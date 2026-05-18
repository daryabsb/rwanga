// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { ipcMain, BrowserWindow } = require('electron');

function senderWindow(event) {
  return BrowserWindow.fromWebContents(event.sender);
}

function register() {
  ipcMain.handle('window.minimize', (event) => {
    const win = senderWindow(event);
    if (win) win.minimize();
  });
  ipcMain.handle('window.maximize', (event) => {
    const win = senderWindow(event);
    if (!win) return;
    if (win.isMaximized()) win.unmaximize(); else win.maximize();
  });
  ipcMain.handle('window.close', (event) => {
    const win = senderWindow(event);
    if (win) win.close();
  });
  ipcMain.handle('window.setTitle', (event, title) => {
    const win = senderWindow(event);
    if (win) win.setTitle(title);
  });
  // Regression Fix §B — let the renderer query the current maximize
  // state on boot so the icon paints correctly (Win11 + frameless can
  // boot maximized via OS state restoration).
  ipcMain.handle('window.getState', (event) => {
    const win = senderWindow(event);
    if (!win) return { maximized: false };
    return { maximized: win.isMaximized() };
  });
}

// Regression Fix §B + §A — push window state changes to the renderer
// so the maximize-button icon flips to "restore" while maximized, AND
// the renderer can apply body.window-maximized for CSS compensation
// of the Win11 frameless-overflow border (the OS extends the window
// ~8px past the visible edges when maximized, clipping right-zone
// title-bar controls without padding compensation).
function attach(win) {
  if (!win || typeof win.on !== 'function') return;
  const push = function(maximized) {
    try {
      if (!win.webContents || win.webContents.isDestroyed()) return;
      win.webContents.send('window.state', { maximized: !!maximized });
    } catch (_) { /* window torn down — ignore. */ }
  };
  win.on('maximize',   function() { push(true);  });
  win.on('unmaximize', function() { push(false); });
  // Push an initial snapshot once the renderer is ready so a window
  // that boots maximized doesn't sit on the wrong icon until the user
  // toggles it.
  if (win.webContents) {
    win.webContents.once('did-finish-load', function() { push(win.isMaximized()); });
  }
}

module.exports = { register, attach };
