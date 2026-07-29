// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// GAP-2-3 fix (S2.4F) — Page Setup's paper-size dropdown must actually
// change the paper size, for every user, in both directions.
//
// Root cause (found incidentally during S2.3F, see
// docs/plans/evidence/S2.3F-new-doc-geometry.md "Gaps opened" and
// tests/e2e/flow/new-doc-page-geometry.spec.js's openA4Doc() comment):
// page-setup-dialog.js built its <select> options from
// Rga.Constants.PAPER_SIZES keys ('Letter' / 'A4' / 'Legal'), but the
// settings-registry entry 'pageSetup.paperSize' only accepts the lowercase
// options ['letter', 'a4', 'custom'] (settings-registry.js:283-291). The
// case-sensitive select validator (settings-validators.js:27-30) does
// options.indexOf(v) and silently rejects 'A4'/'Letter' — Store.set
// returns false, console.warn only, no UI feedback — so Apply never
// changes the paper size. 'Legal' was ALSO never valid (the registry never
// had it), a second instance of the same control<->registry mismatch class.
//
// Fix: the dialog's dropdown now sources its options directly from the
// settings registry entry (the SSOT, per Settings Architecture Doctrine)
// intersected with Rga.Constants.PAPER_SIZES (case-insensitively) so it
// offers only sizes that are BOTH registry-legal AND have real dims —
// currently 'letter' and 'a4'. The control now emits exactly what the
// registry accepts; no .toLowerCase() sprinkled at the Apply call site.
//
// This spec proves the EFFECT, not that a handler fired: choosing a paper
// size and clicking Apply must visibly resize the Flow page (the
// --page-height token S2.3F wired up), Letter 1056px <-> A4 1122.52px.
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { closeApp } = require('../../helpers/app-teardown');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const PX_PER_IN = 96;
const TOL_PX = 2;
const LETTER_HEIGHT_PX = 11 * PX_PER_IN;          // 1056.00
const A4_HEIGHT_PX = 11.6929 * PX_PER_IN;          // 1122.5184

let app, page, userDataDir;

test.beforeEach(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-s24f-'));
  app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(
    window.Rga && window.Rga.Settings && window.Rga.Settings.Store &&
    window.Rga.PageSetup && window.Rga.PageSetup.open &&
    window.Rga.TabManager && typeof window.Rga.TabManager.activeDoc === 'function' &&
    window.Rga.ViewMode));
  await page.evaluate(async () => {
    await window.Rga.Settings.Store.init();
    if (window.Rga.ViewMode.get() !== 'flow') window.Rga.ViewMode.set('flow');
  });
  await page.waitForFunction(() => !!document.querySelector('#editor-container.view-flow #editor'));
});

test.afterEach(async () => {
  if (app) {
    // Modal Apply marks the doc dirty; clear it so the CloseGuard modal
    // doesn't hang teardown.
    try {
      await page.evaluate(() => {
        const TM = window.Rga && window.Rga.TabManager;
        const doc = TM && TM.activeDoc && TM.activeDoc();
        if (doc && window.Rga.Doc && window.Rga.Doc.clearDirty) window.Rga.Doc.clearDirty(doc);
      });
    } catch (_) {}
    await closeApp(app);
    app = null;
  }
  if (userDataDir) { try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {} }
  userDataDir = null;
});

async function measureEditorHeight() {
  return page.evaluate(() => document.getElementById('editor').getBoundingClientRect().height);
}

async function openModal() {
  // Pass the real onApply callback (the same one Ctrl+Shift+G's registered
  // handler uses, page-setup-dialog.js:170) so PageSurface.apply(ps) runs
  // and the --page-height token actually repaints — the honest
  // end-to-end path, not just a Store write.
  await page.evaluate(() => {
    const doc = window.Rga.TabManager.activeDoc();
    window.Rga.PageSetup.open(doc, function(ps) {
      if (window.Rga.PageSurface) window.Rga.PageSurface.apply(ps);
    });
  });
  await page.waitForSelector('#page-setup-modal:not([hidden])');
}

async function selectPaperAndApply(value) {
  await page.locator('#ps-paper').selectOption(value);
  await page.click('#page-setup-modal [data-choice="apply"]');
  await page.waitForFunction(() => document.getElementById('page-setup-modal').hidden === true);
}

// ---------------------------------------------------------------------
// The end-to-end proof: choosing A4 in the real modal actually resizes
// the real Flow page. New doc is Letter (1056px) by default.
// ---------------------------------------------------------------------
test('GAP-2-3 — choosing A4 in Page Setup and clicking Apply resizes the Flow page to 1122.52px', async () => {
  const before = await measureEditorHeight();
  expect(Math.abs(before - LETTER_HEIGHT_PX),
    `sanity check: new doc should start at Letter height ${LETTER_HEIGHT_PX}px, was ${before}px`
  ).toBeLessThanOrEqual(TOL_PX);

  await openModal();
  await selectPaperAndApply('a4');

  const effective = await page.evaluate(() => window.Rga.Settings.Store.effective('pageSetup.paperSize'));
  expect(effective).toBe('a4');

  const after = await measureEditorHeight();
  expect(Math.abs(after - A4_HEIGHT_PX),
    `Apply must change #editor height to A4's ${A4_HEIGHT_PX}px, was ${after}px `
    + `(unchanged from Letter ${LETTER_HEIGHT_PX}px means Apply was silently rejected)`
  ).toBeLessThanOrEqual(TOL_PX);
});

// ---------------------------------------------------------------------
// Round-trip back to Letter proves both directions of the switch work,
// not just A4-in.
// ---------------------------------------------------------------------
test('GAP-2-3 — switching A4 -> Letter and back resizes the Flow page both ways', async () => {
  await openModal();
  await selectPaperAndApply('a4');
  const afterA4 = await measureEditorHeight();
  expect(Math.abs(afterA4 - A4_HEIGHT_PX)).toBeLessThanOrEqual(TOL_PX);

  await openModal();
  await selectPaperAndApply('letter');
  const effective = await page.evaluate(() => window.Rga.Settings.Store.effective('pageSetup.paperSize'));
  expect(effective).toBe('letter');

  const afterLetter = await measureEditorHeight();
  expect(Math.abs(afterLetter - LETTER_HEIGHT_PX),
    `switching back to Letter must return #editor to ${LETTER_HEIGHT_PX}px, was ${afterLetter}px`
  ).toBeLessThanOrEqual(TOL_PX);
});

// ---------------------------------------------------------------------
// The class guard (Step 3): every value the Page Setup paper-size control
// can emit must be a value the settings registry accepts. This is the
// bug class (control<->registry case/format mismatch), not just this one
// instance — it must be caught here, not discovered again by a user.
// ---------------------------------------------------------------------
test('GAP-2-3 class guard — every Page Setup paper-size option is registry-legal', async () => {
  const result = await page.evaluate(() => {
    const entry = window.Rga.Settings.Registry.get('pageSetup.paperSize');
    const registryOptions = entry.options;
    // Open the modal so it (and its <select>) is mounted.
    const doc = window.Rga.TabManager.activeDoc();
    window.Rga.PageSetup.open(doc);
    const overlay = document.getElementById('page-setup-modal');
    const select = document.getElementById('ps-paper');
    const controlValues = Array.from(select.options).map((o) => o.value);
    overlay.hidden = true;
    return { registryOptions, controlValues };
  });

  expect(result.controlValues.length).toBeGreaterThan(0);
  for (const v of result.controlValues) {
    expect(result.registryOptions,
      `Page Setup control offers paper-size value "${v}" which the registry does not accept `
      + `(registry options: ${JSON.stringify(result.registryOptions)}) — Apply would silently reject it`
    ).toContain(v);
  }
});
