// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.Recovery — crash-recovery flow (Persistence Safety Contract §5 / P6).
// Brick 4 owns snapshot interpretation, orphan detection, the Restore/Discard
// UX, and recovered-tab creation. Runs once at boot, before session restore.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  // Restore one orphan as a dirty tab. Returns true on success, false if the
  // snapshot is corrupt (skipped — never fatal to the other orphans).
  function _restoreOne(orphan) {
    let doc;
    try {
      doc = Rga.Doc.deserialize(orphan.rga, orphan.baseHandle || null);
    } catch (_) {
      return false;
    }
    // Reuse the orphan's id as the recovered document's docId — the orphan
    // file becomes this document's own autosave snapshot (Contract §5:
    // kept-until-saved, no duplicate).
    doc.docId = orphan.id;
    Rga.TabManager.openDocument(doc);
    // Recovered work is unsaved — mark dirty so autosave re-arms and the
    // writer must consciously Save (Contract §5; P6 — no auto-restore-to-disk).
    Rga.Doc.markDirty(doc);
    return true;
  }

  function _discardOne(orphan) {
    if (window.rwanga && window.rwanga.autosave
        && typeof window.rwanga.autosave.discard === 'function') {
      window.rwanga.autosave.discard(orphan.id);
    }
  }

  // The boot-time recovery flow. Resolves { restoredCount }.
  async function run() {
    const orphans = (window.rwanga && window.rwanga.autosave
      && typeof window.rwanga.autosave.scanOrphans === 'function')
      ? await window.rwanga.autosave.scanOrphans()
      : [];
    if (!orphans || !orphans.length) return { restoredCount: 0 };

    const choice = (Rga.Modal && typeof Rga.Modal.showRecovery === 'function')
      ? await Rga.Modal.showRecovery(orphans)
      : 'discard';

    if (choice === 'restore') {
      let n = 0;
      for (let i = 0; i < orphans.length; i += 1) {
        if (_restoreOne(orphans[i])) n += 1;
      }
      return { restoredCount: n };
    }

    for (let i = 0; i < orphans.length; i += 1) _discardOne(orphans[i]);
    return { restoredCount: 0 };
  }

  Rga.Recovery = { run, _restoreOne, _discardOne };
})();
