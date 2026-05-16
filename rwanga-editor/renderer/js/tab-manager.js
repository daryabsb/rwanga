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

  function renderRecentFiles() {
    const container = document.getElementById('empty-state-recent');
    if (!container) return;
    const recent = (Rga.FileManager && Rga.FileManager.getRecent) ? Rga.FileManager.getRecent() : [];
    container.innerHTML = '';
    if (!recent.length) return;
    const label = document.createElement('div');
    label.className = 'editor-empty-state-recent-label';
    label.textContent = 'Recently Opened';
    container.appendChild(label);
    recent.forEach(function(r) {
      const item = document.createElement('button');
      item.className = 'editor-empty-state-recent-item';
      const name = document.createElement('span');
      name.className = 'editor-empty-state-recent-name';
      name.textContent = r.displayName || r.handle;
      const path = document.createElement('span');
      path.className = 'editor-empty-state-recent-path';
      path.textContent = r.handle;
      item.appendChild(name);
      item.appendChild(path);
      item.addEventListener('click', function() {
        if (Rga.FileManager && Rga.FileManager.openRecent) Rga.FileManager.openRecent(r.handle);
      });
      container.appendChild(item);
    });
  }

  function setNoDocState(isEmpty) {
    const ec = document.getElementById('editor-container');
    if (!ec) return;
    ec.classList.toggle('no-doc', isEmpty);
    if (isEmpty) renderRecentFiles();
  }

  function activate(tabId) {
    snapshotActive();
    const tab = tabs.find(function(t) { return t.id === tabId; });
    if (!tab) return;
    activeTabId = tabId;
    setNoDocState(false);
    renderTabBar();
    if (editorView && tab.editorState) {
      editorView.updateState(tab.editorState);
      editorView.focus();
    }
    if (Rga.PageSurface && tab.doc && tab.doc.settings) {
      Rga.PageSurface.apply(tab.doc.settings.pageSetup);
    }
    if (Rga.FileManager && Rga.FileManager.setActive) Rga.FileManager.setActive(tab.doc);
    document.dispatchEvent(new CustomEvent('editor.tabActivated', { detail: { tabId } }));
    if (typeof _saveSession === 'function') _saveSession();
  }

  function openDocument(doc) {
    const tab = {
      id: nextTabId(),
      doc: doc,
      editorState: null
    };
    if (editorView) {
      editorView.setProps({ editable: function() { return true; } });
      const pmDoc = doc.body || Rga.Editor.emptyDoc(editorView.state.schema);
      tab.editorState = window.RgaProseMirror.EditorState.create({
        schema: editorView.state.schema,
        doc: pmDoc,
        plugins: editorView.state.plugins
      });
    }
    tabs.push(tab);
    activate(tab.id);
    if (typeof _saveSession === 'function') _saveSession();
    return tab;
  }

  async function closeTab(tabId) {
    const idx = tabs.findIndex(function(t) { return t.id === tabId; });
    if (idx < 0) return;
    const tab = tabs[idx];
    if (tab.doc.dirty) {
      const choice = (Rga.Modal && Rga.Modal.showUnsaved)
        ? await Rga.Modal.showUnsaved(tab.doc.displayName)
        : (confirm('"' + tab.doc.displayName + '" has unsaved changes. Discard?') ? 'discard' : 'cancel');
      if (choice === 'cancel') return;
      if (choice === 'save') {
        if (activeTabId !== tabId) activate(tabId);
        const saved = await Rga.FileManager.save();
        if (!saved) return;
      }
    }
    // Re-find in case tabs shifted during async save
    const currentIdx = tabs.findIndex(function(t) { return t.id === tabId; });
    if (currentIdx < 0) return;
    tabs.splice(currentIdx, 1);
    if (activeTabId === tabId) {
      const next = tabs[currentIdx] || tabs[currentIdx - 1];
      if (next) activate(next.id);
      else {
        activeTabId = null;
        setNoDocState(true);
        renderTabBar();
        if (editorView) {
          const emptyState = window.RgaProseMirror.EditorState.create({
            schema: editorView.state.schema,
            doc: Rga.Editor.emptyDoc(editorView.state.schema),
            plugins: editorView.state.plugins
          });
          editorView.updateState(emptyState);
          editorView.setProps({ editable: function() { return false; } });
        }
        // Last tab closed — fire editor.tabActivated so the panels
        // (Notes, Flags, Breakdown) refresh against the now-empty doc
        // and clear their orphan cards from the just-closed file.
        document.dispatchEvent(new CustomEvent('editor.tabActivated', { detail: { tabId: null } }));
      }
    } else {
      renderTabBar();
    }
    if (typeof _saveSession === 'function') _saveSession();
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
      const mounted = Rga.Editor.mount(editorEl, { documentType: 'screenplay' });
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

    const emptyNew = document.getElementById('empty-state-new');
    if (emptyNew) {
      emptyNew.addEventListener('click', function() {
        if (Rga.FileManager && Rga.FileManager.newScript) Rga.FileManager.newScript();
      });
    }

    const emptyOpen = document.getElementById('empty-state-open');
    if (emptyOpen) {
      emptyOpen.addEventListener('click', function() {
        if (Rga.FileManager && Rga.FileManager.openFromDialog) Rga.FileManager.openFromDialog();
      });
    }
  }

  // ============================================================
  // Session restore — preserves open tabs across app reloads.
  // Saved to localStorage 'rga-session-tabs' on every open/close/activate.
  // Untitled (no-handle) docs are not saved; use Save As to persist them.
  // ============================================================

  const SESSION_KEY = 'rga-session-tabs';

  function _saveSession() {
    const payload = {
      tabs: tabs.filter(function(t) { return t.doc && t.doc.handle; })
                .map(function(t) {
                  return { handle: t.doc.handle, displayName: t.doc.displayName };
                }),
      activeIndex: (function() {
        const idx = tabs.findIndex(function(t) { return t.id === activeTabId; });
        // Translate to index within the SAVED (with-handle) list
        let savedIdx = 0;
        for (let i = 0; i <= idx; i += 1) {
          if (i === idx) return savedIdx;
          if (tabs[i] && tabs[i].doc && tabs[i].doc.handle) savedIdx += 1;
        }
        return 0;
      })()
    };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(payload)); } catch (_) {}
  }

  function _loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  function bootSession() {
    const saved = _loadSession();
    if (!saved || !Array.isArray(saved.tabs) || !saved.tabs.length) {
      return Promise.resolve(false);
    }
    if (!window.rwanga || !window.rwanga.files || typeof window.rwanga.files.read !== 'function') {
      return Promise.resolve(false);
    }

    const reads = saved.tabs.map(function(t) {
      return window.rwanga.files.read(t.handle).then(function(result) {
        if (result && result.content && Rga.FileManager && Rga.FileManager.openFromContent) {
          Rga.FileManager.openFromContent(t.handle, result.content);
        }
      }).catch(function(err) {
        console.warn('[session] failed to restore', t.handle, err && err.message);
      });
    });

    return Promise.all(reads).then(function() {
      // Activate the saved active tab (or first) if any were restored
      if (tabs.length > 0) {
        const idx = (typeof saved.activeIndex === 'number' && tabs[saved.activeIndex])
          ? saved.activeIndex : 0;
        activate(tabs[idx].id);
      }
      return tabs.length > 0;
    });
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
    bootSession: bootSession,
    _saveSession: _saveSession,
    _editorView: function() { return editorView; }
  };
})();
