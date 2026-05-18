// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rwanga', {
  files: {
    pickOpen:    (filters) => ipcRenderer.invoke('files.pickOpen', filters),
    pickFolder:  () => ipcRenderer.invoke('files.pickFolder'),
    read:        (handle) => ipcRenderer.invoke('files.read', handle),
    save:        (handle, content) => ipcRenderer.invoke('files.save', handle, content),
    pickSaveAs:  (suggestedName, content) => ipcRenderer.invoke('files.pickSaveAs', suggestedName, content),
    listFolder:  (handle) => ipcRenderer.invoke('files.listFolder', handle),
    stat:        (handle) => ipcRenderer.invoke('files.stat', handle),
  },
  recent: {
    list:  () => ipcRenderer.invoke('recent.list'),
    touch: (handle, displayName) => ipcRenderer.invoke('recent.touch', handle, displayName),
    clear: () => ipcRenderer.invoke('recent.clear'),
  },
  autosave: {
    write:        (docId, content) => ipcRenderer.invoke('autosave.write', docId, content),
    discard:      (docId) => ipcRenderer.invoke('autosave.discard', docId),
    scanOrphans:  () => ipcRenderer.invoke('autosave.scanOrphans'),
  },
  workspace: {
    read:  () => ipcRenderer.invoke('workspace.read'),
    write: (state) => ipcRenderer.invoke('workspace.write', state),
  },
  prefs: {
    read:  () => ipcRenderer.invoke('prefs.read'),
    write: (partial) => ipcRenderer.invoke('prefs.write', partial),
  },
  export: {
    toPDF: (content, options) => ipcRenderer.invoke('export.toPDF', content, options),
  },
  storage: {
    getReport:            () => ipcRenderer.invoke('storage.getReport'),
    openDataFolder:       () => ipcRenderer.invoke('storage.openDataFolder'),
    clearAutosaves:       (opts) => ipcRenderer.invoke('storage.clearAutosaves', opts),
    clearAutosaveEntry:   (docId) => ipcRenderer.invoke('storage.clearAutosaveEntry', docId),
    clearRecentFiles:     () => ipcRenderer.invoke('storage.clearRecentFiles'),
    resetWorkspace:       () => ipcRenderer.invoke('storage.resetWorkspace'),
    resetPreferences:     () => ipcRenderer.invoke('storage.resetPreferences'),
    clearCorruptBackups:  (kind) => ipcRenderer.invoke('storage.clearCorruptBackups', kind),
    clearPendingUpdate:   () => ipcRenderer.invoke('storage.clearPendingUpdate'),
  },
  updates: {
    getStatus:          () => ipcRenderer.invoke('updates.getStatus'),
    checkNow:           () => ipcRenderer.invoke('updates.checkNow'),
    restartAndInstall:  () => ipcRenderer.invoke('updates.restartAndInstall'),
  },
  window: {
    minimize: () => ipcRenderer.invoke('window.minimize'),
    maximize: () => ipcRenderer.invoke('window.maximize'),
    close:    () => ipcRenderer.invoke('window.close'),
    setTitle: (title) => ipcRenderer.invoke('window.setTitle', title),
    // Regression Fix §B — initial state query for the maximize-button
    // icon resolver in title-bar.js.
    getState: () => ipcRenderer.invoke('window.getState'),
  },
  menu: {
    // Bundle 1 §A — push renderer-owned view-mode state to the native
    // View menu so its radio reflects the current view. The renderer
    // (Rga.ViewMode) is the source of truth; main is the consumer.
    setViewMode: (mode) => ipcRenderer.invoke('menu.setViewMode', mode),
  },
  on: {
    updateDownloaded: (callback) => {
      const handler = (_event, payload) => callback(payload);
      ipcRenderer.on('updates.downloaded', handler);
      return () => ipcRenderer.removeListener('updates.downloaded', handler);
    },
    menuAction: (callback) => {
      const handler = (_event, action) => callback(action);
      ipcRenderer.on('menu.action', handler);
      return () => ipcRenderer.removeListener('menu.action', handler);
    },
    fileOpenRequest: (callback) => {
      const handler = (_event, payload) => callback(payload);
      ipcRenderer.on('files.openRequest', handler);
      return () => ipcRenderer.removeListener('files.openRequest', handler);
    },
    // Regression Fix §A + §B — main pushes `window.state` events on
    // maximize / unmaximize so the renderer can flip the icon and
    // apply body.window-maximized for the Win11 frameless overflow.
    windowState: (callback) => {
      const handler = (_event, payload) => callback(payload);
      ipcRenderer.on('window.state', handler);
      return () => ipcRenderer.removeListener('window.state', handler);
    },
  },
});
