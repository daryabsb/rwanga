// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Flow-view chrome: line numbers, character tinting from tag_registry,
// and page markers (later). Runs only when the active view is Flow.
//
// Line numbers are per visual line — every wrap and every empty paragraph
// the writer typed gets its own number. CSS-only padding between blocks is
// NOT a line. Debounced on every editor state change; recomputed on resize.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  const DEBOUNCE_MS = 120;
  let timer = null;
  let lastViewMode = null;

  // ============================================================
  // Helpers
  // ============================================================

  function _gutter()    { return document.getElementById('flow-line-gutter'); }
  function _container() { return document.getElementById('editor-container'); }
  function _editor()    { return document.getElementById('editor'); }

  function _isFlow() {
    return Rga.ViewMode && Rga.ViewMode.get() === 'flow';
  }

  // Collect every leaf-text "row-producing" element under the editor.
  // We treat each contenteditable block, each outer paragraph/heading, and
  // each slug/transition picker line inside the placeholder as line sources.
  function _collectRowElements(root) {
    if (!root) return [];
    const selectors = [
      '.rga-scene-frame-placeholder-num',
      '.rga-scene-frame-placeholder-slug',
      '.rga-scene-block',
      '.rga-scene-frame-placeholder-transition',
      // Outer body content:
      '.ProseMirror > .rga-title-strip',
      '.ProseMirror p',
      '.ProseMirror h1',
      '.ProseMirror h2',
      '.ProseMirror h3',
      '.ProseMirror blockquote',
      '.ProseMirror li',
      '.ProseMirror .rga-page-break'
    ];
    return Array.prototype.slice.call(root.querySelectorAll(selectors.join(',')));
  }

  // Get the Y positions (relative to gutter origin) of each visual line of
  // an element. Empty elements still contribute one line (the block's top).
  function _lineTops(el, originY) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = range.getClientRects();
    if (!rects || rects.length === 0) {
      const r = el.getBoundingClientRect();
      return [r.top - originY];
    }
    // Deduplicate near-identical tops (PM can return overlapping rects).
    const tops = [];
    let lastTop = -Infinity;
    for (let i = 0; i < rects.length; i += 1) {
      const top = rects[i].top - originY;
      if (top - lastTop > 1) {
        tops.push(top);
        lastTop = top;
      }
    }
    return tops.length ? tops : [el.getBoundingClientRect().top - originY];
  }

  // ============================================================
  // Line numbers
  // ============================================================

  function rebuildLineNumbers() {
    const gutter = _gutter();
    const editor = _editor();
    if (!gutter || !editor) return;
    if (!_isFlow()) { gutter.innerHTML = ''; return; }

    const originRect = gutter.getBoundingClientRect();
    const originY = originRect.top;

    const rows = _collectRowElements(editor);
    const frag = document.createDocumentFragment();

    let lineNum = 0;
    rows.forEach(function(el) {
      const tops = _lineTops(el, originY);
      tops.forEach(function(y) {
        lineNum += 1;
        const d = document.createElement('div');
        d.className = 'flow-line-num';
        d.style.top = y + 'px';
        d.textContent = lineNum;
        frag.appendChild(d);
      });
    });

    gutter.innerHTML = '';
    gutter.appendChild(frag);
    // Match gutter height to last line so its scroll matches the page
    gutter.style.height = (lineNum * 18) + 'px'; // approximate; rebuilt next pass anyway
  }

  // ============================================================
  // Character tinting (color from tag_registry)
  // ============================================================

  // Cleanup pass — the old per-character rainbow tint (one color per name from
  // doc.tagRegistry.characters[].color) was retired 2026-05-16 in favour of a
  // single tag-character color applied via CSS to .rga-tag-character spans.
  // This pass strips any stale inline color residue from the rainbow era so
  // reopening a file that was previously tinted doesn't leave dangling
  // per-character colors locked in via inline style.
  function tintCharacters() {
    const editor = _editor();
    if (!editor) return;
    editor.querySelectorAll('.rga-block-character').forEach(function(el) {
      if (el.style.color) el.style.color = '';
    });
  }

  // ============================================================
  // Scheduling
  // ============================================================

  function setDocTitleVar() {
    const doc = Rga.TabManager && Rga.TabManager.activeDoc && Rga.TabManager.activeDoc();
    let title = '';
    if (doc) {
      title = (doc.metadata && doc.metadata.title) || doc.displayName || '';
    }
    // CSS string: wrap in quotes, escape backslashes and quotes
    const escaped = '"' + String(title).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    const container = _container();
    if (container) container.style.setProperty('--doc-title', escaped);
  }

  function refreshNow() {
    setDocTitleVar();
    rebuildLineNumbers();
    tintCharacters();
  }

  function refresh() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(refreshNow, DEBOUNCE_MS);
  }

  function _onViewChange(mode) {
    lastViewMode = mode;
    if (mode === 'flow') {
      refreshNow();
    } else {
      const g = _gutter();
      if (g) g.innerHTML = '';
    }
  }

  function init() {
    if (!Rga.ViewMode) return;
    lastViewMode = Rga.ViewMode.get();

    Rga.ViewMode.onChange(_onViewChange);

    // Recompute on every editor transaction. We piggyback on PM's
    // dispatchTransaction via a global event the tab-manager fires already.
    document.addEventListener('editor.tabActivated', refresh);

    // PM doesn't expose a doc-changed event globally; rely on observing
    // the editor DOM via MutationObserver.
    const editor = _editor();
    if (editor && window.MutationObserver) {
      const mo = new MutationObserver(function() { refresh(); });
      mo.observe(editor, { childList: true, subtree: true, characterData: true });
    }

    window.addEventListener('resize', refresh);

    // First paints — covers fast and slow doc-load paths.
    setTimeout(refreshNow, 100);
    setTimeout(refreshNow, 500);
    setTimeout(refreshNow, 1500);
  }

  Rga.FlowChrome = { init, refresh: refreshNow, _rebuildLineNumbers: rebuildLineNumbers, _tintCharacters: tintCharacters };
})();
