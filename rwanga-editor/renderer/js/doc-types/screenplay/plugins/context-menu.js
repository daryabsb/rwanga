// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  // ---------------------------------------------------------------
  // Singleton menu element
  // ---------------------------------------------------------------
  let _menuEl = null;
  let _cleanup = null;

  // Margin kept between the menu and the viewport edge.
  const MENU_MARGIN = 8;
  // Estimated submenu width (min-width 140px + padding/label slack). Used to
  // decide whether the "Tag as ▶" submenu would overflow the right edge and
  // therefore needs to flip to the left. The submenu is display:none until
  // hover, so it cannot be measured up front — this estimate is intentionally
  // generous so the flip triggers slightly early rather than too late.
  const SUBMENU_EST_WIDTH = 170;

  // ---------------------------------------------------------------
  // Pure viewport clamp — keeps the menu fully inside the viewport.
  // Prefers the click point, then pulls in from the right/bottom by the
  // menu's *real* dimensions, and never below the top/left margin.
  // Exposed as Rga.ContextMenu._clampPosition for focused tests.
  // ---------------------------------------------------------------
  function clampMenuPosition(clickX, clickY, menuW, menuH, vw, vh, margin) {
    margin = (margin == null) ? MENU_MARGIN : margin;
    let x = Math.min(clickX, vw - menuW - margin);
    let y = Math.min(clickY, vh - menuH - margin);
    x = Math.max(margin, x);
    y = Math.max(margin, y);
    // Submenu opens to the right (CSS left:100%). If that would push it past
    // the right edge, flip it to the left of the parent menu so "Tag as ▶"
    // stays reachable. Direction-agnostic — based purely on available space,
    // so it also covers RTL near the left edge.
    const flipSubmenu = (x + menuW + SUBMENU_EST_WIDTH + margin) > vw;
    return { x: x, y: y, flipSubmenu: flipSubmenu };
  }

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
  // Item builders
  // ---------------------------------------------------------------
  function menuItem(label, action, opts) {
    opts = opts || {};
    const li = document.createElement('li');
    li.className = 'ctx-item' + (opts.className ? ' ' + opts.className : '') + (opts.disabled ? ' ctx-disabled' : '');
    li.textContent = label;
    if (opts.hasSubmenu) li.classList.add('ctx-has-submenu');
    if (!opts.disabled && action) {
      li.addEventListener('mousedown', function(e) {
        e.preventDefault();
        action();
      });
    }
    return li;
  }

  function menuSeparator() {
    const li = document.createElement('li');
    li.className = 'ctx-separator';
    return li;
  }

  // ---------------------------------------------------------------
  // Show the custom context menu
  // Always shown on right-click; mark items are enabled only when
  // there is a non-empty selection.
  // ---------------------------------------------------------------
  function showCustomMenu(view, event) {
    const el = getMenuEl();
    if (!el) return;

    el.innerHTML = '';
    el.className = 'overlay-menu rga-context-menu';

    const pmSel = view.state.selection;
    const nativeSel = window.getSelection ? window.getSelection().toString().trim() : '';
    const hasSelection = !pmSel.empty || nativeSel.length > 0;

    const ul = document.createElement('ul');
    ul.className = 'ctx-list';

    // Native clipboard
    ul.appendChild(menuItem('Cut',   function() { document.execCommand('cut');   hideMenu(); }));
    ul.appendChild(menuItem('Copy',  function() { document.execCommand('copy');  hideMenu(); }));
    ul.appendChild(menuItem('Paste', function() { document.execCommand('paste'); hideMenu(); }));
    ul.appendChild(menuSeparator());

    // Mark actions — only enabled when there's a selection
    ul.appendChild(menuItem('Add note', hasSelection ? function() {
      hideMenu();
      if (Rga.Annotations && Rga.Annotations.addNoteFromMenu) {
        Rga.Annotations.addNoteFromMenu(view);
      }
    } : null, { disabled: !hasSelection }));

    const tagItem = menuItem('Tag as ▶', null, { hasSubmenu: true, disabled: !hasSelection });
    if (hasSelection) buildTagSubmenu(tagItem, view);
    ul.appendChild(tagItem);

    ul.appendChild(menuItem('Flag for revision', hasSelection ? function() {
      hideMenu();
      if (Rga.RevisionFlags && Rga.RevisionFlags.showRevisionEditor) {
        Rga.RevisionFlags.showRevisionEditor(view);
      }
    } : null, { disabled: !hasSelection }));
    ul.appendChild(menuSeparator());

    ul.appendChild(menuItem('Open inspector', function() {
      hideMenu();
      if (Rga.Inspector && Rga.Inspector.open) Rga.Inspector.open();
    }));

    el.appendChild(ul);

    // Unhide first so the menu can be measured — offsetWidth/Height are 0
    // while hidden. This is all synchronous within the contextmenu handler,
    // so the browser only paints after we set the final coordinates: no flash
    // at the pre-clamp position.
    el.classList.remove('ctx-flip-submenu');
    el.hidden = false;
    const pos = clampMenuPosition(
      event.clientX, event.clientY,
      el.offsetWidth, el.offsetHeight,
      window.innerWidth, window.innerHeight
    );
    el.classList.toggle('ctx-flip-submenu', pos.flipSubmenu);
    el.style.left = pos.x + 'px';
    el.style.top = pos.y + 'px';

    // Dismiss on outside click or Escape
    function onOutside(e) {
      if (!el.contains(e.target)) hideMenu();
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); hideMenu(); }
    }
    // Use setTimeout so the current right-click mousedown doesn't immediately dismiss
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
  // ProseMirror plugin — intercepts ALL right-clicks
  // ---------------------------------------------------------------
  function contextMenuPlugin() {
    const PM = window.RgaProseMirror;
    return new PM.Plugin({
      props: {
        handleDOMEvents: {
          contextmenu: function(view, event) {
            // Always suppress browser/Electron default context menu
            event.preventDefault();
            showCustomMenu(view, event);
            return true;
          }
        }
      }
    });
  }

  Rga.ContextMenu = { hide: hideMenu, _clampPosition: clampMenuPosition };
  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};
  Rga.DocTypes.screenplay.contextMenuPlugin = contextMenuPlugin;
})();
