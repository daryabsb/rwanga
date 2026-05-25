// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.Shell.ActivityRail — renders the 48px left-edge column of panel
// buttons. Each rail item maps to one registered Rga.Shell.Sidebar panel.
//
// Click semantics (plan §3.3):
//   - Click an inactive panel button → Sidebar.activate(id) + show sidebar.
//   - Click the active panel button   → Sidebar.deactivate() + hide sidebar (toggle off).
//
// The rail subscribes to Sidebar.onChange to keep its active visual state
// in sync with the Sidebar's source of truth.
//
// No public state; rail state is derived from Sidebar.current() +
// Rga.Shell.Layout.get().sidebar.visible.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Shell = Rga.Shell || {};
  Rga.Shell.ActivityRail = Rga.Shell.ActivityRail || {};

  let _container = null;
  let _unsubscribeSidebar = null;

  // Three-group layout per Activity Rail Doctrine §Rule 3. The rail
  // never owns evenness across full height — these three groups DO,
  // and each panel id is assigned to exactly one group.
  // Panels not in this map fall into a fourth "unassigned" group that
  // is appended after Middle (best-effort; the audit catches drift).
  const RAIL_GROUPS = {
    top:    ['sceneNavigator', 'scriptWorkspace', 'outline', 'search'],
    middle: ['characters', 'revisions'],
    bottom: ['settings']
  };
  const GROUP_ORDER = ['top', 'middle', 'bottom'];

  function init(container) {
    if (!container) return false;
    _container = container;
    refresh();
    // Sync visual active-state when sidebar changes (from any source).
    if (_unsubscribeSidebar) _unsubscribeSidebar();
    if (Rga.Shell.Sidebar && typeof Rga.Shell.Sidebar.onChange === 'function') {
      _unsubscribeSidebar = Rga.Shell.Sidebar.onChange(function() { _syncActiveState(); });
    }
    return true;
  }

  function refresh() {
    if (!_container) return;
    if (!Rga.Shell.Sidebar) return;
    _container.innerHTML = '';
    const ids = Rga.Shell.Sidebar.registered();
    const groupedIds = _partitionByGroup(ids);

    GROUP_ORDER.forEach(function(group) {
      const groupEl = document.createElement('div');
      groupEl.className = 'rga-shell-rail-group rga-shell-rail-group-' + group;
      groupEl.setAttribute('data-rail-group', group);
      groupedIds[group].forEach(function(id) {
        const controller = Rga.Shell.Sidebar.getController(id);
        if (!controller) return;
        groupEl.appendChild(_buildButton(controller));
      });
      // Always append the group — even when empty — so the three-group
      // skeleton exists in the DOM. Empty groups collapse visually
      // because they have no children, but the audit guards check
      // structural presence.
      _container.appendChild(groupEl);
    });

    // Any panel not in any documented group → tail-append in a
    // distinct "unassigned" group, after Middle (before Bottom is
    // visually undesirable). Keeps unknown panels reachable while
    // making the misclassification obvious.
    if (groupedIds.unassigned.length > 0) {
      const groupEl = document.createElement('div');
      groupEl.className = 'rga-shell-rail-group rga-shell-rail-group-unassigned';
      groupEl.setAttribute('data-rail-group', 'unassigned');
      groupedIds.unassigned.forEach(function(id) {
        const controller = Rga.Shell.Sidebar.getController(id);
        if (!controller) return;
        groupEl.appendChild(_buildButton(controller));
      });
      // Insert before the bottom group so Settings stays pinned.
      const bottomEl = _container.querySelector('.rga-shell-rail-group-bottom');
      if (bottomEl) _container.insertBefore(groupEl, bottomEl);
      else          _container.appendChild(groupEl);
    }

    _syncActiveState();
  }

  function _partitionByGroup(ids) {
    const buckets = { top: [], middle: [], bottom: [], unassigned: [] };
    // Walk the documented group order first so each documented panel
    // appears in the doctrine-prescribed sequence, regardless of
    // registration order.
    GROUP_ORDER.forEach(function(group) {
      RAIL_GROUPS[group].forEach(function(panelId) {
        if (ids.indexOf(panelId) >= 0) buckets[group].push(panelId);
      });
    });
    // Anything registered but not documented in RAIL_GROUPS.
    const documented = new Set();
    GROUP_ORDER.forEach(function(g) { RAIL_GROUPS[g].forEach(function(p) { documented.add(p); }); });
    ids.forEach(function(id) {
      if (!documented.has(id)) buckets.unassigned.push(id);
    });
    return buckets;
  }

  function _buildButton(controller) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rga-shell-rail-item';
    btn.setAttribute('data-panel-id', controller.id);
    btn.setAttribute('aria-label', controller.label || controller.id);
    btn.setAttribute('title', _tooltipText(controller));
    // Lucide-only icon resolution (Doctrine Rule 1). controller.icon
    // is a Lucide name (string). If the registry doesn't recognise it
    // we leave the button visually empty rather than fall back to an
    // emoji glyph — the audit will catch unknown names.
    const iconName = controller.icon || '';
    const svg = (Rga.Icons && Rga.Icons.Lucide && Rga.Icons.Lucide.has(iconName))
      ? Rga.Icons.Lucide.svgFor(iconName)
      : '';
    btn.innerHTML = svg;
    btn.addEventListener('click', function() { _onClick(controller.id); });
    return btn;
  }

  function _tooltipText(controller) {
    const label = controller.label || controller.id;
    if (controller.shortcut) return label + ' (' + controller.shortcut + ')';
    return label;
  }

  function _onClick(id) {
    // Settings is a workspace tab, not a sidebar panel. Short-circuit
    // through the canonical opener so the rail click never goes into
    // the sidebar.activate pathway (which would mount the legacy
    // empty-state stub). All Settings entry points route through this
    // single opener.
    if (id === 'settings' &&
        Rga.SettingsWorkspace &&
        typeof Rga.SettingsWorkspace.open === 'function') {
      Rga.SettingsWorkspace.open();
      return;
    }
    if (!Rga.Shell.Sidebar || !Rga.Shell.Layout) return;
    const isCurrent = Rga.Shell.Sidebar.current() === id;
    const sidebarVisible = Rga.Shell.Layout.get().sidebar.visible;
    // Responsive Shell: every rail click is an explicit user choice —
    // flag userOverride so the responsive engine stops auto-toggling
    // the sidebar based on window width.
    if (isCurrent && sidebarVisible) {
      // Toggle off — deactivate AND hide the sidebar.
      Rga.Shell.Sidebar.deactivate();
      Rga.Shell.Layout.set({ sidebar: { visible: false, userOverride: true } });
    } else {
      // Activate and ensure the sidebar is visible.
      Rga.Shell.Sidebar.activate(id);
      Rga.Shell.Layout.set({ sidebar: { visible: true, userOverride: true } });
    }
  }

  function _syncActiveState() {
    if (!_container) return;
    const currentId = Rga.Shell.Sidebar ? Rga.Shell.Sidebar.current() : null;
    const sidebarVisible = Rga.Shell.Layout ? Rga.Shell.Layout.get().sidebar.visible : true;
    const buttons = _container.querySelectorAll('.rga-shell-rail-item');
    for (let i = 0; i < buttons.length; i += 1) {
      const btn = buttons[i];
      const id = btn.getAttribute('data-panel-id');
      const active = (id === currentId) && sidebarVisible;
      if (active) btn.classList.add('rga-shell-rail-item-active');
      else btn.classList.remove('rga-shell-rail-item-active');
      btn.setAttribute('aria-pressed', String(active));
    }
  }

  function _reset() {
    if (_unsubscribeSidebar) _unsubscribeSidebar();
    _unsubscribeSidebar = null;
    if (_container) _container.innerHTML = '';
    _container = null;
  }

  Rga.Shell.ActivityRail.init    = init;
  Rga.Shell.ActivityRail.refresh = refresh;
  Rga.Shell.ActivityRail._reset  = _reset;
  // Read-only exposure for tests and doctrine-guard audits.
  Rga.Shell.ActivityRail._RAIL_GROUPS = RAIL_GROUPS;
})();
