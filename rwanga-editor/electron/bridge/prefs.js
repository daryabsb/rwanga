// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// User preferences bridge — Settings Architecture Doctrine, user tier.
// Persists to <userData>/preferences.json. The Settings Store is the
// sole renderer-side caller via window.rwanga.prefs.read / write.
'use strict';

const { ipcMain } = require('electron');
const { readJsonOrSeed, writeJsonAtomic } = require('../lib/json-file');
const { prefsPath } = require('../lib/paths');

function register() {
  // Read the whole prefs object. Seeded with `{}` on first run; a
  // corrupt file is renamed to .bad-<timestamp> by readJsonOrSeed and
  // a fresh empty file is written in its place (same recovery policy
  // as the autosave bridge).
  ipcMain.handle('prefs.read', async () => {
    return await readJsonOrSeed(prefsPath(), {});
  });

  // Merge a partial set of {id: value} entries into the prefs file and
  // write atomically. Returns the merged object so the caller can
  // confirm what landed on disk.
  ipcMain.handle('prefs.write', async (_event, partial) => {
    if (!partial || typeof partial !== 'object') return await readJsonOrSeed(prefsPath(), {});
    const current = await readJsonOrSeed(prefsPath(), {});
    const merged = Object.assign({}, current, partial);
    await writeJsonAtomic(prefsPath(), merged);
    return merged;
  });
}

module.exports = { register };
