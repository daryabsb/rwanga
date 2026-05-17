// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.KeyboardRegistry — the single document-level keyboard dispatcher.
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
//   Rga.KeyboardRegistry._all()    – snapshot of bindings (test/debug)
//   Rga.KeyboardRegistry._reset()  – test helper
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  // combo string → entry { handler, opts, source }
  // Last-wins per combo (one entry per combo); previous entries log a
  // duplicate warning the first time they are overwritten.
  const _bindings = new Map();
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
    return function unregister() {
      // Only unregister if this exact entry is still the current
      // binding for the combo — a later registration may have
      // replaced it; we don't want unregister(old) to nuke new.
      if (_bindings.get(combo) === entry) _bindings.delete(combo);
    };
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
    _reset: _reset,
    _all: _all
  };
})();
