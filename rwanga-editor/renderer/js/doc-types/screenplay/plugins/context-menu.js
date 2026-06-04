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
    return { x: x, y: y };
  }

  // ---------------------------------------------------------------
  // Pure submenu clamp — given the parent item's viewport rect and the
  // submenu's *measured* size, decide which side it opens on and how far
  // it must shift vertically to stay inside the viewport. Returns
  //   openRight: true  -> submenu opens to the right of the parent (left:100%)
  //   openRight: false -> submenu opens to the left  (right:100%)
  //   topOffset:       vertical offset in px relative to the parent's top
  //                    (the submenu is absolutely positioned inside the
  //                    parent <li>, whose top edge is the 0 reference).
  // Direction-agnostic: it picks the side with room, so it covers RTL too.
  // Exposed as Rga.ContextMenu._clampSubmenuPosition for focused tests.
  // ---------------------------------------------------------------
  function clampSubmenuPosition(parent, subW, subH, vw, vh, margin) {
    margin = (margin == null) ? MENU_MARGIN : margin;
    // Horizontal: prefer the right side; flip left when the right side
    // overflows. If neither side fully fits, take the side with more room.
    const fitsRight = (parent.right + subW + margin) <= vw;
    const fitsLeft = (parent.left - subW - margin) >= 0;
    let openRight;
    if (fitsRight) openRight = true;
    else if (fitsLeft) openRight = false;
    else openRight = (vw - parent.right) >= parent.left;
    // Vertical: align the submenu top with the parent (the CSS default is
    // -4px); clamp so the whole submenu stays inside the viewport.
    let top = parent.top - 4;
    if (top + subH + margin > vh) top = vh - margin - subH;
    if (top < margin) top = margin;
    return { openRight: openRight, topOffset: top - parent.top };
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
    el.hidden = false;
    const pos = clampMenuPosition(
      event.clientX, event.clientY,
      el.offsetWidth, el.offsetHeight,
      window.innerWidth, window.innerHeight
    );
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

  // Position the submenu when it is revealed, measuring its real size so it
  // never spills off the right edge (the reported bug) or the bottom. CSS
  // :hover still controls visibility (display:none → block); we only override
  // the side and vertical offset via inline styles, which win over the
  // stylesheet. Recomputed on every hover so it adapts to the menu's spot.
  function positionSubmenu(parentItem, sub) {
    // Clear any prior inline placement so the measurement is clean.
    sub.style.left = '';
    sub.style.right = '';
    sub.style.top = '';
    const parent = parentItem.getBoundingClientRect();
    const r = sub.getBoundingClientRect();
    const place = clampSubmenuPosition(
      { left: parent.left, right: parent.right, top: parent.top },
      r.width, r.height,
      window.innerWidth, window.innerHeight
    );
    if (place.openRight) {
      sub.style.left = '100%';
      sub.style.right = 'auto';
    } else {
      sub.style.left = 'auto';
      sub.style.right = '100%';
    }
    sub.style.top = place.topOffset + 'px';
  }

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

    // Re-measure and clamp the submenu each time it is hovered open. mouseenter
    // fires while :hover is already active, so the submenu is laid out and
    // measurable. pointerenter covers touch/pen.
    parentItem.addEventListener('mouseenter', function() { positionSubmenu(parentItem, sub); });
    parentItem.addEventListener('pointerenter', function() { positionSubmenu(parentItem, sub); });
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

  Rga.ContextMenu = {
    hide: hideMenu,
    _clampPosition: clampMenuPosition,
    _clampSubmenuPosition: clampSubmenuPosition
  };
  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};
  Rga.DocTypes.screenplay.contextMenuPlugin = contextMenuPlugin;
})();
