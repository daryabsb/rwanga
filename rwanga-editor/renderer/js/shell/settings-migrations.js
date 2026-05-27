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

    // Pre-S12: Rga.Theme.init() wrote the registry default to localStorage
    // on every fresh boot, so a legacy value equal to the default could
    // not be distinguished from a fresh install. S12 removed that write,
    // but the matching-default guard is kept defensively: a user who had
    // explicitly chosen the default value is indistinguishable from a
    // fresh user, and migrating in that case adds noise to prefs without
    // changing observable behavior. Skipping it keeps the migration's
    // one-shot semantics clean. Drop this guard in a future cleanup once
    // enough time has passed that every install with localStorage data
    // has booted at least once post-S12.
    const reg = Rga.Settings && Rga.Settings.Registry;
    const defaultValue = (reg && typeof reg.getDefault === 'function')
      ? reg.getDefault('theme') : undefined;
    if (defaultValue !== undefined && legacy === defaultValue) return;

    // Seed prefs from the legacy localStorage value. The applicator
    // fanout via applyAll() that follows this migration will pick up
    // the new effective value and apply it to the DOM. Post-S12,
    // Rga.Theme.init() no longer pre-paints from localStorage, so a
    // brief boot-time flash dark → user-chosen may occur on migrated
    // sessions — acceptable trade-off for the constitutional fix
    // (RC1 §1A.3, S12).
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
