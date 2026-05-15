// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const filesBridge = require('./bridge/files');
const windowControls = require('./bridge/window-controls');
const { buildMenu } = require('./menu');

let mainWindow = null;
const DEV = process.argv.includes('--dev');

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: true,
    backgroundColor: '#1e1e1e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  buildMenu(mainWindow);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
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
