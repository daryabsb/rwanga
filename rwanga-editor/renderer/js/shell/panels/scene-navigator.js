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
  // Search-v1 — per-render map of nodeId → snippet parts for scenes whose
  // match came from BODY text (not the slug). Rebuilt from scratch on every
  // _render; empty when no filter is active or when all matches were
  // slug-only. The snippet is the ONLY place a match is highlighted — never
  // the editor (no decorations, no editor highlight).
  let _snippets = {};
  // Marks-Expansion-v1 — set of nodeIds whose mark detail (note / revision
  // flag presence) is expanded. Module-level so expansion survives navigator
  // re-renders (ScriptSession ticks, filter changes, keyboard selection);
  // multiple scenes may be expanded at once. Cleared only on unmount/_reset.
  const _expanded = new Set();
  // Scene Navigator Tags v1.1 — set of expanded entity occurrence-lists,
  // keyed "sceneNodeId::tagType::entityId" so the same entity expands
  // independently per scene. Survives navigator re-renders; cleared only on
  // unmount / _reset.
  const _expandedTagEntities = new Set();

  // Scene Navigator Tags v1 — canonical category order + display labels for
  // the scene-local tagged-entity groups. Keys are SceneBundle bundle-keys
  // (Rga.Screenplay.SceneCatalog), labels mirror the Tags Panel's
  // TAG_GROUP_LABELS so the two surfaces read identically.
  const _SCENE_TAG_GROUPS = [
    { key: 'characters', label: 'Characters' },
    { key: 'props',      label: 'Props'      },
    { key: 'wardrobe',   label: 'Wardrobe'   },
    { key: 'locations',  label: 'Locations'  },
    { key: 'sfx',        label: 'SFX'        },
    { key: 'vfx',        label: 'VFX'        },
    { key: 'vehicles',   label: 'Vehicles'   },
    { key: 'animals',    label: 'Animals'    },
    { key: 'custom',     label: 'Custom'     }
  ];

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
      // Search-v1.1 — drop any selected-match highlight when the navigator
      // goes away, so it doesn't linger in the editor.
      if (Rga.SearchHighlight && typeof Rga.SearchHighlight.clear === 'function') {
        Rga.SearchHighlight.clear(_activeView());
      }
      if (_unsubscribeSession) { _unsubscribeSession(); _unsubscribeSession = null; }
      if (_container && _keydownHandler) {
        _container.removeEventListener('keydown', _keydownHandler);
        _keydownHandler = null;
      }
      _selectedNodeId = null;
      _lastCurrentNodeId = null;
      _filterText = '';
      _snippets = {};
      _expanded.clear();
      _expandedTagEntities.clear();
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
    // RTL — the navigator catalogues the active script's scenes, so it
    // mirrors the script's writing direction (the SAME source #editor reads
    // via TabManager.applyDocumentDirection: the active document's
    // metadata.screenplayProfile.direction). Setting dir on the wrapper flips
    // the row grid, the chevron's inline-start position, the caret, and the
    // marks-zone indent — all via logical CSS. LTR scripts default to 'ltr',
    // so the accepted LTR layout is unchanged.
    wrapper.setAttribute('dir', _scriptDirection());
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

    // Search-v1 — _snippets is rebuilt from scratch each render. When a
    // query is active, walk the doc once for body text, filter on slug OR
    // body, then build snippets for body-only matches. No query → no walk.
    _snippets = {};
    let filtered = scenes;
    if (_filterText) {
      const bodyMap = _sceneBodyTextMap(view);
      filtered = _applyFilter(scenes, _filterText, bodyMap);
      _buildSnippets(filtered, _filterText, bodyMap);
    }

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

  // SN-Bundle-1 — slug/number match: the visible signals a writer scans by
  // (scene number + headingDisplay). Pure, no doc walk. Search-v1 keeps this
  // intact and adds body-text matching on top.
  function _slugMatch(scene, q) {
    const num = String(scene.sceneNumber == null ? '' : scene.sceneNumber).toLowerCase();
    const heading = String(scene.headingDisplay || '').toLowerCase();
    return num.indexOf(q) >= 0 || heading.indexOf(q) >= 0;
  }

  // Search-v1 — case-insensitive filter matching scene number + heading
  // (slug) OR scene body text. `bodyMap` is { nodeId: normalizedBodyText }
  // from _sceneBodyTextMap(); when it is absent (e.g. a doc without
  // descendants, as in lean unit stubs) only slug/number matching applies —
  // exactly the pre-Search-v1 behaviour, so existing behaviour is preserved.
  function _applyFilter(scenes, query, bodyMap) {
    const q = String(query || '').toLowerCase();
    if (!q) return scenes;
    return scenes.filter(function(scene) {
      if (_slugMatch(scene, q)) return true;
      const body = (bodyMap && scene.nodeId != null) ? (bodyMap[scene.nodeId] || '') : '';
      return body.toLowerCase().indexOf(q) >= 0;
    });
  }

  // Search-v1 — one direct document walk collecting each scene's BODY text
  // (everything EXCEPT the scene heading, which slug matching already
  // covers). Returns { nodeId: normalizedText }; whitespace collapsed so
  // snippet windows read cleanly. Degrades to {} when the active doc can't
  // be walked (no view / no descendants) → callers fall back to slug-only
  // matching with zero behaviour change.
  //
  // Scope note (Search-v1): a deliberate O(doc) pass per filter render — no
  // cached index, no nav-index change, no schema change, no scrollToPos, no
  // match-position tracking. It runs only while a query is active (empty
  // query → no walk), and the nav-index plugin already walks the full doc
  // on every keystroke, so this adds at most one comparable pass.
  function _sceneBodyTextMap(view) {
    const map = {};
    const doc = view && view.state && view.state.doc;
    if (!doc || typeof doc.descendants !== 'function') return map;
    let currentId = null;
    doc.descendants(function(node) {
      if (!node || !node.type) return true;
      if (node.type.name === 'scene') {
        currentId = (node.attrs && node.attrs.id != null) ? String(node.attrs.id) : null;
        if (currentId) map[currentId] = '';
        return true;  // descend to collect body blocks
      }
      // Skip the heading subtree — its text is the slug, matched separately.
      if (node.type.name === 'sceneHeading') return false;
      if (node.isText && currentId != null && map[currentId] != null) {
        map[currentId] += (node.text || '') + ' ';
      }
      return true;
    });
    Object.keys(map).forEach(function(id) {
      map[id] = map[id].replace(/\s+/g, ' ').trim();
    });
    return map;
  }

  // Search-v1 — populate _snippets for filtered scenes whose match is in
  // BODY text. Slug/number matches get NO snippet (UI rule: "snippet visible
  // only when the match comes from scene text" — the heading already shows
  // why a slug match appears).
  function _buildSnippets(filtered, query, bodyMap) {
    const q = String(query || '').toLowerCase();
    if (!q) return;
    for (let i = 0; i < filtered.length; i += 1) {
      const scene = filtered[i];
      if (_slugMatch(scene, q)) continue;  // slug match → no snippet
      const body = (bodyMap && scene.nodeId != null) ? (bodyMap[scene.nodeId] || '') : '';
      const idx = body.toLowerCase().indexOf(q);
      if (idx >= 0) _snippets[scene.nodeId] = _makeSnippet(body, idx, String(query).length);
    }
  }

  // Search-v1 — build a one-line context window around the first body match.
  // CONTEXT chars each side; the matched substring keeps its original
  // screenplay casing. truncatedStart/End flag whether the text continues
  // beyond the window (rendered as a leading/trailing ellipsis).
  function _makeSnippet(bodyText, matchIdx, matchLen) {
    const CONTEXT = 24;
    const start = Math.max(0, matchIdx - CONTEXT);
    const end = Math.min(bodyText.length, matchIdx + matchLen + CONTEXT);
    return {
      before:         bodyText.slice(start, matchIdx),
      match:          bodyText.slice(matchIdx, matchIdx + matchLen),
      after:          bodyText.slice(matchIdx + matchLen, end),
      truncatedStart: start > 0,
      truncatedEnd:   end < bodyText.length
    };
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
      // Search-v1.1 — any filter change invalidates a prior selected-match
      // highlight (it belonged to the old query / result). Clearing the
      // search removes the highlight (guarded: no-op if none is active).
      if (Rga.SearchHighlight && typeof Rga.SearchHighlight.clear === 'function') {
        Rga.SearchHighlight.clear(_activeView());
      }
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

    // Marks-Expansion-v1 — the number gutter also hosts the expand chevron
    // (UX Direction §2: "orientation anchor + expand chevron on hover"). The
    // chevron appears ONLY when the scene has at least one mark to reveal —
    // no empty expansions. Clicking it toggles expansion and never navigates
    // (stopPropagation); clicking the rest of the row still jumps to scene.
    // Scene Navigator Tags v1.1 — cheap gate: does this scene have any tagged
    // entity? (per-entity sceneAppearances, no doc walk). A scene with tags
    // but no notes/flags still gets a chevron. The expensive occurrence
    // derivation runs only when the row is actually expanded (below).
    const hasTags = _sceneHasTaggedEntities(scene, idx);
    const hasMarks = !!(scene.hasNotes || scene.hasRevisionFlag || hasTags);
    const expanded = hasMarks && _expanded.has(scene.nodeId);
    const gutter = document.createElement('span');
    gutter.className = 'rga-shell-scene-navigator-gutter';
    if (hasMarks) gutter.appendChild(_buildChevron(scene.nodeId, expanded));
    const num = document.createElement('span');
    num.className = 'rga-shell-scene-navigator-num';
    num.textContent = String(scene.sceneNumber);
    gutter.appendChild(num);
    row.appendChild(gutter);

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

    // Search-v1 — body-match context snippet: a full-width second line
    // beneath the row, present only when this scene matched on BODY text
    // (see _buildSnippets). The match is highlighted inside the snippet
    // only. Clicking the row still jumps to the scene (existing nav) — no
    // line-precision navigation.
    const snip = _snippets[scene.nodeId];
    if (snip) row.appendChild(_buildSnippetEl(snip));

    // Marks-Expansion-v1 — expanded mark detail: presence-only lines for
    // notes / revision flags, as a full-width zone beneath the row. Uses only
    // the existing scene.hasNotes / scene.hasRevisionFlag flags (no counts,
    // no new derivation, no nav-index/schema change). Notes/flags FIRST.
    if (expanded && (scene.hasNotes || scene.hasRevisionFlag)) {
      row.appendChild(_buildMarksZone(scene));
    }
    // Scene Navigator Tags v1.1 — scene-local tag intelligence, BENEATH the
    // notes/flags. Derive occurrences (subtree walk) only for the expanded
    // scene; render the hybrid model (category → entity + count → snippets).
    if (expanded && hasTags) {
      const occGroups = _sceneOccurrenceGroups(scene, idx);
      if (occGroups.length) row.appendChild(_buildSceneTagsZone(scene, occGroups));
    }

    row.addEventListener('click', function() { _activateResult(scene.nodeId); });
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

  // Search-v1 — render the snippet parts as text nodes + a single
  // highlighted match span. textContent only (no innerHTML) so arbitrary
  // screenplay text can never inject markup.
  function _buildSnippetEl(snip) {
    const el = document.createElement('div');
    el.className = 'rga-shell-scene-navigator-snippet';
    if (snip.truncatedStart) el.appendChild(document.createTextNode('…'));
    el.appendChild(document.createTextNode(snip.before));
    const mark = document.createElement('span');
    mark.className = 'rga-shell-scene-navigator-snippet-match';
    mark.textContent = snip.match;
    el.appendChild(mark);
    el.appendChild(document.createTextNode(snip.after));
    if (snip.truncatedEnd) el.appendChild(document.createTextNode('…'));
    return el;
  }

  // Marks-Expansion-v1 — disclosure control in the number gutter. A bare
  // button (no text/glyph; the caret is a CSS border-triangle scoped to the
  // navigator) so the .num cell's textContent stays the scene number. aria
  // carries the open/closed meaning for assistive tech.
  function _buildChevron(nodeId, expanded) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rga-shell-scene-navigator-chevron';
    btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    btn.setAttribute('aria-label', expanded ? 'Collapse scene marks' : 'Expand scene marks');
    btn.addEventListener('click', function(e) {
      e.stopPropagation();   // toggle only — never navigate
      _toggleExpanded(nodeId);
    });
    return btn;
  }

  // Marks-Expansion-v1 — presence-only mark lines (no counts). Order: notes
  // first, revision second — mirrors the row indicator order (SN.2).
  function _buildMarksZone(scene) {
    const zone = document.createElement('div');
    zone.className = 'rga-shell-scene-navigator-marks';
    if (scene.hasNotes)        zone.appendChild(_buildMarkLine('Note attached'));
    if (scene.hasRevisionFlag) zone.appendChild(_buildMarkLine('Revision flagged'));
    return zone;
  }
  function _buildMarkLine(text) {
    const line = document.createElement('div');
    line.className = 'rga-shell-scene-navigator-mark';
    line.textContent = text;
    return line;
  }

  // Scene Navigator Tags v1.1 — cheap chevron gate. Does this scene have ANY
  // tagged entity? Read through the Memory facade's per-entity
  // sceneAppearances (O(entities), no doc walk), so deciding whether a row
  // is expandable never pays the subtree-walk cost. The expensive occurrence
  // derivation runs ONLY for the one scene the writer actually expands.
  function _sceneHasTaggedEntities(scene, idx) {
    const Memory = Rga.Screenplay && Rga.Screenplay.Memory;
    if (!Memory || typeof Memory.scene !== 'function') return false;
    if (!idx || !scene || !scene.nodeId) return false;
    const bundle = Memory.scene(scene.nodeId, idx);   // no doc → no cue walk
    if (!bundle) return false;
    for (let i = 0; i < _SCENE_TAG_GROUPS.length; i += 1) {
      const arr = bundle[_SCENE_TAG_GROUPS[i].key];
      if (Array.isArray(arr) && arr.length) return true;
    }
    return false;
  }

  // Scene Navigator Tags v1.1 — the scene's tag intelligence: occurrence
  // groups derived by a SCENE-SUBTREE walk (Rga.SceneTagOccurrences.forScene)
  // over the live document — per-scene counts, original tagged wording, PM
  // positions. Only the expanded scene is walked. No nav-index/schema/
  // registry change; degrades to [] when the module or doc is unavailable.
  function _sceneOccurrenceGroups(scene, idx) {
    if (!Rga.SceneTagOccurrences || typeof Rga.SceneTagOccurrences.forScene !== 'function') return [];
    const view = _activeView();
    const doc = view && view.state && view.state.doc;
    if (!doc || !scene || typeof scene.pmPos !== 'number') return [];
    return Rga.SceneTagOccurrences.forScene(doc, scene.pmPos, idx) || [];
  }

  // Scene Navigator Tags v1.1 — the hybrid occurrence zone. A quiet honest
  // label ("Tagged in this scene"), then a VERTICAL list grouped by category;
  // each entity is a collapsed row carrying its per-scene count, expandable
  // to the occurrence snippets. RTL mirrors via the wrapper dir + logical CSS.
  function _buildSceneTagsZone(scene, groups) {
    const zone = document.createElement('div');
    zone.className = 'rga-shell-scene-navigator-scene-tags';

    const label = document.createElement('div');
    label.className = 'rga-shell-scene-navigator-scene-tags-label';
    label.textContent = 'Tagged in this scene';
    zone.appendChild(label);

    for (let i = 0; i < groups.length; i += 1) {
      zone.appendChild(_buildOccCategoryGroup(scene, groups[i]));
    }
    return zone;
  }

  function _buildOccCategoryGroup(scene, group) {
    const g = document.createElement('div');
    g.className = 'rga-shell-scene-navigator-tag-group';

    const lbl = document.createElement('div');
    lbl.className = 'rga-shell-scene-navigator-tag-group-label';
    lbl.textContent = group.label;
    g.appendChild(lbl);

    // Duplicate-identity tally: same normalized name on more than one
    // entity in this category. Never collapse — entities are keyed by
    // entityId — but flag each so the writer knows which is which.
    const tally = {};
    group.entities.forEach(function(ent) {
      const norm = String(ent.name || '').trim().toLowerCase();
      tally[norm] = (tally[norm] || 0) + 1;
    });

    group.entities.forEach(function(ent) {
      const norm = String(ent.name || '').trim().toLowerCase();
      g.appendChild(_buildOccEntity(scene, group, ent, tally[norm] > 1));
    });
    return g;
  }

  // Scene Navigator Tags v1.1 — one entity: a collapsed row (chevron + dot +
  // name + per-scene count [+ dup warning]) and, when expanded, its
  // occurrence snippets. Click the row/name → focus-highlight the entity in
  // the editor. Click the chevron → reveal/hide the snippets (stopPropagation
  // so it never focuses). Click a snippet → jump to that occurrence.
  function _buildOccEntity(scene, group, ent, isDuplicate) {
    const block = document.createElement('div');
    block.className = 'rga-shell-scene-navigator-tag-entity-block';

    const expKey = String(scene.nodeId) + '::' + group.tagType + '::' + ent.entityId;
    const entExpanded = _expandedTagEntities.has(expKey);

    const row = document.createElement('div');
    row.className = 'rga-shell-scene-navigator-tag-entity';
    row.setAttribute('data-entity-id', String(ent.entityId || ''));
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');

    // Disclosure chevron — only when there is at least one occurrence to
    // reveal (there always is, but guard anyway). Reuses the scene chevron's
    // CSS caret so the two read as siblings.
    const chev = document.createElement('button');
    chev.type = 'button';
    chev.className = 'rga-shell-scene-navigator-tag-entity-chevron';
    chev.setAttribute('aria-expanded', entExpanded ? 'true' : 'false');
    chev.setAttribute('aria-label', entExpanded ? 'Hide occurrences' : 'Show occurrences');
    chev.addEventListener('click', function(e) {
      e.stopPropagation();           // toggle only — never focus the entity
      _toggleTagEntity(expKey);
    });
    chev.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') e.stopPropagation();
    });
    row.appendChild(chev);

    const dot = document.createElement('span');
    dot.className = 'rga-shell-scene-navigator-tag-dot';
    dot.style.background = ent.color || 'var(--accent-primary)';
    dot.setAttribute('aria-hidden', 'true');
    row.appendChild(dot);

    const name = document.createElement('span');
    name.className = 'rga-shell-scene-navigator-tag-entity-name';
    name.textContent = ent.name || '';
    row.appendChild(name);

    const count = document.createElement('span');
    count.className = 'rga-shell-scene-navigator-tag-entity-count';
    count.textContent = '·' + String(ent.count);
    const countText = ent.count + ' tagged occurrence' + (ent.count === 1 ? '' : 's') + ' in this scene';
    count.title = countText;
    count.setAttribute('aria-label', countText);
    row.appendChild(count);

    if (isDuplicate) {
      const warn = document.createElement('span');
      warn.className = 'rga-shell-scene-navigator-tag-entity-dup';
      warn.setAttribute('data-icon-name', 'triangle-alert');
      const svg = (Rga.Icons && Rga.Icons.Lucide && Rga.Icons.Lucide.has('triangle-alert'))
        ? Rga.Icons.Lucide.svgFor('triangle-alert') : '';
      if (svg) { warn.innerHTML = svg; } else { warn.textContent = '⚠'; }
      const warnText = 'Duplicate identity: more than one "' + (ent.name || '')
        + '" exists in ' + group.label;
      warn.setAttribute('aria-label', warnText);
      warn.title = warnText;
      row.appendChild(warn);
    }

    row.addEventListener('click', function(e) {
      e.stopPropagation();          // focus the entity — never jump the scene row
      _focusEntity(ent.entityId);
    });
    row.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.stopPropagation();
        e.preventDefault();
        _focusEntity(ent.entityId);
      }
    });
    block.appendChild(row);

    if (entExpanded) {
      const occList = document.createElement('div');
      occList.className = 'rga-shell-scene-navigator-tag-occurrences';
      for (let i = 0; i < ent.occurrences.length; i += 1) {
        occList.appendChild(_buildOccurrence(ent.occurrences[i]));
      }
      block.appendChild(occList);
    }
    return block;
  }

  // Scene Navigator Tags v1.1 — one occurrence snippet: the original
  // screenplay wording around the tag, the tagged run emphasised. Click →
  // jump to that exact occurrence (selection-only; document untouched).
  // textContent only (no innerHTML) so screenplay text can't inject markup.
  function _buildOccurrence(occ) {
    const el = document.createElement('div');
    el.className = 'rga-shell-scene-navigator-tag-occurrence';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');

    const snip = occ.snippet || { before: '', match: occ.text || '', after: '', truncatedStart: false, truncatedEnd: false };
    if (snip.truncatedStart) el.appendChild(document.createTextNode('…'));
    el.appendChild(document.createTextNode(snip.before || ''));
    const mark = document.createElement('span');
    mark.className = 'rga-shell-scene-navigator-tag-occurrence-match';
    mark.textContent = snip.match || (occ.text || '');
    el.appendChild(mark);
    el.appendChild(document.createTextNode(snip.after || ''));
    if (snip.truncatedEnd) el.appendChild(document.createTextNode('…'));

    el.addEventListener('click', function(e) {
      e.stopPropagation();          // jump to this occurrence — not entity focus
      _jumpToOccurrence(occ.from);
    });
    el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.stopPropagation();
        e.preventDefault();
        _jumpToOccurrence(occ.from);
      }
    });
    return el;
  }

  // Scene Navigator Tags v1.1 — light up an entity's tagged occurrences in
  // the editor by reusing the V1.3 Tag Focus Highlight. No new selection
  // state; the lit editor IS the witness.
  function _focusEntity(entityId) {
    if (!entityId) return;
    const view = _activeView();
    if (view && Rga.TagFocusHighlight && typeof Rga.TagFocusHighlight.setEntity === 'function') {
      Rga.TagFocusHighlight.setEntity(view, entityId);
    }
  }

  // Scene Navigator Tags v1.1 — jump the editor cursor to a specific tagged
  // occurrence (PM position). Selection-only + scrollIntoView; the document
  // is never mutated. Mirrors scrollToScene's PM dance for an arbitrary pos.
  function _jumpToOccurrence(pos) {
    if (typeof pos !== 'number') return false;
    const view = _activeView();
    if (!view || !view.state) return false;
    const PM = window.RgaProseMirror;
    if (!PM || !PM.TextSelection) return false;
    try {
      const $pos = view.state.doc.resolve(pos);
      const sel = PM.TextSelection.near($pos);
      view.dispatch(view.state.tr.setSelection(sel).scrollIntoView());
      try {
        const dom = view.domAtPos ? view.domAtPos(pos) : null;
        const node = dom && dom.node;
        const el = node && (node.nodeType === 1 ? node : node.parentNode);
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
        }
      } catch (_) { /* domAtPos may throw on transient state — selection already moved. */ }
      view.focus && view.focus();
      return true;
    } catch (err) {
      console.error('[Rga.Shell.SceneNavigator] _jumpToOccurrence threw:', err);
      return false;
    }
  }

  // Scene Navigator Tags v1.1 — toggle one entity's occurrence list. Keyed
  // per (scene, tagType, entityId) so the same entity expands independently
  // in different scenes; state survives re-render, cleared on unmount/_reset.
  function _toggleTagEntity(expKey) {
    if (!expKey) return;
    if (_expandedTagEntities.has(expKey)) _expandedTagEntities.delete(expKey);
    else _expandedTagEntities.add(expKey);
    _render();
  }

  // Marks-Expansion-v1 — toggle expansion for one scene. Multiple scenes may
  // be expanded simultaneously; state lives in _expanded and survives the
  // next re-render.
  function _toggleExpanded(nodeId) {
    if (!nodeId) return;
    if (_expanded.has(nodeId)) _expanded.delete(nodeId);
    else _expanded.add(nodeId);
    _render();
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

  // Search-v1.1 — activate a result: jump to the scene (existing nav), then,
  // for an ACTIVE body-text search match, paint a single strong highlight on
  // the first matching keyword inside that scene. Slug-only matches (no
  // snippet) get no highlight — any stale highlight is cleared instead.
  function _activateResult(nodeId) {
    const ok = scrollToScene(nodeId);
    const view = _activeView();
    const SH = Rga.SearchHighlight;
    if (!view || !SH) return ok;
    if (_filterText && _snippets[nodeId]
        && typeof SH.firstMatchInRange === 'function' && typeof SH.set === 'function') {
      const range = _resolveMatchRange(view, nodeId, _filterText);
      if (range) { SH.set(view, range.from, range.to); return ok; }
    }
    if (typeof SH.clear === 'function') SH.clear(view);   // slug-only / no match → no stale highlight
    return ok;
  }

  // Search-v1.1 — resolve the first-match PM range inside a scene. Bounds
  // come from the CURRENT nav-index entry (pmPos/pmEndPos are rebuilt every
  // doc change, so they are valid at click time); the text search itself is
  // delegated to Rga.SearchHighlight.firstMatchInRange (heading-skipping,
  // pure read). No nav-index/schema change; no scrollToPos system.
  function _resolveMatchRange(view, nodeId, query) {
    const doc = view.state && view.state.doc;
    const idx = (Rga.Nav && typeof Rga.Nav.getIndex === 'function') ? Rga.Nav.getIndex(view.state) : null;
    if (!doc || !idx || !Array.isArray(idx.scenes)) return null;
    let entry = null;
    for (let i = 0; i < idx.scenes.length; i += 1) {
      if (idx.scenes[i].nodeId === nodeId) { entry = idx.scenes[i]; break; }
    }
    if (!entry || entry.pmPos == null || entry.pmEndPos == null) return null;
    return Rga.SearchHighlight.firstMatchInRange(doc, entry.pmPos, entry.pmEndPos, query);
  }

  // ----------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------
  function _activeView() {
    if (Rga.TabManager && typeof Rga.TabManager._editorView === 'function') return Rga.TabManager._editorView();
    return null;
  }
  // RTL — resolve the active script's writing direction from the document
  // model, identical to TabManager.applyDocumentDirection (#editor's source
  // of truth). Falls back to lastActiveDoc() so a workspace tab (Settings)
  // being focused doesn't drop the navigator back to LTR while it still
  // shows the last document's scenes. Defaults to 'ltr' when no doc / no
  // profile / not 'rtl' — so existing LTR behaviour is untouched.
  function _scriptDirection() {
    const TM = Rga.TabManager;
    if (!TM) return 'ltr';
    let doc = (typeof TM.activeDoc === 'function') ? TM.activeDoc() : null;
    if (!doc && typeof TM.lastActiveDoc === 'function') doc = TM.lastActiveDoc();
    const profile = doc && doc.metadata && doc.metadata.screenplayProfile;
    return (profile && profile.direction === 'rtl') ? 'rtl' : 'ltr';
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
    const view = _activeView();
    const allScenes = _scenes(view);
    if (!allScenes || allScenes.length === 0) return;
    // Search-v1 — filter the keyboard-navigable set with the SAME body-aware
    // matcher as the rendered list, so arrow selection stays inside exactly
    // what the writer can see (slug- AND body-matched rows).
    const scenes = _filterText
      ? _applyFilter(allScenes, _filterText, _sceneBodyTextMap(view))
      : allScenes;
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
        if (_selectedNodeId) _activateResult(_selectedNodeId);
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
    _snippets = {};
    _expanded.clear();
    _expandedTagEntities.clear();
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
