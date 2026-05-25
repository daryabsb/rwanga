// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Settings workspace — Slices 5A + 5B + 5C.
//
// 5A: workspace tab skeleton (left nav rail + content area).
// 5B: read-only rows for the active section + search box that
//     filters across every registered setting.
// 5C: editable controls for safe registry types.
//     Safe types this slice: toggle, select, radio, number, text.
//     Other types stay read-only and are listed in the slice report.
//
// Mode model:
//   - section mode (default): rows belong to the currently selected
//     section. Switching sections updates rows and clears search.
//   - search mode: query is non-empty; rows are the search results
//     across ALL registered settings. The empty-state element
//     appears when no entry matches.
//
// Control contract (5C):
//   - Every editable control writes through Rga.Settings.Store.set.
//   - Store.set returns boolean. On false the prior effective value
//     is restored on the control (no visual commit of an invalid
//     value) and no UI error is surfaced this slice.
//   - requiresPro rows render a disabled control. No writes are
//     attempted on them.
//   - restartRequired rows are editable plus a small marker chip.
//     No restart banner / restart-action UI in this slice.
//   - A per-row Store subscription keeps the control in sync if the
//     value changes externally (e.g. a tab switch flips the script-
//     tier effective value).
//   - Unsupported types (slider / color / shortcut / margins) fall
//     back to the 5B read-only paragraph.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  if (!Rga.Workspaces || typeof Rga.Workspaces.register !== 'function') return;

  // Types this slice renders as editable controls.
  const EDITABLE_TYPES = new Set(['toggle', 'select', 'radio', 'number', 'text']);

  // --------------------------------------------------------------
  // Value formatting (read-only fallback for unsupported types)
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
  // Editable-control factory
  //
  // Returns { element, sync(value), wire(row) }:
  //   - element: the input / select / fieldset to mount in the row
  //   - sync(v): updates the control's visible value to v (used by
  //     the Store subscriber and by revert-on-reject)
  //   - wire(row): attaches change handler that calls Store.set and
  //     registers a Store subscription. Returns an unsubscribe fn.
  //
  // Disabled handling: if entry.requiresPro the control is rendered
  // with the disabled attribute and wire() registers no change
  // handler (no writes are possible).
  // --------------------------------------------------------------

  function _makeControl(entry) {
    switch (entry.type) {
      case 'toggle': return _makeToggle(entry);
      case 'select': return _makeSelect(entry);
      case 'radio':  return _makeRadio(entry);
      case 'number': return _makeNumber(entry);
      case 'text':   return _makeText(entry);
      default:       return null;
    }
  }

  function _makeToggle(entry) {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'rga-settings-control-toggle';
    input.setAttribute('data-control-for', entry.id);
    input.checked = !!_currentValue(entry);
    if (entry.requiresPro) input.disabled = true;

    function sync(value) { input.checked = !!value; }
    function readValue() { return input.checked; }
    return { element: input, sync: sync, readValue: readValue };
  }

  function _makeSelect(entry) {
    const select = document.createElement('select');
    select.className = 'rga-settings-control-select';
    select.setAttribute('data-control-for', entry.id);
    if (entry.requiresPro) select.disabled = true;
    (entry.options || []).forEach(function(opt) {
      const o = document.createElement('option');
      o.value = String(opt);
      o.textContent = String(opt);
      select.appendChild(o);
    });
    const cur = _currentValue(entry);
    if (cur !== undefined && cur !== null) select.value = String(cur);

    function sync(value) {
      if (value === undefined || value === null) return;
      select.value = String(value);
    }
    function readValue() { return select.value; }
    return { element: select, sync: sync, readValue: readValue };
  }

  function _makeRadio(entry) {
    const group = document.createElement('fieldset');
    group.className = 'rga-settings-control-radio';
    group.setAttribute('role', 'radiogroup');
    group.setAttribute('data-control-for', entry.id);

    const cur = _currentValue(entry);
    const inputs = [];
    (entry.options || []).forEach(function(opt) {
      const label = document.createElement('label');
      label.className = 'rga-settings-control-radio-option';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'rga-setting-' + entry.id;
      input.value = String(opt);
      input.checked = String(cur) === String(opt);
      if (entry.requiresPro) input.disabled = true;
      const span = document.createElement('span');
      span.textContent = String(opt);
      label.appendChild(input);
      label.appendChild(span);
      group.appendChild(label);
      inputs.push(input);
    });

    function sync(value) {
      const s = (value === undefined || value === null) ? '' : String(value);
      inputs.forEach(function(i) { i.checked = i.value === s; });
    }
    function readValue() {
      const sel = inputs.find(function(i) { return i.checked; });
      return sel ? sel.value : undefined;
    }
    return { element: group, sync: sync, readValue: readValue, _inputs: inputs };
  }

  function _makeNumber(entry) {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'rga-settings-control-number';
    input.setAttribute('data-control-for', entry.id);
    if (entry.requiresPro) input.disabled = true;
    const cur = _currentValue(entry);
    if (typeof cur === 'number' && Number.isFinite(cur)) {
      input.value = String(cur);
    }

    function sync(value) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        input.value = String(value);
      } else if (value === undefined || value === null) {
        input.value = '';
      } else {
        input.value = String(value);
      }
    }
    function readValue() {
      const raw = input.value;
      if (raw === '' || raw === null || raw === undefined) return NaN;
      return Number(raw);
    }
    return { element: input, sync: sync, readValue: readValue };
  }

  function _makeText(entry) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'rga-settings-control-text';
    input.setAttribute('data-control-for', entry.id);
    if (entry.requiresPro) input.disabled = true;
    const cur = _currentValue(entry);
    input.value = (cur === undefined || cur === null) ? '' : String(cur);

    function sync(value) {
      input.value = (value === undefined || value === null) ? '' : String(value);
    }
    function readValue() { return input.value; }
    return { element: input, sync: sync, readValue: readValue };
  }

  // --------------------------------------------------------------
  // Row rendering
  // --------------------------------------------------------------

  function _buildRow(entry, subs) {
    const row = document.createElement('article');
    row.className = 'rga-settings-row';
    if (entry.requiresPro) row.classList.add('is-pro');
    if (entry.restartRequired) row.classList.add('is-restart-required');
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

    if (entry.restartRequired) {
      const restart = document.createElement('span');
      restart.className = 'rga-settings-row-restart-marker';
      restart.textContent = 'Restart required';
      header.appendChild(restart);
    }

    row.appendChild(header);

    const desc = document.createElement('p');
    desc.className = 'rga-settings-row-description';
    desc.textContent = entry.description || '';
    row.appendChild(desc);

    const valueSlot = document.createElement('div');
    valueSlot.className = 'rga-settings-row-value';
    row.appendChild(valueSlot);

    if (EDITABLE_TYPES.has(entry.type)) {
      const ctrl = _makeControl(entry);
      if (ctrl) {
        valueSlot.appendChild(ctrl.element);
        _wireControl(entry, ctrl, subs);
        return row;
      }
    }

    // Read-only fallback (unsupported types + safety net).
    valueSlot.classList.add('is-readonly');
    valueSlot.textContent = _formatValue(entry, _currentValue(entry));
    return row;
  }

  function _wireControl(entry, ctrl, subs) {
    const Store = Rga.Settings && Rga.Settings.Store;
    if (!Store) return;

    if (entry.requiresPro) {
      // No change handler, no subscription — just ensure visual state
      // reflects current effective value if it changes elsewhere.
      const unsub = Store.subscribe(entry.id, function(newVal) {
        ctrl.sync(newVal);
      });
      subs.push(unsub);
      return;
    }

    let priorValue = _currentValue(entry);
    let suppressNext = false;

    function onChange() {
      const newValue = ctrl.readValue();
      // Reject NaN on number inputs without touching the store.
      if (entry.type === 'number' && (typeof newValue !== 'number' || !Number.isFinite(newValue))) {
        suppressNext = true;
        ctrl.sync(priorValue);
        return;
      }
      const ok = Store.set(entry.id, newValue);
      if (!ok) {
        suppressNext = true;
        ctrl.sync(priorValue);
        return;
      }
      priorValue = newValue;
    }

    ctrl.element.addEventListener('change', onChange);

    const unsub = Store.subscribe(entry.id, function(newVal) {
      if (suppressNext) { suppressNext = false; return; }
      priorValue = newVal;
      ctrl.sync(newVal);
    });
    subs.push(unsub);
  }

  // Public-ish helper exposed via _workspaceInternals — lets unit
  // tests render rows from a synthetic entry list without standing
  // up the full layout.
  function renderRowsInto(host, entries) {
    if (!host) return;
    _clearSubs(host);
    host.innerHTML = '';
    const subs = _subsFor(host);
    entries.forEach(function(entry) {
      host.appendChild(_buildRow(entry, subs));
    });
  }

  // --------------------------------------------------------------
  // Per-host subscription registry
  //
  // Keeps unsubscribers alive for the lifetime of a row-set so they
  // can be cleanly torn down on re-render or unmount.
  // --------------------------------------------------------------

  function _subsFor(host) {
    if (!host._rgaSettingsSubs) host._rgaSettingsSubs = [];
    return host._rgaSettingsSubs;
  }

  function _clearSubs(host) {
    if (!host || !host._rgaSettingsSubs) return;
    host._rgaSettingsSubs.forEach(function(unsub) {
      try { if (typeof unsub === 'function') unsub(); }
      catch (err) { console.warn('[settings-workspace] unsubscribe threw:', err); }
    });
    host._rgaSettingsSubs = [];
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
    // Editor-only shell chrome is suppressed while Settings is active —
    // Settings is its own surface, not "the editor with Settings on it."
    // TabManager.activate() reads this policy and hides the targets.
    chrome: {
      toolbar:     false,
      bottomPanel: false,
      inspector:   false
    },
    mount: function(el) {
      _buildSkeleton(el);
    },
    unmount: function(el) {
      const rowsHost = el.querySelector('.rga-settings-rows');
      if (rowsHost) _clearSubs(rowsHost);
      el.innerHTML = '';
      el.removeAttribute('data-active-section-id');
      el.classList.remove('rga-settings-workspace');
      if (el._rgaSettingsState) delete el._rgaSettingsState;
    }
  });

  // ---------------------------------------------------------------
  // Reachability — canonical opener.
  //
  // Every Settings entry point (rail bottom button, Tools → Settings
  // menu, macOS Preferences, Ctrl+, , command palette, future
  // surfaces) MUST call Rga.SettingsWorkspace.open(). One public
  // entry point, no duplicate routing logic.
  //
  // Singleton behavior is owned by TabManager.openWorkspace: opening
  // the same kind twice focuses the existing tab.
  // ---------------------------------------------------------------
  Rga.SettingsWorkspace = {
    open: function() {
      if (Rga.TabManager && typeof Rga.TabManager.openWorkspace === 'function') {
        return Rga.TabManager.openWorkspace('settings');
      }
      return null;
    }
  };

  // Ctrl+, opens the workspace via the canonical opener.
  const KR = Rga.KeyboardRegistry;
  if (KR && typeof KR.registerCommand === 'function') {
    KR.registerCommand({
      command: 'view.openSettings',
      label:   'Settings',
      key:     ',',
      mods:    { ctrl: true },
      handler: function() { Rga.SettingsWorkspace.open(); },
      source:  'Settings workspace (Ctrl+,)'
    });
  }

  // Internals for tests / future consumers. NOT a public renderer
  // API — workspaces talk to the host via mount/unmount only.
  Rga.Settings = Rga.Settings || {};
  Rga.Settings._workspaceInternals = {
    renderRowsInto: renderRowsInto,
    _formatValue:   _formatValue,
    _editableTypes: Array.from(EDITABLE_TYPES),
    _makeControl:   _makeControl
  };
})();
