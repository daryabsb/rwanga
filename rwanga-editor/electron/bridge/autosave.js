// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Persistence Safety Contract §4 / §5 / §2 — the autosave snapshot store. The
// sole writer / deleter / reader of <userData>/autosave/.
'use strict';

const { ipcMain } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { writeFileAtomic } = require('../lib/atomic-write');
const { autosaveEntryPath, autosaveDir } = require('../lib/paths');

function register() {
  // Write a recovery snapshot. The envelope is written ATOMICALLY (Brick 1
  // primitive) so a crash mid-snapshot cannot corrupt the snapshot itself.
  ipcMain.handle('autosave.write', async (_event, docId, envelope) => {
    await writeFileAtomic(autosaveEntryPath(docId), JSON.stringify(envelope, null, 2));
    return { ok: true };
  });

  // Discard a document's snapshot (on a successful manual save, or when the
  // writer discards the changes).
  ipcMain.handle('autosave.discard', async (_event, docId) => {
    await fs.rm(autosaveEntryPath(docId), { force: true });
    return { ok: true };
  });

  // Persistence Safety Contract §5 — list crash-orphan snapshots. A graceful
  // quit discards every snapshot (close guard + manual save), so any
  // *.autosave.json still present is a crash orphan.
  ipcMain.handle('autosave.scanOrphans', async () => {
    let files;
    try { files = await fs.readdir(autosaveDir()); }
    catch (_) { return []; }   // the autosave directory does not exist yet
    const orphans = [];
    for (const f of files) {
      if (!f.endsWith('.autosave.json')) continue;
      try {
        const env = JSON.parse(await fs.readFile(path.join(autosaveDir(), f), 'utf8'));
        orphans.push({
          id: f.slice(0, -'.autosave.json'.length),
          savedAt: env.savedAt || null,
          baseHandle: env.baseHandle || null,
          baseDisplayName: env.baseDisplayName || 'Untitled.rga',
          rga: env.rga
        });
      } catch (_) { /* skip a corrupt / partially-written snapshot */ }
    }
    return orphans;
  });
}

module.exports = { register };
