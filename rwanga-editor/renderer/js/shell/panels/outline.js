// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Outline panel — slice-2 plan §3.3.
//
// Section order (top → bottom):
//   1. Title summary       (script title + scenes/pages/word counts)
//   2. Story Progress      (Current Scene + Current Page; reserved: Act, Story Beat)
//   3. Scenes              (numbered list, click to jump)
//   4. Characters          (name + appearance count)
//
// Story Progress is the writer's orientation surface. It is governed by
// the "no fake progress" rule (plan §3.3 + §14):
//   - No percentages that aren't a literal count / literal total.
//   - No invented denominators.
//   - No qualitative judgment ("pacing brisk", "looking strong").
//   - AI-driven story analysis lives in different panels, never here.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  if (!Rga.Shell || !Rga.Shell.Sidebar || typeof Rga.Shell.Sidebar.registerPanel !== 'function') return;

  let _container = null;
  let _unsubscribeSession = null;
  let _collapsed = { title: false, progress: false, scenes: false, characters: true };

  const _controller = {
    id: 'outline',
    label: 'Outline',
    icon: 'list-tree',
    shortcut: 'Cmd-Shift-O',
    available: true,
    mount: function(container) {
      _container = container || null;
      _render();
      if (_unsubscribeSession) _unsubscribeSession();
      if (Rga.ScriptSession && typeof Rga.ScriptSession.subscribe === 'function') {
        _unsubscribeSession = Rga.ScriptSession.subscribe(function() { _render(); });
      }
    },
    unmount: function() {
      if (_unsubscribeSession) { _unsubscribeSession(); _unsubscribeSession = null; }
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
    wrapper.className = 'rga-shell-outline';

    const view = _activeView();
    const outline = _outlineFromEngine(view);
    const snap = _sessionSnap();

    wrapper.appendChild(_titleSection(outline));
    wrapper.appendChild(_progressSection(snap, outline));
    wrapper.appendChild(_scenesSection(outline));
    wrapper.appendChild(_charactersSection(outline));

    _container.appendChild(wrapper);
  }

  function _section(id, label, collapsed, contentBuilder) {
    const sec = document.createElement('section');
    sec.className = 'rga-shell-outline-section';
    sec.setAttribute('data-section', id);

    const header = document.createElement('h3');
    header.className = 'rga-shell-outline-section-header';
    header.textContent = (collapsed ? '▶ ' : '▼ ') + label;
    header.addEventListener('click', function() {
      _collapsed[id] = !_collapsed[id];
      _render();
    });
    sec.appendChild(header);

    if (!collapsed) {
      const body = document.createElement('div');
      body.className = 'rga-shell-outline-section-body';
      contentBuilder(body);
      sec.appendChild(body);
    }
    return sec;
  }

  // ---- Section 1: title summary ----
  function _titleSection(outline) {
    return _section('title', outline.title || 'Untitled', _collapsed.title, function(body) {
      const meta = document.createElement('div');
      meta.className = 'rga-shell-outline-meta';
      const sceneCount = outline.statistics ? outline.statistics.sceneCount : 0;
      const pages = outline.statistics ? outline.statistics.pages : 0;
      meta.textContent = 'Scenes: ' + sceneCount + ' · Pages: ' + pages;
      body.appendChild(meta);

      const wordsLine = document.createElement('div');
      wordsLine.className = 'rga-shell-outline-words';
      const total = outline.statistics ? outline.statistics.words : 0;
      const action = outline.statistics ? outline.statistics.actionWords : 0;
      const dialogue = outline.statistics ? outline.statistics.dialogueWords : 0;
      wordsLine.textContent = _formatThousands(total) + ' words · '
                            + _formatThousands(action) + ' action · '
                            + _formatThousands(dialogue) + ' dialogue';
      body.appendChild(wordsLine);
    });
  }

  // ---- Section 2: Story Progress (writer orientation; fact-only) ----
  function _progressSection(snap, outline) {
    return _section('progress', 'Story Progress', _collapsed.progress, function(body) {
      const totalScenes = outline.statistics ? outline.statistics.sceneCount : 0;
      const curScene = snap && snap.currentScene;
      const curPage = snap && snap.currentPage;

      body.appendChild(_progressRow(
        'Current Scene',
        curScene ? 'S' + curScene.sceneNumber + ' of ' + totalScenes : '— of —',
        curScene ? function() { _jumpToScene(curScene.nodeId); } : null,
        'rga-shell-outline-progress-currentScene'
      ));
      body.appendChild(_progressRow(
        'Current Page',
        curPage ? curPage.number + ' of ' + curPage.total : '— of —',
        null,  // Slice 2: click-to-go-to-page is the command palette's job (Slice 3)
        'rga-shell-outline-progress-currentPage'
      ));

      // Reserved-for-future placeholders. Render as em-dash; no fake data,
      // no AI judgment. See plan §3.3 "no fake progress" rule.
      const divider = document.createElement('div');
      divider.className = 'rga-shell-outline-progress-divider';
      divider.textContent = '— reserved for v0.3+ —';
      body.appendChild(divider);

      body.appendChild(_progressRow(
        'Act Progress',
        '—',
        null,
        'rga-shell-outline-progress-actProgress'
      ));
      body.appendChild(_progressRow(
        'Story Beat',
        '—',
        null,
        'rga-shell-outline-progress-storyBeat'
      ));
    });
  }

  function _progressRow(label, value, clickHandler, cls) {
    const row = document.createElement('div');
    row.className = 'rga-shell-outline-progress-row ' + (cls || '');
    const lbl = document.createElement('span');
    lbl.className = 'rga-shell-outline-progress-label';
    lbl.textContent = label + ':';
    row.appendChild(lbl);
    const val = document.createElement('span');
    val.className = 'rga-shell-outline-progress-value';
    val.textContent = value;
    if (clickHandler) {
      val.classList.add('rga-shell-outline-progress-value-clickable');
      val.addEventListener('click', clickHandler);
    }
    row.appendChild(val);
    return row;
  }

  // ---- Section 3: scene list (simple — number + heading) ----
  function _scenesSection(outline) {
    return _section('scenes', 'Scenes', _collapsed.scenes, function(body) {
      const list = document.createElement('ol');
      list.className = 'rga-shell-outline-scenes';
      const scenes = (outline && Array.isArray(outline.scenes)) ? outline.scenes : [];
      scenes.forEach(function(s) {
        const li = document.createElement('li');
        li.className = 'rga-shell-outline-scene-row';
        li.setAttribute('data-scene-node-id', String(s.nodeId || ''));
        li.setAttribute('role', 'button');
        li.setAttribute('tabindex', '0');
        const num = document.createElement('span');
        num.className = 'rga-shell-outline-scene-num';
        num.textContent = String(s.sceneNumber) + '.';
        li.appendChild(num);
        const head = document.createElement('span');
        head.className = 'rga-shell-outline-scene-head';
        head.textContent = s.headingDisplay || '';
        li.appendChild(head);
        li.addEventListener('click', function() { _jumpToScene(s.nodeId); });
        list.appendChild(li);
      });
      body.appendChild(list);
    });
  }

  // ---- Section 4: characters ----
  function _charactersSection(outline) {
    return _section('characters', 'Characters', _collapsed.characters, function(body) {
      const list = document.createElement('ul');
      list.className = 'rga-shell-outline-characters';
      const chars = (outline && Array.isArray(outline.characters)) ? outline.characters : [];
      chars.forEach(function(c) {
        const li = document.createElement('li');
        li.className = 'rga-shell-outline-character-row';
        li.setAttribute('data-character-node-id', String(c.nodeId || ''));
        li.setAttribute('title', 'Character filtering arrives with the Characters panel.');
        const name = document.createElement('span');
        name.className = 'rga-shell-outline-character-name';
        name.textContent = c.name || c.nodeId || '';
        li.appendChild(name);
        const count = document.createElement('span');
        count.className = 'rga-shell-outline-character-count';
        count.textContent = '(' + (c.appearances || 0) + ' scenes)';
        li.appendChild(count);
        list.appendChild(li);
      });
      body.appendChild(list);
    });
  }

  // ----------------------------------------------------------------
  // Navigation routing — click any scene/value → Scene Navigator
  // ----------------------------------------------------------------
  function _jumpToScene(nodeId) {
    if (!nodeId) return;
    if (Rga.Shell.SceneNavigator) {
      if (typeof Rga.Shell.SceneNavigator.scrollToScene === 'function') {
        Rga.Shell.SceneNavigator.scrollToScene(nodeId);
      }
      if (typeof Rga.Shell.SceneNavigator.focusRow === 'function') {
        Rga.Shell.SceneNavigator.focusRow(nodeId);
      }
    }
    if (Rga.Shell.Sidebar && typeof Rga.Shell.Sidebar.activate === 'function') {
      Rga.Shell.Sidebar.activate('sceneNavigator');
    }
  }

  // ----------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------
  function _activeView() {
    if (Rga.TabManager && typeof Rga.TabManager._editorView === 'function') return Rga.TabManager._editorView();
    return null;
  }

  function _outlineFromEngine(view) {
    if (!view || !view.state) return { title: '', statistics: { sceneCount: 0, pages: 0, words: 0, actionWords: 0, dialogueWords: 0 }, scenes: [], characters: [] };
    if (!Rga.Nav || typeof Rga.Nav.getOutline !== 'function') return { title: '', statistics: {}, scenes: [], characters: [] };
    return Rga.Nav.getOutline(view.state) || { title: '', statistics: {}, scenes: [], characters: [] };
  }

  function _sessionSnap() {
    if (Rga.ScriptSession && typeof Rga.ScriptSession.get === 'function') return Rga.ScriptSession.get();
    return null;
  }

  function _formatThousands(n) {
    const v = (typeof n === 'number' && isFinite(n)) ? Math.max(0, Math.floor(n)) : 0;
    return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  // Test surface.
  Rga.Shell.Outline = Rga.Shell.Outline || {};
  Rga.Shell.Outline._controller = _controller;
  Rga.Shell.Outline._render     = _render;
})();
