// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// PB1.A — main-process PDF export handler.
//
// Registers ipcMain.handle('export.toPDF', …), the middle of the dead pipe
// the Print/Export Truth Audit identified: the menu already emits
// file.exportPdf and preload already exposes window.rwanga.export.toPDF —
// this handler is what was missing.
//
// Strategy (the audit's "hidden child window pre-loaded with the
// PrintRenderer output" option): the renderer hands us a self-contained
// HTML document (the print sheets + the app's own stylesheet links + an
// @page rule pinned to the layout pageSize). We render it in an OFFSCREEN
// BrowserWindow and snapshot it with webContents.printToPDF. Rendering in a
// throwaway window — rather than the main window — means the PDF contains
// only the page sheets, with no shell chrome and no need for @media print
// discipline on the live editor.
//
// Return shapes (resolved, never rejected — the renderer branches on them):
//   { path }            — success; absolute path written
//   { canceled: true }  — user dismissed the save dialog
//   { error: message }  — render / write failure (also logged here)
'use strict';

const { ipcMain, dialog, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { toPrintOptions } = require('../lib/pdf-print-options');

function senderWindow(event) {
  return BrowserWindow.fromWebContents(event.sender);
}

// Render `html` to a PDF Buffer in an offscreen window using `printOptions`.
// Exported so the wiring can be exercised without the full app.
async function renderHtmlToPdf(html, printOptions) {
  // The export document links the app's CSS by absolute file:// URL and its
  // fonts resolve relative to those CSS files, so a temp file in the OS temp
  // dir (a file:// origin) loads everything correctly. A data: URL would
  // have an opaque origin and Chromium would block the file:// subresources.
  const tmpPath = path.join(
    os.tmpdir(),
    'rwanga-pdf-export-' + process.pid + '-' + Date.now() + '.html'
  );
  await fs.writeFile(tmpPath, html, 'utf8');

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  try {
    await win.loadFile(tmpPath);
    // Wait for webfonts (e.g. the vendored RTL Noto Naskh chain) to finish
    // loading before snapshotting, otherwise the first export can fall back
    // to a substitute font. document.fonts.ready is a no-op when there are
    // no pending fonts.
    try {
      await win.webContents.executeJavaScript(
        'document.fonts && document.fonts.ready ? document.fonts.ready.then(function(){return true;}) : true'
      );
    } catch (_) { /* font readiness is best-effort */ }
    return await win.webContents.printToPDF(printOptions);
  } finally {
    if (!win.isDestroyed()) win.destroy();
    fs.unlink(tmpPath).catch(function() { /* temp cleanup is best-effort */ });
  }
}

let _registered = false;
function register() {
  if (_registered) return;
  _registered = true;

  ipcMain.handle('export.toPDF', async (event, content, options) => {
    options = options || {};
    if (typeof content !== 'string' || content.length === 0) {
      return { error: 'No content to export.' };
    }

    const win = senderWindow(event);
    const saveResult = await dialog.showSaveDialog(win, {
      title: 'Export to PDF',
      defaultPath: options.suggestedName || 'Script.pdf',
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
    });
    if (saveResult.canceled || !saveResult.filePath) return { canceled: true };

    let target = saveResult.filePath;
    if (!target.toLowerCase().endsWith('.pdf')) target = target + '.pdf';

    try {
      const printOptions = toPrintOptions(options.geometry);
      const buffer = await renderHtmlToPdf(content, printOptions);
      await fs.writeFile(target, buffer);
      return { path: target };
    } catch (err) {
      console.error('[export.toPDF] export failed:', err);
      return { error: (err && err.message) ? err.message : String(err) };
    }
  });
}

module.exports = { register, renderHtmlToPdf };
