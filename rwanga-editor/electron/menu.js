// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { Menu, ipcMain } = require('electron');

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
        // Bundle 1 §A — the three editor views are first-class menu entries
        // alongside the status-bar dropdown. Both surfaces call
        // Rga.ViewMode.set(mode) in the renderer; the menu sends a
        // 'view.{flow,draft,print}' action over the existing menu.action
        // IPC channel.
        { label: 'Flow',  type: 'radio', id: 'view.flow',  checked: true,
          click: () => sendMenuAction(mainWindow, 'view.flow') },
        { label: 'Draft', type: 'radio', id: 'view.draft', checked: false,
          click: () => sendMenuAction(mainWindow, 'view.draft') },
        { label: 'Print', type: 'radio', id: 'view.print', checked: false,
          click: () => sendMenuAction(mainWindow, 'view.print') },
        { type: 'separator' },
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

// Bundle 1 §A — keep the native View menu's radio state in sync with
// the renderer's Rga.ViewMode. The renderer pushes its current mode
// over this channel whenever it changes (boot, dropdown, Esc-exits-
// Draft, future surfaces). Idempotent; safely no-ops if the menu
// isn't built yet or the view items are missing.
function setViewMenuRadio(mode) {
  const menu = Menu.getApplicationMenu();
  if (!menu) return;
  const viewSub = menu.items.find(function(i) { return i.label === 'View'; });
  if (!viewSub || !viewSub.submenu) return;
  ['view.flow', 'view.draft', 'view.print'].forEach(function(id) {
    const item = viewSub.submenu.items.find(function(i) { return i.id === id; });
    if (item) item.checked = (id === 'view.' + mode);
  });
}

let _ipcRegistered = false;
function registerIpc() {
  if (_ipcRegistered) return;
  _ipcRegistered = true;
  ipcMain.handle('menu.setViewMode', function(_event, mode) {
    setViewMenuRadio(mode);
  });
}

module.exports = { buildMenu, registerIpc, setViewMenuRadio };
