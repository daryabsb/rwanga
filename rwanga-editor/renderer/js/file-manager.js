// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  const Doc = Rga.Doc;

  let activeDoc = null;

  function setActive(doc) {
    activeDoc = doc;
    notifyTitle();
  }

  function getActive() { return Rga.TabManager ? Rga.TabManager.activeDoc() : activeDoc; }

  function notifyTitle() {
    const doc = getActive();
    if (!doc) return;
    const dirty = doc.dirty ? '● ' : '';
    const title = `${dirty}${doc.displayName} — Rwanga`;
    if (window.rwanga && window.rwanga.window) {
      window.rwanga.window.setTitle(title);
    }
  }

  async function newScript(seedDefaults) {
    const doc = Doc.create({ seedDefaults });
    Rga.TabManager.openDocument(doc);
    return doc;
  }

  async function openFromDialog() {
    const result = await window.rwanga.files.pickOpen({ rga: true, drafts: true });
    if (!result) return null;
    return openFromContent(result.handle, result.content);
  }

  function openFromContent(handle, content) {
    let doc;
    try {
      doc = Doc.deserialize(content, handle);
    } catch (err) {
      alert(`Cannot open file:\n${err.message}`);
      return null;
    }
    Rga.TabManager.openDocument(doc);
    return doc;
  }

  function captureEditorState(doc) {
    const view = Rga.TabManager && Rga.TabManager._editorView && Rga.TabManager._editorView();
    if (view) doc.body = view.state.doc;
  }

  async function save() {
    if (!activeDoc) return null;
    if (!activeDoc.handle) return await saveAs();
    captureEditorState(activeDoc);
    const content = Doc.serialize(activeDoc);
    try {
      const res = await window.rwanga.files.save(activeDoc.handle, content);
      Doc.clearDirty(activeDoc, res.savedAt);
      notifyTitle();
      if (Rga.TabManager && Rga.TabManager.renderTabBar) Rga.TabManager.renderTabBar();
      return res;
    } catch (err) {
      alert(`Save failed:\n${err.message}`);
      return null;
    }
  }

  async function saveAs() {
    if (!activeDoc) return null;
    captureEditorState(activeDoc);
    const content = Doc.serialize(activeDoc);
    const suggestedName = activeDoc.displayName.endsWith('.rga') ? activeDoc.displayName : 'Untitled.rga';
    try {
      const res = await window.rwanga.files.pickSaveAs(suggestedName, content);
      if (!res) return null;
      Doc.rebindHandle(activeDoc, res.handle);
      Doc.clearDirty(activeDoc, res.savedAt);
      notifyTitle();
      if (Rga.TabManager && Rga.TabManager.renderTabBar) Rga.TabManager.renderTabBar();
      return res;
    } catch (err) {
      alert(`Save As failed:\n${err.message}`);
      return null;
    }
  }

  Rga.FileManager = { newScript, openFromDialog, openFromContent, save, saveAs, setActive, getActive, notifyTitle };
})();
