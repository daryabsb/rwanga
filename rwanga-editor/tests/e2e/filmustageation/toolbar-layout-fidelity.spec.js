// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Filmustageation F1A.6A — toolbar layout fidelity regression.
//
// F1A.6 migrated the Scene group out of the static toolbar HTML into
// a plugin-registered contribution mounted inside a `.rga-shell-
// toolbar-content-slot` wrapper. The wrapper became a flex child of
// the inner band — its children (the plugin separator + scene group)
// stacked vertically INSIDE the slot's block layout instead of
// flowing as siblings of text-group and writing-group in the inner
// band's flex line.
//
// F1A.6A applies `display: contents` to the slot. The slot is removed
// from the layout box tree; its children are promoted to be direct
// layout children of `.rga-shell-toolbar-inner`. The flex flow
// becomes the pre-F1A.6 sequence again:
//
//   text-group → plugin-sep → scene-group → static-sep → writing-group
//     → static-sep → mode-group
//
// This spec is the runtime guard that the fix holds:
//   - the slot is display: contents
//   - the Scene group reaches its expected horizontal width (NOT
//     collapsed to a narrow vertical stack inside the slot)
//   - the Scene group's controls (select + button) render side-by-side
//     on the toolbar row
//   - the toolbar row height stays at the design 36px (no vertical
//     stacking)
//   - the four toolbar groups flow left-to-right without overlap
//   - top edges align (a single horizontal line)
//
// Scope note: separator computed widths in this toolbar can shrink
// to 0 under flex pressure (a pre-existing behavior present on
// baseline F1A.6 — verified via git stash). That is NOT what F1A.6A
// fixes; this spec asserts the geometric layout of GROUPS, which is
// what the user reported as broken.
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os   = require('os');
const fs   = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');

async function launchApp() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1a-6a-toolbar-layout-'));
  const app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector(
    '#rga-shell-toolbar [data-toolbar-group-id="scene"]',
    { timeout: 5000 });
  return { app, page, userDataDir };
}

async function teardown(app, userDataDir) {
  try { await app.close(); } catch (_) {}
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
}

// =================================================================
// 1. The fix itself — slot resolves to display: contents.
// =================================================================

test('F1A.6A — .rga-shell-toolbar-content-slot resolves to display: contents', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const display = await page.evaluate(() => {
      const slot = document.querySelector('.rga-shell-toolbar-content-slot');
      return slot ? getComputedStyle(slot).display : null;
    });
    expect(display).toBe('contents');
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 2. All toolbar groups sit on a single horizontal line (top edges
//    aligned). Pre-fix the Scene group stacked vertically inside the
//    slot, so its top edge sat noticeably below text/writing/mode.
// =================================================================

test('F1A.6A — every toolbar group renders on a single horizontal line (vertical centers aligned)', async () => {
  // F1A.7 (2026-05-29) note: the tolerance widened from ±1px (top
  // edges) to ±2px on vertical centers. The toolbar's inner band uses
  // `align-items: center`, so when groups have different intrinsic
  // heights (e.g., the F1A.7 Tag group is just a native <select>,
  // taller-text groups have buttons that lift the group's bbox), top
  // edges legitimately differ by a few pixels even though the
  // controls visually center on the same line. The right invariant
  // is "centers aligned," which is what `align-items: center` actually
  // guarantees.
  const { app, page, userDataDir } = await launchApp();
  try {
    const rects = await page.evaluate(() => {
      const groups = Array.from(document.querySelectorAll(
        '#rga-shell-toolbar .rga-shell-toolbar-group'));
      return groups.map((el) => {
        const r = el.getBoundingClientRect();
        return {
          dataGroup: el.getAttribute('data-group'),
          x:      Math.round(r.x),
          y:      Math.round(r.y),
          width:  Math.round(r.width),
          height: Math.round(r.height),
          cy:     Math.round(r.y + r.height / 2)
        };
      });
    });
    expect(rects.length).toBeGreaterThan(0);
    const firstCy = rects[0].cy;
    rects.forEach((r) => {
      expect(Math.abs(r.cy - firstCy)).toBeLessThanOrEqual(2);
      expect(r.width).toBeGreaterThan(0);
      expect(r.height).toBeGreaterThan(0);
    });
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 3. Groups appear in left-to-right order and do not overlap.
// =================================================================

test('F1A.6A — toolbar groups flow left-to-right without overlap', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const rects = await page.evaluate(() => {
      const groups = Array.from(document.querySelectorAll(
        '#rga-shell-toolbar .rga-shell-toolbar-group'));
      return groups.map((el) => ({
        dataGroup: el.getAttribute('data-group'),
        x:     el.getBoundingClientRect().x,
        right: el.getBoundingClientRect().right
      }));
    });
    // F1A.7 (2026-05-29): expected sequence grew to include the 'tag'
    // group (between 'scene' at order 200 and the static 'writing'
    // group). The L→R + no-overlap invariant still holds.
    expect(rects.map((r) => r.dataGroup))
      .toEqual(['text', 'scene', 'tag', 'writing', 'mode']);
    for (let i = 1; i < rects.length; i += 1) {
      const prev = rects[i - 1];
      const cur  = rects[i];
      expect(cur.x).toBeGreaterThanOrEqual(prev.right - 0.5);
    }
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 4. The plugin-inserted leading separator sits BETWEEN text and scene
//    in the DOM tree (the layout-effective sequence).
// =================================================================

test('F1A.6A — Scene group has a leading separator between it and the text group', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const result = await page.evaluate(() => {
      const innerKids = Array.from(document.querySelectorAll(
        '#rga-shell-toolbar .rga-shell-toolbar-inner > *, ' +
        '#rga-shell-toolbar .rga-shell-toolbar-content-slot > *'
      )).filter((el) => !el.classList.contains('rga-shell-toolbar-content-slot'));
      const idx = (selector) => innerKids.findIndex(
        (el) => el.matches(selector));
      return {
        textIdx:  idx('[data-group="text"]'),
        sceneIdx: idx('[data-group="scene"]'),
        sepBetween: innerKids.some((el, i) =>
          el.classList.contains('rga-shell-toolbar-group-sep') &&
          i > idx('[data-group="text"]') &&
          i < idx('[data-group="scene"]'))
      };
    });
    expect(result.textIdx).toBeGreaterThanOrEqual(0);
    expect(result.sceneIdx).toBeGreaterThan(result.textIdx);
    expect(result.sepBetween).toBe(true);
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 5. The Scene group has a meaningful horizontal width (NOT collapsed
//    inside the slot block). Pre-fix the Scene group stacked
//    vertically inside the wrapper and its width was just the width of
//    the widest child (~the +Scene button). Post-fix it sits on the
//    toolbar row with its select + sep + button laid out inline, so
//    the group is substantially wider.
// =================================================================

test('F1A.6A — Scene group has a meaningful horizontal width on the toolbar row', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const sceneRect = await page.evaluate(() => {
      const group = document.querySelector('[data-toolbar-group-id="scene"]');
      const r = group.getBoundingClientRect();
      return {
        x:      Math.round(r.x),
        y:      Math.round(r.y),
        width:  Math.round(r.width),
        height: Math.round(r.height)
      };
    });
    // The Scene group contains a 6-option select + 1px sep + "+ Scene"
    // text button. Inline it occupies > 100px easily; pre-fix it
    // collapsed to the button width (~70px) and stacked vertically
    // (height grew to ~60px+). Post-fix: width > 100, height ≤ 32.
    expect(sceneRect.width).toBeGreaterThan(100);
    expect(sceneRect.height).toBeLessThanOrEqual(34);
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 6. The Scene group's controls (select + button) render inline.
// =================================================================

test('F1A.6A — Scene group select + Insert Scene button render inline on the toolbar row', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const sceneGeom = await page.evaluate(() => {
      const group = document.querySelector('[data-toolbar-group-id="scene"]');
      const select = group.querySelector('select.rga-shell-toolbar-blocktype');
      const btn = group.querySelector('button[data-command="scene.insert"]');
      const gRect = group.getBoundingClientRect();
      const sRect = select.getBoundingClientRect();
      const bRect = btn.getBoundingClientRect();
      return {
        groupY:  Math.round(gRect.y),
        selectY: Math.round(sRect.y),
        btnY:    Math.round(bRect.y),
        groupHeight: Math.round(gRect.height),
        selectWidth: Math.round(sRect.width),
        btnWidth:    Math.round(bRect.width),
        selectRight: Math.round(sRect.right),
        btnX:        Math.round(bRect.x)
      };
    });
    // Select + button share approximately the same baseline as their group.
    expect(Math.abs(sceneGeom.selectY - sceneGeom.groupY)).toBeLessThanOrEqual(8);
    expect(Math.abs(sceneGeom.btnY - sceneGeom.groupY)).toBeLessThanOrEqual(8);
    // Both controls have non-zero width (not clipped to 0).
    expect(sceneGeom.selectWidth).toBeGreaterThan(0);
    expect(sceneGeom.btnWidth).toBeGreaterThan(0);
    // Button sits to the right of the select (inline, not stacked).
    expect(sceneGeom.btnX).toBeGreaterThanOrEqual(sceneGeom.selectRight - 1);
    // Group height is in the toolbar row's ballpark.
    expect(sceneGeom.groupHeight).toBeLessThanOrEqual(34);
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 7. Toolbar row height stays at the 36px row geometry — no vertical
//    growth from misplaced content stacking. Pre-fix the inner band's
//    height could grow because the slot wrapper held vertically-
//    stacked content; post-fix the row stays at design height.
// =================================================================

test('F1A.6A — toolbar row height stays at the 36px design geometry (no vertical stacking)', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const heights = await page.evaluate(() => {
      const tb = document.getElementById('rga-shell-toolbar');
      const inner = tb.querySelector('.rga-shell-toolbar-inner');
      return {
        toolbar: Math.round(tb.getBoundingClientRect().height),
        inner:   Math.round(inner.getBoundingClientRect().height)
      };
    });
    // 36px row per the shell.css definition. Subpixel tolerance ±2.
    expect(Math.abs(heights.toolbar - 36)).toBeLessThanOrEqual(2);
    expect(Math.abs(heights.inner - 36)).toBeLessThanOrEqual(2);
  } finally {
    await teardown(app, userDataDir);
  }
});
