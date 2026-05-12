// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const path = require('node:path');
const { app } = require('electron');

function userData() {
  return app.getPath('userData');
}

function workspacePath() {
  return path.join(userData(), 'workspace.json');
}

function prefsPath() {
  return path.join(userData(), 'preferences.json');
}

function autosaveDir() {
  return path.join(userData(), 'autosave');
}

function autosaveManifestPath() {
  return path.join(autosaveDir(), 'manifest.json');
}

function autosaveEntryPath(docId) {
  const safe = String(docId).replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(autosaveDir(), safe + '.bak');
}

function logDir() {
  return path.join(userData(), 'logs');
}

function logPath() {
  return path.join(logDir(), 'main.log');
}

module.exports = {
  userData,
  workspacePath,
  prefsPath,
  autosaveDir,
  autosaveManifestPath,
  autosaveEntryPath,
  logDir,
  logPath,
};
