// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Settings Migrations — H2 (Theme Constitutional Activation).
//
// Boot-time one-shot reconciliations between legacy storage sites
// and the Settings store. Runs AFTER Rga.Settings.Store.init() has
// hydrated the user tier from prefs and BEFORE Applicators.applyAll()
// fires handlers — that ordering lets a migration write into the
// store and have the resulting effective value propagate normally.
//
// Idempotent contract: every migration in here is a no-op once its
// post-condition holds. Re-running on a subsequent launch must do
// nothing observable.
//
// Currently shipped migrations:
//   - theme: if `prefs.theme` is undefined and `localStorage 'rga-theme'`
//     holds a legacy value, seed `Store.set('theme', legacyValue)` so
//     the user's prior dark/light choice carries forward into the
//     Settings-canonical store.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Settings = Rga.Settings || {};

  function _readLegacyTheme() {
    try {
      const raw = window.localStorage.getItem('rga-theme');
      if (raw === 'dark' || raw === 'light') return raw;
      return null;
    } catch (_) {
      return null;
    }
  }

  function _migrateTheme() {
    const Store = Rga.Settings && Rga.Settings.Store;
    if (!Store || typeof Store.get !== 'function' || typeof Store.set !== 'function') return;

    const prefsTheme = Store.get('theme', 'user');
    if (prefsTheme !== undefined) return;  // post-condition already holds.

    const legacy = _readLegacyTheme();
    if (!legacy) return;                    // nothing to migrate.

    // Rga.Theme.init() writes the registry default to localStorage on
    // every fresh boot (no prior `rga-theme` key), which would make the
    // migration treat every fresh install as if the user had explicitly
    // chosen the default. Only migrate when the legacy value differs
    // from the registry default — that signal is the only honest one
    // we have for "user previously made an explicit choice." A user who
    // chose a value equal to the default is indistinguishable from a
    // fresh user and the effective value is identical either way; once
    // they change it again, prefs gets populated normally.
    const reg = Rga.Settings && Rga.Settings.Registry;
    const defaultValue = (reg && typeof reg.getDefault === 'function')
      ? reg.getDefault('theme') : undefined;
    if (defaultValue !== undefined && legacy === defaultValue) return;

    // Seed prefs from the legacy localStorage value. The applicator
    // fanout via applyAll() that follows this migration will pick up
    // the new effective value and reconcile DOM if needed; since
    // Rga.Theme.init() already painted from the same localStorage
    // value pre-paint, no visible flicker occurs.
    Store.set('theme', legacy);
  }

  // Public: callable from the boot path. Returns a Promise so callers
  // can chain Applicators.applyAll() after every migration completes
  // even if a future migration becomes async.
  function run() {
    try { _migrateTheme(); }
    catch (err) {
      console.warn('[Rga.Settings.Migrations] theme migration threw:', err);
    }
    return Promise.resolve();
  }

  Rga.Settings.Migrations = { run: run, _migrateTheme: _migrateTheme };
})();
