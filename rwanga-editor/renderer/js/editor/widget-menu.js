// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Phase 5 — widget buttons ([+ Scene] | [+ ▾]), floating insert menu, slash command.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  function _pm() { return window.RgaProseMirror; }

  // ---------------------------------------------------------------
  // Helpers — document structure
  // ---------------------------------------------------------------

  // Position of the top-level block (direct child of body) containing $from.
  function _topBlockPos($from) {
    for (let d = $from.depth; d >= 1; d--) {
      if ($from.node(d - 1).type.name === 'body') return $from.before(d);
    }
    return null;
  }

  function _bodyPos(doc) {
    let p = null;
    doc.forEach(function(node, offset) {
      if (node.type.name === 'body') p = offset;
    });
    return p;
  }

  // True if any ancestor node is a scene.
  function _insideScene($from) {
    for (let d = 0; d <= $from.depth; d++) {
      if ($from.node(d).type.name === 'scene') return true;
    }
    return false;
  }

  // ---------------------------------------------------------------
  // Generic insert helpers
  // ---------------------------------------------------------------

  // Insert newNode after the current top-level block; place cursor inside it.
  function _insertAfterBlock(view, newNode) {
    const PM = _pm();
    const { state, dispatch } = view;
    const { $from } = state.selection;

    let blockPos = _topBlockPos($from);

    if (blockPos === null) {
      const bp = _bodyPos(state.doc);
      if (bp === null) return false;
      const tr = state.tr.insert(bp + 1, newNode);
      const sel = PM.TextSelection.findFrom(tr.doc.resolve(bp + 2), 1, true);
      if (sel) tr.setSelection(sel);
      dispatch(tr);
      view.focus();
      return true;
    }

    const blockNode = state.doc.nodeAt(blockPos);
    if (!blockNode) return false;
    const insertPos = blockPos + blockNode.nodeSize;
    const tr = state.tr.insert(insertPos, newNode);
    const targetPos = Math.min(insertPos + 1, tr.doc.content.size - 1);
    const sel = PM.TextSelection.findFrom(tr.doc.resolve(targetPos), 1, true);
    if (sel) tr.setSelection(sel);
    dispatch(tr);
    view.focus();
    return true;
  }

  // Insert newNode after the current scene-child block (inside-scene inserts).
  function _insertAfterSceneChild(view, newNode) {
    const PM = _pm();
    const { state, dispatch } = view;
    const { $from } = state.selection;

    let childPos = null;
    for (let d = $from.depth; d >= 1; d--) {
      if ($from.node(d - 1).type.name === 'scene') { childPos = $from.before(d); break; }
    }
    if (childPos === null) return _insertAfterBlock(view, newNode);

    const childNode = state.doc.nodeAt(childPos);
    if (!childNode) return false;
    const insertPos = childPos + childNode.nodeSize;
    const tr = state.tr.insert(insertPos, newNode);
    const sel = PM.TextSelection.findFrom(tr.doc.resolve(insertPos + 1), 1, true);
    if (sel) tr.setSelection(sel);
    dispatch(tr);
    view.focus();
    return true;
  }

  // ---------------------------------------------------------------
  // Insert commands
  // ---------------------------------------------------------------

  function cmdParagraph(view) {
    return _insertAfterBlock(view, view.state.schema.nodes.paragraph.createAndFill());
  }

  function _cmdHeading(level) {
    return function(view) {
      return _insertAfterBlock(view, view.state.schema.nodes.heading.create({ level }));
    };
  }

  function cmdQuote(view) {
    return _insertAfterBlock(view, view.state.schema.nodes.quote.createAndFill());
  }

  function cmdBulletList(view) {
    const s = view.state.schema;
    const li = s.nodes.listItem.create(null, [s.nodes.paragraph.createAndFill()]);
    return _insertAfterBlock(view, s.nodes.bulletList.create(null, [li]));
  }

  function cmdOrderedList(view) {
    const s = view.state.schema;
    const li = s.nodes.listItem.create(null, [s.nodes.paragraph.createAndFill()]);
    return _insertAfterBlock(view, s.nodes.orderedList.create(null, [li]));
  }

  function cmdHorizontalRule(view) {
    return _insertAfterBlock(view, view.state.schema.nodes.horizontalRule.create());
  }

  function cmdPageBreak(view) {
    return _insertAfterBlock(view, view.state.schema.nodes.pageBreak.create());
  }

  function cmdScene(view) {
    const s = view.state.schema;
    const sceneLine = s.nodes.sceneLine.createAndFill();
    const action = s.nodes.action.createAndFill();
    return _insertAfterBlock(view, s.nodes.scene.create(null, [sceneLine, action]));
  }

  function cmdTitleStrip(view) {
    const PM = _pm();
    const { state, dispatch } = view;
    const s = state.schema;
    const first = state.doc.firstChild;
    if (first && first.type === s.nodes.titleStrip) {
      dispatch(state.tr.setSelection(PM.TextSelection.create(state.doc, 1)));
      view.focus();
      return true;
    }
    const ts = s.nodes.titleStrip.createAndFill();
    const tr = state.tr.insert(0, ts);
    dispatch(tr.setSelection(PM.TextSelection.create(tr.doc, 1)));
    view.focus();
    return true;
  }

  function cmdInlineFreeText(view) {
    return _insertAfterSceneChild(view, view.state.schema.nodes.inlineFreeText.createAndFill());
  }

  // ---------------------------------------------------------------
  // Menu item definitions
  // ---------------------------------------------------------------

  // "Other" items shown in the [+ ▾] dropdown (scene excluded — it has its own button).
  const OTHER_ITEMS = [
    { id: 'title',         label: 'Title',           action: cmdTitleStrip },
    { id: 'heading1',      label: 'Heading 1',       action: _cmdHeading(1) },
    { id: 'heading2',      label: 'Heading 2',       action: _cmdHeading(2) },
    { id: 'paragraph',     label: 'Paragraph',       action: cmdParagraph },
    { id: 'quote',         label: 'Quote',           action: cmdQuote },
    { id: 'bulletList',    label: 'Bulleted list',   action: cmdBulletList },
    { id: 'orderedList',   label: 'Numbered list',   action: cmdOrderedList },
    { id: 'horizontalRule',label: 'Horizontal rule', action: cmdHorizontalRule },
    { id: 'pageBreak',     label: 'Page break',      action: cmdPageBreak },
  ];

  const INSIDE_SCENE_ITEMS = [
    { id: 'inlineFreeText', label: 'Inline free text', action: cmdInlineFreeText },
  ];

  // Full outside-scene list (used by slash command and Ctrl+/).
  const OUTSIDE_SCENE_ITEMS = OTHER_ITEMS.concat([
    { id: 'scene', label: 'Scene', shortcut: 'Ctrl+Enter', action: cmdScene },
  ]);

  // ---------------------------------------------------------------
  // Floating menu
  // ---------------------------------------------------------------

  let _menu = null;

  function hideMenu() {
    if (_menu && _menu.parentNode) _menu.parentNode.removeChild(_menu);
    _menu = null;
  }

  function _clampToViewport(menu) {
    requestAnimationFrame(function() {
      const r = menu.getBoundingClientRect();
      if (r.right > window.innerWidth - 8) {
        menu.style.left = Math.max(8, window.innerWidth - r.width - 8) + 'px';
      }
      if (r.bottom > window.innerHeight - 8) {
        const top = parseFloat(menu.style.top) - r.height - 8;
        menu.style.top = Math.max(8, top) + 'px';
      }
    });
  }

  function _buildMenu(items, view, slashPos) {
    const menu = document.createElement('div');
    menu.className = 'rga-widget-menu';

    const filter = document.createElement('input');
    filter.className = 'rga-widget-filter';
    filter.placeholder = 'Filter…';
    filter.setAttribute('autocomplete', 'off');
    filter.setAttribute('spellcheck', 'false');
    menu.appendChild(filter);

    const list = document.createElement('ul');
    list.className = 'rga-widget-list';
    menu.appendChild(list);

    let activeIdx = 0;

    function render(q) {
      const lq = (q || '').toLowerCase().trim();
      const filtered = items.filter(function(it) {
        return !lq || it.label.toLowerCase().includes(lq) || it.id.includes(lq);
      });
      list.innerHTML = '';
      activeIdx = 0;
      if (!filtered.length) {
        const li = document.createElement('li');
        li.className = 'rga-widget-empty';
        li.textContent = 'No matches';
        list.appendChild(li);
        return;
      }
      filtered.forEach(function(item, i) {
        const li = document.createElement('li');
        li.className = 'rga-widget-item' + (i === 0 ? ' active' : '');
        li.dataset.idx = String(i);
        const lbl = document.createElement('span');
        lbl.className = 'rga-widget-label';
        lbl.textContent = item.label;
        li.appendChild(lbl);
        if (item.shortcut) {
          const sc = document.createElement('span');
          sc.className = 'rga-widget-shortcut';
          sc.textContent = item.shortcut;
          li.appendChild(sc);
        }
        li.addEventListener('mousedown', function(e) {
          e.preventDefault();
          _execute(item, view, slashPos);
          hideMenu();
        });
        list.appendChild(li);
      });
    }

    function setActive(idx) {
      list.querySelectorAll('.rga-widget-item').forEach(function(el, i) {
        el.classList.toggle('active', i === idx);
      });
      const active = list.querySelectorAll('.rga-widget-item')[idx];
      if (active) active.scrollIntoView({ block: 'nearest' });
    }

    filter.addEventListener('input', function() { render(filter.value); });

    filter.addEventListener('keydown', function(e) {
      const visible = list.querySelectorAll('.rga-widget-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIdx = Math.min(activeIdx + 1, visible.length - 1);
        setActive(activeIdx);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIdx = Math.max(activeIdx - 1, 0);
        setActive(activeIdx);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const el = visible[activeIdx];
        if (el) {
          const idx = parseInt(el.dataset.idx, 10);
          const q = (filter.value || '').toLowerCase().trim();
          const filtered = items.filter(function(it) {
            return !q || it.label.toLowerCase().includes(q) || it.id.includes(q);
          });
          if (filtered[idx]) { _execute(filtered[idx], view, slashPos); hideMenu(); }
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        hideMenu();
        view.focus();
      } else if (e.key === 'Backspace' && !filter.value && slashPos !== null) {
        e.preventDefault();
        hideMenu();
        view.focus();
      }
    });

    render('');

    setTimeout(function() {
      function onOutside(e) {
        if (_menu && !_menu.contains(e.target)) hideMenu();
      }
      document.addEventListener('mousedown', onOutside, true);
    }, 0);

    return menu;
  }

  function _execute(item, view, slashPos) {
    if (slashPos !== null) {
      const tr = view.state.tr.delete(slashPos - 1, slashPos);
      view.dispatch(tr);
    }
    item.action(view);
  }

  // ---------------------------------------------------------------
  // Open menus
  // ---------------------------------------------------------------

  // [+ ▾] button: shows Other items (or scene-child items inside a scene).
  function openOtherMenu(view, anchorEl) {
    hideMenu();
    const { $from } = view.state.selection;
    const items = _insideScene($from) ? INSIDE_SCENE_ITEMS : OTHER_ITEMS;
    _menu = _buildMenu(items, view, null);
    document.body.appendChild(_menu);
    if (anchorEl) {
      const r = anchorEl.getBoundingClientRect();
      _menu.style.left = r.left + 'px';
      _menu.style.top = (r.bottom + 4) + 'px';
    } else {
      try {
        const coords = view.coordsAtPos(view.state.selection.$from.pos);
        _menu.style.left = coords.left + 'px';
        _menu.style.top = (coords.bottom + 4) + 'px';
      } catch (_) {
        _menu.style.left = '200px';
        _menu.style.top = '200px';
      }
    }
    _clampToViewport(_menu);
    const f = _menu.querySelector('.rga-widget-filter');
    if (f) f.focus();
  }

  // Ctrl+/ shortcut: shows full outside-scene or inside-scene list.
  function openWidgetMenu(view, anchorEl) {
    hideMenu();
    const { $from } = view.state.selection;
    const items = _insideScene($from) ? INSIDE_SCENE_ITEMS : OUTSIDE_SCENE_ITEMS;
    _menu = _buildMenu(items, view, null);
    document.body.appendChild(_menu);
    if (anchorEl) {
      const r = anchorEl.getBoundingClientRect();
      _menu.style.left = (r.right + 6) + 'px';
      _menu.style.top = r.top + 'px';
    } else {
      try {
        const coords = view.coordsAtPos(view.state.selection.$from.pos);
        _menu.style.left = coords.left + 'px';
        _menu.style.top = (coords.bottom + 4) + 'px';
      } catch (_) {
        _menu.style.left = '200px';
        _menu.style.top = '200px';
      }
    }
    _clampToViewport(_menu);
    const f = _menu.querySelector('.rga-widget-filter');
    if (f) f.focus();
  }

  // Slash command: opens at the "/" position.
  function _openSlashMenu(view, slashPos) {
    hideMenu();
    const $from = view.state.doc.resolve(slashPos);
    const items = _insideScene($from) ? INSIDE_SCENE_ITEMS : OUTSIDE_SCENE_ITEMS;
    _menu = _buildMenu(items, view, slashPos);
    document.body.appendChild(_menu);
    try {
      const coords = view.coordsAtPos(slashPos);
      _menu.style.left = coords.left + 'px';
      _menu.style.top = (coords.bottom + 4) + 'px';
    } catch (_) {
      _menu.style.left = '200px';
      _menu.style.top = '200px';
    }
    _clampToViewport(_menu);
    const f = _menu.querySelector('.rga-widget-filter');
    if (f) f.focus();
  }

  // ---------------------------------------------------------------
  // Widget button pair — follows cursor, sits on next line
  // ---------------------------------------------------------------

  function _positionWrap(view, wrap) {
    const { $from } = view.state.selection;
    try {
      const coords = view.coordsAtPos($from.pos);
      const editorLeft = view.dom.getBoundingClientRect().left;
      wrap.style.top = Math.round(coords.bottom + 4) + 'px';
      wrap.style.left = Math.round(editorLeft) + 'px';
      wrap.hidden = false;
      wrap.classList.toggle('inside-scene', _insideScene($from));
    } catch (_) {
      wrap.hidden = true;
    }
  }

  function widgetMenuPlugin() {
    const PM = _pm();
    return new PM.Plugin({
      view: function(editorView) {
        const wrap = document.createElement('div');
        wrap.className = 'rga-widget-wrap';
        wrap.style.position = 'fixed';
        wrap.style.zIndex = '200';

        const btnScene = document.createElement('button');
        btnScene.className = 'rga-widget-btn rga-widget-btn-primary';
        btnScene.textContent = '+ Scene';
        btnScene.title = 'Insert scene (Ctrl+Enter)';
        btnScene.tabIndex = -1;

        const btnOther = document.createElement('button');
        btnOther.className = 'rga-widget-btn rga-widget-btn-secondary';
        btnOther.innerHTML = '+ <span class="rga-widget-arrow">▾</span>';
        btnOther.title = 'Insert block…';
        btnOther.tabIndex = -1;

        wrap.appendChild(btnScene);
        wrap.appendChild(btnOther);
        document.body.appendChild(wrap);

        btnScene.addEventListener('mousedown', function(e) {
          e.preventDefault();
          cmdScene(editorView);
        });

        btnOther.addEventListener('mousedown', function(e) {
          e.preventDefault();
          openOtherMenu(editorView, btnOther);
        });

        const container = document.getElementById('editor-container');
        function onScroll() { _positionWrap(editorView, wrap); }
        if (container) container.addEventListener('scroll', onScroll, { passive: true });

        return {
          update: function(view) { _positionWrap(view, wrap); },
          destroy: function() {
            if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
            if (container) container.removeEventListener('scroll', onScroll);
          }
        };
      }
    });
  }

  // ---------------------------------------------------------------
  // Slash command plugin
  // ---------------------------------------------------------------

  function slashCommandPlugin() {
    const PM = _pm();
    return new PM.Plugin({
      props: {
        handleKeyDown: function(view, e) {
          if (e.key !== '/') return false;
          const { $from, empty } = view.state.selection;
          if (!empty) return false;
          const parent = $from.parent;
          if (parent.type.name === 'sceneLine') return false;
          if (parent.textContent !== '' || $from.parentOffset !== 0) return false;
          setTimeout(function() {
            const pos = view.state.selection.$from.pos;
            _openSlashMenu(view, pos);
          }, 0);
          return false;
        }
      }
    });
  }

  // ---------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------

  Rga.WidgetMenu = {
    openWidgetMenu,
    openOtherMenu,
    hideMenu,
    widgetMenuPlugin,
    slashCommandPlugin,
    cmdScene,
    cmdParagraph,
    cmdQuote,
    cmdBulletList,
    cmdOrderedList,
    cmdInlineFreeText,
    OUTSIDE_SCENE_ITEMS,
    INSIDE_SCENE_ITEMS,
  };

  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};
  Rga.DocTypes.screenplay.widgetMenuPlugin = widgetMenuPlugin;
  Rga.DocTypes.screenplay.slashCommandPlugin = slashCommandPlugin;
})();
