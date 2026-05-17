// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.Shell.SceneNavigator — the canonical scene-orchestration surface.
// Slice-1 plan §3.7.1 + §3.7.2.
//
// Per-row content: scene number + heading + estimated page + note/flag
// indicators + current-scene mark. Current-scene mark sourced from
// Rga.ScriptSession.currentScene (no independent derivation).
//
// Slice-1 API:
//   Rga.Shell.SceneNavigator.scrollToScene(nodeId) → boolean
//   Rga.Shell.SceneNavigator._reset()              (test helper)
//
// Registered with the Sidebar as panel id 'sceneNavigator'.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Shell = Rga.Shell || {};
  Rga.Shell.SceneNavigator = Rga.Shell.SceneNavigator || {};

  let _container = null;
  let _unsubscribeSession = null;
  // Keyboard-navigation selection. CRITICAL: this is a SEPARATE state from
  // the current-scene indicator. The current-scene indicator follows the
  // editor cursor (sourced from Rga.ScriptSession.currentScene); the
  // selected row follows keyboard focus. They are distinct states by design
  // and never collapse into one. (Plan §3.7.1 + §14 glossary + user sign-off
  // note: "Current scene indicator = editor cursor location; Selected row =
  // keyboard/navigation focus. These are separate states and must remain
  // separate.")
  let _selectedNodeId = null;
  let _keydownHandler = null;

  // ----------------------------------------------------------------
  // Sidebar panel controller
  // ----------------------------------------------------------------
  const _controller = {
    id: 'sceneNavigator',
    label: 'Scenes',
    icon: 'clapperboard',
    shortcut: 'Cmd-Shift-S',
    available: true,
    mount: function(container) {
      _container = container || null;
      _render();
      if (_unsubscribeSession) _unsubscribeSession();
      if (Rga.ScriptSession && typeof Rga.ScriptSession.subscribe === 'function') {
        _unsubscribeSession = Rga.ScriptSession.subscribe(function() { _render(); });
      }
      // Wire keyboard navigation when the panel container is focused.
      if (_container && !_keydownHandler) {
        _container.setAttribute('tabindex', '0');  // make container focusable
        _keydownHandler = function(e) { _onKeydown(e); };
        _container.addEventListener('keydown', _keydownHandler);
      }
    },
    unmount: function() {
      if (_unsubscribeSession) { _unsubscribeSession(); _unsubscribeSession = null; }
      if (_container && _keydownHandler) {
        _container.removeEventListener('keydown', _keydownHandler);
        _keydownHandler = null;
      }
      _selectedNodeId = null;
      _container = null;
    }
  };

  // Register at module load.
  if (Rga.Shell && Rga.Shell.Sidebar && typeof Rga.Shell.Sidebar.registerPanel === 'function') {
    Rga.Shell.Sidebar.registerPanel(_controller);
  }

  // ----------------------------------------------------------------
  // Rendering
  // ----------------------------------------------------------------
  function _render() {
    if (!_container) return;
    _container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'rga-shell-scene-navigator';
    const view = _activeView();
    const scenes = _scenes(view);
    if (!scenes || scenes.length === 0) {
      wrapper.appendChild(_buildEmpty());
      _container.appendChild(wrapper);
      return;
    }
    const idx = (Rga.Nav && typeof Rga.Nav.getIndex === 'function') ? Rga.Nav.getIndex(view.state) : null;
    const currentNodeId = (Rga.ScriptSession && typeof Rga.ScriptSession.get === 'function')
      ? (Rga.ScriptSession.get().currentScene && Rga.ScriptSession.get().currentScene.nodeId) || null
      : null;
    const list = document.createElement('ul');
    list.className = 'rga-shell-scene-navigator-list';
    for (let i = 0; i < scenes.length; i += 1) {
      list.appendChild(_buildRow(scenes[i], idx, currentNodeId));
    }
    wrapper.appendChild(list);
    _container.appendChild(wrapper);
  }

  function _buildEmpty() {
    const el = document.createElement('div');
    el.className = 'rga-shell-scene-navigator-empty';
    el.textContent = 'No scenes yet. Press Enter on the slug line to start one.';
    return el;
  }

  function _buildRow(scene, idx, currentNodeId) {
    const row = document.createElement('li');
    row.className = 'rga-shell-scene-navigator-row';
    row.setAttribute('data-scene-node-id', String(scene.nodeId || ''));
    row.setAttribute('data-scene-number', String(scene.sceneNumber));
    // Two SEPARATE visual states, applied independently:
    //   .rga-shell-scene-navigator-row-current  → matches editor cursor
    //   .rga-shell-scene-navigator-row-selected → matches keyboard focus
    // A row can carry one, the other, both, or neither. They never collapse.
    if (currentNodeId && scene.nodeId === currentNodeId) {
      row.classList.add('rga-shell-scene-navigator-row-current');
    }
    if (_selectedNodeId && scene.nodeId === _selectedNodeId) {
      row.classList.add('rga-shell-scene-navigator-row-selected');
    }

    const num = document.createElement('span');
    num.className = 'rga-shell-scene-navigator-num';
    num.textContent = String(scene.sceneNumber);
    row.appendChild(num);

    const heading = document.createElement('span');
    heading.className = 'rga-shell-scene-navigator-heading';
    heading.textContent = scene.headingDisplay || '';
    row.appendChild(heading);

    const indicators = document.createElement('span');
    indicators.className = 'rga-shell-scene-navigator-indicators';
    if (scene.hasNotes)        indicators.appendChild(_indicator('📝', 'Has notes'));
    if (scene.hasRevisionFlag) indicators.appendChild(_indicator('🚩', 'Has revision flag'));
    row.appendChild(indicators);

    const page = document.createElement('span');
    page.className = 'rga-shell-scene-navigator-page';
    const pageNum = _pageNumberForScene(scene, idx);
    page.textContent = pageNum != null ? 'p.' + pageNum : '';
    row.appendChild(page);

    row.addEventListener('click', function() { scrollToScene(scene.nodeId); });
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');
    return row;
  }

  function _indicator(glyph, label) {
    const sp = document.createElement('span');
    sp.className = 'rga-shell-scene-navigator-indicator';
    sp.textContent = glyph;
    sp.setAttribute('aria-label', label);
    sp.title = label;
    return sp;
  }

  function _pageNumberForScene(scene, idx) {
    if (!idx || !Array.isArray(idx.pages)) return null;
    for (let i = 0; i < idx.pages.length; i += 1) {
      const pg = idx.pages[i];
      if (Array.isArray(pg.sceneIds) && pg.sceneIds.indexOf(scene.nodeId) >= 0) return pg.pageNumber;
    }
    return null;
  }

  // ----------------------------------------------------------------
  // Public navigation API (the single dispatch exception per §1.3)
  // ----------------------------------------------------------------
  function scrollToScene(nodeId) {
    if (!nodeId) return false;
    const view = _activeView();
    if (!view || !view.state) return false;
    if (!Rga.Nav || typeof Rga.Nav.findScene !== 'function') return false;
    const pmPos = Rga.Nav.findScene(view.state.doc, nodeId);
    if (pmPos == null) return false;
    const PM = window.RgaProseMirror;
    if (!PM || !PM.TextSelection) return false;
    try {
      const $pos = view.state.doc.resolve(pmPos + 1);  // inside the scene's first child
      const sel = PM.TextSelection.near($pos);
      view.dispatch(view.state.tr.setSelection(sel).scrollIntoView());
      // V1.1 fix 4 (Scene Navigator click): PM's scrollIntoView is a
      // transaction-meta hint that only scrolls if the cursor would be
      // off-screen. For a navigator-jump we always want the scene's
      // DOM node visible at the top of the editor viewport, even when
      // it's already partially visible. Find the scene node's DOM and
      // explicitly scroll it into view as a backup.
      try {
        const dom = view.nodeDOM(pmPos);
        if (dom && typeof dom.scrollIntoView === 'function') {
          dom.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'auto' });
        }
      } catch (_) {
        /* nodeDOM may throw on transient state — selection already moved. */
      }
      view.focus && view.focus();
      return true;
    } catch (err) {
      console.error('[Rga.Shell.SceneNavigator] scrollToScene threw:', err);
      return false;
    }
  }

  // ----------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------
  function _activeView() {
    if (Rga.TabManager && typeof Rga.TabManager._editorView === 'function') return Rga.TabManager._editorView();
    return null;
  }
  function _scenes(view) {
    if (!view || !view.state) return [];
    if (!Rga.Nav || typeof Rga.Nav.getIndex !== 'function') return [];
    const idx = Rga.Nav.getIndex(view.state);
    return (idx && Array.isArray(idx.scenes)) ? idx.scenes : [];
  }

  // ----------------------------------------------------------------
  // Keyboard navigation (Slice 2)
  // ----------------------------------------------------------------
  // CRITICAL: keyboard navigation moves the selected-row state only.
  // It does NOT move the editor cursor. The current-scene indicator
  // remains pinned to the cursor (sourced from ScriptSession). Enter
  // is the only key that bridges the two: it activates scrollToScene,
  // which moves the cursor, which (on its own) makes the current-scene
  // indicator update via the normal ScriptSession flow.
  function _onKeydown(e) {
    if (!_container) return;
    const scenes = _scenes(_activeView());
    if (!scenes || scenes.length === 0) return;
    const currentIdx = _selectedIndex(scenes);
    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = currentIdx < 0 ? 0 : Math.min(scenes.length - 1, currentIdx + 1);
        _setSelected(scenes[next].nodeId);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prev = currentIdx <= 0 ? 0 : currentIdx - 1;
        _setSelected(scenes[prev].nodeId);
        break;
      }
      case 'Home': {
        e.preventDefault();
        _setSelected(scenes[0].nodeId);
        break;
      }
      case 'End': {
        e.preventDefault();
        _setSelected(scenes[scenes.length - 1].nodeId);
        break;
      }
      case 'Enter': {
        e.preventDefault();
        if (_selectedNodeId) scrollToScene(_selectedNodeId);
        break;
      }
      case 'Escape': {
        // Clear the selection; release focus back to wherever it came from.
        _selectedNodeId = null;
        _render();
        if (_container && typeof _container.blur === 'function') _container.blur();
        break;
      }
      default: return;
    }
  }

  function _selectedIndex(scenes) {
    if (!_selectedNodeId) return -1;
    for (let i = 0; i < scenes.length; i += 1) {
      if (scenes[i].nodeId === _selectedNodeId) return i;
    }
    return -1;
  }

  function _setSelected(nodeId) {
    _selectedNodeId = nodeId;
    _render();
    // Scroll the selected row into view within the panel (DOM-only — does
    // NOT move the editor cursor).
    if (_container) {
      const row = _container.querySelector('[data-scene-node-id="' + nodeId + '"]');
      if (row && typeof row.scrollIntoView === 'function') {
        row.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  // ----------------------------------------------------------------
  // focusRow(nodeId) — public API for cross-panel orchestration
  // ----------------------------------------------------------------
  // Called by the Outline panel when a writer clicks a scene there.
  // Sets the selected-row state. Does NOT move the editor cursor —
  // pair this with scrollToScene if cursor movement is wanted too.
  function focusRow(nodeId) {
    if (!nodeId) return false;
    const scenes = _scenes(_activeView());
    if (!scenes || scenes.length === 0) return false;
    let found = false;
    for (let i = 0; i < scenes.length; i += 1) {
      if (scenes[i].nodeId === nodeId) { found = true; break; }
    }
    if (!found) return false;
    _setSelected(nodeId);
    return true;
  }

  function selectedRowNodeId() {
    return _selectedNodeId;
  }

  function _reset() {
    if (_unsubscribeSession) { _unsubscribeSession(); _unsubscribeSession = null; }
    if (_container && _keydownHandler) {
      _container.removeEventListener('keydown', _keydownHandler);
      _keydownHandler = null;
    }
    _selectedNodeId = null;
    if (_container) _container.innerHTML = '';
    _container = null;
  }

  Rga.Shell.SceneNavigator.scrollToScene     = scrollToScene;
  Rga.Shell.SceneNavigator.focusRow          = focusRow;
  Rga.Shell.SceneNavigator.selectedRowNodeId = selectedRowNodeId;
  Rga.Shell.SceneNavigator._reset            = _reset;
  Rga.Shell.SceneNavigator._controller       = _controller;
  Rga.Shell.SceneNavigator._render           = _render;  // test helper
})();
