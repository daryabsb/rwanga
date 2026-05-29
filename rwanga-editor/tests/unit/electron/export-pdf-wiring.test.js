// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// PB1.A — main-process export pipe wiring guards.
//
// Electron's BrowserWindow / printToPDF cannot run under node:test, so the
// runtime path is verified in Playwright/manual; these source-level guards
// pin the wiring that closes the dead PDF pipe the audit found (handler
// registered, printToPDF used, parity mapper consumed, bridge registered in
// main, preload bridge intact).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '../../..');
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');

test('PB1.A: export-pdf bridge registers ipcMain.handle("export.toPDF")', () => {
  const src = read('electron/bridge/export-pdf.js');
  assert.match(src, /ipcMain\.handle\(\s*['"]export\.toPDF['"]/,
    'export-pdf.js must register the export.toPDF IPC handler that preload.js invokes');
});

test('PB1.A: export-pdf bridge snapshots via webContents.printToPDF', () => {
  const src = read('electron/bridge/export-pdf.js');
  assert.match(src, /printToPDF\s*\(/, 'export must use webContents.printToPDF');
});

test('PB1.A: export-pdf bridge derives options from the pure parity mapper', () => {
  const src = read('electron/bridge/export-pdf.js');
  assert.match(src, /require\(['"]\.\.\/lib\/pdf-print-options['"]\)/,
    'export-pdf.js must consume the PB1.C toPrintOptions mapper for page-size/margin parity');
  assert.match(src, /toPrintOptions\(/);
});

test('PB1.A: export-pdf bridge renders in an offscreen BrowserWindow (show:false), not the main window', () => {
  const src = read('electron/bridge/export-pdf.js');
  assert.match(src, /new BrowserWindow\(/);
  assert.match(src, /show:\s*false/, 'PDF must render in a hidden window so shell chrome is excluded');
});

test('PB1.A: main.js requires and registers the export-pdf bridge at app start', () => {
  const src = read('electron/main.js');
  assert.match(src, /require\(['"]\.\/bridge\/export-pdf['"]\)/, 'main.js must require the export-pdf bridge');
  assert.match(src, /exportPdfBridge\.register\(\)/, 'main.js must call exportPdfBridge.register() in whenReady');
});

test('PB1.A: preload still exposes window.rwanga.export.toPDF over the export.toPDF channel', () => {
  const src = read('electron/preload.js');
  assert.match(src, /toPDF:\s*\(content,\s*options\)\s*=>\s*ipcRenderer\.invoke\(['"]export\.toPDF['"]/,
    'the preload export bridge end must remain intact (renderer → main contract)');
});
