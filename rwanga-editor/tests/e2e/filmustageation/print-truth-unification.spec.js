// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Print Truth Unification V1 — end-to-end in the real Electron app.
//
// Proves, through the live renderer + cascade (the ground truth), that the
// document's owned print truth now reaches Print Preview / PDF:
//   C — header/footer banner text renders with {{tokens}} resolved.
//   E — SCENE ## appears in the printed slug when numbering is on, gone when off.
//   D — mark visibility (highlights on by default; tags/notes/flags off, toggleable).
//   B — direction-aware leading reaches the sheet (LTR 1.0 / RTL 1.3) from the
//       same source that feeds pagination; both renderers consume one contract.
//   Persistence — header/footer/marks survive save → reopen byte-identically.
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
  await page.waitForFunction(() => !!(
    window.Rga && window.Rga.PrintContract && window.Rga.PrintPreview &&
    window.Rga.ManuscriptGeometry && window.Rga.TabManager &&
    typeof window.Rga.PrintPreview.open === 'function'));
  await page.waitForFunction(() => !!window.Rga.TabManager.activeDoc());
  return { app, page };
}

async function clearDirtyAndClose(app, page) {
  try {
    await page.evaluate(() => {
      const d = window.Rga.TabManager.activeDoc();
      if (d) { if (window.Rga.Doc && window.Rga.Doc.clearDirty) window.Rga.Doc.clearDirty(d); else d.dirty = false; }
      if (window.Rga.PrintPreview.isActive()) window.Rga.PrintPreview.hide();
    });
  } catch (_) {}
  await app.close();
}

// -----------------------------------------------------------------
// C — header / footer banners render contract text with tokens resolved.
// -----------------------------------------------------------------
test('PTU-C — header/footer banners render with {{tokens}} resolved in Print Preview', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ptu-hf-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    const obs = await page.evaluate(() => {
      const doc = window.Rga.TabManager.activeDoc();
      doc.metadata.title = 'NIGHT RUNNER';
      doc.settings.pageSetup.headerText = '{{title}} — p{{page}}/{{pages}}';
      doc.settings.pageSetup.footerText = '© {{title}}';
      window.Rga.PrintPreview.open();
      const root = document.getElementById('rga-print-preview-root');
      const header = root.querySelector('.rga-page-sheet-running-header');
      const footer = root.querySelector('.rga-page-sheet-footer-banner');
      return { header: header && header.textContent, footer: footer && footer.textContent };
    });
    expect(obs.header).toMatch(/^NIGHT RUNNER — p1\/\d+$/);   // title + page/pages resolved
    expect(obs.footer).toBe('© NIGHT RUNNER');
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// E — SCENE ## in the printed slug, gated by the (unified) numbering toggle.
// -----------------------------------------------------------------
test('PTU-E — scene numbers appear in the printed slug and respect the toggle', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ptu-scene-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    const withNumbers = await page.evaluate(() => {
      const doc = window.Rga.TabManager.activeDoc();
      doc.settings.show_scene_numbers = true;
      if (doc.settings.screenplay) delete doc.settings.screenplay.sceneNumbering;
      window.Rga.PrintPreview.open();
      const root = document.getElementById('rga-print-preview-root');
      return {
        headings: root.querySelectorAll('.rga-print-block-sceneHeading').length,
        markers:  root.querySelectorAll('.rga-print-scene-number').length
      };
    });
    // Sample script has scene headings; with numbering on, each gets a marker.
    expect(withNumbers.headings).toBeGreaterThan(0);
    expect(withNumbers.markers).toBe(withNumbers.headings);

    const off = await page.evaluate(() => {
      const doc = window.Rga.TabManager.activeDoc();
      // Drive the unified home (nested screenplay.sceneNumbering) the UI writes.
      doc.settings.screenplay = doc.settings.screenplay || {};
      doc.settings.screenplay.sceneNumbering = false;
      window.Rga.PrintPreview.refresh();
      const root = document.getElementById('rga-print-preview-root');
      return root.querySelectorAll('.rga-print-scene-number').length;
    });
    expect(off).toBe(0);   // nested UI home overrides → no markers
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// D — mark visibility is document-owned; defaults honor the doctrine.
// -----------------------------------------------------------------
test('PTU-D — mark visibility defaults + document-level toggle reach the contract', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ptu-marks-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    const def = await page.evaluate(() => {
      const doc = window.Rga.TabManager.activeDoc();
      return window.Rga.PrintContract.resolve(doc).marks;
    });
    expect(def).toEqual({ tags: false, notes: false, flags: false, highlights: true });

    const toggled = await page.evaluate(() => {
      const doc = window.Rga.TabManager.activeDoc();
      doc.settings.pageSetup.showTags = true;
      doc.settings.pageSetup.showHighlights = false;
      const c = window.Rga.PrintContract.resolve(doc);
      // Renderer consumes it via the layoutProfile contract.
      const layout = window.Rga.ManuscriptGeometry.resolve(doc);
      return { marks: c.marks, layoutMarks: layout.printContract.marks };
    });
    expect(toggled.marks).toEqual({ tags: true, notes: false, flags: false, highlights: false });
    expect(toggled.layoutMarks).toEqual(toggled.marks);   // one source, both agree
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// B — direction-aware leading from ONE source reaches the sheet + pagination.
// -----------------------------------------------------------------
test('PTU-B — sheet leading is LTR 1.0 / RTL 1.3 from the single resolved source', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ptu-lead-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    const obs = await page.evaluate(() => {
      const doc = window.Rga.TabManager.activeDoc();
      // LTR
      doc.metadata.screenplayProfile.direction = 'ltr';
      const ltrLeading = window.Rga.ManuscriptGeometry.resolve(doc).font.leading;
      window.Rga.PrintPreview.open();
      let root = document.getElementById('rga-print-preview-root');
      const ltrSheetLH = root.querySelector('.rga-page-sheet').style.lineHeight;
      const ltrLpp = window.Rga.ManuscriptGeometry.resolve(doc).linesPerPage;
      window.Rga.PrintPreview.hide();
      // RTL
      doc.metadata.screenplayProfile.direction = 'rtl';
      const rtlProfile = window.Rga.ManuscriptGeometry.resolve(doc);
      window.Rga.PrintPreview.open();
      root = document.getElementById('rga-print-preview-root');
      const rtlSheetLH = root.querySelector('.rga-page-sheet').style.lineHeight;
      return {
        ltrLeading, ltrSheetLH, ltrLpp,
        rtlLeading: rtlProfile.font.leading, rtlSheetLH, rtlLpp: rtlProfile.linesPerPage
      };
    });
    expect(obs.ltrLeading).toBe(1);
    expect(obs.ltrSheetLH).toBe('1');
    expect(obs.rtlLeading).toBe(1.3);
    expect(obs.rtlSheetLH).toBe('1.3');
    // Pagination follows the relaxed RTL leading honestly (fewer lines/page).
    expect(obs.rtlLpp).toBeLessThan(obs.ltrLpp);
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// Persistence — header/footer/marks/scene-home survive save → reopen.
// -----------------------------------------------------------------
test('PTU — header/footer/marks survive save → reopen byte-identically', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ptu-rt-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    const result = await page.evaluate(() => {
      const doc = window.Rga.TabManager.activeDoc();
      doc.settings.pageSetup.headerText = '{{title}} {{date}}';
      doc.settings.pageSetup.footerText = 'CONFIDENTIAL';
      doc.settings.pageSetup.showNotes = true;
      doc.settings.pageSetup.showHighlights = false;
      doc.settings.screenplay = { sceneNumbering: false };
      const before = window.Rga.PrintContract.resolve(doc);
      const str = window.Rga.Doc.serialize(doc);
      const re = window.Rga.Doc.deserialize(str, '/reopened.rga');
      const after = window.Rga.PrintContract.resolve(re);
      return { before, after };
    });
    expect(result.after.header).toEqual(result.before.header);
    expect(result.after.footer).toEqual(result.before.footer);
    expect(result.after.marks).toEqual(result.before.marks);
    expect(result.after.sceneNumbering).toEqual(result.before.sceneNumbering);
    // The distinctive values actually took effect.
    expect(result.before.header.text).toBe('{{title}} {{date}}');
    expect(result.before.marks).toEqual({ tags: false, notes: true, flags: false, highlights: false });
    expect(result.before.sceneNumbering.enabled).toBe(false);
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// D2 — the Print Preview Marks control: present, seeded, per-review toggle.
// -----------------------------------------------------------------
test('PTU-D2 — Print Preview Marks control is present, seeded from the doc, and toggles per-review', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ptu-marksui-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    const obs = await page.evaluate(() => {
      window.Rga.PrintPreview.open();
      const bar = document.getElementById('rga-print-preview-review-bar') || document.querySelector('.rga-review-bar');
      const btn = document.querySelector('.rga-review-marks-btn');
      const cb = (k) => document.querySelector('.rga-review-marks-cb[data-mark="' + k + '"]');
      // Open the popover (seeds the checkboxes from the document default).
      btn.click();
      const seeded = {
        highlights: cb('highlights').checked, notes: cb('notes').checked,
        flags: cb('flags').checked, tags: cb('tags').checked
      };
      // Turn TAGS on for this review (checkbox change).
      const tagsCb = cb('tags');
      tagsCb.checked = true;
      tagsCb.dispatchEvent(new Event('change', { bubbles: true }));
      const doc = window.Rga.TabManager.activeDoc();
      // Prove a tag mark would now be visibly decorated (CSS is loaded).
      const root = document.getElementById('rga-print-preview-root');
      const probe = document.createElement('span');
      probe.className = 'rga-print-mark-tag'; probe.textContent = 'x';
      root.appendChild(probe);
      const border = getComputedStyle(probe).borderBottomStyle;
      probe.remove();
      return {
        hasBar: !!bar, hasBtn: !!btn, seeded,
        optMarksTags: window.Rga.PrintPreview.getOptions().marks.tags,
        persistedShowTags: doc.settings.pageSetup.showTags === true,  // must remain false (per-review)
        tagBorderStyle: border
      };
    });
    expect(obs.hasBar).toBe(true);
    expect(obs.hasBtn).toBe(true);
    // Seeded from the doctrine default: highlights on; the rest off.
    expect(obs.seeded).toEqual({ highlights: true, notes: false, flags: false, tags: false });
    // The toggle drives the renderer override but does NOT persist to the .rga.
    expect(obs.optMarksTags).toBe(true);
    expect(obs.persistedShowTags).toBe(false);
    // An enabled tag is visibly decorated (dotted underline) — not invisible.
    expect(obs.tagBorderStyle).toBe('dotted');
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// D3 — the marks override is per-review: closing + reopening Preview
//      follows the document default again (Settings owns persistence).
// -----------------------------------------------------------------
test('PTU-D3 — marks override resets on exit; Settings default persists', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ptu-marksreset-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    const obs = await page.evaluate(() => {
      window.Rga.PrintPreview.open();
      window.Rga.PrintPreview.setMarkVisibility('tags', true);   // per-review override
      const afterToggle = window.Rga.PrintPreview.getOptions().marks.tags;
      window.Rga.PrintPreview.hide();
      const afterHide = window.Rga.PrintPreview.getOptions().marks;  // override cleared
      // The persistent default still says tags off.
      const doc = window.Rga.TabManager.activeDoc();
      const contractTags = window.Rga.PrintContract.resolve(doc).marks.tags;
      return { afterToggle, afterHideHasMarks: !!afterHide, contractTags };
    });
    expect(obs.afterToggle).toBe(true);
    expect(obs.afterHideHasMarks).toBe(false);   // override gone after exit
    expect(obs.contractTags).toBe(false);        // document default unchanged
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});
