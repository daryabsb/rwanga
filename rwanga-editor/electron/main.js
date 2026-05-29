// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const filesBridge = require('./bridge/files');
const windowControls = require('./bridge/window-controls');
const autosaveBridge = require('./bridge/autosave');
const prefsBridge = require('./bridge/prefs');
const exportPdfBridge = require('./bridge/export-pdf');
const { buildMenu, registerIpc: registerMenuIpc } = require('./menu');

let mainWindow = null;
const DEV = process.argv.includes('--dev');

// Persistence Safety Contract §6 — app-close dirty guard.
// The window 'close' is intercepted and the renderer is asked for a verdict.
// CLOSE_RESPONSE_TIMEOUT_MS bounds the wait; on timeout the close is ABORTED
// (Brick 2 amendment — proceeding is unsafe until Autosave / Brick 3 exists).
let _closeApproved = false;
let _closeTimer = null;
const CLOSE_RESPONSE_TIMEOUT_MS = 10000;

// Studio Shell Recovery — Workstream A1: frameless window transport.
//
// Platform-conditional chrome ownership (Option B hybrid, per
// docs/owned-chrome-architecture-report.md):
//   • Windows + Linux: frame: false — Rwanga owns title bar, menu,
//     window controls. Renderer paints all chrome in subsequent
//     stages (A2 title bar, A3 controls, A4 menu, A5 drag polish).
//   • macOS: titleBarStyle: 'hiddenInset' — native traffic lights
//     preserved per Apple HIG; Rwanga paints title content beside
//     them. macOS keeps its global native menu bar.
//
// A1 ONLY changes the transport layer. Renderer is untouched until
// A2 lands the owned title bar. The temporary state on Windows
// after A1 is: no native title bar, no native menu, no window
// controls. Resize edges still work; Win+arrow snap, Alt+F4, Win+M
// still work; mouse drag does NOT yet (drag region declaration is
// part of A2). This is a verification state, not daily use.
const _isMac = process.platform === 'darwin';
const _isWin = process.platform === 'win32';
const _isLin = process.platform === 'linux';

function createMainWindow() {
  const _windowOptions = {
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#1e1e1e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
  };
  if (_isMac) {
    // macOS hybrid: hiddenInset keeps traffic lights, lets us paint
    // chrome alongside them (Phase A3 mission turn).
    _windowOptions.titleBarStyle = 'hiddenInset';
  } else {
    // Windows + Linux: fully frameless. Renderer owns every chrome
    // surface starting with A2.
    _windowOptions.frame = false;
  }
  mainWindow = new BrowserWindow(_windowOptions);

  // Regression Fix §A + §B — wire window state event push so the
  // renderer can flip the maximize-button icon and apply
  // body.window-maximized for CSS chrome-edge compensation.
  windowControls.attach(mainWindow);

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  buildMenu(mainWindow);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Persistence Safety Contract §6.1 — intercept the close, ask the renderer.
  mainWindow.on('close', (event) => {
    if (_closeApproved) return;   // verdict already given — let it close
    const wc = mainWindow ? mainWindow.webContents : null;
    if (!wc || wc.isDestroyed()) return;   // renderer gone — nothing to ask
    event.preventDefault();
    if (_closeTimer) return;   // a close request is already in flight
    wc.send('app.closeRequested');
    _closeTimer = setTimeout(() => {
      _closeTimer = null;
      // Brick 2 amendment — until Autosave (Brick 3) exists, a renderer that
      // never replies must NOT be force-closed: proceeding would silently lose
      // unsaved work. Abort the close (the window stays open — the original
      // 'close' was already prevented) and log the timeout. The Contract §6.1
      // "proceed on timeout" end state is revisited once Brick 3 lands.
      console.error('[app-close] renderer did not respond within '
        + CLOSE_RESPONSE_TIMEOUT_MS + 'ms — close aborted, window kept open.');
    }, CLOSE_RESPONSE_TIMEOUT_MS);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    filesBridge.register();
    windowControls.register();
    registerMenuIpc();
    autosaveBridge.register();
    prefsBridge.register();
    exportPdfBridge.register();
    // Persistence Safety Contract §6.1 — the renderer's close verdict.
    ipcMain.handle('app.closeResponse', (_event, allow) => {
      if (_closeTimer) { clearTimeout(_closeTimer); _closeTimer = null; }
      if (allow) {
        _closeApproved = true;
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
      }
      // allow === false → abort: the timer is cleared, the window stays open.
    });
    createMainWindow();
    if (DEV) startDevLiveReload();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (mainWindow === null) createMainWindow();
  });
}

// ---------------------------------------------------------------
// Dev-mode live reload
// Watches renderer/ and reloads the window on any change.
// Also spawns the esbuild renderer-bundle watcher so bundle.js
// rebuilds automatically; fs.watch then picks up the new bundle.
// ---------------------------------------------------------------
function startDevLiveReload() {
  const rendererDir = path.join(__dirname, '..', 'renderer');
  const buildScript = path.join(__dirname, '..', 'scripts', 'build-renderer.js');

  console.log('[dev] live reload watching ' + rendererDir);

  // Spawn the bundle watcher (esbuild --watch)
  const watcher = spawn(process.execPath, [buildScript, '--watch'], {
    stdio: 'inherit',
    env: process.env
  });
  watcher.on('exit', (code) => {
    console.log('[dev] bundle watcher exited with code ' + code);
  });
  app.on('before-quit', () => { try { watcher.kill(); } catch (_) {} });

  // Watch the renderer tree and hard-reload on any change (debounced)
  let reloadTimer = null;
  const scheduleReload = (file) => {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      console.log('[dev] reloading window (changed: ' + file + ')');
      mainWindow.webContents.reloadIgnoringCache();
    }, 200);
  };

  try {
    fs.watch(rendererDir, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      // Skip sourcemaps and the temp files from the bundler
      if (filename.endsWith('.map')) return;
      scheduleReload(filename);
    });
  } catch (err) {
    console.error('[dev] fs.watch failed:', err.message);
  }
}
