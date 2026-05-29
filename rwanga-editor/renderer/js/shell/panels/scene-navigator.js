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
  // SN.1 — tracks the previous render's current-scene nodeId so the
  // navigator only auto-scrolls when the cursor crosses a scene boundary,
  // not on every incidental re-render (keyboard selection, view changes,
  // ScriptSession ticks where currentScene is unchanged).
  let _lastCurrentNodeId = null;
  // SN-Bundle-1 — transient find/filter text. Substring-matched against
  // scene number + headingDisplay, case-insensitive, never persisted.
  // Cleared on Escape (first press) per UX Direction §10 precedence rule.
  let _filterText = '';

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
      _lastCurrentNodeId = null;
      _filterText = '';
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
    // SN-Bundle-1 — preserve find-input focus + cursor across re-renders.
    // The renderer rebuilds DOM from scratch on every tick (ScriptSession
    // subscriptions, filter changes, manual triggers); without this guard,
    // a writer typing in the find field would lose focus on each keystroke.
    const focusState = _captureFindInputFocus();

    _container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'rga-shell-scene-navigator';
    const view = _activeView();
    const scenes = _scenes(view);

    // True zero-scenes empty: no header, no find — the unified empty surface
    // carries identity. Adding header/find here would duplicate "Scenes" and
    // expose a find input that filters nothing.
    if (!scenes || scenes.length === 0) {
      wrapper.appendChild(_buildEmpty());
      _container.appendChild(wrapper);
      _lastCurrentNodeId = null;
      return;
    }

    // SN-Bundle-1 — header + find above the list, present whenever the doc
    // has scenes (identity stays put through find→no-results→clear loop).
    wrapper.appendChild(_buildHeader(scenes.length));
    wrapper.appendChild(_buildFind());

    const filtered = _filterText ? _applyFilter(scenes, _filterText) : scenes;

    // No-results branch: filter active, zero matches. Header + find stay;
    // the list is replaced by a calm "no scenes found" surface with a
    // Clear affordance. SN.1 does not scroll here (no row in DOM).
    if (filtered.length === 0) {
      wrapper.appendChild(_buildNoResults(_filterText));
      _container.appendChild(wrapper);
      _restoreFindInputFocus(focusState);
      return;
    }

    const idx = (Rga.Nav && typeof Rga.Nav.getIndex === 'function') ? Rga.Nav.getIndex(view.state) : null;
    const currentNodeId = (Rga.ScriptSession && typeof Rga.ScriptSession.get === 'function')
      ? (Rga.ScriptSession.get().currentScene && Rga.ScriptSession.get().currentScene.nodeId) || null
      : null;
    const list = document.createElement('ul');
    list.className = 'rga-shell-scene-navigator-list';
    for (let i = 0; i < filtered.length; i += 1) {
      list.appendChild(_buildRow(filtered[i], idx, currentNodeId));
    }
    wrapper.appendChild(list);
    _container.appendChild(wrapper);

    // SN-Bundle-1: restore find input focus + cursor before the SN.1
    // scroll block so a writer typing in find with the editor cursor
    // simultaneously transitioning scenes does not lose either signal.
    _restoreFindInputFocus(focusState);

    // SN.1 — keep the current-scene row visible. Calm guard: only scroll
    // when the current scene actually changed since the previous render.
    // `block: 'nearest'` is a no-op when the row is already in view, so a
    // writer who manually scrolled the panel won't get yanked unless the
    // cursor itself transitioned to a different scene. Behaviour is auto
    // (instant) per UX Direction §6 — functional confirmation, not motion.
    if (currentNodeId && currentNodeId !== _lastCurrentNodeId) {
      const currentRow = _container.querySelector('.rga-shell-scene-navigator-row-current');
      if (currentRow && typeof currentRow.scrollIntoView === 'function') {
        currentRow.scrollIntoView({ behavior: 'auto', block: 'nearest' });
      }
    }
    // SN-Bundle-1 contract: only update the tracker when the current row
    // is actually rendered. If filter excludes the current scene, leave
    // the tracker stale so a subsequent filter clear re-triggers the
    // scroll-into-view (the user expects "you are here" to be visible
    // again after clearing find).
    if (currentNodeId && _container.querySelector('.rga-shell-scene-navigator-row-current')) {
      _lastCurrentNodeId = currentNodeId;
    } else if (!currentNodeId) {
      _lastCurrentNodeId = null;
    }
  }

  // SN-Bundle-1 — focus preservation across re-render. Capture before
  // innerHTML is wiped; restore after the new input element is in DOM.
  function _captureFindInputFocus() {
    if (!_container) return null;
    const input = _container.querySelector('.rga-shell-scene-navigator-find-input');
    if (!input || (typeof document !== 'undefined' && document.activeElement !== input)) return null;
    return { cursorPos: (typeof input.selectionEnd === 'number') ? input.selectionEnd : (input.value || '').length };
  }
  function _restoreFindInputFocus(state) {
    if (!state || !_container) return;
    const input = _container.querySelector('.rga-shell-scene-navigator-find-input');
    if (!input) return;
    try {
      input.focus();
      if (typeof input.setSelectionRange === 'function') {
        input.setSelectionRange(state.cursorPos, state.cursorPos);
      }
    } catch (_) {
      /* JSDOM occasionally throws on selection-range for text inputs. */
    }
  }

  // Bundle 1 §B: unified empty-state. The Sidebar's renderEmpty
  // helper expects a container, but _render() builds a wrapper first;
  // we return a one-off div that the Sidebar helper has populated.
  // SN-Bundle-1 — copy refreshed to doc-type-neutral voice per UX
  // Direction §11: describe what will appear, not the screenplay-specific
  // mechanic that creates a scene. Title stays "Scenes" (panel identity).
  function _buildEmpty() {
    const host = document.createElement('div');
    Rga.Shell.Sidebar.renderEmpty(host, {
      title: 'Scenes',
      body: 'Scenes will appear here as you write.'
    });
    return host;
  }

  // SN-Bundle-1 — quiet section header + scene count. Non-interactive
  // identity (unlike Outline's collapsible section headers). Counts are
  // raw orientation — the only awareness figure permitted per UX
  // Direction §9 ("at most one figure, used with caution").
  function _buildHeader(count) {
    const header = document.createElement('div');
    header.className = 'rga-shell-scene-navigator-section-header';
    const label = document.createElement('span');
    label.className = 'rga-shell-scene-navigator-section-header-label';
    label.textContent = 'Scenes';
    header.appendChild(label);
    const countEl = document.createElement('span');
    countEl.className = 'rga-shell-scene-navigator-section-header-count';
    countEl.textContent = ' · ' + String(count);
    header.appendChild(countEl);
    return header;
  }

  // SN-Bundle-1 — find field. Single input, substring-matched against
  // scene number + headingDisplay, transient (UX Direction §10).
  // Re-render on input event with focus + cursor preservation (handled
  // in _render itself via _captureFindInputFocus / _restoreFindInputFocus).
  function _buildFind() {
    const wrap = document.createElement('div');
    wrap.className = 'rga-shell-scene-navigator-find';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'rga-shell-scene-navigator-find-input';
    input.placeholder = 'Find scene…';
    input.value = _filterText || '';
    input.setAttribute('aria-label', 'Find scene');
    input.addEventListener('input', function(e) {
      _setFilter(e.target.value);
      _render();
    });
    wrap.appendChild(input);
    return wrap;
  }

  // SN-Bundle-1 — "no results" surface. Reuses the unified panel-empty
  // class set (sidebar.js renderEmpty) so it inherits the same calm voice
  // as the true-empty state. Clear affordance restores the full list.
  function _buildNoResults(query) {
    const host = document.createElement('div');
    Rga.Shell.Sidebar.renderEmpty(host, {
      title: 'No scenes found',
      body: 'No scenes match “' + query + '”.',
      actions: [{
        label: 'Clear',
        onClick: function() {
          _setFilter('');
          _render();
          const input = _container && _container.querySelector('.rga-shell-scene-navigator-find-input');
          if (input) try { input.focus(); } catch (_) {}
        }
      }]
    });
    return host;
  }

  // SN-Bundle-1 — case-insensitive substring filter against the visible
  // signals a writer scans by: scene number (for jumping to "scene 12")
  // and headingDisplay (for jumping to "the dancer scene"). No tag fields,
  // no per-scene meta — staying inside the navigator's "find, not query"
  // posture (UX Direction §10).
  function _applyFilter(scenes, query) {
    const q = String(query || '').toLowerCase();
    if (!q) return scenes;
    return scenes.filter(function(scene) {
      const num = String(scene.sceneNumber == null ? '' : scene.sceneNumber).toLowerCase();
      const heading = String(scene.headingDisplay || '').toLowerCase();
      return num.indexOf(q) >= 0 || heading.indexOf(q) >= 0;
    });
  }

  // SN-Bundle-1 — every filter mutation resets _lastCurrentNodeId so the
  // SN.1 scroll re-fires when the visible row set changes. This restores
  // "you are here" after a filter clear (current scene may have been
  // hidden by the filter; user expects it on-screen when cleared).
  function _setFilter(text) {
    const newText = String(text == null ? '' : text);
    if (newText !== _filterText) {
      _filterText = newText;
      _lastCurrentNodeId = null;
    }
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
    // SN.2 — Lucide marks replace emoji glyphs. Frozen designer picks:
    //   notes    → square-pen           (2 paths)
    //   revision → flag-triangle-right  (1 path)
    // Shape-distinct so the two are tellable apart without relying on
    // color (UX Direction §7 colorblind-safe rule).
    if (scene.hasNotes)        indicators.appendChild(_indicator('square-pen',          'Has notes'));
    if (scene.hasRevisionFlag) indicators.appendChild(_indicator('flag-triangle-right', 'Has revision flag'));
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

  // SN.2 — indicators render as inline Lucide SVG via the established
  // Rga.Icons.Lucide path (also used by the activity rail). The SVG
  // wrapper bakes in aria-hidden="true", so the accessible meaning lives
  // on the container span's aria-label + title (preserved from emoji era).
  // Graceful-degrade per Doctrine Law 11: if Lucide is absent or the icon
  // name is unregistered, the span renders empty body but the aria-label
  // still carries the meaning — assistive tech announces it correctly.
  function _indicator(iconName, label) {
    const sp = document.createElement('span');
    sp.className = 'rga-shell-scene-navigator-indicator';
    sp.setAttribute('data-icon-name', String(iconName));
    const svg = (Rga.Icons && Rga.Icons.Lucide && Rga.Icons.Lucide.has(iconName))
      ? Rga.Icons.Lucide.svgFor(iconName)
      : '';
    sp.innerHTML = svg;
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
    // SN-Bundle-1 — events bubble from the find input into the container's
    // handler. Some keys (Home/End/Enter) collide with input text-cursor
    // semantics; those skip when the target IS the input. Arrow Up/Down
    // are safe to intercept globally (single-line inputs ignore them).
    // Escape is always intercepted because its precedence rule (filter
    // first, then selection) is the same regardless of focus origin.
    const inFindInput = !!(e.target && e.target.classList &&
      e.target.classList.contains('rga-shell-scene-navigator-find-input'));

    // SN-Bundle-1: list operations run against the filtered view, not the
    // raw scene set, so keyboard selection stays inside what the writer
    // can see. Filtering by '' returns the full list — no behaviour change
    // when find is empty.
    const allScenes = _scenes(_activeView());
    if (!allScenes || allScenes.length === 0) return;
    const scenes = _filterText ? _applyFilter(allScenes, _filterText) : allScenes;
    if (scenes.length === 0 && e.key !== 'Escape') return;
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
        if (inFindInput) return;
        e.preventDefault();
        _setSelected(scenes[0].nodeId);
        break;
      }
      case 'End': {
        if (inFindInput) return;
        e.preventDefault();
        _setSelected(scenes[scenes.length - 1].nodeId);
        break;
      }
      case 'Enter': {
        if (inFindInput) return;
        e.preventDefault();
        if (_selectedNodeId) scrollToScene(_selectedNodeId);
        break;
      }
      case 'Escape': {
        e.preventDefault();
        // SN-Bundle-1 precedence (UX Direction §10):
        //   filter has text → first Escape clears filter (stay focused)
        //   filter is empty → Escape clears selection (as today)
        if (_filterText) {
          _setFilter('');
          _render();
          // Re-focus the input if Escape came from inside it, so the
          // writer can keep typing without re-clicking. If Escape came
          // from outside the input, leave focus where it was.
          if (inFindInput) {
            const input = _container.querySelector('.rga-shell-scene-navigator-find-input');
            if (input) try { input.focus(); } catch (_) {}
          }
          break;
        }
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
    _lastCurrentNodeId = null;
    _filterText = '';
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
