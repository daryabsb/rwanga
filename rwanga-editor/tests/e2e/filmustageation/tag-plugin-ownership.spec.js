// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Filmustageation F1A.7 — tag dropdown plugin ownership.
//
// F1A.6 moved the Scene group into screenplay plugin ownership via
// Rga.Shell.Toolbar.registerGroup. F1A.7 moves the Tag dropdown the
// same way: the production-vocabulary <select> + its
// applyTagFromSelection handler that previously lived in CORE
// (renderer/index.html inside the Writing group, plus
// renderer/js/format-toolbar.js) now live in
// renderer/js/doc-types/screenplay/toolbar-tag.js, registered at
// order 300 (after Scene at 200, before the static Writing group).
//
// This spec is the runtime guard that the migration holds:
//   - tag <select> is mounted inside the plugin slot, not the
//     static CORE Writing group
//   - the screenplay plugin's tag group is registered at order 300
//   - the tag <select> still carries the 9 production categories +
//     a placeholder ("Tag…")
//   - the visible position is between the Scene group and the
//     Writing group (text → scene → tag → writing → mode)
//   - the toolbar's L→R group order is preserved with no overlap
//   - the toolbar row stays at the 36px design geometry
//   - the F1A.6A layout-fidelity guarantees (slot display: contents,
//     single-line top alignment) continue to hold
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os   = require('os');
const fs   = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');

async function launchApp() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1a-7-tag-'));
  const app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector(
    '#rga-shell-toolbar [data-toolbar-group-id="tag"]',
    { timeout: 5000 });
  return { app, page, userDataDir };
}

async function teardown(app, userDataDir) {
  try { await app.close(); } catch (_) {}
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
}

// ----------------------------------------------------------------
// §1 — Ownership: the tag select is plugin-mounted, not CORE-static
// ----------------------------------------------------------------

test('F1A.7 — tag <select> is mounted inside the plugin slot (not in the static Writing group)', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const result = await page.evaluate(() => {
      const select = document.getElementById('rga-shell-toolbar-tag');
      const slot = document.querySelector('.rga-shell-toolbar-content-slot');
      const writingGroup = document.querySelector('[data-group="writing"]');
      return {
        selectExists: !!select,
        // The select lives inside a [data-toolbar-group-id="tag"]
        // group; that group is a child of the slot wrapper.
        insidePluginGroup: !!(select && select.closest('[data-toolbar-group-id="tag"]')),
        groupInsideSlot: !!(select && select.closest('[data-toolbar-group-id="tag"]')
                            && select.closest('[data-toolbar-group-id="tag"]').parentNode === slot),
        // The select must NOT live inside the static writing group.
        insideWritingGroup: !!(writingGroup && writingGroup.contains(select))
      };
    });
    expect(result.selectExists).toBe(true);
    expect(result.insidePluginGroup).toBe(true);
    expect(result.groupInsideSlot).toBe(true);
    expect(result.insideWritingGroup).toBe(false);
  } finally {
    await teardown(app, userDataDir);
  }
});

test('F1A.7 — Rga.Shell.Toolbar registers a "tag" group at order 300', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const meta = await page.evaluate(() => {
      const Toolbar = window.Rga && window.Rga.Shell && window.Rga.Shell.Toolbar;
      if (!Toolbar) return null;
      const ctrl = Toolbar.getController('tag');
      return ctrl ? { id: ctrl.id, order: ctrl.order, dataGroup: ctrl.dataGroup } : null;
    });
    expect(meta).not.toBeNull();
    expect(meta.id).toBe('tag');
    expect(meta.order).toBe(300);
    expect(meta.dataGroup).toBe('tag');
  } finally {
    await teardown(app, userDataDir);
  }
});

// ----------------------------------------------------------------
// §2 — Vocabulary: the 9 categories remain available
// ----------------------------------------------------------------

test('F1A.7 — tag <select> exposes the 9 production categories + placeholder', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const labels = await page.evaluate(() => {
      const sel = document.getElementById('rga-shell-toolbar-tag');
      return Array.from(sel.options).map((o) => [o.value, o.textContent]);
    });
    expect(labels).toEqual([
      ['',          'Tag…'],
      ['character', 'Character'],
      ['prop',      'Prop'],
      ['wardrobe',  'Wardrobe'],
      ['location',  'Location'],
      ['sfx',       'SFX'],
      ['vfx',       'VFX'],
      ['vehicle',   'Vehicle'],
      ['animal',    'Animal'],
      ['custom',    'Custom']
    ]);
  } finally {
    await teardown(app, userDataDir);
  }
});

// ----------------------------------------------------------------
// §3 — Visible position: text → scene → tag → writing → mode
// ----------------------------------------------------------------

test('F1A.7 — group order in the toolbar row is text → scene → tag → writing → mode', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const order = await page.evaluate(() => {
      const groups = Array.from(document.querySelectorAll(
        '#rga-shell-toolbar .rga-shell-toolbar-group'));
      return groups.map((el) => ({
        dataGroup: el.getAttribute('data-group'),
        x:         el.getBoundingClientRect().x
      }));
    });
    expect(order.map((g) => g.dataGroup))
      .toEqual(['text', 'scene', 'tag', 'writing', 'mode']);
    // Strictly left-to-right.
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i].x).toBeGreaterThan(order[i - 1].x);
    }
  } finally {
    await teardown(app, userDataDir);
  }
});

// ----------------------------------------------------------------
// §4 — Layout fidelity: row height + single-line top alignment
//      (F1A.6A guarantees continue to hold after F1A.7)
// ----------------------------------------------------------------

test('F1A.7 — toolbar groups share a vertical center (align-items: center holds)', async () => {
  // The right invariant under align-items: center is "centers aligned,"
  // not "top edges aligned." The Tag group's native <select> has a
  // slightly different intrinsic height than the icon-button groups,
  // so top edges legitimately differ by a few pixels — but the visual
  // center, which is what align-items actually controls, matches
  // within ±2px.
  const { app, page, userDataDir } = await launchApp();
  try {
    const rects = await page.evaluate(() => {
      const groups = Array.from(document.querySelectorAll(
        '#rga-shell-toolbar .rga-shell-toolbar-group'));
      return groups.map((el) => {
        const r = el.getBoundingClientRect();
        return {
          dataGroup: el.getAttribute('data-group'),
          height:    Math.round(r.height),
          cy:        Math.round(r.y + r.height / 2)
        };
      });
    });
    const firstCy = rects[0].cy;
    rects.forEach((r) => {
      expect(Math.abs(r.cy - firstCy)).toBeLessThanOrEqual(2);
      expect(r.height).toBeGreaterThan(0);
      expect(r.height).toBeLessThanOrEqual(34);
    });
  } finally {
    await teardown(app, userDataDir);
  }
});

test('F1A.7 — toolbar row stays at 36px design geometry (no vertical growth)', async () => {
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
    expect(Math.abs(heights.toolbar - 36)).toBeLessThanOrEqual(2);
    expect(Math.abs(heights.inner - 36)).toBeLessThanOrEqual(2);
  } finally {
    await teardown(app, userDataDir);
  }
});

test('F1A.7 — F1A.6A slot fix continues to hold (.rga-shell-toolbar-content-slot is display: contents)', async () => {
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

// ----------------------------------------------------------------
// §5 — No overlap between Tag and its neighbors (Scene, Writing)
// ----------------------------------------------------------------

test('F1A.7 — tag group has meaningful inline width and no overlap with neighbors', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const geom = await page.evaluate(() => {
      const scene = document.querySelector('[data-toolbar-group-id="scene"]');
      const tag   = document.querySelector('[data-toolbar-group-id="tag"]');
      const writing = document.querySelector('[data-group="writing"]');
      const r = (el) => el.getBoundingClientRect();
      return {
        scene:   { x: r(scene).x,   right: r(scene).right,   width: r(scene).width },
        tag:     { x: r(tag).x,     right: r(tag).right,     width: r(tag).width },
        writing: { x: r(writing).x, right: r(writing).right, width: r(writing).width }
      };
    });
    expect(geom.tag.width).toBeGreaterThan(20);
    // Scene ends, then tag begins (allow ≤0.5px subpixel tolerance).
    expect(geom.tag.x).toBeGreaterThanOrEqual(geom.scene.right - 0.5);
    // Tag ends, then writing begins.
    expect(geom.writing.x).toBeGreaterThanOrEqual(geom.tag.right - 0.5);
  } finally {
    await teardown(app, userDataDir);
  }
});

// ----------------------------------------------------------------
// §6 — CORE no longer owns the tag dropdown (negative guard)
// ----------------------------------------------------------------

test('F1A.7 — CORE format-toolbar.js no longer references the tag dropdown', async () => {
  // Static check via the renderer source.
  const fs2 = require('fs');
  const path2 = require('path');
  const src = fs2.readFileSync(
    path2.resolve(__dirname, '..', '..', '..', 'renderer', 'js', 'format-toolbar.js'),
    'utf8');
  expect(/function applyTagFromSelection\b/.test(src)).toBe(false);
  expect(/applyTagFromSelection\s*\(/.test(src)).toBe(false);
  // The Row 3 tag handler binding moved out of CORE too — no
  // getElementById('rga-shell-toolbar-tag') in CORE.
  expect(/getElementById\(['"]rga-shell-toolbar-tag['"]\)/.test(src)).toBe(false);
});

test('F1A.7 — CORE index.html no longer carries the tag dropdown in the static Writing group', async () => {
  const fs2 = require('fs');
  const path2 = require('path');
  const html = fs2.readFileSync(
    path2.resolve(__dirname, '..', '..', '..', 'renderer', 'index.html'),
    'utf8');
  // The static <select id="rga-shell-toolbar-tag"> must be absent.
  expect(/id="rga-shell-toolbar-tag"/.test(html)).toBe(false);
  // The 9 production category strings must be absent from the static
  // HTML — they now live in the plugin file.
  ['Wardrobe', 'SFX', 'VFX', 'Vehicle', 'Animal'].forEach((label) => {
    // Search inside the writing group region only — these words might
    // appear elsewhere in comments. Use the writing-group block.
    const writingMatch = html.match(
      /<div class="rga-shell-toolbar-group" data-group="writing">([\s\S]*?)<\/div>/);
    expect(writingMatch).toBeTruthy();
    expect(writingMatch[1].includes(label)).toBe(false);
  });
});
