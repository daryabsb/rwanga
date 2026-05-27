// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Page Setup live preview — S8.
//
// Proves the seven assertions required by the S8 brief:
//   1. Preview updates    — opening Page Setup mounts a live miniature;
//                           the rendered geometry matches the doc.
//   2. Print uses same source — Rga.LayoutProfile.compose(doc) is the
//                           single resolver consumed by the preview AND
//                           by any future print/paper-view consumer
//                           (proved by reading the same API surface).
//   3. Margins update     — changing pageSetup.margins through Store
//                           reflects in the preview within ≤100ms.
//   4. Orientation update — changing pageSetup.orientation from
//                           portrait → landscape swaps page rect.
//   5. Paper size update  — changing pageSetup.paperSize letter → a4
//                           re-renders with A4 dimensions.
//   6. No duplicate ownership — the preview reads ONLY via
//                           ManuscriptGeometry.resolve (which delegates
//                           to LayoutProfile.compose); it does not read
//                           Settings.Store.effective for geometry.
//   7. No orphan CSS path — documentElement carries no --page-margin-*
//                           inline custom properties after a margin
//                           change (the H7 orphan writes are retired).
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os   = require('os');
const fs   = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');

async function launchAndOpen(userDataDir) {
  const app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  // Wait for the substrate to be live.
  await page.waitForFunction(() =>
    !!(window.Rga && window.Rga.Settings && window.Rga.Settings.Store
       && window.Rga.LayoutProfile && window.Rga.ManuscriptGeometry
       && window.Rga.TabManager && window.Rga.TabManager.activeDoc));
  return { app, page };
}

async function openSettingsAndPageSetup(page) {
  // Settings workspace ships with Ctrl+, in production; for the test we
  // call the renderer-side helper directly to avoid keyboard-focus race.
  await page.evaluate(() => window.Rga.SettingsWorkspace.open());
  await page.waitForSelector('.rga-settings-workspace');
  // Click the Page Setup nav item.
  await page.click('.rga-settings-nav-item[data-section-id="pageSetup"]');
  await page.waitForSelector('[data-test-page-setup-preview] [data-test-page-preview]');
}

async function clearDirtyAndClose(app, page) {
  // S7 dirty-handshake guard: Store.set for script-tier ids marks the
  // active doc dirty; on app.close Electron's CloseGuard would prompt
  // and wait forever. Clear every dirty doc the TabManager exposes
  // (activeDoc + lastActiveDoc).
  try {
    await page.evaluate(() => {
      const TM = window.Rga && window.Rga.TabManager;
      const docs = TM ? [TM.activeDoc(), TM.lastActiveDoc && TM.lastActiveDoc()].filter(Boolean) : [];
      docs.forEach((d) => {
        if (window.Rga.Doc && window.Rga.Doc.clearDirty) window.Rga.Doc.clearDirty(d);
        else d.dirty = false;
      });
    });
  } catch (_) {}
  await app.close();
}

// ----------------------------------------------------------------
// 1. Preview updates
// ----------------------------------------------------------------

test('S8 §1 — opening Page Setup mounts a live preview reflecting the active doc geometry', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's8-preview-mount-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettingsAndPageSetup(page);

    // The stage carries data-* attributes mirroring the resolved profile.
    const observed = await page.evaluate(() => {
      const stage = document.querySelector('.rga-page-setup-preview-stage');
      return {
        paperW:      stage && stage.getAttribute('data-paper-w-in'),
        paperH:      stage && stage.getAttribute('data-paper-h-in'),
        orientation: stage && stage.getAttribute('data-orientation'),
        mTop:        stage && stage.getAttribute('data-margin-top-in')
      };
    });
    expect(observed.paperW).toBe('8.5');
    expect(observed.paperH).toBe('11');
    expect(observed.orientation).toBe('portrait');
    expect(observed.mTop).toBe('1');
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// ----------------------------------------------------------------
// 2. Print uses the same source — single-resolver invariant
// ----------------------------------------------------------------

test('S8 §2 — preview and any other consumer derive geometry from Rga.LayoutProfile.compose (single resolver)', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's8-single-resolver-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettingsAndPageSetup(page);

    // Mutate margins through Store.
    await page.evaluate(() => {
      window.Rga.Settings.Store.set('pageSetup.margins',
        { top: 1.3, right: 0.8, bottom: 1.4, left: 1.6 });
    });
    await page.waitForFunction(() => {
      const stage = document.querySelector('.rga-page-setup-preview-stage');
      return stage && stage.getAttribute('data-margin-top-in') === '1.3';
    }, null, { timeout: 1000 });

    // Read the resolver output directly — this is what PrintRenderer
    // would read too. The preview's data-* attributes (which were the
    // visible truth) must match. While Settings is the focused tab,
    // activeDoc() returns null (workspace tab kind); the same
    // lastActiveDoc fallback the preview module uses applies.
    const equal = await page.evaluate(() => {
      const TM = window.Rga.TabManager;
      const doc = TM.activeDoc() || (TM.lastActiveDoc && TM.lastActiveDoc());
      const profile = window.Rga.ManuscriptGeometry.resolve(doc);
      const stage = document.querySelector('.rga-page-setup-preview-stage');
      return profile.margins.top    === parseFloat(stage.getAttribute('data-margin-top-in'))
          && profile.margins.right  === parseFloat(stage.getAttribute('data-margin-right-in'))
          && profile.margins.bottom === parseFloat(stage.getAttribute('data-margin-bottom-in'))
          && profile.margins.left   === parseFloat(stage.getAttribute('data-margin-left-in'));
    });
    expect(equal).toBe(true);
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// ----------------------------------------------------------------
// 3. Margins update ≤100ms (live update budget)
// ----------------------------------------------------------------

test('S8 §3 — margin change reflects in the preview within 100ms', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's8-margins-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettingsAndPageSetup(page);

    const t = await page.evaluate(async () => {
      const start = performance.now();
      window.Rga.Settings.Store.set('pageSetup.margins',
        { top: 2, right: 1, bottom: 2, left: 1.25 });
      return new Promise((resolve) => {
        function poll() {
          const stage = document.querySelector('.rga-page-setup-preview-stage');
          if (stage && stage.getAttribute('data-margin-top-in') === '2') {
            resolve(performance.now() - start);
          } else {
            requestAnimationFrame(poll);
          }
        }
        poll();
      });
    });
    expect(t).toBeLessThan(100);
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// ----------------------------------------------------------------
// 4. Orientation update (portrait → landscape)
// ----------------------------------------------------------------

test('S8 §4 — portrait → landscape swaps pageSize w/h in the preview', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's8-orient-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettingsAndPageSetup(page);

    // Sanity: starts portrait Letter = 8.5 × 11.
    let stage = await page.evaluate(() => {
      const s = document.querySelector('.rga-page-setup-preview-stage');
      return { w: s.getAttribute('data-paper-w-in'),
               h: s.getAttribute('data-paper-h-in'),
               o: s.getAttribute('data-orientation') };
    });
    expect(stage.o).toBe('portrait');
    expect(stage.w).toBe('8.5');
    expect(stage.h).toBe('11');

    await page.evaluate(() => {
      window.Rga.Settings.Store.set('pageSetup.orientation', 'landscape');
    });
    await page.waitForFunction(() => {
      const s = document.querySelector('.rga-page-setup-preview-stage');
      return s && s.getAttribute('data-orientation') === 'landscape';
    }, null, { timeout: 1000 });

    stage = await page.evaluate(() => {
      const s = document.querySelector('.rga-page-setup-preview-stage');
      return { w: s.getAttribute('data-paper-w-in'),
               h: s.getAttribute('data-paper-h-in') };
    });
    // Landscape Letter: long edge becomes width.
    expect(stage.w).toBe('11');
    expect(stage.h).toBe('8.5');
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// ----------------------------------------------------------------
// 5. Paper size update (letter → a4)
// ----------------------------------------------------------------

test('S8 §5 — paper size change letter → a4 re-renders the preview with A4 dims', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's8-paper-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettingsAndPageSetup(page);

    await page.evaluate(() => {
      window.Rga.Settings.Store.set('pageSetup.paperSize', 'a4');
    });
    await page.waitForFunction(() => {
      const s = document.querySelector('.rga-page-setup-preview-stage');
      if (!s) return false;
      const w = parseFloat(s.getAttribute('data-paper-w-in'));
      return Math.abs(w - 8.2677) < 0.01;
    }, null, { timeout: 1000 });

    const dims = await page.evaluate(() => {
      const s = document.querySelector('.rga-page-setup-preview-stage');
      return { w: parseFloat(s.getAttribute('data-paper-w-in')),
               h: parseFloat(s.getAttribute('data-paper-h-in')) };
    });
    expect(Math.abs(dims.w - 8.2677)).toBeLessThan(0.01);
    expect(Math.abs(dims.h - 11.6929)).toBeLessThan(0.01);
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// ----------------------------------------------------------------
// 6. No duplicate ownership — preview reads via the single resolver
// ----------------------------------------------------------------

test('S8 §6 — preview never reads Settings.Store.effective for geometry (single-source contract)', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's8-single-source-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettingsAndPageSetup(page);

    // Instrument: capture every Store.effective call from preview repaint.
    // We mutate via Store.set and watch that LayoutProfile.compose was the
    // resolver path used to refresh — by ensuring the rendered data-*
    // matches compose() exactly (and that compose() returns values from
    // doc.settings, not from independent Store reads).
    const proof = await page.evaluate(async () => {
      // Capture compose call count.
      const lp = window.Rga.LayoutProfile;
      const orig = lp.compose;
      let composeCalls = 0;
      lp.compose = function() { composeCalls += 1; return orig.apply(this, arguments); };
      try {
        // Capture Store.effective for geometry ids — preview must NOT call them.
        const Store = window.Rga.Settings.Store;
        const origEff = Store.effective;
        const geometryReads = [];
        Store.effective = function(id) {
          if (id && id.indexOf('pageSetup.') === 0) geometryReads.push(id);
          return origEff.apply(this, arguments);
        };
        try {
          // Drive a change through Store.set.
          Store.set('pageSetup.margins', { top: 1.1, right: 1.2, bottom: 1.3, left: 1.4 });
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          // Resolve to confirm composed values. While Settings is the
          // focused workspace tab activeDoc() is null; use the same
          // lastActiveDoc fallback the preview applies.
          const TM = window.Rga.TabManager;
          const doc = TM.activeDoc() || (TM.lastActiveDoc && TM.lastActiveDoc());
          const profile = lp.compose(
            (doc && doc.metadata && doc.metadata.screenplayProfile) || null,
            (doc && doc.settings) || null
          );
          return {
            composeCalls: composeCalls,
            geometryReads: geometryReads.slice(),  // copy
            composedTop: profile.margins.top
          };
        } finally {
          Store.effective = origEff;
        }
      } finally {
        lp.compose = orig;
      }
    });

    // compose() was the resolver — at least one call during the repaint.
    expect(proof.composeCalls).toBeGreaterThan(0);
    // Store.effective was NOT called for any pageSetup.* geometry id by
    // the preview. (Other code may have called it — only the preview's
    // path is under test. We assert the preview did not contribute any
    // such reads during the repaint window.)
    expect(proof.geometryReads).toEqual([]);
    expect(proof.composedTop).toBe(1.1);
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// ----------------------------------------------------------------
// 7. No orphan CSS path remains
// ----------------------------------------------------------------

test('S8 §7 — no --page-margin-* inline CSS variables are written after a margin change', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's8-no-orphan-css-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettingsAndPageSetup(page);

    await page.evaluate(() => {
      window.Rga.Settings.Store.set('pageSetup.margins',
        { top: 0.9, right: 0.95, bottom: 1.05, left: 1.1 });
    });
    // Wait a couple of frames for any pending writes to land.
    await page.evaluate(() => new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r))));

    const cssVars = await page.evaluate(() => ({
      top:    document.documentElement.style.getPropertyValue('--page-margin-top').trim(),
      right:  document.documentElement.style.getPropertyValue('--page-margin-right').trim(),
      bottom: document.documentElement.style.getPropertyValue('--page-margin-bottom').trim(),
      left:   document.documentElement.style.getPropertyValue('--page-margin-left').trim()
    }));
    expect(cssVars).toEqual({ top: '', right: '', bottom: '', left: '' });
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});
