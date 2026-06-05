// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Print Contract V1 — end-to-end in the real Electron app.
// Doctrine: docs/Filmustageation/PRINT_CONTRACT_V1.md §8 (success criteria)
//
// Proves the doctrine through the live renderer + cascade (the ground truth):
//   1. A screenplay created today STORES its print contract inside the .rga.
//   2. Both renderers CONSUME the resolver: ManuscriptGeometry.resolve(doc)
//      carries `printContract`; PdfExport._printContract() returns the same
//      contract; both equal Rga.PrintContract.resolve(doc).
//   3. The contract + the resolved page geometry survive a save → reopen
//      byte-identically (identical Print Preview / PDF output).
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
    window.Rga && window.Rga.PrintContract && typeof window.Rga.PrintContract.resolve === 'function' &&
    window.Rga.ManuscriptGeometry && typeof window.Rga.ManuscriptGeometry.resolve === 'function' &&
    window.Rga.Doc && typeof window.Rga.Doc.serialize === 'function' &&
    window.Rga.TabManager && typeof window.Rga.TabManager.activeDoc === 'function'));
  await page.waitForFunction(() => !!window.Rga.TabManager.activeDoc());
  return { app, page };
}

async function clearDirtyAndClose(app, page) {
  try {
    await page.evaluate(() => {
      const TM = window.Rga && window.Rga.TabManager;
      const docs = TM ? [TM.activeDoc()].filter(Boolean) : [];
      docs.forEach((d) => {
        if (window.Rga.Doc && window.Rga.Doc.clearDirty) window.Rga.Doc.clearDirty(d);
        else d.dirty = false;
      });
    });
  } catch (_) {}
  await app.close();
}

// -----------------------------------------------------------------
// 1. A new document STORES its contract in the serialized .rga.
// -----------------------------------------------------------------
test('PC-V1 — a screenplay created today stores its print contract in the .rga', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-store-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    const stored = await page.evaluate(() => {
      const doc = window.Rga.TabManager.activeDoc();
      const parsed = JSON.parse(window.Rga.Doc.serialize(doc));
      const sp = parsed.metadata.screenplayProfile || {};
      const ps = parsed.settings.pageSetup || {};
      return {
        version: parsed.metadata.printContractVersion,
        direction: sp.direction,
        paperSize: ps.paperSize,
        orientation: ps.orientation,
        pageNumbers: ps.pageNumbers,
        pageNumberPosition: ps.pageNumberPosition,
        sceneNumbers: parsed.settings.show_scene_numbers
      };
    });
    expect(stored).toEqual({
      version: 1, direction: 'ltr', paperSize: 'Letter', orientation: 'portrait',
      pageNumbers: true, pageNumberPosition: 'top_right', sceneNumbers: true
    });
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 2. Both renderers consume the single resolver.
// -----------------------------------------------------------------
test('PC-V1 — Print Preview geometry and PDF Export both consume the contract resolver', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-consume-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    const obs = await page.evaluate(() => {
      const doc = window.Rga.TabManager.activeDoc();
      const contract = window.Rga.PrintContract.resolve(doc);
      const layout = window.Rga.ManuscriptGeometry.resolve(doc);   // Print Preview path
      const PE = window.Rga.PdfExport;
      const pdfContract = (PE && typeof PE._printContract === 'function') ? PE._printContract() : null;
      return {
        contract,
        layoutContract: layout.printContract,
        pdfContract,
        // owned enums on the layoutProfile are sourced from the contract
        layoutDirection: layout.direction,
        layoutOrientation: layout.orientation
      };
    });
    // The single resolver is the source for all three.
    expect(obs.layoutContract).toEqual(obs.contract);
    expect(obs.pdfContract).toEqual(obs.contract);
    expect(obs.layoutDirection).toBe(obs.contract.direction);
    expect(obs.layoutOrientation).toBe(obs.contract.orientation);
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 3. Contract + resolved geometry survive save → reopen identically.
//    (The Settings-Store write path for pageSetup is covered separately
//    by settings/page-setup-ownership.spec.js; here we mutate the owned
//    homes directly to isolate the contract round-trip.)
// -----------------------------------------------------------------
test('PC-V1 — contract and page geometry are identical after a save + reopen', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-reopen-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    const result = await page.evaluate(() => {
      const doc = window.Rga.TabManager.activeDoc();
      // Set a distinctive contract: A4 landscape, RTL, numbering off.
      doc.settings.pageSetup.paperSize = 'A4';
      doc.settings.pageSetup.orientation = 'landscape';
      doc.settings.pageSetup.pageNumbers = false;
      doc.settings.show_scene_numbers = false;
      doc.metadata.screenplayProfile.direction = 'rtl';

      const beforeContract = window.Rga.PrintContract.resolve(doc);
      const beforeGeom = window.Rga.ManuscriptGeometry.resolve(doc);
      const str = window.Rga.Doc.serialize(doc);

      // Reopen through the real deserialize pipeline (migration + v3 schema).
      const re = window.Rga.Doc.deserialize(str, '/reopened.rga');
      const afterContract = window.Rga.PrintContract.resolve(re);
      const afterGeom = window.Rga.ManuscriptGeometry.resolve(re);

      return {
        beforeContract, afterContract,
        beforePage: { w: beforeGeom.pageSize.w, h: beforeGeom.pageSize.h, dir: beforeGeom.direction, lpp: beforeGeom.linesPerPage },
        afterPage:  { w: afterGeom.pageSize.w,  h: afterGeom.pageSize.h,  dir: afterGeom.direction,  lpp: afterGeom.linesPerPage }
      };
    });

    // The contract reopened identically.
    expect(result.afterContract).toEqual(result.beforeContract);
    // The distinctive values actually took effect (not a trivial pass).
    expect(result.beforeContract.paperSize).toBe('A4');
    expect(result.beforeContract.orientation).toBe('landscape');
    expect(result.beforeContract.direction).toBe('rtl');
    expect(result.beforeContract.pageNumbering.enabled).toBe(false);
    expect(result.beforeContract.sceneNumbering.enabled).toBe(false);
    // The resolved page geometry is byte-identical across the reopen.
    expect(result.afterPage).toEqual(result.beforePage);
    // Landscape actually swapped the page (w > h).
    expect(result.beforePage.w).toBeGreaterThan(result.beforePage.h);
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});
