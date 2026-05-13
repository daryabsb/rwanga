// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  const tabs = [];
  let activeTabId = null;
  let tabIdCounter = 0;
  let editorView = null;  // singleton EditorView

  function nextTabId() {
    tabIdCounter += 1;
    return 'tab-' + tabIdCounter;
  }

  function tabBarEl() { return document.getElementById('tab-bar'); }

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

  function snapshotActive() {
    const active = tabs.find(function(t) { return t.id === activeTabId; });
    if (!active || !editorView) return;
    active.editorState = editorView.state;
  }

  function activate(tabId) {
    snapshotActive();
    const tab = tabs.find(function(t) { return t.id === tabId; });
    if (!tab) return;
    activeTabId = tabId;
    renderTabBar();
    if (editorView && tab.editorState) {
      editorView.updateState(tab.editorState);
    }
    if (Rga.FileManager && Rga.FileManager.setActive) Rga.FileManager.setActive(tab.doc);
  }

  function openDocument(doc) {
    const tab = {
      id: nextTabId(),
      doc: doc,
      editorState: null
    };
    if (editorView) {
      tab.editorState = window.RgaProseMirror.EditorState.create({
        schema: editorView.state.schema,
        doc: Rga.Editor.emptyDoc(editorView.state.schema),
        plugins: editorView.state.plugins
      });
    }
    tabs.push(tab);
    activate(tab.id);
    return tab;
  }

  function closeTab(tabId) {
    const idx = tabs.findIndex(function(t) { return t.id === tabId; });
    if (idx < 0) return;
    const tab = tabs[idx];
    if (tab.doc.dirty) {
      const choice = confirm('"' + tab.doc.displayName + '" has unsaved changes. Discard them?');
      if (!choice) return;
    }
    tabs.splice(idx, 1);
    if (activeTabId === tabId) {
      const next = tabs[idx] || tabs[idx - 1];
      if (next) activate(next.id);
      else {
        activeTabId = null;
        renderTabBar();
        // Phase 8 wires the welcome view here; for now editor stays open.
      }
    } else {
      renderTabBar();
    }
  }

  function activeTab() {
    return tabs.find(function(t) { return t.id === activeTabId; }) || null;
  }
  function activeDoc() {
    const t = activeTab();
    return t ? t.doc : null;
  }
  function getTabs() { return tabs.slice(); }

  function init() {
    tabs.length = 0;
    activeTabId = null;
    tabIdCounter = 0;

    const editorEl = document.getElementById('editor');
    if (editorEl && Rga.Editor && Rga.Editor.mount) {
      const mounted = Rga.Editor.mount(editorEl);
      if (mounted) {
        editorView = mounted.view;
      } else {
        console.error('[Rga.TabManager] ProseMirror mount failed — editor will not be interactive');
      }
    }

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
    renderTabBar,
    _editorView: function() { return editorView; }
  };
})();
