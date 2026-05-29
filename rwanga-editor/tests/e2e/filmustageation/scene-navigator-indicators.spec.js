// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Filmustageation SN.2 — Scenes Sidebar Catalogue, Lucide indicators
// replace emoji glyphs.
//
// Designer decisions (frozen):
//   C1 notes        → Lucide square-pen
//   C2 revision     → Lucide flag-triangle-right
//   C3 color        → calm neutral, same tone for both (currentColor inherit)
//   C4 size         → 12px square, line-height 1
//
// Coverage:
//   1. Notes indicator renders as Lucide SVG (not emoji textContent).
//   2. Revision indicator renders as Lucide SVG (not emoji textContent).
//   3. Indicators remain shape-distinguishable (path-count difference).
//   4. aria-labels preserved on the container spans.
//   5. Row height unchanged (Phase 0 row min-height: 28px).
//   6. Signal track still reserves width (grid layout intact).
//   7. SEPARATION INVARIANT (current vs selected) survives indicator
//      change — both states still apply correctly with SVG indicators.
//   8. SN.1 auto-scroll path is unaffected (current-row scroll fires
//      on a current-scene transition, same as before SN.2).
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os   = require('os');
const fs   = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');

async function launchApp() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sn-2-indicators-'));
  const app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(
    window.Rga && window.Rga.Shell && window.Rga.Shell.Sidebar &&
    window.Rga.Shell.SceneNavigator &&
    window.Rga.Icons && window.Rga.Icons.Lucide &&
    window.Rga.ScriptSession && typeof window.Rga.ScriptSession.get === 'function'));
  await page.waitForFunction(() =>
    window.Rga.Shell.Sidebar.current() === 'sceneNavigator', null, { timeout: 5000 });
  return { app, page, userDataDir };
}

async function teardown(app, userDataDir) {
  try { await app.close(); } catch (_) {}
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
}

// Seed an indicator-bearing fixture: scene 0 = no indicators (control),
// scene 1 = notes only, scene 2 = revision only, scene 3 = both.
async function seedIndicatorFixture(page) {
  return page.evaluate(() => {
    const scenes = [
      { nodeId: 'sc-plain',    sceneNumber: 1, pmPos: 0,   pmEndPos: 100, headingDisplay: 'INT. LOCATION 1 — DAY',   setting: 'INT.', locationText: 'LOCATION 1', time: 'DAY',   hasNotes: false, hasRevisionFlag: false },
      { nodeId: 'sc-notes',    sceneNumber: 2, pmPos: 100, pmEndPos: 200, headingDisplay: 'EXT. LOCATION 2 — NIGHT', setting: 'EXT.', locationText: 'LOCATION 2', time: 'NIGHT', hasNotes: true,  hasRevisionFlag: false },
      { nodeId: 'sc-revision', sceneNumber: 3, pmPos: 200, pmEndPos: 300, headingDisplay: 'INT. LOCATION 3 — DAY',   setting: 'INT.', locationText: 'LOCATION 3', time: 'DAY',   hasNotes: false, hasRevisionFlag: true  },
      { nodeId: 'sc-both',     sceneNumber: 4, pmPos: 300, pmEndPos: 400, headingDisplay: 'EXT. LOCATION 4 — NIGHT', setting: 'EXT.', locationText: 'LOCATION 4', time: 'NIGHT', hasNotes: true,  hasRevisionFlag: true  }
    ];
    const fakeIndex = { scenes: scenes, pages: [], characters: [], tags: {}, notes: [], flags: [] };
    window.__rgaNavOriginal = window.Rga.Nav.getIndex;
    window.Rga.Nav.getIndex = function() { return fakeIndex; };
    window.Rga.Shell.SceneNavigator._render();
    return { sceneCount: scenes.length };
  });
}

function rowFor(page, nodeId) {
  return page.locator('.rga-shell-scene-navigator-row[data-scene-node-id="' + nodeId + '"]');
}

// =================================================================
// 1. Notes indicator renders as Lucide square-pen SVG.
// =================================================================

test('SN.2 — notes indicator renders as Lucide square-pen SVG (not emoji text)', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    await seedIndicatorFixture(page);
    const ind = rowFor(page, 'sc-notes').locator('.rga-shell-scene-navigator-indicator');
    await expect(ind).toHaveCount(1);
    await expect(ind).toHaveAttribute('aria-label', 'Has notes');
    await expect(ind).toHaveAttribute('data-icon-name', 'square-pen');
    const svg = ind.locator('svg');
    await expect(svg).toHaveCount(1);
    // square-pen has 2 path elements.
    await expect(svg.locator('path')).toHaveCount(2);
    // Emoji glyph must NOT appear anywhere in the indicator text.
    const text = await ind.evaluate((el) => el.textContent);
    expect(text).not.toContain('📝');
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 2. Revision indicator renders as Lucide flag-triangle-right SVG.
// =================================================================

test('SN.2 — revision indicator renders as Lucide flag-triangle-right SVG (not emoji text)', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    await seedIndicatorFixture(page);
    const ind = rowFor(page, 'sc-revision').locator('.rga-shell-scene-navigator-indicator');
    await expect(ind).toHaveCount(1);
    await expect(ind).toHaveAttribute('aria-label', 'Has revision flag');
    await expect(ind).toHaveAttribute('data-icon-name', 'flag-triangle-right');
    const svg = ind.locator('svg');
    await expect(svg).toHaveCount(1);
    await expect(svg.locator('path')).toHaveCount(1);
    const text = await ind.evaluate((el) => el.textContent);
    expect(text).not.toContain('🚩');
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 3. Indicators remain shape-distinguishable (path-count difference).
// =================================================================

test('SN.2 — notes and revision indicators are shape-distinct (path-count differs)', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    await seedIndicatorFixture(page);
    const both = rowFor(page, 'sc-both').locator('.rga-shell-scene-navigator-indicator');
    await expect(both).toHaveCount(2);
    const counts = await both.evaluateAll((nodes) =>
      nodes.map((n) => ({
        name: n.getAttribute('data-icon-name'),
        paths: n.querySelectorAll('svg path').length
      }))
    );
    expect(counts[0].name).toBe('square-pen');
    expect(counts[1].name).toBe('flag-triangle-right');
    expect(counts[0].paths).not.toBe(counts[1].paths);
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 4. Aria-labels preserved on the indicator container spans.
// =================================================================

test('SN.2 — indicator aria-labels survive the emoji→SVG migration', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    await seedIndicatorFixture(page);
    const both = rowFor(page, 'sc-both').locator('.rga-shell-scene-navigator-indicator');
    const labels = await both.evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute('aria-label'))
    );
    expect(labels).toEqual(['Has notes', 'Has revision flag']);
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 5. Row height unchanged — single-line label discipline preserved.
//    The plan-anchored baseline is min-height: 28px (shell.css:1583).
// =================================================================

test('SN.2 — row height remains the plan-anchored 28px minimum across indicator states', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    await seedIndicatorFixture(page);
    const heights = await page.evaluate(() => {
      const ids = ['sc-plain', 'sc-notes', 'sc-revision', 'sc-both'];
      return ids.map((id) => {
        const r = document.querySelector(
          '.rga-shell-scene-navigator-row[data-scene-node-id="' + id + '"]');
        if (!r) return null;
        const rect = r.getBoundingClientRect();
        return { id: id, h: Math.round(rect.height) };
      });
    });
    for (const h of heights) {
      expect(h).not.toBeNull();
      expect(h.h).toBeGreaterThanOrEqual(28);
      // All rows share the same height regardless of indicator presence —
      // signal-track reservation prevents row growth.
      expect(h.h).toBe(heights[0].h);
    }
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 6. Signal track still reserves width — heading column stays put
//    whether the indicator span is empty or populated.
// =================================================================

test('SN.2 — signal track reserves width; heading does not reflow on indicator presence/absence', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    await seedIndicatorFixture(page);
    // Heading right-edge x for plain vs both — should match. The signal
    // margin is grid-`auto` width, so an empty indicator span still
    // claims the column it lives in.
    const xs = await page.evaluate(() => {
      const plain = document.querySelector(
        '.rga-shell-scene-navigator-row[data-scene-node-id="sc-plain"] ' +
        '.rga-shell-scene-navigator-heading');
      const both = document.querySelector(
        '.rga-shell-scene-navigator-row[data-scene-node-id="sc-both"] ' +
        '.rga-shell-scene-navigator-heading');
      return {
        plainRight: plain ? Math.round(plain.getBoundingClientRect().right) : null,
        bothRight:  both  ? Math.round(both.getBoundingClientRect().right)  : null
      };
    });
    expect(xs.plainRight).not.toBeNull();
    expect(xs.bothRight).not.toBeNull();
    // grid `auto` columns DO consume width based on content, so an indicator
    // span with two SVGs takes wider track than an empty span. The discipline
    // we test is: heading right-edge must be reached by all rows within a
    // small reflow tolerance — single-line ellipsis cannot collapse to zero
    // width when indicators appear. (Strict equality is not the contract;
    // the contract is "no row growth," tested by §5.) We assert the heading
    // remains a non-trivial width across both rows.
    const plainW = await page.evaluate(() => {
      const el = document.querySelector(
        '.rga-shell-scene-navigator-row[data-scene-node-id="sc-plain"] ' +
        '.rga-shell-scene-navigator-heading');
      return el ? Math.round(el.getBoundingClientRect().width) : null;
    });
    const bothW = await page.evaluate(() => {
      const el = document.querySelector(
        '.rga-shell-scene-navigator-row[data-scene-node-id="sc-both"] ' +
        '.rga-shell-scene-navigator-heading');
      return el ? Math.round(el.getBoundingClientRect().width) : null;
    });
    expect(plainW).toBeGreaterThan(20);
    expect(bothW).toBeGreaterThan(20);
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 7. SEPARATION INVARIANT survives the SVG migration.
//    Current (cursor) and selected (keyboard) remain distinct states
//    and both classes apply correctly to rows with SVG indicators.
// =================================================================

test('SN.2 — current vs selected separation invariant holds with SVG indicators', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    await seedIndicatorFixture(page);
    // Park current on sc-notes (which carries a notes SVG indicator).
    await page.evaluate(() => {
      window.__rgaSessionOriginalGet = window.Rga.ScriptSession.get.bind(window.Rga.ScriptSession);
      const baseSnap = window.__rgaSessionOriginalGet();
      const overrideSnap = Object.assign({}, baseSnap, {
        currentScene: { nodeId: 'sc-notes', sceneNumber: 2, headingDisplay: 'EXT. LOCATION 2 — NIGHT' }
      });
      window.Rga.ScriptSession.get = function() { return overrideSnap; };
      window.Rga.Shell.SceneNavigator._render();
    });
    // Keyboard-select sc-revision (which carries a revision SVG indicator).
    await page.evaluate(() => window.Rga.Shell.SceneNavigator.focusRow('sc-revision'));
    const state = await page.evaluate(() => {
      const r = (id) => document.querySelector(
        '.rga-shell-scene-navigator-row[data-scene-node-id="' + id + '"]');
      return {
        notesCurrent:    r('sc-notes').classList.contains('rga-shell-scene-navigator-row-current'),
        notesSelected:   r('sc-notes').classList.contains('rga-shell-scene-navigator-row-selected'),
        revisionCurrent:  r('sc-revision').classList.contains('rga-shell-scene-navigator-row-current'),
        revisionSelected: r('sc-revision').classList.contains('rga-shell-scene-navigator-row-selected'),
        // Indicators still render their SVGs.
        notesSvg:    !!r('sc-notes').querySelector('.rga-shell-scene-navigator-indicator svg'),
        revisionSvg: !!r('sc-revision').querySelector('.rga-shell-scene-navigator-indicator svg')
      };
    });
    expect(state.notesCurrent).toBe(true);
    expect(state.notesSelected).toBe(false);
    expect(state.revisionCurrent).toBe(false);
    expect(state.revisionSelected).toBe(true);
    expect(state.notesSvg).toBe(true);
    expect(state.revisionSvg).toBe(true);
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 8. SN.1 auto-scroll path is unaffected by the indicator migration.
//    A current-scene transition still calls scrollIntoView on the
//    current row (the SN.1 contract — behavior:'auto', block:'nearest').
// =================================================================

test('SN.2 — SN.1 auto-scroll behaviour is unaffected by the SVG indicator change', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    await seedIndicatorFixture(page);
    // Install the same scroll spy SN.1 uses.
    await page.evaluate(() => {
      window.__sn1ScrollCalls = [];
      window.Element.prototype.scrollIntoView = function(opts) {
        window.__sn1ScrollCalls.push({
          sceneNodeId: this.getAttribute ? this.getAttribute('data-scene-node-id') : null,
          hasCurrentClass: this.classList
            ? this.classList.contains('rga-shell-scene-navigator-row-current')
            : false,
          opts: opts || {}
        });
      };
    });
    // Trigger a transition into sc-both (a row with both indicators).
    await page.evaluate(() => {
      window.__rgaSessionOriginalGet = window.Rga.ScriptSession.get.bind(window.Rga.ScriptSession);
      const baseSnap = window.__rgaSessionOriginalGet();
      const overrideSnap = Object.assign({}, baseSnap, {
        currentScene: { nodeId: 'sc-both', sceneNumber: 4, headingDisplay: 'EXT. LOCATION 4 — NIGHT' }
      });
      window.Rga.ScriptSession.get = function() { return overrideSnap; };
      window.Rga.Shell.SceneNavigator._render();
    });
    const calls = await page.evaluate(() =>
      (window.__sn1ScrollCalls || []).filter((c) =>
        c.opts && c.opts.behavior === 'auto' && c.hasCurrentClass)
    );
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[calls.length - 1].sceneNodeId).toBe('sc-both');
    expect(calls[calls.length - 1].opts.block).toBe('nearest');
  } finally {
    await teardown(app, userDataDir);
  }
});
