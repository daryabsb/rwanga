// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.CloseGuard — the single owner of the unsaved-changes confirmation
// (Persistence Safety Contract §6 / §2). Both Rga.TabManager.closeTab and
// the app-close flow route through it; there is no other unsaved prompt.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  // Confirm closing ONE tab's document.
  //   tab = { id, kind, doc }
  // Workspace tabs (Shell Doctrine — kind !== 'document') have no
  // unsaved state to guard; close immediately. Returns 'proceed' for
  // them. For documents: 'proceed' (clean, discarded, or successfully
  // saved) or 'cancel'.
  async function confirmClose(tab) {
    if (!tab) return 'proceed';
    if (tab.kind && tab.kind !== 'document') return 'proceed';
    if (!tab.doc || !tab.doc.dirty) return 'proceed';

    const name = tab.doc.displayName;
    const choice = (Rga.Modal && typeof Rga.Modal.showUnsaved === 'function')
      ? await Rga.Modal.showUnsaved(name)
      : (window.confirm('"' + name + '" has unsaved changes. Discard?') ? 'discard' : 'cancel');

    if (choice === 'cancel') return 'cancel';
    if (choice === 'save') {
      // The document must be the active tab for FileManager.save to target it.
      if (Rga.TabManager && typeof Rga.TabManager.activate === 'function') {
        Rga.TabManager.activate(tab.id);
      }
      const saved = (Rga.FileManager && typeof Rga.FileManager.save === 'function')
        ? await Rga.FileManager.save()
        : null;
      if (!saved) return 'cancel';   // save failed or was cancelled
    } else if (choice === 'discard') {
      // Persistence Safety Contract §5 — abandoning the changes also discards
      // the recovery snapshot, so a graceful quit leaves no orphan behind.
      if (window.rwanga && window.rwanga.autosave
          && typeof window.rwanga.autosave.discard === 'function') {
        window.rwanga.autosave.discard(tab.doc.docId);
      }
    }
    return 'proceed';   // 'discard' (snapshot cleared) or a successful 'save'
  }

  // Confirm closing the whole app. Prompts each dirty document SEQUENTIALLY
  // (Contract §6, locked decision 4). Any 'cancel' aborts the whole quit.
  // Returns true to allow the close, false to abort it.
  async function confirmAppClose() {
    const tabs = (Rga.TabManager && typeof Rga.TabManager.tabs === 'function')
      ? Rga.TabManager.tabs()
      : [];
    for (let i = 0; i < tabs.length; i += 1) {
      const tab = tabs[i];
      // Skip workspace tabs (no dirty state) and clean document tabs.
      if (!tab) continue;
      if (tab.kind && tab.kind !== 'document') continue;
      if (!tab.doc || !tab.doc.dirty) continue;
      const verdict = await confirmClose(tab);
      if (verdict === 'cancel') return false;
    }
    return true;
  }

  Rga.CloseGuard = { confirmClose, confirmAppClose };
})();
