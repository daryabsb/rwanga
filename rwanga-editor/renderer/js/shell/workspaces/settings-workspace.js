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

  // Types this workspace renders as editable controls.
  //   - 5C ships: toggle, select, radio, number, text
  //   - H5  adds: slider (windowZoom + future range-shaped settings)
  //   - H6  adds: shortcut (kb.*)
  //   - H7  adds: margins (pageSetup.margins) + color (appearance.editorDeskColor)
  const EDITABLE_TYPES = new Set([
    'toggle', 'select', 'radio', 'number', 'text',
    'slider', 'shortcut', 'margins', 'color'
  ]);

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
      case 'toggle':   return _makeToggle(entry);
      case 'select':   return _makeSelect(entry);
      case 'radio':    return _makeRadio(entry);
      case 'number':   return _makeNumber(entry);
      case 'text':     return _makeText(entry);
      case 'slider':   return _makeSlider(entry);
      case 'shortcut': return _makeShortcut(entry);
      case 'margins':  return _makeMargins(entry);
      case 'color':    return _makeColor(entry);
      default:         return null;
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
    const labels = (entry.labels && typeof entry.labels === 'object') ? entry.labels : null;
    (entry.options || []).forEach(function(opt) {
      const o = document.createElement('option');
      o.value = String(opt);
      o.textContent = (labels && Object.prototype.hasOwnProperty.call(labels, opt))
        ? labels[opt] : String(opt);
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
    const labels = (entry.labels && typeof entry.labels === 'object') ? entry.labels : null;
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
      span.textContent = (labels && Object.prototype.hasOwnProperty.call(labels, opt))
        ? labels[opt] : String(opt);
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

  // H5 — Slider control (RC1 §5.2.5 + Component Library #8).
  //
  // Wrap: <span> housing the native <input type="range"> + a value
  // label to its right. The wrap is the `element` so _wireControl's
  // change listener catches bubbled events from the inner input.
  // Native range fires `change` only on release; we re-emit a change
  // on each `input` event so the wire layer commits live to Store
  // (Window Zoom must respond mid-drag — the user wants to see the UI
  // scale as they slide, not after they let go).
  //
  // Disabled handling: _disableControlElement handles the wrap by
  // disabling every inner <input> child, so PERSISTS_ONLY rows render
  // a properly-greyed slider.
  function _makeSlider(entry) {
    const wrap = document.createElement('span');
    wrap.className = 'rga-settings-control-slider';
    wrap.setAttribute('data-control-for', entry.id);

    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'rga-settings-control-slider-input';
    if (typeof entry.min  === 'number') input.min  = String(entry.min);
    if (typeof entry.max  === 'number') input.max  = String(entry.max);
    if (typeof entry.step === 'number') input.step = String(entry.step);
    if (entry.requiresPro) input.disabled = true;

    const cur = _currentValue(entry);
    if (typeof cur === 'number' && Number.isFinite(cur)) {
      input.value = String(cur);
    }

    const valueLabel = document.createElement('span');
    valueLabel.className = 'rga-settings-control-slider-value';
    valueLabel.textContent = _formatSliderValue(entry, cur);

    wrap.appendChild(input);
    wrap.appendChild(valueLabel);

    // Live label update + change-event re-emit on every input tick.
    // The dispatched event bubbles through the wrap, where _wireControl
    // is listening for `change`.
    input.addEventListener('input', function() {
      const n = Number(input.value);
      valueLabel.textContent = _formatSliderValue(entry, n);
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    function sync(value) {
      // Native range inputs clamp internally on assignment: setting
      // input.value beyond min/max silently snaps to the boundary, and
      // the getter then returns that boundary value. Reading back
      // post-assign keeps the visible value label aligned with what
      // the slider is actually showing.
      if (typeof value === 'number' && Number.isFinite(value)) {
        input.value = String(value);
      } else if (value === undefined || value === null) {
        input.value = String(entry.default);
      } else {
        return;
      }
      const shown = Number(input.value);
      valueLabel.textContent = _formatSliderValue(entry, shown);
    }
    function readValue() {
      const raw = input.value;
      if (raw === '' || raw === null || raw === undefined) return NaN;
      return Number(raw);
    }
    return { element: wrap, sync: sync, readValue: readValue };
  }

  function _formatSliderValue(entry, value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '';
    const unit = (entry && typeof entry.unit === 'string') ? entry.unit : '';
    return String(value) + unit;
  }

  // H6 — Shortcut control (RC1 §5.2.8 + Component Library §11).
  //
  // Value format follows the Settings.Validators.shortcut grammar:
  //   (Modifier '+')* Key — e.g. 'Ctrl+Shift+P', 'Ctrl+S', 'Escape'
  //
  // Visible UI is a sequence of key caps with '+' separators. Click
  // anywhere on the wrap enters rebind mode: the wrap's caps are
  // replaced by the prompt "Press new shortcut..." in accent color,
  // and a window-level keydown listener (capture phase) intercepts
  // the next non-modifier keystroke. Escape exits without writing.
  //
  // Conflict policy (RC1 §15.5 + H6 brief): if the captured combo is
  // already bound to ANOTHER kb.* setting in the registry, the rebind
  // is rejected with a toast and the prior value remains. No silent
  // overwrite. The setting being rebound is excluded from the conflict
  // check so re-pressing the same combo is a no-op, not a self-conflict.
  //
  // Wire path: a successful capture dispatches a synthetic 'change'
  // event on the wrap; _wireControl reads the new value via readValue()
  // and writes it through Settings.Store, which fans out to the
  // shortcut applicator that re-binds the KeyboardRegistry combo.
  function _makeShortcut(entry) {
    const wrap = document.createElement('span');
    wrap.className = 'rga-settings-control-shortcut';
    wrap.setAttribute('data-control-for', entry.id);
    wrap.setAttribute('role', 'button');
    wrap.setAttribute('tabindex', entry.requiresPro ? '-1' : '0');

    let currentValue = String(_currentValue(entry) || '');
    let rebinding    = false;
    let captureFn    = null;

    function _renderCaps(value) {
      wrap.textContent = '';
      wrap.classList.remove('is-rebinding');
      const parts = String(value || '').split('+').filter(Boolean);
      parts.forEach(function(part, i) {
        if (i > 0) {
          const sep = document.createElement('span');
          sep.className = 'rga-settings-control-shortcut-sep';
          sep.textContent = '+';
          wrap.appendChild(sep);
        }
        const cap = document.createElement('span');
        cap.className = 'rga-settings-control-shortcut-cap';
        cap.textContent = part;
        wrap.appendChild(cap);
      });
    }

    function _renderRebindPrompt() {
      wrap.textContent = '';
      wrap.classList.add('is-rebinding');
      const prompt = document.createElement('span');
      prompt.className = 'rga-settings-control-shortcut-prompt';
      prompt.textContent = 'Press new shortcut...';
      wrap.appendChild(prompt);
    }

    function _exitRebind(restoreValue) {
      if (!rebinding) return;
      rebinding = false;
      if (captureFn) {
        window.removeEventListener('keydown', captureFn, true);
        captureFn = null;
      }
      _renderCaps(restoreValue == null ? currentValue : restoreValue);
    }

    function _commitNewValue(newCombo) {
      currentValue = newCombo;
      // The synthetic change event bubbles through the wrap; _wireControl
      // is listening for 'change' and writes through Store.set on read.
      wrap.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function _enterRebind() {
      if (rebinding) return;
      if (wrap.classList.contains('is-disabled')) return;
      rebinding = true;
      _renderRebindPrompt();

      captureFn = function(e) {
        // Capture phase + immediate stop so the KeyboardRegistry
        // dispatcher never sees this event.
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') {
          e.stopImmediatePropagation();
        }

        const k = e.key;
        if (!k) return;
        // Skip modifier-only keystrokes — they are not a complete chord.
        if (k === 'Shift' || k === 'Control' || k === 'Alt' || k === 'Meta') return;
        if (k === 'Escape') {
          _exitRebind(currentValue);
          return;
        }

        const keyToken = _keyEventToShortcutToken(k);
        if (!keyToken) return;

        const mods = [];
        if (e.ctrlKey || e.metaKey) mods.push('Ctrl');
        if (e.shiftKey)             mods.push('Shift');
        if (e.altKey)               mods.push('Alt');
        const combo = mods.concat([keyToken]).join('+');

        const Validators = Rga.Settings && Rga.Settings.Validators;
        if (Validators && typeof Validators.shortcut === 'function' && !Validators.shortcut(combo)) {
          _exitRebind(currentValue);
          _toast('That key combination is not supported.', 'warning');
          return;
        }

        // No-op when the user presses the same combination — exit
        // cleanly without firing a Store write or a conflict toast.
        if (combo === currentValue) {
          _exitRebind(currentValue);
          return;
        }

        const conflict = _findShortcutConflict(entry.id, combo);
        if (conflict) {
          _exitRebind(currentValue);
          _toast(combo + ' is already bound to "' + conflict.label + '". Shortcut unchanged.', 'warning');
          return;
        }

        _exitRebind(combo);
        _commitNewValue(combo);
      };

      window.addEventListener('keydown', captureFn, true);
    }

    _renderCaps(currentValue);

    wrap.addEventListener('click', function() {
      if (entry.requiresPro) return;
      _enterRebind();
    });
    wrap.addEventListener('keydown', function(e) {
      if (entry.requiresPro) return;
      if (rebinding) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        _enterRebind();
      }
    });

    function sync(value) {
      if (rebinding) _exitRebind(value);
      currentValue = String(value || '');
      _renderCaps(currentValue);
    }
    function readValue() { return currentValue; }
    return { element: wrap, sync: sync, readValue: readValue };
  }

  // Map a KeyboardEvent.key to the Settings.Validators.shortcut grammar.
  // Returns null for unsupported keys (modifier-only events filtered
  // earlier; everything else either passes the grammar or is rejected).
  function _keyEventToShortcutToken(k) {
    if (!k) return null;
    if (k.length === 1) {
      const u = k.toUpperCase();
      if (/^[A-Z0-9]$/.test(u)) return u;
      switch (k) {
        case ',':  return 'Comma';
        case '.':  return 'Period';
        case '/':  return 'Slash';
        case '\\': return 'Backslash';
        case '+':  return 'Plus';
        case '-':  return 'Minus';
        case '=':  return 'Equal';
        case ';':  return 'Semicolon';
        case "'":  return 'Quote';
        case '`':  return 'Tick';
        case '[':  return 'OpenBracket';
        case ']':  return 'CloseBracket';
        case ' ':  return 'Space';
        default:   return null;
      }
    }
    if (/^F([1-9]|1[0-2])$/.test(k)) return k;
    switch (k) {
      case 'Tab':       case 'Enter':    case 'Escape':
      case 'Backspace': case 'Delete':
      case 'Home':      case 'End':
      case 'PageUp':    case 'PageDown': case 'Insert':
        return k;
      case 'ArrowUp':    return 'Up';
      case 'ArrowDown':  return 'Down';
      case 'ArrowLeft':  return 'Left';
      case 'ArrowRight': return 'Right';
      default:           return null;
    }
  }

  // RC1 §15.5 conflict detection — scope is the kb.* family in the
  // registry. Returns the first OTHER kb.* entry whose current
  // effective value matches `combo`, or null when free.
  //
  // Broader system-wide conflict detection (against ad-hoc bindings
  // installed outside the kb.* registry, e.g. the editor keymap) is a
  // future-slice concern — the constitution's required check is
  // within the rebindable Keyboard Shortcuts section.
  function _findShortcutConflict(myId, combo) {
    const R     = Rga.Settings && Rga.Settings.Registry;
    const Store = Rga.Settings && Rga.Settings.Store;
    if (!R || !Store || typeof R.all !== 'function') return null;
    const all = R.all();
    for (let i = 0; i < all.length; i += 1) {
      const other = all[i];
      if (!other || other.type !== 'shortcut') continue;
      if (other.id === myId) continue;
      const v = Store.effective(other.id);
      if (typeof v === 'string' && v === combo) {
        return { id: other.id, label: other.label || other.id };
      }
    }
    return null;
  }

  function _toast(message, type) {
    if (Rga.Toast && typeof Rga.Toast.show === 'function') {
      Rga.Toast.show(message, type || 'warning');
    } else {
      console.warn('[settings-workspace] ' + message);
    }
  }

  // H7 — Margin Group control (RC1 §5.2.9 + Component Library §12).
  //
  // Value shape: { top: number, right: number, bottom: number, left: number }
  // Bounds: min 0, max 3, step 0.1, unit 'in'. Field order per the
  // constitution: top, right, bottom, left.
  //
  // Clamping policy: every input commits the whole object back to
  // Store; values below min snap up to 0, values above max snap down
  // to 3, NaN snaps back to the prior value for that field. This is
  // honest clamping at the control layer — the value that the user
  // sees is exactly the value Store receives.
  function _makeMargins(entry) {
    const wrap = document.createElement('div');
    wrap.className = 'rga-settings-control-margins';
    wrap.setAttribute('data-control-for', entry.id);

    const FIELDS = ['top', 'right', 'bottom', 'left'];
    const LABELS = { top: 'TOP', right: 'RIGHT', bottom: 'BOTTOM', left: 'LEFT' };
    const MIN  = 0;
    const MAX  = 3;
    const STEP = 0.1;
    const UNIT = (entry && typeof entry.unit === 'string') ? entry.unit : 'in';

    const inputs = {};
    const cur = _currentValue(entry) || entry.default || {};

    FIELDS.forEach(function(key) {
      const field = document.createElement('div');
      field.className = 'rga-settings-control-margins-field';

      const label = document.createElement('label');
      label.className = 'rga-settings-control-margins-label';
      label.textContent = LABELS[key];

      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'rga-settings-control-margins-input';
      input.min  = String(MIN);
      input.max  = String(MAX);
      input.step = String(STEP);
      input.setAttribute('data-margin-field', key);
      input.setAttribute('aria-label', LABELS[key]);
      if (entry.requiresPro) input.disabled = true;
      const initial = (typeof cur[key] === 'number' && Number.isFinite(cur[key]))
        ? cur[key] : (entry.default && entry.default[key]);
      if (typeof initial === 'number' && Number.isFinite(initial)) {
        input.value = String(initial);
      }

      const unit = document.createElement('span');
      unit.className = 'rga-settings-control-margins-unit';
      unit.textContent = UNIT;

      label.setAttribute('for', '');
      field.appendChild(label);
      field.appendChild(input);
      field.appendChild(unit);
      wrap.appendChild(field);
      inputs[key] = input;
    });

    function _clamp(n, fallback) {
      if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
      if (n < MIN) return MIN;
      if (n > MAX) return MAX;
      return n;
    }

    function _readAll() {
      const out = {};
      FIELDS.forEach(function(key) {
        const raw = inputs[key].value;
        const n   = (raw === '' || raw === null || raw === undefined) ? NaN : Number(raw);
        const fallback = (entry.default && typeof entry.default[key] === 'number')
          ? entry.default[key] : 0;
        out[key] = _clamp(n, fallback);
      });
      return out;
    }

    // After clamping the user's typed value, write the visible field
    // value back so the typed value and the committed value never
    // disagree (e.g. typing 5 in a max-3 field shows "3").
    function _writeVisible(values) {
      FIELDS.forEach(function(key) {
        inputs[key].value = String(values[key]);
      });
    }

    FIELDS.forEach(function(key) {
      inputs[key].addEventListener('change', function() {
        const values = _readAll();
        _writeVisible(values);
        // Bubble a change up through the wrap so _wireControl picks it
        // up and writes through Store. readValue() returns `values`.
        const ev = new Event('change', { bubbles: true });
        wrap.__pendingValue = values;
        wrap.dispatchEvent(ev);
      });
    });

    function sync(value) {
      if (!value || typeof value !== 'object') return;
      FIELDS.forEach(function(key) {
        if (typeof value[key] === 'number' && Number.isFinite(value[key])) {
          inputs[key].value = String(value[key]);
        }
      });
    }
    function readValue() {
      // The change handler stashes the clamped object before
      // dispatching; readValue returns it. Fall back to reading the
      // inputs directly so synthetic test paths work too.
      return wrap.__pendingValue || _readAll();
    }
    return { element: wrap, sync: sync, readValue: readValue };
  }

  // H7 — Color control (RC1 §5.2.7 + Component Library §10).
  //
  // Renders a curated palette of circular swatches. The palette MUST
  // come from entry.options (RC1 §5.2.7 — "MUST always have predefined
  // options. MUST NOT use a free-form color picker"). Selection writes
  // through Store; the existing per-id applicator drives the visible
  // effect (e.g. shell-applicators.js sets --editor-bg).
  function _makeColor(entry) {
    const wrap = document.createElement('div');
    wrap.className = 'rga-settings-control-color';
    wrap.setAttribute('role', 'radiogroup');
    wrap.setAttribute('data-control-for', entry.id);
    if (entry.label) wrap.setAttribute('aria-label', entry.label);

    const options = Array.isArray(entry.options) ? entry.options.slice() : [];
    const labels  = (entry.labels && typeof entry.labels === 'object') ? entry.labels : {};
    const swatches = [];

    let currentValue = String(_currentValue(entry) || entry.default || '');

    options.forEach(function(value) {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'rga-settings-control-color-swatch';
      sw.setAttribute('role', 'radio');
      sw.setAttribute('data-color-value', value);
      const human = labels[value] || value;
      sw.setAttribute('aria-label', human);
      sw.setAttribute('title', human);
      sw.style.background = value;
      if (entry.requiresPro) sw.disabled = true;
      if (value === currentValue) {
        sw.classList.add('is-active');
        sw.setAttribute('aria-checked', 'true');
      } else {
        sw.setAttribute('aria-checked', 'false');
      }
      sw.addEventListener('click', function() {
        if (entry.requiresPro) return;
        if (currentValue === value) return;
        currentValue = value;
        _refreshActive();
        const ev = new Event('change', { bubbles: true });
        wrap.__pendingValue = value;
        wrap.dispatchEvent(ev);
      });
      wrap.appendChild(sw);
      swatches.push(sw);
    });

    function _refreshActive() {
      swatches.forEach(function(sw) {
        const v = sw.getAttribute('data-color-value');
        const active = v === currentValue;
        sw.classList.toggle('is-active', active);
        sw.setAttribute('aria-checked', active ? 'true' : 'false');
      });
    }

    function sync(value) {
      if (typeof value !== 'string') return;
      currentValue = value;
      _refreshActive();
    }
    function readValue() {
      return wrap.__pendingValue || currentValue;
    }
    return { element: wrap, sync: sync, readValue: readValue };
  }

  // --------------------------------------------------------------
  // Row rendering
  // --------------------------------------------------------------

  // RC1 §1A.5 + §8.1.2 — PERSISTS_ONLY = editable control type + no
  // registered applicator. Per the design constitution the row MUST
  // render at 60% opacity, pointer-events:none, with helper text
  // appended with the literal "Behavior not wired yet." — and MUST
  // carry no badge (opacity + helper text are sufficient signal).
  function _isPersistsOnly(entry) {
    if (!EDITABLE_TYPES.has(entry.type)) return false;
    const Applicators = Rga.Settings && Rga.Settings.Applicators;
    if (!Applicators || typeof Applicators.registered !== 'function') return true;
    return Applicators.registered().indexOf(entry.id) < 0;
  }

  function _buildRow(entry, subs) {
    const row = document.createElement('article');
    row.className = 'rga-settings-row';
    if (entry.requiresPro) row.classList.add('is-pro');
    if (entry.restartRequired) row.classList.add('is-restart-required');
    row.setAttribute('data-setting-id', entry.id);

    const persistsOnly = _isPersistsOnly(entry);
    if (persistsOnly) {
      row.classList.add('is-persists-only');
      row.setAttribute('aria-disabled', 'true');
    }

    const header = document.createElement('header');
    header.className = 'rga-settings-row-header';

    const label = document.createElement('h2');
    label.className = 'rga-settings-row-label';
    label.textContent = entry.label;
    header.appendChild(label);

    // RC1 §8.1.2 forbids badges on PERSISTS_ONLY rows. RC1 §7.3 forbids
    // any badge that exposes control types (`toggle`, `select`, etc).
    // The previously-rendered type chip is retired here.
    //
    // Pro and Restart-required markers (RC1 §7.2 status badges) render
    // only on REAL rows; PERSISTS_ONLY suppresses them.
    if (!persistsOnly) {
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
    }

    row.appendChild(header);

    const desc = document.createElement('p');
    desc.className = 'rga-settings-row-description';
    // RC1 §8.1.2 — append the literal honest-state text when not wired.
    desc.textContent = persistsOnly
      ? (entry.description || '') + ' Behavior not wired yet.'
      : (entry.description || '');
    row.appendChild(desc);

    const valueSlot = document.createElement('div');
    valueSlot.className = 'rga-settings-row-value';
    row.appendChild(valueSlot);

    if (EDITABLE_TYPES.has(entry.type)) {
      const ctrl = _makeControl(entry);
      if (ctrl) {
        if (persistsOnly) {
          // RC1 §8.1.2 — non-interactive at the control level. The row
          // also blocks pointer-events via CSS (.is-persists-only). The
          // `disabled` attribute makes the native control unfocusable
          // and unreachable by keyboard.
          _disableControlElement(ctrl.element);
        }
        valueSlot.appendChild(ctrl.element);
        _wireControl(entry, ctrl, subs, persistsOnly);
        return row;
      }
    }

    // Read-only fallback (unsupported types + safety net).
    valueSlot.classList.add('is-readonly');
    valueSlot.textContent = _formatValue(entry, _currentValue(entry));
    return row;
  }

  function _disableControlElement(el) {
    if (!el) return;
    // Wrap-style controls (fieldset for radio, span for slider) carry
    // their interactive element inside. Disable every nested input so
    // the visible control reflects PERSISTS_ONLY / Pro status.
    const inner = el.querySelectorAll && el.querySelectorAll('input');
    if (inner && inner.length > 0) {
      Array.from(inner).forEach(function(i) { i.disabled = true; });
    }
    if ('disabled' in el) el.disabled = true;
    // Wrap-style controls with no nested <input> (e.g. the shortcut
    // wrap, whose interactive surface is the wrap itself) take a class
    // hook so CSS can render the disabled visual without a host
    // disabled attribute.
    if (el.classList) el.classList.add('is-disabled');
    if (el.setAttribute) {
      el.setAttribute('aria-disabled', 'true');
      if (el.getAttribute && el.getAttribute('tabindex') !== null) {
        el.setAttribute('tabindex', '-1');
      }
    }
  }

  function _wireControl(entry, ctrl, subs, persistsOnly) {
    const Store = Rga.Settings && Rga.Settings.Store;
    if (!Store) return;

    if (entry.requiresPro || persistsOnly) {
      // No change handler, no subscription writes back. PERSISTS_ONLY
      // controls are non-interactive at the DOM level; subscribing
      // only to mirror external changes (e.g. tier flips) keeps the
      // visual aligned with the canonical effective value.
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
    _syncPageSetupPreview(el, sectionId);
  }

  // S8 — mount Rga.PageSetupPreview as a side panel when the user is
  // on the Page Setup section; unmount on any other section. The side
  // panel host is a 240px column appended to .rga-settings-content;
  // CSS in settings-workspace.css scopes it so other sections don't
  // see the column. The preview module owns its own subscriptions to
  // the watched pageSetup.* ids; this function only manages mount /
  // unmount and the host element.
  function _syncPageSetupPreview(el, sectionId) {
    const PSP = Rga.PageSetupPreview;
    let host = el.querySelector('.rga-settings-page-setup-preview-host');
    if (sectionId === 'pageSetup') {
      if (!PSP || typeof PSP.mount !== 'function') return;
      if (!host) {
        host = document.createElement('aside');
        host.className = 'rga-settings-page-setup-preview-host';
        const content = el.querySelector('.rga-settings-content');
        if (content) content.appendChild(host);
      }
      PSP.mount(host);
    } else {
      if (host) {
        if (PSP && typeof PSP.unmount === 'function') PSP.unmount(host);
        if (host.parentNode) host.parentNode.removeChild(host);
      }
    }
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
