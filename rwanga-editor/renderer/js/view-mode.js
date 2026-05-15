// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// View modes — Flow (default), Print, Draft.
// State lives in localStorage as a per-app global preference. Esc inside
// Draft restores the previous view.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  const KEY = 'rga-view-mode';
  const MODES = ['flow', 'print', 'draft'];
  const DEFAULT = 'flow';

  let current = DEFAULT;
  let previous = DEFAULT;
  const listeners = [];

  function _load() {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored && MODES.indexOf(stored) !== -1) {
        current = stored;
        previous = stored === 'draft' ? 'flow' : stored;
      }
    } catch (_) {}
  }

  function _persist() {
    try { localStorage.setItem(KEY, current); } catch (_) {}
  }

  function _apply() {
    const target = document.getElementById('editor-container') || document.body;
    if (!target) return;
    MODES.forEach(function(m) {
      target.classList.toggle('view-' + m, m === current);
    });
    document.body.classList.toggle('view-draft-active', current === 'draft');
  }

  function _notify() {
    listeners.forEach(function(fn) { try { fn(current); } catch (_) {} });
  }

  function get() { return current; }

  function set(mode) {
    if (MODES.indexOf(mode) === -1) return;
    if (mode === current) return;
    if (current !== 'draft') previous = current;
    current = mode;
    _persist();
    _apply();
    _notify();
  }

  function cycle() {
    const idx = MODES.indexOf(current);
    set(MODES[(idx + 1) % MODES.length]);
  }

  function exitDraft() {
    if (current !== 'draft') return;
    set(previous || DEFAULT);
  }

  function onChange(fn) {
    if (typeof fn !== 'function') return;
    listeners.push(fn);
  }

  function init() {
    _load();
    _apply();
    _notify();

    // Esc exits Draft globally
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && current === 'draft') {
        e.preventDefault();
        exitDraft();
      }
    });
  }

  Rga.ViewMode = { init, get, set, cycle, exitDraft, onChange, MODES };
})();
