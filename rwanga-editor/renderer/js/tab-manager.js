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
      const isDoc = t.kind === 'document';
      const dirty = isDoc && t.doc && t.doc.dirty;
      const title = isDoc ? (t.doc && t.doc.displayName) : (t.title || t.workspaceKind || 'Tab');
      el.className = 'tab' +
        (t.id === activeTabId ? ' active' : '') +
        (dirty ? ' dirty' : '') +
        (isDoc ? '' : ' tab-workspace');
      el.dataset.tabId = t.id;
      if (!isDoc) el.dataset.workspaceKind = t.workspaceKind || '';
      el.textContent = (dirty ? '● ' : '') + (title || '');
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
    // Only document tabs hold a PM editor state; workspace tabs have no
    // editorState reference and must not capture the singleton view's
    // state (which belongs to whichever document tab last held focus).
    if (active.kind !== 'document') return;
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

  // RTL Recovery Slice A — text direction is a DOCUMENT property. The active
  // document's screenplayProfile.direction drives #editor's dir attribute on
  // every open / tab activation; every block inherits it (and the dir=rtl CSS
  // resolves the RTL font + start/end alignment). Direction is no longer
  // owned by localStorage / ScriptLanguage.
  function applyDocumentDirection(doc) {
    const editorEl = document.getElementById('editor');
    if (!editorEl) return;
    const profile = doc && doc.metadata && doc.metadata.screenplayProfile;
    const dir = (profile && profile.direction === 'rtl') ? 'rtl' : 'ltr';
    editorEl.setAttribute('dir', dir);
  }

  function activate(tabId) {
    // Snapshot the previously active DOCUMENT tab's PM state before switch.
    // Workspace tabs hold no PM state; their snapshot is a no-op handled
    // inside snapshotActive() (it short-circuits when the active tab has
    // no editorState reference).
    snapshotActive();
    const tab = tabs.find(function(t) { return t.id === tabId; });
    if (!tab) return;
    activeTabId = tabId;
    setNoDocState(false);
    renderTabBar();

    // Per Shell Doctrine — toggle visibility of the renderer subtree.
    // Document tabs reveal [data-renderer="document"]; workspace tabs
    // reveal their own [data-renderer="workspace"][data-workspace-kind=…].
    _applyRendererVisibility(tab);

    if (tab.kind === 'document') {
      if (editorView && tab.editorState) {
        editorView.updateState(tab.editorState);
        editorView.focus();
      }
      if (Rga.PageSurface && tab.doc && tab.doc.settings) {
        Rga.PageSurface.apply(tab.doc.settings.pageSetup);
      }
      applyDocumentDirection(tab.doc);
      if (Rga.FileManager && Rga.FileManager.setActive) Rga.FileManager.setActive(tab.doc);
    }
    // For workspace tabs: do NOT touch editorView (its state belongs
    // to whichever document tab last held focus), do NOT call PageSurface
    // (no doc.settings to apply), do NOT call FileManager.setActive
    // (activeDoc() will correctly return null while this workspace is active).

    document.dispatchEvent(new CustomEvent('editor.tabActivated', { detail: { tabId } }));
    if (typeof _saveSession === 'function') _saveSession();
  }

  // Walk children of #tab-content-host and reveal only the active
  // renderer's subtree. Document renderers carry data-renderer="document";
  // workspace renderers carry data-renderer="workspace" + data-workspace-kind.
  // Renderers outside #tab-content-host (none in v01) are ignored.
  function _applyRendererVisibility(tab) {
    const host = document.getElementById('tab-content-host');
    if (!host) return;
    const isDoc = tab.kind === 'document';
    const children = host.children;
    for (let i = 0; i < children.length; i += 1) {
      const child = children[i];
      const kind = child.getAttribute('data-renderer');
      if (!kind) continue;
      let show = false;
      if (isDoc && kind === 'document') show = true;
      if (!isDoc && kind === 'workspace' &&
          child.getAttribute('data-workspace-kind') === tab.workspaceKind) {
        show = true;
      }
      child.style.display = show ? '' : 'none';
    }
  }

  function openDocument(doc) {
    const tab = {
      id: nextTabId(),
      kind: 'document',
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

  // openWorkspace(workspaceKind) — open or focus a workspace tab.
  // Workspace tabs are singletons per kind: opening the same kind twice
  // focuses the existing tab. Returns the tab, or null if the kind is
  // not registered with Rga.Workspaces.
  function openWorkspace(workspaceKind) {
    const registration = (Rga.Workspaces && typeof Rga.Workspaces.get === 'function')
      ? Rga.Workspaces.get(workspaceKind)
      : null;
    if (!registration) {
      console.warn('[Rga.TabManager.openWorkspace] unknown workspace kind:', workspaceKind);
      return null;
    }
    // Singleton: focus the existing instance if already open.
    const existing = tabs.find(function(t) {
      return t.kind === 'workspace' && t.workspaceKind === workspaceKind;
    });
    if (existing) {
      activate(existing.id);
      return existing;
    }
    // Create the mount element inside #tab-content-host. Each workspace
    // renderer is a sibling div marked with data-renderer="workspace" so
    // the activate-time visibility toggle can target it.
    const host = document.getElementById('tab-content-host');
    let mountEl = null;
    if (host) {
      mountEl = document.createElement('div');
      mountEl.setAttribute('data-renderer', 'workspace');
      mountEl.setAttribute('data-workspace-kind', workspaceKind);
      mountEl.style.display = 'none';  // activate() reveals it
      host.appendChild(mountEl);
      try { registration.mount(mountEl); }
      catch (err) {
        console.error('[Rga.TabManager.openWorkspace] mount failed for', workspaceKind, err);
      }
    }
    const tab = {
      id: nextTabId(),
      kind: 'workspace',
      workspaceKind: workspaceKind,
      title: registration.title,
      mountEl: mountEl,
      _registration: registration
    };
    tabs.push(tab);
    activate(tab.id);
    if (typeof _saveSession === 'function') _saveSession();
    return tab;
  }

  async function closeTab(tabId) {
    const idx = tabs.findIndex(function(t) { return t.id === tabId; });
    if (idx < 0) return;
    const tab = tabs[idx];
    // Shell Doctrine — only DOCUMENT tabs go through CloseGuard (there is
    // no unsaved state to guard on a workspace; per-workspace UI state is
    // either persisted on change or intentionally transient).
    if (tab.kind === 'document') {
      // Persistence Safety Contract §6.2 — the unsaved-changes prompt is
      // owned solely by Rga.CloseGuard; closeTab has no prompt logic.
      const verdict = (Rga.CloseGuard && typeof Rga.CloseGuard.confirmClose === 'function')
        ? await Rga.CloseGuard.confirmClose(tab)
        : 'proceed';
      if (verdict === 'cancel') return;
    } else if (tab.kind === 'workspace') {
      // Run the workspace's optional unmount before removing its DOM.
      try {
        if (tab._registration && typeof tab._registration.unmount === 'function' && tab.mountEl) {
          tab._registration.unmount(tab.mountEl);
        }
      } catch (err) {
        console.warn('[Rga.TabManager.closeTab] workspace unmount threw', err);
      }
      if (tab.mountEl && tab.mountEl.parentNode) {
        tab.mountEl.parentNode.removeChild(tab.mountEl);
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
        applyDocumentDirection(null);
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
    // Workspace tabs have no doc; normalize to null so callers across
    // the codebase get a consistent "no document active" signal regardless
    // of whether zero tabs are open or a workspace tab is currently active.
    if (!t || t.kind !== 'document') return null;
    return t.doc || null;
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
    // Only DOCUMENT tabs with file handles are persisted. Workspace tabs
    // are excluded — they don't restore by handle. Future workspace
    // session-restore will be opt-in per workspace kind (Shell Doctrine
    // §2 restoreOnSession); for v01, no workspace opts in.
    const isPersistableDoc = function(t) {
      return t && t.kind === 'document' && t.doc && t.doc.handle;
    };
    const payload = {
      tabs: tabs.filter(isPersistableDoc).map(function(t) {
        return { handle: t.doc.handle, displayName: t.doc.displayName };
      }),
      activeIndex: (function() {
        const idx = tabs.findIndex(function(t) { return t.id === activeTabId; });
        // Translate to index within the SAVED (document-with-handle) list
        let savedIdx = 0;
        for (let i = 0; i <= idx; i += 1) {
          if (i === idx) return savedIdx;
          if (isPersistableDoc(tabs[i])) savedIdx += 1;
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
      // Brick 4 — session restore MERGES with crash recovery. If this file is
      // already open as a recovered (dirty) tab, the recovered version wins —
      // skip the session reopen so there is no duplicate tab.
      if (tabs.some(function(x) { return x.doc && x.doc.handle === t.handle; })) {
        return Promise.resolve();
      }
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
    openWorkspace,
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
