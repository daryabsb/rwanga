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
}

module.exports = { register };
