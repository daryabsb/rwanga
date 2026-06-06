// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.Recovery — crash-recovery flow (Persistence Safety Contract §5 / P6).
// Brick 4 owns snapshot interpretation, orphan detection, the Restore/Discard
// UX, and recovered-tab creation.
//
// Recovery is an APP-LAUNCH event, not a renderer-LOAD event. A renderer can
// reload mid-session without a crash or a graceful quit — the dev live-reload
// watcher does this on any renderer file change (and any future in-session
// reload would too). On such a reload the main process and the live autosave
// snapshots both survive, so scanOrphans() would surface the STILL-LIVE
// document's own snapshot as if it were a crash orphan — producing a spurious
// "Recover unsaved work?" prompt for the document the writer is actively
// editing (and, if Discarded, losing it — an untitled doc is not recoverable
// by session restore).
//
// We distinguish the two with sessionStorage, which survives a page reload but
// is cleared when the window/process is gone:
//   * fresh app launch  → no flag → genuine crash recovery → PROMPT (user decides).
//   * in-session reload → flag set → the snapshots belong to the live session →
//                         restore them SILENTLY (continuity; never prompt/discard).
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  // sessionStorage flag: set on the first recovery run in this window, read on
  // every subsequent run. A reload preserves it; a new window/process clears it.
  const BOOT_FLAG = 'rga-recovery-session-booted';

  function _isReloadBoot() {
    // Storage may be unavailable (opaque origin in some test harnesses). Treat
    // that as a fresh launch — prompting is always the SAFE default (it never
    // loses work), it is only the spurious prompt we want to avoid.
    try { return window.sessionStorage.getItem(BOOT_FLAG) === '1'; }
    catch (_) { return false; }
  }
  function _markBooted() {
    try { window.sessionStorage.setItem(BOOT_FLAG, '1'); } catch (_) {}
  }

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
    // Read the reload flag BEFORE marking this boot, so the first run of the
    // window sees "fresh launch" and every later run (reload) sees "reload".
    const isReload = _isReloadBoot();
    _markBooted();

    const orphans = (window.rwanga && window.rwanga.autosave
      && typeof window.rwanga.autosave.scanOrphans === 'function')
      ? await window.rwanga.autosave.scanOrphans()
      : [];
    if (!orphans || !orphans.length) return { restoredCount: 0 };

    // In-session reload (not a crash, not a quit): the snapshots are the live
    // session's own. Restore them silently to preserve continuity — NEVER
    // prompt, NEVER discard (Discard here would delete a live snapshot, and an
    // untitled doc would be lost outright). Session restore runs after this and
    // dedupes saved files by handle, so there are no duplicate tabs.
    if (isReload) {
      let n = 0;
      for (let i = 0; i < orphans.length; i += 1) {
        if (_restoreOne(orphans[i])) n += 1;
      }
      return { restoredCount: n, reload: true };
    }

    // Fresh app launch — genuine crash recovery. The writer decides.
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

  Rga.Recovery = { run, _restoreOne, _discardOne, _isReloadBoot, _markBooted };
})();
