// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Script Workspace panel — slice-2 plan §3.2.
// NEVER call this a "file browser" / "file tree" / "file explorer".
//
// Workspace = directory containing the active script's file. Enumerated
// via window.rwanga.files.listDirectory (Electron preload IPC). Files
// categorized by extension into 6 groups (render order = scanning order):
//   1. Scripts                .rga, .fountain, .fdx
//   2. References             .pdf, .docx, .epub
//   3. Images & Storyboards   .png, .jpg, .jpeg, .webp, .svg, .gif, .heic
//   4. Audio                  .mp3, .wav, .m4a, .ogg, .flac, .aac, .aiff, .opus, .wma
//   5. Notes                  .md, .txt, .rtf
//   6. Other                  everything else
//
// Audio is first-class — writers collect soundtrack ideas, ambient
// sound, voice memos, interviews. Hiding those under "Other" treats
// them as second-class; the category names them explicitly.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  if (!Rga.Shell || !Rga.Shell.Sidebar || typeof Rga.Shell.Sidebar.registerPanel !== 'function') return;

  // Category definitions in render order. Each: id, label, ext list.
  const CATEGORIES = [
    { id: 'scripts',    label: 'Scripts',              exts: ['.rga', '.fountain', '.fdx'] },
    { id: 'references', label: 'References',           exts: ['.pdf', '.docx', '.epub'] },
    { id: 'images',     label: 'Images & Storyboards', exts: ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.heic'] },
    { id: 'audio',      label: 'Audio',                exts: ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac', '.aiff', '.opus', '.wma'] },
    { id: 'notes',      label: 'Notes',                exts: ['.md', '.txt', '.rtf'] },
    { id: 'other',      label: 'Other',                exts: null }  // catch-all
  ];

  let _container = null;
  let _unsubscribeTabActivated = null;
  let _lastListing = null;       // small cache keyed by directory path
  let _lastDirPath = null;

  const _controller = {
    id: 'scriptWorkspace',
    label: 'Script Workspace',
    icon: 'folder-open',
    shortcut: 'Cmd-Shift-E',
    available: true,
    mount: function(container) {
      _container = container || null;
      _render();
      if (_unsubscribeTabActivated) _unsubscribeTabActivated();
      // Re-enumerate when the active script changes (workspace folder may shift).
      const handler = function() { _lastListing = null; _lastDirPath = null; _render(); };
      document.addEventListener('editor.tabActivated', handler);
      _unsubscribeTabActivated = function() { document.removeEventListener('editor.tabActivated', handler); };
    },
    unmount: function() {
      if (_unsubscribeTabActivated) { _unsubscribeTabActivated(); _unsubscribeTabActivated = null; }
      _container = null;
    }
  };

  if (Rga.Shell.Sidebar.registerPanel) Rga.Shell.Sidebar.registerPanel(_controller);

  // ----------------------------------------------------------------
  // Rendering
  // ----------------------------------------------------------------
  function _render() {
    if (!_container) return;
    _container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'rga-shell-workspace';

    // Header with refresh button.
    const header = document.createElement('div');
    header.className = 'rga-shell-workspace-header';
    const title = document.createElement('span');
    title.className = 'rga-shell-workspace-title';
    title.textContent = 'Script Workspace';
    header.appendChild(title);
    const refresh = document.createElement('button');
    refresh.type = 'button';
    refresh.className = 'rga-shell-workspace-refresh';
    refresh.textContent = '⟳';
    refresh.setAttribute('aria-label', 'Refresh workspace');
    refresh.addEventListener('click', function() { _lastListing = null; _lastDirPath = null; _render(); });
    header.appendChild(refresh);
    wrapper.appendChild(header);

    const dirPath = _workspaceDirectoryPath();
    if (!dirPath) {
      wrapper.appendChild(_emptyState('Open or save a script to see its workspace.'));
      _container.appendChild(wrapper);
      return;
    }

    _enumerate(dirPath).then(function(entries) {
      if (entries == null) {
        wrapper.appendChild(_errorState());
        _flush(wrapper);
        return;
      }
      if (entries.length === 0) {
        wrapper.appendChild(_emptyState('This workspace is empty. Drag in references, images, audio, or notes — or New Script (Cmd-N) to begin.'));
        _flush(wrapper);
        return;
      }
      const grouped = _categorize(entries);
      CATEGORIES.forEach(function(cat) {
        const bucket = grouped[cat.id];
        if (!bucket || bucket.length === 0) return;
        wrapper.appendChild(_categorySection(cat, bucket));
      });
      _flush(wrapper);
    }).catch(function(err) {
      console.error('[script-workspace] enumeration threw:', err);
      wrapper.appendChild(_errorState());
      _flush(wrapper);
    });
  }

  function _flush(wrapper) {
    if (!_container) return;
    _container.innerHTML = '';
    _container.appendChild(wrapper);
  }

  // Bundle 1 §B: unified empty-state. Both no-doc and empty-folder
  // paths go through the Sidebar helper; only the body text differs.
  function _emptyState(text) {
    const host = document.createElement('div');
    Rga.Shell.Sidebar.renderEmpty(host, {
      title: 'Script Workspace',
      body: text
    });
    return host;
  }

  // Error state shares the same empty-state shell + adds a Retry action.
  function _errorState() {
    const host = document.createElement('div');
    Rga.Shell.Sidebar.renderEmpty(host, {
      title: 'Script Workspace',
      body: 'Could not read this workspace.',
      actions: [{
        label: 'Retry',
        onClick: function() { _lastListing = null; _lastDirPath = null; _render(); }
      }]
    });
    return host;
  }

  function _categorySection(cat, entries) {
    const section = document.createElement('section');
    section.className = 'rga-shell-workspace-category';
    section.setAttribute('data-category-id', cat.id);
    const heading = document.createElement('h3');
    heading.className = 'rga-shell-workspace-category-heading';
    heading.textContent = cat.label;
    section.appendChild(heading);
    const list = document.createElement('ul');
    list.className = 'rga-shell-workspace-file-list';
    entries.forEach(function(entry) { list.appendChild(_fileRow(entry)); });
    section.appendChild(list);
    return section;
  }

  function _fileRow(entry) {
    const li = document.createElement('li');
    li.className = 'rga-shell-workspace-file';
    li.setAttribute('data-file-path', entry.path);
    li.setAttribute('data-file-name', entry.name);
    li.setAttribute('role', 'button');
    li.setAttribute('tabindex', '0');
    li.textContent = entry.name;
    li.addEventListener('click', function() { _openEntry(entry); });
    return li;
  }

  // ----------------------------------------------------------------
  // Workspace resolution + IPC enumeration
  // ----------------------------------------------------------------
  function _workspaceDirectoryPath() {
    if (!Rga.TabManager || typeof Rga.TabManager.activeDoc !== 'function') return null;
    const doc = Rga.TabManager.activeDoc();
    if (!doc || !doc.handle) return null;
    return _dirname(doc.handle);
  }

  function _dirname(filePath) {
    if (typeof filePath !== 'string' || filePath.length === 0) return null;
    const sep = filePath.indexOf('\\') >= 0 ? '\\' : '/';
    const i = filePath.lastIndexOf(sep);
    return i > 0 ? filePath.slice(0, i) : null;
  }

  function _enumerate(dirPath) {
    if (_lastListing && _lastDirPath === dirPath) {
      return Promise.resolve(_lastListing);
    }
    if (!window.rwanga || !window.rwanga.files || typeof window.rwanga.files.listDirectory !== 'function') {
      // IPC not available (e.g. web build) — return empty until the layer lands.
      return Promise.resolve([]);
    }
    return Promise.resolve(window.rwanga.files.listDirectory(dirPath)).then(function(entries) {
      if (!Array.isArray(entries)) return null;
      const files = entries.filter(function(e) { return e && !e.isDirectory; });
      _lastListing = files;
      _lastDirPath = dirPath;
      return files;
    });
  }

  function _categorize(entries) {
    const grouped = {};
    CATEGORIES.forEach(function(c) { grouped[c.id] = []; });
    entries.forEach(function(entry) {
      const cat = _categoryFor(entry.name);
      grouped[cat.id].push(entry);
    });
    // Sort each bucket alphabetically.
    Object.keys(grouped).forEach(function(k) {
      grouped[k].sort(function(a, b) { return a.name.localeCompare(b.name); });
    });
    return grouped;
  }

  function _categoryFor(filename) {
    const ext = _ext(filename);
    for (let i = 0; i < CATEGORIES.length - 1; i += 1) {  // skip 'other' (catch-all)
      const cat = CATEGORIES[i];
      if (cat.exts && cat.exts.indexOf(ext) >= 0) return cat;
    }
    return CATEGORIES[CATEGORIES.length - 1];  // 'other'
  }

  function _ext(filename) {
    if (typeof filename !== 'string') return '';
    const i = filename.lastIndexOf('.');
    if (i < 0) return '';
    return filename.slice(i).toLowerCase();
  }

  // ----------------------------------------------------------------
  // Open actions
  // ----------------------------------------------------------------
  function _openEntry(entry) {
    if (!entry) return;
    const ext = _ext(entry.name);
    if (ext === '.rga') {
      if (Rga.FileManager && typeof Rga.FileManager.openFromHandle === 'function') {
        Rga.FileManager.openFromHandle(entry.path);
      }
      return;
    }
    // Non-.rga → open in OS default app via Electron preload IPC.
    if (window.rwanga && window.rwanga.shell && typeof window.rwanga.shell.openPath === 'function') {
      try { window.rwanga.shell.openPath(entry.path); }
      catch (err) { console.error('[script-workspace] openPath threw:', err); }
    }
  }

  // Expose internals for tests.
  Rga.Shell.ScriptWorkspace = Rga.Shell.ScriptWorkspace || {};
  Rga.Shell.ScriptWorkspace._controller = _controller;
  Rga.Shell.ScriptWorkspace._CATEGORIES = CATEGORIES;
  Rga.Shell.ScriptWorkspace._categorize = _categorize;
  Rga.Shell.ScriptWorkspace._categoryFor = _categoryFor;
  Rga.Shell.ScriptWorkspace._dirname = _dirname;
})();
