// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// GAP-2-1 fix (S2.3F) — a New document must paint at its full configured
// page size (A4/Letter, per Page Setup) in Flow view FROM THE FIRST PAINT,
// never a shrunken page that grows toward its correct height as content is
// typed. Re-raised by the user 2026-07-29; ratified expectation recorded on
// the GAP-2-1 row of docs/plans/2026-07-02-stage1-launch-gate-masterplan.md.
//
// Root cause (see docs/plans/evidence/S2.3F-new-doc-geometry.md for the full
// diagnosis): renderer/css/editor-prosemirror.css set `min-height: auto;
// height: auto;` on the Flow #editor surface, so its height was purely
// CONTENT-driven — a near-empty New doc rendered a few hundred px tall and
// only grew as text arrived. The fix publishes a --page-height CSS token
// (renderer/js/editor/page-surface.js) alongside the existing --page-width
// token, and uses it as a MIN-HEIGHT FLOOR (not a height cap) on #editor —
// the page starts at its full paper height and can still grow past it once
// content overflows one page. This is a floor change only: Flow stays a
// single continuous surface (no seams, no capsules, no pagination) exactly
// per the locked Flow doctrine (project_flow_continuous_doctrine).
//
// Covers the matrix the slice requires: A4 + Letter, LTR + RTL — proving the
// fix is not a Letter-only or LTR-only patch (both paper dims and both
// script directions go through the SAME token/CSS path).
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { closeApp } = require('../../helpers/app-teardown');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const PX_PER_IN = 96;
const TOL_PX = 2; // sub-pixel layout rounding only — this is a hard floor, not a fuzzy match

let app, page, userDataDir, workDir;

test.beforeEach(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-s23f-'));
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-s23f-doc-'));
  app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(
    window.Rga && window.Rga.TabManager && window.Rga.TabManager._editorView() &&
    window.Rga.FileManager && window.Rga.ViewMode));
  await page.evaluate(() => { if (window.Rga.ViewMode.get() !== 'flow') window.Rga.ViewMode.set('flow'); });
});

test.afterEach(async () => {
  if (app) { await closeApp(app); app = null; }
  for (const d of [userDataDir, workDir]) {
    if (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} }
  }
  userDataDir = workDir = null;
});

// Creates a brand-new document via the REAL "File > New" entry point
// (Rga.FileManager.newScript — the same function A4.1's Ctrl+N binds to),
// optionally seeded with a language (drives screenplayProfile.direction per
// Doc._directionForLanguage: ku/ar -> rtl, else ltr).
async function newDoc(seed) {
  await page.evaluate((s) => window.Rga.FileManager.newScript(s), seed || undefined);
  await page.waitForFunction(() => !!document.querySelector('#editor-container.view-flow #editor'));
}

// Opens a synthetic A4 document through the REAL open-file path
// (Rga.FileManager.openFromDialog -> Doc.deserialize -> TabManager.
// openDocument -> activate -> Rga.PageSurface.apply(tab.doc.settings.
// pageSetup)) — the exact same consumer call tab-manager.js:145 makes for
// ANY doc activation, "New" included. This is the pattern S4.5's
// buildNewKurdishDoc() test used for a "brand-new, never-typed-in" doc.
//
// NOT used: switching an existing doc's paper size via the Page Setup
// modal (Ctrl+Shift+G -> select A4 -> Apply). That path is BROKEN —
// discovered incidentally while writing this spec and reported as a
// proposed gap, not fixed here (out of GAP-2-1's scope): the modal writes
// `Store.set('pageSetup.paperSize', paper.value)` with paper.value from
// Constants.PAPER_SIZES keys ('Letter'/'A4'/'Legal', page-setup-dialog.js:31),
// but the registry entry 'pageSetup.paperSize' only accepts lowercase
// options ['letter','a4','custom'] (settings-registry.js:287). The select
// validator (settings-validators.js:27-30) does a case-sensitive
// `options.indexOf(v)`, so 'A4' never matches 'a4' — Store.set is silently
// rejected (console.warn + return false) and the paper size never changes,
// for every user, every time, regardless of this slice's fix.
async function openA4Doc(language, workDir) {
  const doc = {
    rga_version: '3.0',
    document_type: 'screenplay',
    metadata: {
      title: 'S2.3F A4 probe',
      author: 'S2.3F',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      version: 1,
      revision_notes: '',
      screenplayProfile: {
        language: language || 'en',
        direction: (language === 'ku' || language === 'ar') ? 'rtl' : 'ltr',
        screenplayConvention: 'hollywood'
      },
      production_type: 'feature',
      genre: '',
      logline: '',
      useSchemaV3: true
    },
    settings: {
      font_size: 12,
      font_family: 'Courier Prime',
      show_scene_numbers: true,
      page_size: 'A4',
      pageSetup: { paperSize: 'A4', margins: { top: 1, right: 1, bottom: 1, left: 1.5 } },
      sceneHeadingStyle: 'twoLine',
      units: 'in'
    },
    body: {
      type: 'doc',
      content: [{ type: 'body', content: [] }]
    }
  };
  const filePath = path.join(workDir, 'a4-probe-' + (language || 'en') + '.rga');
  fs.writeFileSync(filePath, JSON.stringify(doc));
  await app.evaluate(({ dialog }, fp) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [fp] });
  }, filePath);
  await page.evaluate(() => window.Rga.FileManager.openFromDialog());
  await page.waitForFunction(() => {
    const d = window.Rga.FileManager.getActive();
    return !!(d && String(d.displayName || '').indexOf('a4-probe') >= 0);
  });
}

async function measureEditor() {
  return page.evaluate(() => {
    const editor = document.getElementById('editor');
    const rect = editor.getBoundingClientRect();
    return { height: rect.height, width: rect.width };
  });
}

async function markCleanAndIgnore() {
  // GAP-2-1 docs create dirty state (typing); clear it so afterEach's
  // closeApp() doesn't hang on the unsaved-changes CloseGuard modal.
  await page.evaluate(() => {
    const TM = window.Rga.TabManager;
    const docs = [];
    if (TM && typeof TM.tabs === 'function') (TM.tabs() || []).forEach((t) => { if (t && t.doc) docs.push(t.doc); });
    docs.forEach((d) => { if (window.Rga.Doc && window.Rga.Doc.clearDirty) window.Rga.Doc.clearDirty(d); else d.dirty = false; });
  });
}

// The shared assertion set: first-paint height matches the paper's full
// configured height (never a shrunken/growing page), and typing a couple of
// short lines does NOT change it (it's a floor, not content-driven).
function expectedHeightPx(paperHeightIn) {
  return paperHeightIn * PX_PER_IN;
}

async function assertFullSizeFromFirstPaintAndStable(expectedHeightIn, label) {
  const first = await measureEditor();
  const expected = expectedHeightPx(expectedHeightIn);
  expect(Math.abs(first.height - expected),
    `${label}: #editor height on first paint was ${first.height}px, expected ${expected}px `
    + `(${expectedHeightIn}in paper height) — the page must NOT start shrunken.`
  ).toBeLessThanOrEqual(TOL_PX);

  await page.click('#editor');
  await page.keyboard.type('INT. ROOM - DAY');
  await page.keyboard.press('Enter');
  await page.keyboard.type('A short action line.');

  const afterTyping = await measureEditor();
  expect(Math.abs(afterTyping.height - first.height),
    `${label}: #editor height changed from ${first.height}px to ${afterTyping.height}px after `
    + `typing two short lines — the page must not grow toward its size, it must already BE that size.`
  ).toBeLessThanOrEqual(TOL_PX);

  await markCleanAndIgnore();
}

// ---------------------------------------------------------------------------
// Letter + LTR — the default New doc (no seed).
// ---------------------------------------------------------------------------
test('GAP-2-1 — New doc (Letter, LTR) paints at full 11in page height from the first frame', async () => {
  await newDoc();
  await assertFullSizeFromFirstPaintAndStable(11, 'Letter/LTR');
});

// ---------------------------------------------------------------------------
// Letter + RTL — Kurdish-seeded New doc (screenplayProfile.direction: 'rtl'),
// still Letter paper (seedDefaults does not touch paperSize).
// ---------------------------------------------------------------------------
test('GAP-2-1 — New doc (Letter, RTL/Kurdish profile) paints at full 11in page height from the first frame', async () => {
  await newDoc({ language: 'ku' });
  const dir = await page.evaluate(() => document.getElementById('editor').getAttribute('dir'));
  expect(dir).toBe('rtl');
  await assertFullSizeFromFirstPaintAndStable(11, 'Letter/RTL');
});

// ---------------------------------------------------------------------------
// A4 + LTR — a fresh, never-typed-in A4 document opened through the real
// TabManager.openDocument -> activate -> PageSurface.apply path (proves the
// --page-height token/floor tracks Page Setup's A4 dims, not just the
// Letter default). See openA4Doc() above for why this bypasses the modal.
// ---------------------------------------------------------------------------
test('GAP-2-1 — a fresh A4 doc (LTR) paints at full 11.6929in page height from the first frame', async () => {
  await openA4Doc('en', workDir);
  await assertFullSizeFromFirstPaintAndStable(11.6929, 'A4/LTR');
});

// ---------------------------------------------------------------------------
// A4 + RTL — same, Kurdish/RTL profile.
// ---------------------------------------------------------------------------
test('GAP-2-1 — a fresh A4 doc (RTL/Kurdish profile) paints at full 11.6929in page height from the first frame', async () => {
  await openA4Doc('ku', workDir);
  const dir = await page.evaluate(() => document.getElementById('editor').getAttribute('dir'));
  expect(dir).toBe('rtl');
  await assertFullSizeFromFirstPaintAndStable(11.6929, 'A4/RTL');
});
