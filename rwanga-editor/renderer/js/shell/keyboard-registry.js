// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.KeyboardRegistry — the single document-level keyboard dispatcher,
// AND the SSOT for command ownership (Studio Shell Recovery §A4.1).
//
// Per the ownership matrix (Runtime Ownership Stabilization Slice 2,
// section A — resolves OI-1):
//
//   * One document.addEventListener('keydown', …) listener across the
//     whole renderer. Adding a new shortcut never adds another
//     listener; it adds an entry to this registry.
//   * Combos are normalised to a canonical string
//     ("cmd+shift+p" / "escape" / "cmd+`") so two distinct
//     registration shapes for the same combo collide and are visible.
//   * Last-registration-wins per combo, with a console.warn the first
//     time a duplicate appears — the warning is the audit trail. The
//     visual-stab guard tests assert there are zero duplicates at
//     boot time.
//   * Each binding may carry a `when` predicate so context-sensitive
//     shortcuts (e.g. Escape only when in Draft mode) live with their
//     handler instead of inside an ad-hoc `if (mode === 'draft')`
//     gate buried in a separate document listener.
//
// COMMAND LAYER (Studio Shell Recovery §A4.1): a higher-level surface
// on top of the keyboard dispatcher. Each command has an id, label,
// handler, and an OPTIONAL accelerator (key + mods). Menu items,
// command palette, and any other UI that needs to show "what
// accelerator triggers this command" call commandAccelerator(id) to
// get the formatted label string — they MUST NOT hardcode accelerator
// strings. audit() returns conflicts (the same combo registered to
// multiple distinct sources); the §A4.1 guard test asserts audit()
// is empty at boot.
//
// API:
//   Rga.KeyboardRegistry.init()                          – attach the dispatcher
//   Rga.KeyboardRegistry.register(key, opts, handler, source) → unregister fn
//     key     – 'a'..'z' | '`' | ',' | 'escape' | 'arrowup' | …
//                 Case-insensitive; whatever KeyboardEvent.key yields,
//                 lower-cased.
//     opts    – { ctrl?: bool, shift?: bool, alt?: bool,
//                 when?: (e) => bool,
//                 preventDefault?: bool (default true) }
//     handler – (e) => void
//     source  – string label for the audit trail (origin module).
//   Rga.KeyboardRegistry.registerCommand(spec) → unregister fn
//     spec = { command, label, handler, key?, mods?, when?, source }
//     If key+mods present, also creates a keyboard binding via
//     register(); always stores the command for commandAccelerator /
//     invokeCommand lookups.
//   Rga.KeyboardRegistry.commandAccelerator(commandId) → string
//     Formatted accelerator label like "Ctrl+Shift+S" — or "" if the
//     command has no keyboard binding. Menu items use this to show
//     accelerators instead of hardcoding strings.
//   Rga.KeyboardRegistry.invokeCommand(commandId, e?) → boolean
//     Invokes the command's handler. Returns false if no such command.
//   Rga.KeyboardRegistry.audit() → array of conflicts
//     Returns [{ combo, sources: [...] }, …] for every combo that has
//     been registered more than once. The §A4.1 guard asserts empty.
//   Rga.KeyboardRegistry._all()    – snapshot of bindings (test/debug)
//   Rga.KeyboardRegistry._reset()  – test helper
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  // combo string → entry { handler, opts, source }
  // Last-wins per combo (one entry per combo); previous entries log a
  // duplicate warning the first time they are overwritten.
  const _bindings = new Map();
  // §A4.1 — every register() call appends here (combo, source). Lives
  // beyond overwrites so audit() can see historical conflicts.
  const _registrations = [];
  // §A4.1 — commandId → { id, label, key, mods, handler }. Populated
  // by registerCommand(); read by commandAccelerator() + invokeCommand().
  const _commands = new Map();
  let _listener = null;

  function _comboKey(key, opts) {
    const parts = [];
    // Cmd and Ctrl normalise to "cmd" so combos work cross-platform.
    if (opts && opts.ctrl) parts.push('cmd');
    if (opts && opts.shift) parts.push('shift');
    if (opts && opts.alt) parts.push('alt');
    parts.push(String(key || '').toLowerCase());
    return parts.join('+');
  }

  function _comboFromEvent(e) {
    const opts = {
      ctrl:  e.ctrlKey || e.metaKey,
      shift: e.shiftKey,
      alt:   e.altKey
    };
    return _comboKey(e.key, opts);
  }

  function register(key, opts, handler, source) {
    if (typeof handler !== 'function') return function() {};
    opts = opts || {};
    const combo = _comboKey(key, opts);
    if (_bindings.has(combo)) {
      const prev = _bindings.get(combo);
      console.warn(
        '[Rga.KeyboardRegistry] duplicate registration for ' + combo +
        ' — previous source: ' + (prev.source || '(unknown)') +
        ', new source: ' + (source || '(unknown)') +
        '. The new registration replaces the previous one (last-wins).'
      );
    }
    const entry = { handler: handler, opts: opts, source: source || '(unknown)' };
    _bindings.set(combo, entry);
    // §A4.1 — append to the registration log (survives overwrites; used by audit()).
    _registrations.push({ combo: combo, source: source || '(unknown)' });
    return function unregister() {
      // Only unregister if this exact entry is still the current
      // binding for the combo — a later registration may have
      // replaced it; we don't want unregister(old) to nuke new.
      if (_bindings.get(combo) === entry) _bindings.delete(combo);
    };
  }

  // §A4.1 — command-layer API. Each command has a single id, a single
  // owner (the handler), and AT MOST one keyboard accelerator. Menu
  // items and other UI surfaces read accelerator labels via
  // commandAccelerator(id) — no hardcoded accelerator strings allowed.
  function registerCommand(spec) {
    if (!spec || typeof spec !== 'object') return function() {};
    if (typeof spec.command !== 'string' || !spec.command) return function() {};
    if (typeof spec.handler !== 'function') return function() {};
    if (_commands.has(spec.command)) {
      console.warn(
        '[Rga.KeyboardRegistry] command already registered: ' + spec.command +
        '. Ignoring duplicate registerCommand().'
      );
      return function() {};
    }
    _commands.set(spec.command, {
      id: spec.command,
      label: spec.label || spec.command,
      key: spec.key || null,
      mods: spec.mods || {},
      handler: spec.handler,
      source: spec.source || spec.command
    });
    // If a keyboard accelerator is declared, also create the binding.
    if (spec.key) {
      const opts = Object.assign({}, spec.mods || {});
      if (spec.when) opts.when = spec.when;
      if (typeof spec.preventDefault === 'boolean') opts.preventDefault = spec.preventDefault;
      const unbind = register(spec.key, opts, spec.handler, spec.source || spec.command);
      return function unregister() {
        unbind();
        _commands.delete(spec.command);
      };
    }
    return function unregister() {
      _commands.delete(spec.command);
    };
  }

  function commandAccelerator(commandId) {
    const cmd = _commands.get(commandId);
    if (!cmd || !cmd.key) return '';
    return _formatAccelerator(cmd.key, cmd.mods);
  }

  function invokeCommand(commandId, e) {
    const cmd = _commands.get(commandId);
    if (!cmd) return false;
    try { cmd.handler(e); }
    catch (err) { console.error('[Rga.KeyboardRegistry] command "' + commandId + '" threw:', err); }
    return true;
  }

  function _formatAccelerator(key, mods) {
    const parts = [];
    mods = mods || {};
    if (mods.ctrl)  parts.push('Ctrl');
    if (mods.shift) parts.push('Shift');
    if (mods.alt)   parts.push('Alt');
    let keyLabel;
    const k = String(key || '');
    if (k === 'escape')       keyLabel = 'Esc';
    else if (k === '`')       keyLabel = '`';
    else if (k.length === 1)  keyLabel = k.toUpperCase();
    else                      keyLabel = k.charAt(0).toUpperCase() + k.slice(1);
    parts.push(keyLabel);
    return parts.join('+');
  }

  // §A4.1 — return every combo that has been registered more than
  // once. The §A4.1 guard test asserts this is empty at boot. Future
  // duplicate accelerator registrations fail CI.
  function audit() {
    const byCombo = new Map();
    _registrations.forEach(function(reg) {
      if (!byCombo.has(reg.combo)) byCombo.set(reg.combo, []);
      byCombo.get(reg.combo).push(reg.source);
    });
    const conflicts = [];
    byCombo.forEach(function(sources, combo) {
      if (sources.length > 1) conflicts.push({ combo: combo, sources: sources.slice() });
    });
    return conflicts;
  }

  function _onKeydown(e) {
    if (!e || e.defaultPrevented) return;
    // Skip modifier-only keystrokes (Shift down by itself, etc.) —
    // they don't compose a meaningful combo.
    const k = String(e.key || '').toLowerCase();
    if (!k || k === 'shift' || k === 'control' || k === 'meta' || k === 'alt') return;
    const combo = _comboFromEvent(e);
    const entry = _bindings.get(combo);
    if (!entry) return;
    if (entry.opts.when && !entry.opts.when(e)) return;
    // Default preventDefault: true. Pass {preventDefault: false} to
    // opt out (e.g. for read-only inspectors that want the underlying
    // browser action to still happen).
    if (entry.opts.preventDefault !== false) e.preventDefault();
    try { entry.handler(e); }
    catch (err) { console.error('[Rga.KeyboardRegistry] handler threw for ' + combo + ':', err); }
  }

  function init() {
    if (_listener) return;
    _listener = _onKeydown;
    document.addEventListener('keydown', _listener);
  }

  function _reset() {
    _bindings.clear();
    _registrations.length = 0;
    _commands.clear();
    if (_listener) {
      document.removeEventListener('keydown', _listener);
      _listener = null;
    }
  }

  function _all() {
    const out = {};
    _bindings.forEach(function(entry, combo) {
      out[combo] = { source: entry.source, opts: Object.assign({}, entry.opts) };
    });
    return out;
  }

  Rga.KeyboardRegistry = {
    init: init,
    register: register,
    // §A4.1 — command layer + audit.
    registerCommand:      registerCommand,
    commandAccelerator:   commandAccelerator,
    invokeCommand:        invokeCommand,
    audit:                audit,
    _reset: _reset,
    _all: _all,
    _formatAccelerator:   _formatAccelerator
  };
})();
