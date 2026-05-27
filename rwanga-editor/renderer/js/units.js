// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.Units — measurement-unit conversion helper.
//
// S12 (Settings Recovery — legacy paths cleanup): the canonical unit
// preference now lives in the Settings Store under id 'units' (user
// tier). This module became a thin facade:
//   - current()  → reads Store.effective('units')
//   - set(unit)  → writes Store.set('units', unit) (user tier)
//   - onChange() → driven by the units applicator (shell-applicators.js)
//                  which invokes _notify on every effective change.
//
// The legacy localStorage key 'rga-default-units' and the per-document
// `doc.settings.units` write path are retired. A future slice may add
// `pageSetup.units` (script-tier) as an explicit per-script override —
// not in scope for S12.
//
// Reference: 1in = 2.54cm = 25.4mm = 96px (CSS pixel standard).
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  const UNITS = ['in', 'cm', 'mm', 'px'];
  const DEFAULT = 'in';

  const TO_INCHES = { 'in': 1, 'cm': 1 / 2.54, 'mm': 1 / 25.4, 'px': 1 / 96 };
  const FROM_INCHES = { 'in': 1, 'cm': 2.54, 'mm': 25.4, 'px': 96 };

  const listeners = [];

  function _store() {
    return (Rga.Settings && Rga.Settings.Store) || null;
  }

  function current() {
    const store = _store();
    if (store && typeof store.effective === 'function') {
      const v = store.effective('units');
      if (UNITS.indexOf(v) !== -1) return v;
    }
    return DEFAULT;
  }

  // `scope` parameter retained for legacy callers (e.g. status-bar cycle);
  // post-S12 all writes go through the Store user tier. A future slice
  // may reinstate per-script units via a separate `pageSetup.units` entry.
  function set(unit /* , scope */) {
    if (UNITS.indexOf(unit) === -1) return;
    const store = _store();
    if (store && typeof store.set === 'function') {
      store.set('units', unit);
    }
    // Subscribers are normally notified by the applicator on Store change.
    // _notify here keeps cycle()/set() responsive in early-boot test
    // contexts where the Store is not yet wired; idempotent on the
    // applicator path because _notify forwards the same value.
    _notify(unit);
  }

  function cycle() {
    const idx = UNITS.indexOf(current());
    set(UNITS[(idx + 1) % UNITS.length]);
  }

  function convert(value, from, to) {
    if (typeof value !== 'number') return value;
    if (from === to) return value;
    const inInches = value * (TO_INCHES[from] || 1);
    return inInches * (FROM_INCHES[to] || 1);
  }

  // Format a numeric value (assumed in inches by default — the canonical
  // storage unit for pageSetup.margins) for display in the active unit.
  function format(valueInInches, opts) {
    opts = opts || {};
    const unit = opts.unit || current();
    const v = convert(valueInInches, 'in', unit);
    switch (unit) {
      case 'in': return v.toFixed(2) + ' in';
      case 'cm': return v.toFixed(2) + ' cm';
      case 'mm': return Math.round(v) + ' mm';
      case 'px': return Math.round(v) + ' px';
      default:   return v + ' ' + unit;
    }
  }

  // CSS length string. Works for any unit: '1in', '2.54cm', etc.
  function toCss(valueInInches, opts) {
    opts = opts || {};
    const unit = opts.unit || current();
    const v = convert(valueInInches, 'in', unit);
    return v + unit;
  }

  function onChange(fn) {
    if (typeof fn === 'function') listeners.push(fn);
  }
  function _notify(unit) {
    listeners.forEach(function(fn) { try { fn(unit); } catch (_) {} });
  }

  Rga.Units = { current, set, cycle, convert, format, toCss, onChange, UNITS, _notify };
})();
