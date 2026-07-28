// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// S3.3 / PF-13 — clean-console audit across the core flows.
//
// NOT part of the e2e suite. `tests/integration/playwright.config.js` matches
// only `integration/**` and `e2e/**`, so this file is invisible to
// `npm run test:e2e`; it is run explicitly via the config beside it. (The plan
// suggested parking it under `docs/plans/evidence/`; it lives here instead
// because a spec outside `rwanga-editor/` cannot resolve `@playwright/test`.
// `tests/diagnostics/` is the repo's existing home for non-suite specs.)
//
// It launches the real app, subscribes to `console` + `pageerror` for the whole
// session, walks the core flows a first-run user walks, and then reports.
// Verdict rule (plan §S3.3 Step 2): zero error-level console messages and zero
// page errors → PF-13 TRUE. Every warning is recorded verbatim in the evidence
// file whether or not it fails the audit.
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { closeApp } = require('../../helpers/app-teardown');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const REPORT = path.resolve(APP_ROOT, '..', 'docs', 'plans', 'evidence', 'S3.3-console-capture.json');

test('PF-13 — core flows produce a clean console', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's33-console-'));
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 's33-work-'));
  const target = path.join(workDir, 's33-audit.rga');

  const messages = [];   // every console message, in order, tagged with the flow
  const pageErrors = [];
  let flow = 'launch';

  const app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const page = await app.firstWindow();

  page.on('console', (msg) => {
    messages.push({ flow, type: msg.type(), text: msg.text(), location: msg.location() });
  });
  page.on('pageerror', (err) => {
    pageErrors.push({ flow, message: String(err && err.message || err), stack: String(err && err.stack || '') });
  });

  try {
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => !!(
      window.Rga && window.Rga.FileManager && window.Rga.FileManager.getActive
      && window.Rga.FileManager.getActive()
      && window.Rga.TabManager && window.Rga.TabManager._editorView
      && window.Rga.TabManager._editorView()));

    // ---- 1. New document ----
    flow = 'new-script';
    await page.evaluate(() => window.Rga.FileManager.newScript());
    await page.waitForFunction(() => !!window.Rga.FileManager.getActive());

    // ---- 2. Type the screenplay block types through the real key flow ----
    // (slug Enter-flow, Tab cycle action <-> character <-> dialogue <-> shot,
    //  plus a parenthetical and a transition — the locked script framework.)
    flow = 'typing-block-types';
    await page.locator('#editor').click();
    await page.keyboard.type('INT. KITCHEN - NIGHT');
    await page.keyboard.press('Enter');
    await page.keyboard.type('A kettle whistles on the hob.');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');                 // -> character
    await page.keyboard.type('SARA');
    await page.keyboard.press('Enter');               // -> dialogue
    await page.keyboard.type('It is already boiling.');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await page.keyboard.type('CLOSE ON the kettle.');
    await page.keyboard.press('Enter');
    await page.keyboard.type('EXT. STREET - DAY');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Rain on the windscreen.');

    // ---- 3. Save (real path, native dialog stubbed in main) ----
    flow = 'save-as';
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath });
    }, target);
    const saved = await page.evaluate(() => window.Rga.FileManager.saveAs());
    expect(saved, 'saveAs() returned null — the audit needs a real save').not.toBeNull();

    // ---- 4. Reopen from disk (real path) ----
    flow = 'reopen';
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
    }, target);
    await page.evaluate(() => window.Rga.FileManager.openFromDialog());
    await page.waitForFunction(() => !!window.Rga.FileManager.getActive());

    // ---- 5. Print Preview open / close ----
    flow = 'print-preview';
    await page.waitForFunction(() => !!(window.Rga.PrintPreview));
    await page.evaluate(() => window.Rga.PrintPreview.open());
    await page.waitForFunction(() => window.Rga.PrintPreview.isActive() === true);
    await page.waitForTimeout(500);   // let paging/layout settle and speak up
    await page.evaluate(() => window.Rga.PrintPreview.hide());
    await page.waitForFunction(() => window.Rga.PrintPreview.isActive() === false);

    // ---- 6. Page Setup changes ----
    flow = 'page-setup';
    await page.evaluate(() => window.Rga.Settings.Store.set('pageSetup.paperSize', 'a4'));
    await page.waitForTimeout(200);
    await page.evaluate(() => window.Rga.Settings.Store.set('pageSetup.orientation', 'landscape'));
    await page.waitForTimeout(200);
    await page.evaluate(() => window.Rga.Settings.Store.set('pageSetup.orientation', 'portrait'));
    await page.evaluate(() => window.Rga.Settings.Store.set('pageSetup.paperSize', 'letter'));
    await page.waitForTimeout(200);

    // ---- 7. Undo / redo x5 ----
    flow = 'undo-redo';
    await page.locator('#editor').click();
    await page.keyboard.type('A late addition.');
    for (let i = 0; i < 5; i += 1) { await page.keyboard.press('Control+z'); }
    for (let i = 0; i < 5; i += 1) { await page.keyboard.press('Control+y'); }
    await page.waitForTimeout(300);

    flow = 'close';
  } finally {
    const errors = messages.filter((m) => m.type === 'error');
    const warnings = messages.filter((m) => m.type === 'warning' || m.type === 'warn');
    fs.mkdirSync(path.dirname(REPORT), { recursive: true });
    fs.writeFileSync(REPORT, JSON.stringify({
      capturedAt: new Date().toISOString(),
      totals: {
        all: messages.length,
        errors: errors.length,
        warnings: warnings.length,
        pageErrors: pageErrors.length
      },
      errors, warnings, pageErrors,
      all: messages
    }, null, 2), 'utf8');
    // eslint-disable-next-line no-console
    console.log('[S3.3] console capture -> ' + REPORT
      + ' | errors=' + errors.length + ' warnings=' + warnings.length
      + ' pageErrors=' + pageErrors.length);
    await closeApp(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch (_) {}
  }

  const errors = messages.filter((m) => m.type === 'error');
  expect(pageErrors, 'uncaught page errors during core flows').toEqual([]);
  expect(errors.map((e) => e.flow + ': ' + e.text),
    'error-level console messages during core flows').toEqual([]);
});
