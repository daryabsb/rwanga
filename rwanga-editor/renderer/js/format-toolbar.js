// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.FormatToolbar — top-of-editor formatting toolbar.
//
// v1 buttons: Bold / Italic / Underline / Strikethrough / Text color /
//             Highlight / Link.
// Selection-aware: each button reflects whether its mark is currently active
// at the cursor. Recomputed on PM state change (we listen for both selection
// changes and the broader tab-activated event).
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  // ============================================================
  // Helpers
  // ============================================================

  function _PM() { return window.RgaProseMirror; }
  // _view returns the canonical EditorView for the active tab.
  // Phase 9: there is exactly one PM editor (v3 single doc), so the
  // old inner-editor lookup is gone.
  function _view() {
    return Rga.TabManager && Rga.TabManager._editorView && Rga.TabManager._editorView();
  }
  function _markType(name) {
    const view = _view();
    if (!view) return null;
    return view.state.schema.marks[name] || null;
  }

  function _markActive(state, markType) {
    const { from, $from, to, empty } = state.selection;
    if (!markType) return false;
    if (empty) return !!markType.isInSet(state.storedMarks || $from.marks());
    return state.doc.rangeHasMark(from, to, markType);
  }

  function _markAttrs(state, markType) {
    if (!markType) return null;
    const { $from, from, to, empty } = state.selection;
    if (empty) {
      const marks = state.storedMarks || $from.marks();
      const m = markType.isInSet(marks);
      return m ? m.attrs : null;
    }
    let found = null;
    state.doc.nodesBetween(from, to, function(node) {
      if (found) return false;
      const m = markType.isInSet(node.marks);
      if (m) found = m.attrs;
      return true;
    });
    return found;
  }

  // ============================================================
  // Commands
  // ============================================================

  function toggleMarkSimple(markName) {
    return function() {
      const view = _view();
      if (!view) return;
      const mt = _markType(markName);
      if (!mt) return;
      const PM = _PM();
      PM.toggleMark(mt)(view.state, view.dispatch);
      view.focus();
    };
  }

  function applyMarkAttrs(markName, attrs) {
    const view = _view();
    if (!view) return;
    const mt = _markType(markName);
    if (!mt) return;
    const PM = _PM();
    const { from, to, empty } = view.state.selection;
    if (empty) return; // marks with attrs need a selection range
    let tr = view.state.tr.removeMark(from, to, mt);
    if (attrs) tr = tr.addMark(from, to, mt.create(attrs));
    view.dispatch(tr);
    view.focus();
  }

  function clearMark(markName) {
    const view = _view();
    if (!view) return;
    const mt = _markType(markName);
    if (!mt) return;
    const { from, to, empty } = view.state.selection;
    if (empty) return;
    view.dispatch(view.state.tr.removeMark(from, to, mt));
    view.focus();
  }

  // ============================================================
  // Color popover
  // ============================================================

  let activeColorMark = null; // 'color' | 'highlight'

  // §D1: the toolbar surface moved from inline #format-toolbar
  // (inside #editor-area) to #rga-shell-toolbar (Row 3 of #app). The
  // resolver tries the new id first; the legacy id is kept as a
  // fallback so the (post-§D1) test fixtures that don't include
  // Row 3 yet don't crash.
  function _toolbar() {
    return document.getElementById('rga-shell-toolbar') ||
           document.getElementById('format-toolbar');
  }
  function _popover()  { return document.getElementById('format-color-popover'); }
  function _customColor() { return document.getElementById('format-color-custom'); }

  function openColorPopover(markName, anchorEl) {
    const pop = _popover();
    if (!pop || !anchorEl) return;
    activeColorMark = markName;
    const rect = anchorEl.getBoundingClientRect();
    pop.style.left = rect.left + 'px';
    pop.style.top = (rect.bottom + 4) + 'px';
    pop.hidden = false;
    setTimeout(function() {
      document.addEventListener('mousedown', _onDocClickClose, { once: true });
    }, 0);
  }
  function closeColorPopover() {
    const pop = _popover();
    if (pop) pop.hidden = true;
    activeColorMark = null;
  }
  function _onDocClickClose(e) {
    const pop = _popover();
    if (pop && !pop.contains(e.target)) closeColorPopover();
  }

  function wireColorPopover() {
    const pop = _popover();
    if (!pop) return;
    pop.addEventListener('click', function(e) {
      const sw = e.target.closest('.format-swatch');
      if (!sw) return;
      const color = sw.dataset.color || '';
      if (!activeColorMark) return;
      if (color) applyMarkAttrs(activeColorMark, { value: color });
      else clearMark(activeColorMark);
      closeColorPopover();
    });
    const custom = _customColor();
    if (custom) {
      custom.addEventListener('input', function() {
        if (!activeColorMark) return;
        applyMarkAttrs(activeColorMark, { value: custom.value });
        // Don't close — let user fine-tune
      });
    }
  }

  // ============================================================
  // Link dialog
  // ============================================================

  function _linkDialog()  { return document.getElementById('format-link-dialog'); }
  function _linkInput()   { return document.getElementById('format-link-input'); }
  function openLinkDialog() {
    const view = _view();
    if (!view) return;
    const dlg = _linkDialog();
    if (!dlg) return;
    const linkType = _markType('link');
    const attrs = _markAttrs(view.state, linkType);
    _linkInput().value = (attrs && attrs.href) || '';
    dlg.hidden = false;
    setTimeout(function() { _linkInput().focus(); }, 0);
  }
  function closeLinkDialog() {
    const dlg = _linkDialog();
    if (dlg) dlg.hidden = true;
  }
  function applyLink() {
    const view = _view();
    if (!view) return;
    const href = (_linkInput().value || '').trim();
    if (!href) return closeLinkDialog();
    applyMarkAttrs('link', { href: href, title: null });
    closeLinkDialog();
  }
  function removeLink() {
    clearMark('link');
    closeLinkDialog();
  }
  function wireLinkDialog() {
    const ok     = document.getElementById('format-link-ok');
    const cancel = document.getElementById('format-link-cancel');
    const remove = document.getElementById('format-link-remove');
    if (ok)     ok.addEventListener('click', applyLink);
    if (cancel) cancel.addEventListener('click', closeLinkDialog);
    if (remove) remove.addEventListener('click', removeLink);
    const input = _linkInput();
    if (input) {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); applyLink(); }
        if (e.key === 'Escape') { e.preventDefault(); closeLinkDialog(); }
      });
    }
  }

  // ============================================================
  // Button state refresh
  // ============================================================

  function refreshActiveStates() {
    const view = _view();
    const toolbar = _toolbar();
    if (!view || !toolbar) return;
    const state = view.state;
    const schema = state.schema;
    // §D1 — Row 3 buttons use data-command="text.<markname>" instead
    // of data-mark. Map the command suffix back to the mark name for
    // active-state lookup.
    toolbar.querySelectorAll('.rga-shell-toolbar-btn[data-command^="text."]').forEach(function(btn) {
      const cmd = btn.dataset.command;
      const name = cmd.slice('text.'.length);
      const mt = schema.marks[name];
      if (!mt) return;
      btn.classList.toggle('active', _markActive(state, mt));
    });
    // Color swatches reflect current selection's color value, if any.
    const colorAttrs = _markAttrs(state, schema.marks.color);
    const sw = document.getElementById('rga-shell-toolbar-color-swatch');
    if (sw) sw.style.background = (colorAttrs && colorAttrs.value) || 'transparent';
    const hlAttrs = _markAttrs(state, schema.marks.highlight);
    const hl = document.getElementById('rga-shell-toolbar-highlight-icon');
    if (hl) hl.style.background = (hlAttrs && hlAttrs.value) || 'transparent';
  }

  // ============================================================
  // Tag selection (Scene toolbox)
  // ============================================================

  function applyTagFromSelection(tagType) {
    if (!tagType) return;
    const view = _view();
    if (!view) return;
    const { from, to, empty } = view.state.selection;
    if (empty) return;
    const text = view.state.doc.textBetween(from, to, ' ').trim();
    if (!text) return;
    const doc = Rga.TabManager && Rga.TabManager.activeDoc && Rga.TabManager.activeDoc();
    if (!doc || !Rga.Doc || typeof Rga.Doc.addEntity !== 'function') return;
    // Add to tag_registry, get its id
    const entityId = Rga.Doc.addEntity(doc, tagType, { name: text, color: null });
    const mt = view.state.schema.marks.tag;
    if (!mt) return;
    view.dispatch(view.state.tr.addMark(from, to, mt.create({ tagType: tagType, entityId: entityId })));
    view.focus();
    // Mark doc dirty so save knows
    if (Rga.Doc.markDirty) Rga.Doc.markDirty(doc);
  }

  // ============================================================
  // Annotation + Revision flag dialogs
  // ============================================================

  let _annotationSelectedColor = '#FFE08A';

  function _annotationDialog() { return document.getElementById('format-annotation-dialog'); }
  function _annotationText()   { return document.getElementById('format-annotation-text'); }
  function openAnnotationDialog() {
    const view = _view();
    if (!view) return;
    const { from, to, empty } = view.state.selection;
    if (empty) return; // need a selection
    const dlg = _annotationDialog();
    if (!dlg) return;
    _annotationText().value = '';
    _annotationSelectedColor = '#FFE08A';
    _refreshAnnotationSwatchSelection();
    dlg.hidden = false;
    setTimeout(function() { _annotationText().focus(); }, 0);
  }
  function closeAnnotationDialog() {
    const dlg = _annotationDialog();
    if (dlg) dlg.hidden = true;
  }
  function applyAnnotation() {
    const view = _view();
    if (!view) return closeAnnotationDialog();
    const text = (_annotationText().value || '').trim();
    if (!Rga.Annotations || typeof Rga.Annotations.addAnnotation !== 'function') {
      return closeAnnotationDialog();
    }
    Rga.Annotations.addAnnotation(view, { text: text, color: _annotationSelectedColor });
    closeAnnotationDialog();
    view.focus();
  }
  function _refreshAnnotationSwatchSelection() {
    const grid = document.getElementById('format-annotation-colors');
    if (!grid) return;
    grid.querySelectorAll('.format-swatch').forEach(function(s) {
      s.classList.toggle('selected', s.dataset.color === _annotationSelectedColor);
    });
  }
  function wireAnnotationDialog() {
    const ok     = document.getElementById('format-annotation-ok');
    const cancel = document.getElementById('format-annotation-cancel');
    const grid   = document.getElementById('format-annotation-colors');
    if (ok)     ok.addEventListener('click', applyAnnotation);
    if (cancel) cancel.addEventListener('click', closeAnnotationDialog);
    if (grid) {
      grid.addEventListener('click', function(e) {
        const sw = e.target.closest('.format-swatch');
        if (!sw) return;
        _annotationSelectedColor = sw.dataset.color || _annotationSelectedColor;
        _refreshAnnotationSwatchSelection();
      });
    }
    const input = _annotationText();
    if (input) {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter')  { e.preventDefault(); applyAnnotation(); }
        if (e.key === 'Escape') { e.preventDefault(); closeAnnotationDialog(); }
      });
    }
  }

  // The toolbar Flag button delegates to Rga.RevisionFlags.showRevisionEditor,
  // which is the same rich popup the right-click menu uses (3 severity
  // swatches + reason). No local dialog is needed.
  function openFlagPopup() {
    const view = _view();
    if (!view) return;
    if (view.state.selection.empty) return;
    if (Rga.RevisionFlags && typeof Rga.RevisionFlags.showRevisionEditor === 'function') {
      Rga.RevisionFlags.showRevisionEditor(view, null, null);
    }
  }

  // ============================================================
  // Clear formatting + Undo / Redo
  // ============================================================

  function clearAllFormatting() {
    const view = _view();
    if (!view) return;
    const { from, to, empty } = view.state.selection;
    if (empty) return;
    const PM = _PM();
    let tr = view.state.tr;
    const marks = view.state.schema.marks;
    Object.keys(marks).forEach(function(name) {
      tr = tr.removeMark(from, to, marks[name]);
    });
    view.dispatch(tr);
    view.focus();
  }

  function doUndo() {
    const view = _view();
    if (!view) return;
    const PM = _PM();
    PM.undo(view.state, view.dispatch);
    view.focus();
  }
  function doRedo() {
    const view = _view();
    if (!view) return;
    const PM = _PM();
    PM.redo(view.state, view.dispatch);
    view.focus();
  }

  // ============================================================
  // Init
  // ============================================================

  // §D2 — shared block-type dispatcher. The Row 3 toolbar dropdown
  // (#rga-shell-toolbar-blocktype) calls this single helper, so the
  // PM.setBlockType invocation lives in one place. (Scene Toolbox
  // dropdown — the prior second consumer — was retired in §A Shell
  // Final Polish; controls migrated entirely to Row 3.)
  function _dispatchBlockType(nodeTypeName) {
    if (!nodeTypeName) return;
    const view = _view();
    const sp = window.Rga && window.Rga.DocTypes && window.Rga.DocTypes.screenplay;
    const PM = _PM();
    if (!view || !sp || !PM) return;
    const nodeType = view.state.schema.nodes[nodeTypeName];
    if (!nodeType || !PM.setBlockType) return;
    PM.setBlockType(nodeType)(view.state, view.dispatch.bind(view));
    view.focus();
  }

  // §D2 — Insert Scene command. Routes ONLY through the existing
  // engine command (Rga.DocTypes.screenplay.v3Commands.insertSceneSmart).
  // No engine modification. No new command logic.
  function _dispatchInsertScene() {
    const view = _view();
    const sp = window.Rga && window.Rga.DocTypes && window.Rga.DocTypes.screenplay;
    if (!view || !sp || !sp.v3Commands || typeof sp.v3Commands.insertSceneSmart !== 'function') return;
    sp.v3Commands.insertSceneSmart(view.state, view.dispatch.bind(view));
    view.focus();
  }

  // §D1 — register the eight Text-tools commands via the §A4.1
  // command layer. KR is the single owner; the Row 3 toolbar invokes
  // via KR.invokeCommand. Bold/Italic carry displayAccelerator
  // ("Ctrl+B" / "Ctrl+I") so the toolbar can show the label — the
  // actual keyboard binding lives in ProseMirror's editor keymap
  // (renderer/js/editor/mount.js) which fires in editor focus context.
  // Underline / Strikethrough / Color / Highlight / Link / Clear have
  // no keyboard accelerator anywhere; their commandAccelerator is ''.
  function registerTextCommands() {
    if (!window.Rga || !window.Rga.KeyboardRegistry ||
        typeof window.Rga.KeyboardRegistry.registerCommand !== 'function') return;
    const KR = window.Rga.KeyboardRegistry;
    KR.registerCommand({ command: 'text.bold',          label: 'Bold',          displayAccelerator: 'Ctrl+B',
      handler: toggleMarkSimple('bold'),          source: 'D1 toolbar (text.bold)' });
    KR.registerCommand({ command: 'text.italic',        label: 'Italic',        displayAccelerator: 'Ctrl+I',
      handler: toggleMarkSimple('italic'),        source: 'D1 toolbar (text.italic)' });
    KR.registerCommand({ command: 'text.underline',     label: 'Underline',
      handler: toggleMarkSimple('underline'),     source: 'D1 toolbar (text.underline)' });
    KR.registerCommand({ command: 'text.strikethrough', label: 'Strikethrough',
      handler: toggleMarkSimple('strikethrough'), source: 'D1 toolbar (text.strikethrough)' });
    KR.registerCommand({ command: 'text.color',         label: 'Text color',
      handler: function() {
        const anchor = document.querySelector('.rga-shell-toolbar-btn[data-command="text.color"]');
        if (anchor) openColorPopover('color', anchor);
      }, source: 'D1 toolbar (text.color)' });
    KR.registerCommand({ command: 'text.highlight',     label: 'Highlight',
      handler: function() {
        const anchor = document.querySelector('.rga-shell-toolbar-btn[data-command="text.highlight"]');
        if (anchor) openColorPopover('highlight', anchor);
      }, source: 'D1 toolbar (text.highlight)' });
    KR.registerCommand({ command: 'text.link',          label: 'Link',
      handler: openLinkDialog,                    source: 'D1 toolbar (text.link)' });
    KR.registerCommand({ command: 'text.clear',         label: 'Clear formatting',
      handler: clearAllFormatting,                source: 'D1 toolbar (text.clear)' });

    // §D2 — Scene tools. scene.insert is invoked by the Row 3 "+ Scene"
    // button. No keyboard accelerator (insertSceneSmart is the engine's
    // canonical path; Tab cycles block type, Enter spawns scenes per
    // v3-keymap.js — neither conflict with a toolbar button).
    KR.registerCommand({ command: 'scene.insert', label: 'Insert Scene',
      handler: _dispatchInsertScene, source: 'D2 toolbar (scene.insert)' });

    // §D3 — Writing tools. Note + Flag wrap the existing
    // openAnnotationDialog / openFlagPopup handlers (the Scene Toolbox
    // buttons call the same functions directly — single owner, two
    // surfaces). Tag is a parameterised dropdown (handled inline on
    // change rather than as a single-fire command). Undo / Redo are
    // NOT re-registered here: the §A4.1 edit.undo / edit.redo commands
    // already own them; the Row 3 buttons declare data-command="edit.
    // undo|redo" and the click delegation invokes via KR.invokeCommand
    // (no new ownership; the toolbar is a third consumer of an
    // existing command).
    KR.registerCommand({ command: 'writing.note', label: 'Add Note',
      handler: openAnnotationDialog, source: 'D3 toolbar (writing.note)' });
    KR.registerCommand({ command: 'writing.flag', label: 'Flag Revision',
      handler: openFlagPopup,        source: 'D3 toolbar (writing.flag)' });
  }

  // §D4 — Mode toggle helpers. Source of truth: Rga.Shell.Layout.
  // toolbar.mode. Screenplay is the only mode with a visible button;
  // the Text button was removed (Manuscript Visual Maturity Bundle §D).
  // The SSOT and persistence pipeline are unchanged. Any persisted
  // 'text' value from a prior session is treated as 'screenplay'
  // because 'text' is no longer in the TOOLBAR_MODES whitelist.
  const TOOLBAR_MODES = ['screenplay'];

  function _readToolbarMode() {
    if (!window.Rga || !window.Rga.Shell || !window.Rga.Shell.Layout) return 'screenplay';
    const snap = window.Rga.Shell.Layout.get();
    const m = snap && snap.toolbar && snap.toolbar.mode;
    return (TOOLBAR_MODES.indexOf(m) !== -1) ? m : 'screenplay';
  }

  function _applyToolbarMode(mode) {
    if (TOOLBAR_MODES.indexOf(mode) === -1) mode = 'screenplay';
    const bar = document.getElementById('rga-shell-toolbar');
    if (bar) bar.setAttribute('data-mode', mode);
    const btns = document.querySelectorAll('.rga-shell-toolbar-mode-btn[data-toolbar-mode]');
    btns.forEach(function(b) {
      const checked = (b.getAttribute('data-toolbar-mode') === mode);
      b.setAttribute('aria-checked', checked ? 'true' : 'false');
      b.classList.toggle('active', checked);
    });
  }

  function _wireToolbarMode() {
    const group = document.querySelector('.rga-shell-toolbar-mode[data-group="mode"]');
    if (!group || group.dataset.wired) return;
    group.dataset.wired = '1';
    // Apply persisted mode on init (Layout.fromJSON has already run
    // via WorkspaceState by the time format-toolbar.init() fires —
    // the boot order in index.html enforces this).
    _applyToolbarMode(_readToolbarMode());
    // Click → write Layout. Layout's subscriber pipeline triggers
    // WorkspaceState._save, so persistence happens for free.
    group.addEventListener('click', function(e) {
      const btn = e.target.closest('.rga-shell-toolbar-mode-btn[data-toolbar-mode]');
      if (!btn) return;
      e.stopPropagation();
      const next = btn.getAttribute('data-toolbar-mode');
      if (TOOLBAR_MODES.indexOf(next) === -1) return;
      if (next === _readToolbarMode()) return; // no-op, no notify
      if (window.Rga && window.Rga.Shell && window.Rga.Shell.Layout) {
        window.Rga.Shell.Layout.set({ toolbar: { mode: next } });
      } else {
        // Layout missing (test fixture, defensive) — still update DOM
        // so the surface stays consistent within this session.
        _applyToolbarMode(next);
      }
    });
    // Subscribe to Layout — keep DOM mirror in sync with any
    // out-of-band writers (palette, menu, future surfaces).
    if (window.Rga && window.Rga.Shell && window.Rga.Shell.Layout &&
        typeof window.Rga.Shell.Layout.subscribe === 'function') {
      window.Rga.Shell.Layout.subscribe(function(next, prev) {
        const a = next && next.toolbar && next.toolbar.mode;
        const b = prev && prev.toolbar && prev.toolbar.mode;
        if (a !== b) _applyToolbarMode(a);
      });
    }
  }

  function init() {
    // §D1 — register text commands FIRST so the Row 3 click delegation
    // and any future menu items can resolve them. Idempotent — KR
    // dedupes commands by id.
    registerTextCommands();

    // §D1 — Row 3 owned toolbar. Click delegation by data-command
    // attribute: every button declares its commandId, dispatch
    // routes through KR.invokeCommand (single owner). No per-button
    // event listeners, no hardcoded mark-name → handler tables.
    const row3 = document.getElementById('rga-shell-toolbar');
    if (row3 && !row3.dataset.wired) {
      row3.dataset.wired = '1';
      row3.addEventListener('click', function(e) {
        const btn = e.target.closest('.rga-shell-toolbar-btn[data-command]');
        if (!btn) return;
        e.stopPropagation();
        const KR = window.Rga && window.Rga.KeyboardRegistry;
        if (KR && typeof KR.invokeCommand === 'function') {
          KR.invokeCommand(btn.dataset.command);
        }
      });
    }

    // §D2 — Row 3 block-type dropdown. Shared _dispatchBlockType helper.
    // Selection-aware: subscribes to Rga.ScriptMetrics so the
    // dropdown's value tracks the cursor's current block type.
    const row3BlockType = document.getElementById('rga-shell-toolbar-blocktype');
    if (row3BlockType) {
      row3BlockType.addEventListener('change', function() {
        _dispatchBlockType(row3BlockType.value);
      });
      if (window.Rga && window.Rga.ScriptMetrics &&
          typeof window.Rga.ScriptMetrics.subscribe === 'function') {
        const sync = function() {
          const snap = window.Rga.ScriptMetrics.get && window.Rga.ScriptMetrics.get();
          const bt = snap && snap.currentBlockType;
          if (!bt) { row3BlockType.value = ''; return; }
          // sceneHeading is held by a disabled+hidden option (lets
          // .value carry it without showing in the dropdown list);
          // any unknown block type falls back to '' (empty).
          const exists = Array.prototype.some.call(row3BlockType.options,
            function(o) { return o.value === bt; });
          row3BlockType.value = exists ? bt : '';
        };
        window.Rga.ScriptMetrics.subscribe(sync);
        sync();
      }
    }

    // Annotation dialog handlers (the dialog DOM lives elsewhere
    // in the page; this only wires the dialog's internal OK/Cancel/
    // color-grid buttons — the launch button is the Row 3 Note button
    // routed via writing.note → openAnnotationDialog).
    wireAnnotationDialog();

    // §D3 — Row 3 Tag dropdown. Calls applyTagFromSelection (the
    // single tagging logic). After applying, reset the dropdown to
    // its placeholder option so re-selecting the same tag re-fires
    // the change event.
    const row3Tag = document.getElementById('rga-shell-toolbar-tag');
    if (row3Tag) {
      row3Tag.addEventListener('change', function() {
        const t = row3Tag.value;
        if (!t) return;
        applyTagFromSelection(t);
        row3Tag.value = '';
      });
    }

    // §D4 — Mode toggle (Screenplay / Text). State owned by
    // Rga.Shell.Layout.toolbar.mode (existing shell-truth surface;
    // persisted via WorkspaceState — no new ownership). Switching
    // mode toggles the data-mode attribute on #rga-shell-toolbar;
    // CSS handles the visibility of Scene + Writing groups. Nothing
    // is unregistered — Scene + Writing commands stay registered in
    // KR and remain reachable via menus / keyboard / scene toolbox.
    _wireToolbarMode();

    // Color / link popover support DOM (popovers live elsewhere in the
    // page; wire their internal handlers regardless of which surface
    // opened them).
    wireColorPopover();
    wireLinkDialog();

    // Selection-aware refresh — the v3 editor's single PM doc emits
    // selectionchange + key events that this listener reacts to.
    document.addEventListener('selectionchange', refreshActiveStates);
    document.addEventListener('editor.tabActivated', refreshActiveStates);
    document.addEventListener('mouseup', refreshActiveStates);
    document.addEventListener('keyup', refreshActiveStates);

    // Initial paint after editor mounts
    setTimeout(refreshActiveStates, 200);
  }

  Rga.FormatToolbar = { init, refresh: refreshActiveStates };
})();
