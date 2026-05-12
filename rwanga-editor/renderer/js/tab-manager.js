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

  function activate(tabId) {
    const tab = tabs.find(function(t) { return t.id === tabId; });
    if (!tab) return;
    activeTabId = tabId;
    renderTabBar();
    if (Rga.Editor && Rga.Editor.loadDocument) Rga.Editor.loadDocument(tab.doc);
    if (Rga.FileManager && Rga.FileManager.setActive) Rga.FileManager.setActive(tab.doc);
    if (Rga.SceneManager && Rga.SceneManager.updateNavigatorFor) Rga.SceneManager.updateNavigatorFor(tab.doc, null);
    if (Rga.TagSystem && Rga.TagSystem.updateManagerPanelFor) Rga.TagSystem.updateManagerPanelFor(tab.doc);
    if (Rga.Problems && Rga.Problems.run) Rga.Problems.run();
  }

  function openDocument(doc) {
    const tab = { id: nextTabId(), doc: doc };
    tabs.push(tab);
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
    if (activeTabId === tabId) {
      const next = tabs[idx] || tabs[idx - 1];
      if (next) activate(next.id);
      else {
        activeTabId = null;
        renderTabBar();
        if (Rga.Editor && Rga.Editor.loadDocument) Rga.Editor.loadDocument(null);
      }
    } else {
      renderTabBar();
    }
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

  function init() {
    tabs.length = 0;
    activeTabId = null;
    tabIdCounter = 0;
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
  };
})();
