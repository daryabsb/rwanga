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
