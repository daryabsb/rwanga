// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { ipcMain, dialog, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

function senderWindow(event) {
  return BrowserWindow.fromWebContents(event.sender);
}

function dialogFiltersFor(filters) {
  filters = filters || { rga: true };
  const list = [];
  if (filters.rga) list.push({ name: 'Rwanga Script', extensions: ['rga'] });
  if (filters.drafts) list.push({ name: 'Draft text', extensions: ['txt', 'md'] });
  list.push({ name: 'All Files', extensions: ['*'] });
  return list;
}

async function readFile(handle) {
  const raw = await fs.readFile(handle, 'utf8');
  return { displayName: path.basename(handle), content: raw };
}

function register() {
  ipcMain.handle('files.pickOpen', async (event, filters) => {
    const win = senderWindow(event);
    const result = await dialog.showOpenDialog(win, {
      title: 'Open',
      filters: dialogFiltersFor(filters),
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths.length) return null;
    const handle = result.filePaths[0];
    const { content } = await readFile(handle);
    return { handle, displayName: path.basename(handle), content };
  });

  ipcMain.handle('files.read', async (_event, handle) => {
    return await readFile(handle);
  });

  ipcMain.handle('files.save', async (_event, handle, content) => {
    await fs.writeFile(handle, content, 'utf8');
    const stat = await fs.stat(handle);
    return { handle, savedAt: stat.mtimeMs };
  });

  ipcMain.handle('files.pickSaveAs', async (event, suggestedName, content) => {
    const win = senderWindow(event);
    const result = await dialog.showSaveDialog(win, {
      title: 'Save As',
      defaultPath: suggestedName || 'Untitled.rga',
      filters: [{ name: 'Rwanga Script', extensions: ['rga'] }],
    });
    if (result.canceled || !result.filePath) return null;
    let target = result.filePath;
    if (!target.toLowerCase().endsWith('.rga')) target = target + '.rga';
    await fs.writeFile(target, content, 'utf8');
    const stat = await fs.stat(target);
    return { handle: target, displayName: path.basename(target), savedAt: stat.mtimeMs };
  });

  ipcMain.handle('files.stat', async (_event, handle) => {
    try {
      const s = await fs.stat(handle);
      return { exists: true, mtime: s.mtimeMs, size: s.size };
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  });
}

module.exports = { register };
