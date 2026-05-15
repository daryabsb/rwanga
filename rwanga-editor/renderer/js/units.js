// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.Units — measurement-unit preference + conversion helper.
//
// Two layers:
//   1. App default (localStorage 'rga-default-units'), used when no doc is open
//      or as a fallback. Default: 'in'.
//   2. Per-document override at doc.settings.units. Always wins when a doc is
//      active. Saved with the .rga file so collaborators see consistent units.
//
// Reference: 1in = 2.54cm = 25.4mm = 96px (CSS pixel standard).
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  const KEY = 'rga-default-units';
  const UNITS = ['in', 'cm', 'mm', 'px'];
  const DEFAULT = 'in';

  const TO_INCHES = { 'in': 1, 'cm': 1 / 2.54, 'mm': 1 / 25.4, 'px': 1 / 96 };
  const FROM_INCHES = { 'in': 1, 'cm': 2.54, 'mm': 25.4, 'px': 96 };

  const listeners = [];

  function _appDefault() {
    try {
      const v = localStorage.getItem(KEY);
      return UNITS.indexOf(v) !== -1 ? v : DEFAULT;
    } catch (_) { return DEFAULT; }
  }

  function _setAppDefault(unit) {
    if (UNITS.indexOf(unit) === -1) return;
    try { localStorage.setItem(KEY, unit); } catch (_) {}
  }

  // Active unit: per-doc if a doc is open, else app default.
  function current() {
    const doc = Rga.TabManager && Rga.TabManager.activeDoc && Rga.TabManager.activeDoc();
    if (doc && doc.settings && UNITS.indexOf(doc.settings.units) !== -1) {
      return doc.settings.units;
    }
    return _appDefault();
  }

  // Set the unit. Defaults to per-doc scope; pass scope='app' to set the
  // global default instead.
  function set(unit, scope) {
    if (UNITS.indexOf(unit) === -1) return;
    if (scope === 'app') {
      _setAppDefault(unit);
    } else {
      const doc = Rga.TabManager && Rga.TabManager.activeDoc && Rga.TabManager.activeDoc();
      if (doc && doc.settings) {
        doc.settings.units = unit;
        if (Rga.Doc && Rga.Doc.markDirty) Rga.Doc.markDirty(doc);
      }
      // Also update the app default — most users want one consistent unit.
      _setAppDefault(unit);
    }
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

  Rga.Units = { current, set, cycle, convert, format, toCss, onChange, UNITS };
})();
