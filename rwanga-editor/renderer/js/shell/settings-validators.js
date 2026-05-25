// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Settings Validators — Slice 3C.
//
// Pure value validators. Each function takes a value (and sometimes
// a context like a select-options array) and returns boolean. No
// I/O, no console writes, no awareness of the store or registry.
// The dispatcher validateValue(entry, value) routes by entry.type
// so call sites don't have to switch on type themselves.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Settings = Rga.Settings || {};

  // --------------------------------------------------------------
  // Primitive validators.
  // --------------------------------------------------------------

  function boolean(v) { return typeof v === 'boolean'; }

  function number(v)  { return typeof v === 'number' && Number.isFinite(v); }

  function integer(v) { return Number.isInteger(v); }

  function string(v)  { return typeof v === 'string'; }

  function select(v, options) {
    if (!Array.isArray(options) || options.length === 0) return false;
    return options.indexOf(v) >= 0;
  }

  // 6-digit hex (#RRGGBB). Shorthand and alpha forms are intentionally
  // rejected — registry defaults use 6-digit hex throughout.
  function color(v) {
    return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
  }

  // path: any string. OS-specific validation is out of scope; the
  // setting `files.defaultDirectory` defaults to '' so empty must pass.
  function path(v) { return typeof v === 'string'; }

  // marginGroup: { top, bottom, left, right } of non-negative finite
  // numbers. Extra keys are tolerated; missing or malformed required
  // keys reject.
  function marginGroup(v) {
    if (!v || typeof v !== 'object') return false;
    const KEYS = ['top', 'bottom', 'left', 'right'];
    for (let i = 0; i < KEYS.length; i += 1) {
      const k = KEYS[i];
      if (!Object.prototype.hasOwnProperty.call(v, k)) return false;
      const x = v[k];
      if (typeof x !== 'number' || !Number.isFinite(x) || x < 0) return false;
    }
    return true;
  }

  // --------------------------------------------------------------
  // Shortcut grammar.
  //
  // Chord = (Modifier '+')* Key
  //   Modifier ∈ {Ctrl, Shift, Alt, Meta}  (each at most once)
  //   Key      ∈ A-Z | 0-9 | F1..F12 | Tab | Space | Enter | Escape
  //              | Backspace | Delete | Up | Down | Left | Right
  //              | Home | End | PageUp | PageDown | Insert
  //              | Comma | Period | Slash | Backslash | Plus | Minus
  //              | Equal | Semicolon | Quote | Tick | OpenBracket
  //              | CloseBracket
  //
  // Empty / orphan modifiers / unknown keys / wrong case → reject.
  // --------------------------------------------------------------

  const MODIFIERS = new Set(['Ctrl', 'Shift', 'Alt', 'Meta']);
  const NAMED_KEYS = new Set([
    'Tab', 'Space', 'Enter', 'Escape', 'Backspace', 'Delete',
    'Up', 'Down', 'Left', 'Right',
    'Home', 'End', 'PageUp', 'PageDown', 'Insert',
    'Comma', 'Period', 'Slash', 'Backslash', 'Plus', 'Minus',
    'Equal', 'Semicolon', 'Quote', 'Tick',
    'OpenBracket', 'CloseBracket'
  ]);
  const KEY_REGEX = /^([A-Z]|[0-9]|F[1-9]|F1[0-2])$/;

  function shortcut(v) {
    if (typeof v !== 'string' || v.length === 0) return false;
    const parts = v.split('+');
    if (parts.length === 0) return false;
    // Last segment must be a key (not a modifier).
    const last = parts[parts.length - 1];
    if (last.length === 0) return false;
    if (MODIFIERS.has(last)) return false;
    if (!KEY_REGEX.test(last) && !NAMED_KEYS.has(last)) return false;
    // Preceding segments must be unique modifiers.
    const seen = new Set();
    for (let i = 0; i < parts.length - 1; i += 1) {
      const p = parts[i];
      if (p.length === 0) return false;          // empty segment, e.g. 'Ctrl++S'
      if (!MODIFIERS.has(p)) return false;       // unknown / wrong case
      if (seen.has(p)) return false;             // duplicate modifier
      seen.add(p);
    }
    return true;
  }

  // --------------------------------------------------------------
  // Dispatcher.
  // --------------------------------------------------------------

  function validateValue(entry, value) {
    if (!entry || typeof entry.type !== 'string') return false;
    switch (entry.type) {
      case 'toggle':   return boolean(value);
      case 'number':   return number(value);
      case 'slider':   return number(value);
      case 'text':     return string(value);
      case 'color':    return color(value);
      case 'shortcut': return shortcut(value);
      case 'margins':  return marginGroup(value);
      case 'select':
      case 'radio':    return select(value, entry.options);
      default:         return false;
    }
  }

  Rga.Settings.Validators = {
    boolean, number, integer, string, select,
    color, shortcut, path, marginGroup,
    validateValue
  };
})();
