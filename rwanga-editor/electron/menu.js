// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { Menu } = require('electron');

function buildMenu(mainWindow) {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{
      label: 'Rwanga Editor',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Script', accelerator: 'CommandOrControl+N', click: () => sendMenuAction(mainWindow, 'file.new') },
        { label: 'Open…', accelerator: 'CommandOrControl+O', click: () => sendMenuAction(mainWindow, 'file.open') },
        { label: 'Open Folder…', accelerator: 'CommandOrControl+K CommandOrControl+O', click: () => sendMenuAction(mainWindow, 'file.openFolder') },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CommandOrControl+S', click: () => sendMenuAction(mainWindow, 'file.save') },
        { label: 'Save As…', accelerator: 'CommandOrControl+Shift+S', click: () => sendMenuAction(mainWindow, 'file.saveAs') },
        { type: 'separator' },
        { label: 'Export to PDF…', accelerator: 'CommandOrControl+Shift+E', click: () => sendMenuAction(mainWindow, 'file.exportPdf') },
        { type: 'separator' },
        { label: 'Manage Storage…', click: () => sendMenuAction(mainWindow, 'file.manageStorage') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Load Sample Script', click: () => sendMenuAction(mainWindow, 'help.loadSample') },
        { label: 'Check for Updates…', click: () => sendMenuAction(mainWindow, 'help.checkUpdates') },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function sendMenuAction(window, action) {
  if (window && !window.isDestroyed()) {
    window.webContents.send('menu.action', action);
  }
}

module.exports = { buildMenu };
