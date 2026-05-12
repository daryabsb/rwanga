// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  const tabs = [];
  let activeTabId = null;
  let tabIdCounter = 0;

  function nextTabId() {
    tabIdCounter += 1;
    return 'tab-' + tabIdCounter;
  }

  function tabBarEl() { return document.getElementById('tab-bar'); }
  function editorAreaEl() { return document.getElementById('editor-area'); }

  function renderTabBar() {
    const bar = tabBarEl();
    if (!bar) return;
    const newBtn = bar.querySelector('#tab-new');
    bar.innerHTML = '';
    tabs.forEach(function(t) {
      const el = document.createElement('button');
      el.className = 'tab' + (t.id === activeTabId ? ' active' : '') + (t.doc.dirty ? ' dirty' : '');
      el.dataset.tabId = t.id;
      el.textContent = (t.doc.dirty ? '● ' : '') + t.doc.displayName;
      el.addEventListener('click', function() { activate(t.id); });
      const close = document.createElement('span');
      close.className = 'tab-close';
      close.textContent = '×';
      close.addEventListener('click', function(e) {
        e.stopPropagation();
        closeTab(t.id);
      });
      el.appendChild(close);
      bar.appendChild(el);
    });
    if (newBtn) bar.appendChild(newBtn);
  }

  function ensureEditorContainer(tab) {
    let container = document.querySelector('[data-tab-id="' + tab.id + '"][data-role="editor-container"]');
    if (!container) {
      container = document.createElement('div');
      container.dataset.tabId = tab.id;
      container.dataset.role = 'editor-container';
      container.className = 'tab-editor-container';
      container.innerHTML = '<div class="gutter" data-role="gutter"></div><div class="editor-surface" contenteditable="true" data-role="editor"></div>';
      const area = editorAreaEl();
      if (area) area.appendChild(container);
    }
    return container;
  }

  function showOnly(tabId) {
    document.querySelectorAll('[data-role="editor-container"]').forEach(function(c) {
      c.style.display = c.dataset.tabId === tabId ? '' : 'none';
    });
  }

  function bindEditorInputHandler(tab) {
    const container = ensureEditorContainer(tab);
    const ed = container.querySelector('[data-role="editor"]');
    if (!ed || ed.dataset.bound === '1') return;
    ed.dataset.bound = '1';
    ed.addEventListener('input', function() {
      if (!tab.doc.dirty) {
        Rga.Doc.markDirty(tab.doc);
        renderTabBar();
        if (Rga.FileManager && Rga.FileManager.notifyTitle) Rga.FileManager.notifyTitle();
      }
      if (Rga.SceneManager && Rga.SceneManager.updateNavigatorFor) Rga.SceneManager.updateNavigatorFor(tab.doc, container);
      if (Rga.TagSystem && Rga.TagSystem.updateManagerPanelFor) Rga.TagSystem.updateManagerPanelFor(tab.doc);
      if (Rga.Problems && Rga.Problems.runFor) Rga.Problems.runFor(tab.doc, container);
    });
  }

  function loadDocIntoContainer(tab) {
    const container = ensureEditorContainer(tab);
    if (Rga.Editor && Rga.Editor.loadDocumentInto) {
      Rga.Editor.loadDocumentInto(tab.doc, container);
    }
    bindEditorInputHandler(tab);
  }

  function activate(tabId) {
    const tab = tabs.find(function(t) { return t.id === tabId; });
    if (!tab) return;
    activeTabId = tabId;
    showOnly(tabId);
    renderTabBar();
    const container = ensureEditorContainer(tab);
    if (Rga.SceneManager && Rga.SceneManager.updateNavigatorFor) Rga.SceneManager.updateNavigatorFor(tab.doc, container);
    if (Rga.TagSystem && Rga.TagSystem.updateManagerPanelFor) Rga.TagSystem.updateManagerPanelFor(tab.doc);
    if (Rga.Problems && Rga.Problems.runFor) Rga.Problems.runFor(tab.doc, container);
    if (Rga.FileManager && Rga.FileManager.setActive) Rga.FileManager.setActive(tab.doc);
  }

  function openDocument(doc) {
    const tab = { id: nextTabId(), doc: doc };
    tabs.push(tab);
    loadDocIntoContainer(tab);
    activate(tab.id);
    return tab;
  }

  function closeTab(tabId, opts) {
    opts = opts || {};
    const idx = tabs.findIndex(function(t) { return t.id === tabId; });
    if (idx < 0) return;
    const tab = tabs[idx];
    if (tab.doc.dirty && !opts.skipDirtyCheck) {
      const choice = confirm('"' + tab.doc.displayName + '" has unsaved changes. Discard them?');
      if (!choice) return;
    }
    tabs.splice(idx, 1);
    const container = document.querySelector('[data-tab-id="' + tabId + '"][data-role="editor-container"]');
    if (container && container.parentNode) container.parentNode.removeChild(container);
    if (activeTabId === tabId) {
      const next = tabs[idx] || tabs[idx - 1];
      if (next) activate(next.id);
      else activeTabId = null;
    }
    renderTabBar();
    if (Rga.AutosaveClient && Rga.AutosaveClient.discard) Rga.AutosaveClient.discard(tab.doc.docId);
  }

  function activeTab() {
    return tabs.find(function(t) { return t.id === activeTabId; }) || null;
  }
  function activeDoc() {
    const t = activeTab();
    return t ? t.doc : null;
  }
  function getTabs() { return tabs.slice(); }
  function containerFor(tabId) {
    return document.querySelector('[data-tab-id="' + tabId + '"][data-role="editor-container"]');
  }

  function init() {
    tabs.length = 0;
    activeTabId = null;
    tabIdCounter = 0;
    document.querySelectorAll('[data-role="editor-container"]').forEach(function(c) {
      if (c.parentNode) c.parentNode.removeChild(c);
    });
    const newBtn = document.getElementById('tab-new');
    if (newBtn) {
      newBtn.addEventListener('click', function() {
        if (Rga.FileManager && Rga.FileManager.newScript) Rga.FileManager.newScript();
      });
    }
  }

  Rga.TabManager = {
    init,
    openDocument,
    closeTab,
    activate,
    activeTab,
    activeDoc,
    tabs: getTabs,
    containerFor,
    renderTabBar,
  };
})();
