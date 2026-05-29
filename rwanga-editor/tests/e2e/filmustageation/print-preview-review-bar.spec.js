// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Review Bar v1 — Playwright (Electron) integration.
//
// Proves the live review-surface behaviour jsdom cannot: the bar mounts over
// the real sheet stack, the page indicator tracks scroll, prev/next/jump
// navigate (and the page VISIBLY scrolls), Fit/zoom transform the stack
// (presentation only), Export routes to the PDF pipe WITHOUT re-zooming, the
// export carries real screenplay formatting, and Done/Esc return to the editor.
//
// Prerequisite: `npm run build:renderer`. Run with: npm run test:e2e
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');

let app, page, userDataDir;

test.beforeEach(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-e2e-'));
  app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(window.Rga && window.Rga.PrintPreview && window.Rga.ReviewBar));
  await page.waitForFunction(() => !!(window.Rga.TabManager && window.Rga.TabManager._editorView()));
});

test.afterEach(async () => {
  if (app) { await app.close(); app = null; }
  if (userDataDir) {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
    userDataDir = null;
  }
});

function enterPreview() {
  return page.evaluate(() => window.Rga.PrintPreview.open());
}

// Build a properly-structured, MULTI-PAGE screenplay (scene headings, action,
// cues, dialogue, parentheticals, transitions) so PrintRenderer emits the real
// screenplay block classes — the fidelity the writer expects in the package.
// Uses updateState (NOT dispatch) so the doc is not marked dirty — a dirty
// doc makes the CloseGuard block app.close() and hangs afterEach.
async function buildRealScript() {
  await page.evaluate(() => {
    const v = window.Rga.TabManager._editorView();
    const s = v.state.schema, PM = window.RgaProseMirror;
    const scenes = [];
    for (let i = 0; i < 8; i += 1) {
      scenes.push(s.nodes.scene.create({ id: 'sc' + i, notes: '', revisionFlag: null, metadata: { linkedScenes: [], references: [], production: {} } }, [
        s.nodes.sceneHeading.create({ setting: 'INT.', time: 'NIGHT', headingStyle: null }, s.text('APARTMENT ' + i)),
        s.nodes.action.create(null, s.text('The room is dim. ' + 'Action detail. '.repeat(18))),
        s.nodes.character.create(null, s.text('COLLECTOR')),
        s.nodes.parenthetical.create(null, s.text('(quietly)')),
        s.nodes.dialogue.create(null, s.text('I hate this job, every single night of it.')),
        s.nodes.transition.create({ presetType: 'CUT' }, s.text('CUT TO:'))
      ]));
    }
    const doc = s.nodes.doc.create(null, [s.nodes.titleStrip.create({ removable: true }), s.nodes.body.create(null, scenes)]);
    v.updateState(PM.EditorState.create({ schema: s, doc: doc, plugins: v.state.plugins }));
  });
  await enterPreview();
  await expect(page.locator('#rga-review-bar')).toBeVisible();
}

test('entering Print Preview mounts the review bar with all directed controls', async () => {
  await enterPreview();
  const bar = page.locator('#rga-review-bar');
  await expect(bar).toBeVisible();
  await expect(bar.locator('.rga-review-done')).toBeVisible();
  await expect(bar.locator('.rga-review-pageind')).toBeVisible();
  await expect(bar.locator('.rga-review-prev')).toBeVisible();
  await expect(bar.locator('.rga-review-next')).toBeVisible();
  await expect(bar.locator('.rga-review-fit-page')).toBeVisible();
  await expect(bar.locator('.rga-review-fit-width')).toBeVisible();
  await expect(bar.locator('.rga-review-zoom-pct')).toBeVisible();
  await expect(bar.locator('.rga-review-export')).toBeVisible();
  // Print is shown-but-deferred (disabled).
  await expect(bar.locator('.rga-review-print')).toBeDisabled();
});

test('Fit page is the default on entry; the percent readout is populated', async () => {
  await enterPreview();
  await expect(page.locator('.rga-review-fit-page')).toHaveClass(/is-active/);
  await expect(page.locator('.rga-review-zoom-pct')).toHaveText(/%$/);
});

test('the page indicator reports current / total from the real sheet stack', async () => {
  await enterPreview();
  const total = await page.locator('#rga-print-preview-root .rga-page-sheet').count();
  await expect(page.locator('.rga-review-pageind')).toHaveText(new RegExp('1 / ' + total));
});

test('Done returns to the editor and removes the bar', async () => {
  await enterPreview();
  await page.locator('.rga-review-done').click();
  await expect(page.locator('#rga-review-bar')).toBeHidden();
  await expect(page.locator('#editor')).toBeVisible();
  expect(await page.evaluate(() => window.Rga.PrintPreview.isActive())).toBe(false);
});

test('Esc still exits the surface (keyboard path) and removes the bar', async () => {
  await enterPreview();
  await page.keyboard.press('Escape');
  await expect(page.locator('#rga-review-bar')).toBeHidden();
  expect(await page.evaluate(() => window.Rga.PrintPreview.isActive())).toBe(false);
});

test('Fit width toggles the active fit control; zoom stepper changes the readout and clears fit', async () => {
  await enterPreview();
  await page.locator('.rga-review-fit-width').click();
  await expect(page.locator('.rga-review-fit-width')).toHaveClass(/is-active/);
  await expect(page.locator('.rga-review-fit-page')).not.toHaveClass(/is-active/);

  const before = await page.locator('.rga-review-zoom-pct').textContent();
  await page.locator('.rga-review-zoom-in').click();
  await expect(page.locator('.rga-review-zoom-pct')).not.toHaveText(before);
  // Manual zoom clears any active fit mode.
  await expect(page.locator('.rga-review-fit-width')).not.toHaveClass(/is-active/);
});

test('zoom is presentation-only — it sets root.style.zoom and never the sheet inch geometry', async () => {
  await enterPreview();
  await page.locator('.rga-review-zoom-in').click();
  const probe = await page.evaluate(() => {
    const root = document.getElementById('rga-print-preview-root');
    const sheet = root.querySelector('.rga-page-sheet');
    return { rootZoom: root.style.zoom, sheetW: sheet.style.width, sheetH: sheet.style.height };
  });
  expect(probe.rootZoom).not.toBe('');                 // presentation transform applied
  expect(probe.sheetW).toMatch(/in$/);                 // sheet geometry stays inch-true
  expect(probe.sheetH).toMatch(/in$/);
});

test('Export PDF routes through the review surface to Rga.PdfExport.run()', async () => {
  await enterPreview();
  // Stub the renderer-side caller (a plain Rga object, unlike the immutable
  // contextBridge bridge) so no native save dialog blocks the test.
  await page.evaluate(() => {
    window.__exportRan = 0;
    window.Rga.PdfExport.run = () => { window.__exportRan += 1; return Promise.resolve(true); };
  });
  await page.locator('.rga-review-export').click();
  expect(await page.evaluate(() => window.__exportRan)).toBe(1);
});

test('next / prev navigate the package — the page VISIBLY scrolls, not just the indicator', async () => {
  await buildRealScript();
  const total = await page.locator('#rga-print-preview-root .rga-page-sheet').count();
  expect(total).toBeGreaterThanOrEqual(2);
  const scrollTop = () => page.evaluate(() => document.getElementById('rga-print-preview-root').scrollTop);
  await expect(page.locator('.rga-review-pageind')).toHaveText(new RegExp('^\\s*1 / ' + total));
  const at1 = await scrollTop();
  await page.locator('.rga-review-next').click();
  await expect(page.locator('.rga-review-pageind')).toHaveText(new RegExp('^\\s*2 / ' + total));
  const at2 = await scrollTop();
  expect(at2).toBeGreaterThan(at1);                 // the surface actually moved
  await page.locator('.rga-review-prev').click();
  await expect(page.locator('.rga-review-pageind')).toHaveText(new RegExp('^\\s*1 / ' + total));
  expect(await scrollTop()).toBeLessThan(at2);
});

test('jump-to-page: click the indicator, type a page, Enter scrolls there', async () => {
  await buildRealScript();
  const total = await page.locator('#rga-print-preview-root .rga-page-sheet').count();
  await page.locator('.rga-review-pageind').click();
  const input = page.locator('.rga-review-pageind-input');
  await expect(input).toBeVisible();
  await input.fill(String(total));
  await input.press('Enter');
  await expect(page.locator('.rga-review-pageind')).toHaveText(new RegExp(total + ' / ' + total));
});

test('FIX: Export PDF never changes the zoom (no re-zoom side-effect)', async () => {
  // run() must not call PrintPreview.refresh() — that re-ran fit/zoom on every
  // Export click. The real bridge is contextBridge-immutable (can't stub), so
  // we exercise the REAL run() and assert the synchronous zoom is untouched.
  // (A native save dialog may open; the synchronous re-zoom check has already
  // happened by then, and afterEach force-closes the app.)
  await buildRealScript();
  const z = () => page.evaluate(() => document.getElementById('rga-print-preview-root').style.zoom);
  const before = await z();
  await page.locator('.rga-review-export').click();
  expect(await z()).toBe(before);
});

test('FIX: Fit page is stable across a preview refresh (Page Setup-style)', async () => {
  await buildRealScript();
  const z = () => page.evaluate(() => document.getElementById('rga-print-preview-root').style.zoom);
  const z1 = await z();
  await page.evaluate(() => window.Rga.PrintPreview.refresh());
  expect(await z()).toBe(z1);   // same content + window → same fit, no drift
});

test('FIX: the writing-chrome menubar recedes while the review surface is active', async () => {
  await enterPreview();
  const display = await page.evaluate(() => {
    const m = document.querySelector('#rga-shell-menubar');
    return m ? getComputedStyle(m).display : 'absent';
  });
  expect(['none', 'absent']).toContain(display);
});

test('FIX: the export carries the real screenplay formatting (export matches preview)', async () => {
  // Reconstruct the exact HTML run() builds (bridge is immutable). It must
  // carry the screenplay block classes AND link the formatting stylesheet, so
  // the exported PDF is laid out like Print Preview — not plain text.
  await buildRealScript();
  const fmt = await page.evaluate(() => {
    const v = window.Rga.TabManager._editorView();
    const model = window.Rga.PrintPreview.buildModel(v);
    const tmp = document.createElement('div');
    window.Rga.PrintRenderer.render(model, tmp, {});
    const html = window.Rga.PdfExport._buildExportHtml({ sheetsHTML: tmp.innerHTML, cssHrefs: window.Rga.PdfExport._cssHrefs(), geometry: window.Rga.PdfExport._geometry() });
    return {
      slug: /rga-print-block-sceneHeading/.test(html),
      dialogue: /rga-print-block-dialogue/.test(html),
      character: /rga-print-block-character/.test(html),
      css: /editor-prosemirror\.css/.test(html)
    };
  });
  expect(fmt.slug).toBe(true);
  expect(fmt.dialogue).toBe(true);
  expect(fmt.character).toBe(true);
  expect(fmt.css).toBe(true);
});

test('the preview renders real screenplay formatting (uppercase bold sluglines, indented dialogue)', async () => {
  await buildRealScript();
  const styles = await page.evaluate(() => {
    const root = document.getElementById('rga-print-preview-root');
    const slug = root.querySelector('.rga-print-block-sceneHeading');
    const dlg = root.querySelector('.rga-print-block-dialogue');
    const ch = root.querySelector('.rga-print-block-character');
    return {
      slugUpper: slug && getComputedStyle(slug).textTransform,
      slugWeight: slug && getComputedStyle(slug).fontWeight,
      dlgPad: dlg && getComputedStyle(dlg).paddingLeft,
      chPad: ch && getComputedStyle(ch).paddingLeft
    };
  });
  expect(styles.slugUpper).toBe('uppercase');
  expect(parseInt(styles.slugWeight, 10)).toBeGreaterThanOrEqual(700);
  expect(parseFloat(styles.dlgPad)).toBeGreaterThan(0);   // dialogue indented
  expect(parseFloat(styles.chPad)).toBeGreaterThan(0);    // character cue indented
});
