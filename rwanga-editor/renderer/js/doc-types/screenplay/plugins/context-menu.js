// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  // ---------------------------------------------------------------
  // Singleton menu element (reused across invocations)
  // ---------------------------------------------------------------
  let _menuEl = null;
  let _cleanup = null;

  function getMenuEl() {
    if (!_menuEl) _menuEl = document.getElementById('context-menu');
    return _menuEl;
  }

  function hideMenu() {
    const el = getMenuEl();
    if (el) {
      el.hidden = true;
      el.innerHTML = '';
    }
    if (_cleanup) {
      _cleanup();
      _cleanup = null;
    }
  }

  // ---------------------------------------------------------------
  // Menu item builder
  // ---------------------------------------------------------------
  function menuItem(label, action, opts) {
    opts = opts || {};
    const li = document.createElement('li');
    li.className = 'ctx-item' + (opts.className ? ' ' + opts.className : '');
    li.textContent = label;
    if (opts.hasSubmenu) li.classList.add('ctx-has-submenu');
    li.addEventListener('mousedown', function(e) {
      e.preventDefault();
      if (action) action();
    });
    return li;
  }

  function menuSeparator() {
    const li = document.createElement('li');
    li.className = 'ctx-separator';
    return li;
  }

  // ---------------------------------------------------------------
  // Show custom context menu
  // ---------------------------------------------------------------
  function showCustomMenu(view, event) {
    const el = getMenuEl();
    if (!el) return;

    el.innerHTML = '';
    el.className = 'overlay-menu rga-context-menu';

    const ul = document.createElement('ul');
    ul.className = 'ctx-list';

    // -- Native clipboard actions ---
    ul.appendChild(menuItem('Cut', function() { document.execCommand('cut'); hideMenu(); }));
    ul.appendChild(menuItem('Copy', function() { document.execCommand('copy'); hideMenu(); }));
    ul.appendChild(menuItem('Paste', function() { document.execCommand('paste'); hideMenu(); }));
    ul.appendChild(menuSeparator());

    // -- Mark actions ---
    ul.appendChild(menuItem('Add note', function() {
      hideMenu();
      if (Rga.Annotations && Rga.Annotations.showAnnotationEditor) {
        Rga.Annotations.showAnnotationEditor(view);
      }
    }));

    const tagItem = menuItem('Tag as ▶', null, { hasSubmenu: true });
    buildTagSubmenu(tagItem, view);
    ul.appendChild(tagItem);

    ul.appendChild(menuItem('Flag for revision', function() {
      hideMenu();
      if (Rga.RevisionFlags && Rga.RevisionFlags.showRevisionEditor) {
        Rga.RevisionFlags.showRevisionEditor(view);
      }
    }));
    ul.appendChild(menuSeparator());

    ul.appendChild(menuItem('Open inspector', function() {
      hideMenu();
      if (Rga.Inspector && Rga.Inspector.open) Rga.Inspector.open();
    }));

    el.appendChild(ul);

    // Position near cursor
    const x = Math.min(event.clientX, window.innerWidth - 200);
    const y = Math.min(event.clientY, window.innerHeight - 200);
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.hidden = false;

    // Dismiss on outside click or Escape
    function onOutside(e) {
      if (!el.contains(e.target)) hideMenu();
    }
    function onKey(e) {
      if (e.key === 'Escape') hideMenu();
    }
    setTimeout(function() {
      document.addEventListener('mousedown', onOutside, true);
      document.addEventListener('keydown', onKey, true);
    }, 0);

    _cleanup = function() {
      document.removeEventListener('mousedown', onOutside, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }

  // ---------------------------------------------------------------
  // Tag submenu
  // ---------------------------------------------------------------
  const TAG_TYPES = [
    { key: 'character', label: 'Character' },
    { key: 'prop',      label: 'Prop' },
    { key: 'wardrobe',  label: 'Wardrobe' },
    { key: 'location',  label: 'Location' },
    { key: 'sfx',       label: 'SFX' },
    { key: 'vfx',       label: 'VFX' },
    { key: 'vehicle',   label: 'Vehicle' },
    { key: 'animal',    label: 'Animal' },
    { key: 'custom',    label: 'Custom…' },
  ];

  function buildTagSubmenu(parentItem, view) {
    const sub = document.createElement('ul');
    sub.className = 'ctx-submenu ctx-list';

    TAG_TYPES.forEach(function(t) {
      const li = menuItem(t.label, function() {
        hideMenu();
        if (Rga.Tags && Rga.Tags.showTagDialog) {
          Rga.Tags.showTagDialog(view, t.key);
        }
      });
      sub.appendChild(li);
    });

    parentItem.appendChild(sub);
  }

  // ---------------------------------------------------------------
  // ProseMirror plugin
  // ---------------------------------------------------------------
  function contextMenuPlugin() {
    const PM = window.RgaProseMirror;
    return new PM.Plugin({
      props: {
        handleDOMEvents: {
          contextmenu: function(view, event) {
            if (view.state.selection.empty) return false;
            event.preventDefault();
            showCustomMenu(view, event);
            return true;
          }
        }
      }
    });
  }

  Rga.ContextMenu = { hide: hideMenu };
  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};
  Rga.DocTypes.screenplay.contextMenuPlugin = contextMenuPlugin;
})();
