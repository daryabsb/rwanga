// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Settings workspace — Slices 5A + 5B.
//
// 5A: workspace tab skeleton (left nav rail + content area).
// 5B: read-only rows for the active section + search box that
//     filters across every registered setting.
//
// Mode model:
//   - section mode (default): rows belong to the currently selected
//     section. Switching sections updates rows and clears search.
//   - search mode: query is non-empty; rows are the search results
//     across ALL registered settings. The empty-state element
//     appears when no entry matches.
//
// Renderer scope (intentionally narrow for Slice 5B):
//   - one row per visible setting: label, description, current
//     effective value (as text), type chip
//   - requiresPro entries carry an .is-pro class + a marker element
//   - NO editable controls inside rows (those land with Slice 5C+)
//   - NO tier badges, advanced toggle, reset buttons, restart banner
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  if (!Rga.Workspaces || typeof Rga.Workspaces.register !== 'function') return;

  // --------------------------------------------------------------
  // Value formatting
  // --------------------------------------------------------------

  function _formatValue(entry, value) {
    if (value === undefined || value === null) return '(unset)';
    switch (entry.type) {
      case 'toggle': return value ? 'On' : 'Off';
      case 'text':
        return value === '' ? '(empty)' : String(value);
      case 'margins':
        if (value && typeof value === 'object') {
          return 'T ' + value.top + ' · B ' + value.bottom +
                 ' · L ' + value.left + ' · R ' + value.right;
        }
        return String(value);
      default:
        return String(value);
    }
  }

  function _currentValue(entry) {
    const Store = Rga.Settings && Rga.Settings.Store;
    if (Store && typeof Store.effective === 'function') {
      return Store.effective(entry.id);
    }
    return entry.default;
  }

  // --------------------------------------------------------------
  // Row rendering
  // --------------------------------------------------------------

  function _buildRow(entry) {
    const row = document.createElement('article');
    row.className = 'rga-settings-row';
    if (entry.requiresPro) row.classList.add('is-pro');
    row.setAttribute('data-setting-id', entry.id);

    const header = document.createElement('header');
    header.className = 'rga-settings-row-header';

    const label = document.createElement('h2');
    label.className = 'rga-settings-row-label';
    label.textContent = entry.label;
    header.appendChild(label);

    if (entry.type) {
      const chip = document.createElement('span');
      chip.className = 'rga-settings-row-type-chip';
      chip.textContent = entry.type;
      header.appendChild(chip);
    }

    if (entry.requiresPro) {
      const pro = document.createElement('span');
      pro.className = 'rga-settings-row-pro-marker';
      pro.textContent = 'Pro';
      header.appendChild(pro);
    }

    row.appendChild(header);

    const desc = document.createElement('p');
    desc.className = 'rga-settings-row-description';
    desc.textContent = entry.description || '';
    row.appendChild(desc);

    const value = document.createElement('p');
    value.className = 'rga-settings-row-value';
    value.textContent = _formatValue(entry, _currentValue(entry));
    row.appendChild(value);

    return row;
  }

  // Public-ish helper exposed via _workspaceInternals — lets unit
  // tests render rows from a synthetic entry list without standing
  // up the full layout.
  function renderRowsInto(host, entries) {
    if (!host) return;
    host.innerHTML = '';
    entries.forEach(function(entry) {
      host.appendChild(_buildRow(entry));
    });
  }

  // --------------------------------------------------------------
  // Section / search state per mount element
  // --------------------------------------------------------------

  function _state(el) {
    if (!el._rgaSettingsState) {
      el._rgaSettingsState = { mode: 'section', sectionId: null, query: '' };
    }
    return el._rgaSettingsState;
  }

  function _entriesForActiveSection(sectionId) {
    const L = Rga.Settings && Rga.Settings.Layout;
    const R = Rga.Settings && Rga.Settings.Registry;
    if (!L || !R) return [];
    const section = L.getSection(sectionId);
    if (!section) return [];
    return section.settingIds
      .map(function(id) { return R.get(id); })
      .filter(Boolean);
  }

  function _entriesForSearch(query) {
    const Search = Rga.Settings && Rga.Settings.Search;
    if (!Search || typeof Search.searchSettings !== 'function') return [];
    return Search.searchSettings(query);
  }

  function _renderForState(el) {
    const state = _state(el);
    const rowsHost = el.querySelector('.rga-settings-rows');
    const empty    = el.querySelector('.rga-settings-empty');
    if (!rowsHost) return;

    let entries;
    if (state.mode === 'search') {
      entries = _entriesForSearch(state.query);
    } else {
      entries = _entriesForActiveSection(state.sectionId);
    }

    renderRowsInto(rowsHost, entries);

    if (empty) {
      const showEmpty = state.mode === 'search' && entries.length === 0;
      if (showEmpty) {
        empty.removeAttribute('hidden');
        empty.style.display = '';
      } else {
        empty.setAttribute('hidden', '');
        empty.style.display = 'none';
      }
    }
  }

  function _renderSectionHeader(el, section) {
    if (!section) return;
    el.querySelector('.rga-settings-content-title').textContent       = section.label;
    el.querySelector('.rga-settings-content-description').textContent = section.description;
    el.querySelector('.rga-settings-content-count').textContent =
      section.settingIds.length + ' setting' + (section.settingIds.length === 1 ? '' : 's');
  }

  function _setActiveSection(el, sectionId) {
    const L = Rga.Settings && Rga.Settings.Layout;
    if (!L) return;
    const section = L.getSection(sectionId);
    if (!section) return;
    const state = _state(el);
    state.mode      = 'section';
    state.sectionId = sectionId;
    state.query     = '';
    const input = el.querySelector('.rga-settings-search-input');
    if (input && input.value !== '') input.value = '';
    el.setAttribute('data-active-section-id', sectionId);

    el.querySelectorAll('.rga-settings-nav-item').forEach(function(li) {
      li.classList.toggle('is-active',
        li.getAttribute('data-section-id') === sectionId);
    });
    _renderSectionHeader(el, section);
    _renderForState(el);
  }

  function _onSearchInput(el) {
    const input = el.querySelector('.rga-settings-search-input');
    const state = _state(el);
    const q = input ? input.value : '';
    state.query = q;
    state.mode  = q.length > 0 ? 'search' : 'section';
    _renderForState(el);
  }

  // --------------------------------------------------------------
  // Mount
  // --------------------------------------------------------------

  function _buildSkeleton(el) {
    const L = Rga.Settings && Rga.Settings.Layout;
    const sections = (L && typeof L.sections === 'function') ? L.sections() : [];
    el.classList.add('rga-settings-workspace');

    // Left nav rail.
    const nav = document.createElement('nav');
    nav.className = 'rga-settings-nav';
    sections.forEach(function(section) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'rga-settings-nav-item';
      item.setAttribute('data-section-id', section.id);
      item.textContent = section.label;
      item.addEventListener('click', function() {
        _setActiveSection(el, section.id);
      });
      nav.appendChild(item);
    });

    // Right content area.
    const content = document.createElement('section');
    content.className = 'rga-settings-content';

    const header = document.createElement('header');
    header.className = 'rga-settings-content-header';

    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.className = 'rga-settings-search-input';
    searchInput.setAttribute('placeholder', 'Search settings');
    searchInput.setAttribute('aria-label', 'Search settings');
    searchInput.addEventListener('input', function() { _onSearchInput(el); });
    header.appendChild(searchInput);

    const title = document.createElement('h1');
    title.className = 'rga-settings-content-title';
    const desc = document.createElement('p');
    desc.className = 'rga-settings-content-description';
    const count = document.createElement('p');
    count.className = 'rga-settings-content-count';
    header.appendChild(title);
    header.appendChild(desc);
    header.appendChild(count);

    content.appendChild(header);

    const rowsHost = document.createElement('div');
    rowsHost.className = 'rga-settings-rows';
    content.appendChild(rowsHost);

    const empty = document.createElement('div');
    empty.className = 'rga-settings-empty';
    empty.setAttribute('hidden', '');
    empty.style.display = 'none';
    const emptyMsg = document.createElement('p');
    emptyMsg.className = 'rga-settings-empty-message';
    emptyMsg.textContent = 'No settings match your search.';
    empty.appendChild(emptyMsg);
    content.appendChild(empty);

    el.appendChild(nav);
    el.appendChild(content);

    // Seed: first section as active.
    if (sections.length > 0) _setActiveSection(el, sections[0].id);
  }

  Rga.Workspaces.register({
    kind: 'settings',
    title: 'Settings',
    icon: 'settings',
    restoreOnSession: false,
    mount: function(el) {
      _buildSkeleton(el);
    },
    unmount: function(el) {
      el.innerHTML = '';
      el.removeAttribute('data-active-section-id');
      el.classList.remove('rga-settings-workspace');
      if (el._rgaSettingsState) delete el._rgaSettingsState;
    }
  });

  // Ctrl+, opens the workspace.
  const KR = Rga.KeyboardRegistry;
  if (KR && typeof KR.registerCommand === 'function') {
    KR.registerCommand({
      command: 'view.openSettings',
      label:   'Open Settings',
      key:     ',',
      mods:    { ctrl: true },
      handler: function() {
        if (Rga.TabManager && typeof Rga.TabManager.openWorkspace === 'function') {
          Rga.TabManager.openWorkspace('settings');
        }
      },
      source:  'Slice 5A settings workspace'
    });
  }

  // Internals for tests / future consumers. NOT a public renderer
  // API — workspaces talk to the host via mount/unmount only.
  Rga.Settings = Rga.Settings || {};
  Rga.Settings._workspaceInternals = {
    renderRowsInto: renderRowsInto,
    _formatValue:   _formatValue
  };
})();
