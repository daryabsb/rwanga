// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Filmustageation F1A.1 — Platform boundary smoke.
//
// The Editor / Platform Boundary Contract
// (docs/filmustageation/EDITOR_VIEWPORT_PLATFORM_BOUNDARY_CONTRACT.md)
// declares that:
//
//   • The editor boots and operates standalone (Electron) with NO
//     window.rwanga.platform global defined.
//   • Every shell module initializes without depending on a platform.
//   • Rga.Platform.has(...) returns false in standalone mode.
//   • The editor renderer never crashes from a missing platform global.
//
// This spec is the runtime guard. It fails LOUDLY if any future change
// accidentally introduces a hard dependency on the platform namespace —
// shipping such a change would make the editor refuse to boot in
// standalone Electron, violating the OSS-safe rule (doctrine Law 14).
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os   = require('os');
const fs   = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');

async function launchStandalone() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1a-1-standalone-'));
  // Collect console errors so we can assert "no platform-related
  // errors at boot" after the page settles. We don't fail the test
  // on every console error — some pre-existing modules log warnings
  // that are unrelated to F1A.1 — but we do scrape for "platform" or
  // "rwanga.platform" mentions, which would prove a guard is missing.
  const consoleErrors = [];
  const pageErrors = [];
  const app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const page = await app.firstWindow();
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    pageErrors.push(String(err && err.message ? err.message : err));
  });
  await page.waitForLoadState('domcontentloaded');
  return { app, page, userDataDir, consoleErrors, pageErrors };
}

async function teardown(app, userDataDir) {
  try { await app.close(); } catch (_) {}
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
}

// =================================================================
// 1. window.rwanga.platform is undefined in standalone Electron.
// =================================================================

test('F1A.1 — window.rwanga.platform is undefined in standalone Electron', async () => {
  const { app, page, userDataDir } = await launchStandalone();
  try {
    const platformType = await page.evaluate(() => typeof window.rwanga.platform);
    expect(platformType).toBe('undefined');
    // Belt-and-braces: explicitly assert the bridge object exists
    // (the rest of the editor depends on it) and that the platform
    // slot is not present at any depth.
    const bridgeShape = await page.evaluate(() => ({
      hasRwanga:           typeof window.rwanga === 'object' && window.rwanga !== null,
      platformIsUndefined: window.rwanga.platform === undefined,
      hasFiles:            typeof window.rwanga.files === 'object',
      hasAutosave:         typeof window.rwanga.autosave === 'object',
      hasPrefs:            typeof window.rwanga.prefs === 'object'
    }));
    expect(bridgeShape).toEqual({
      hasRwanga: true,
      platformIsUndefined: true,
      hasFiles: true,
      hasAutosave: true,
      hasPrefs: true
    });
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 2. Rga.Platform.has / invoke / get all short-circuit cleanly.
// =================================================================

test('F1A.1 — Rga.Platform.has() returns false for any probe in standalone mode', async () => {
  const { app, page, userDataDir } = await launchStandalone();
  try {
    await page.waitForFunction(() => !!(window.Rga && window.Rga.Platform));
    const probes = await page.evaluate(() => ({
      hasAny:           window.Rga.Platform.has(),
      hasShareScript:   window.Rga.Platform.has('shareScript'),
      hasSync:          window.Rga.Platform.has('sync'),
      hasCollab:        window.Rga.Platform.has('collab'),
      hasAuth:          window.Rga.Platform.has('auth'),
      // Edge cases that must never throw.
      hasEmpty:         window.Rga.Platform.has(''),
      hasUndefined:     window.Rga.Platform.has(undefined),
      hasObject:        window.Rga.Platform.has({}),
      hasNumber:        window.Rga.Platform.has(42),
      // invoke + get return undefined cleanly.
      invokeShare:      window.Rga.Platform.invoke('shareScript', 'doc'),
      getUserId:        window.Rga.Platform.get('user.id'),
      getDeep:          window.Rga.Platform.get('a.b.c.d'),
      rawIsNull:        window.Rga.Platform._raw() === null
    }));
    expect(probes).toEqual({
      hasAny:           false,
      hasShareScript:   false,
      hasSync:          false,
      hasCollab:        false,
      hasAuth:          false,
      hasEmpty:         false,
      hasUndefined:     false,
      hasObject:        false,
      hasNumber:        false,
      invokeShare:      undefined,
      getUserId:        undefined,
      getDeep:          undefined,
      rawIsNull:        true
    });
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 3. Every shell module initializes successfully without a platform.
// =================================================================

test('F1A.1 — every CORE shell + settings module initializes in standalone mode', async () => {
  const { app, page, userDataDir, consoleErrors, pageErrors } = await launchStandalone();
  try {
    await page.waitForFunction(() => !!(
      window.Rga &&
      window.Rga.Settings && window.Rga.Settings.Store && window.Rga.Settings.Applicators &&
      window.Rga.Shell && window.Rga.Shell.Layout && window.Rga.Shell.Sidebar &&
      window.Rga.Shell.ActivityRail && window.Rga.Shell.StudioPanel &&
      window.Rga.Shell.TitleBar && window.Rga.Shell.StatusBar &&
      window.Rga.ScriptSession && window.Rga.ScriptMetrics &&
      window.Rga.TabManager && window.Rga.Platform &&
      window.RgaProseMirror
    ), null, { timeout: 10000 });

    // Functional probes — each module's main public entry point
    // returns a sensible value in standalone mode.
    const moduleHealth = await page.evaluate(async () => {
      // Settings store is async-init; we kick it then read effective.
      await window.Rga.Settings.Store.init();
      const wordWrap = window.Rga.Settings.Store.effective('editor.wordWrap');
      const autosaveOn = window.Rga.Settings.Store.effective('autosave.enabled');
      // ScriptSession + ScriptMetrics snapshots — no active doc on
      // fresh boot, so we just confirm the call shape.
      const sessionSnap = window.Rga.ScriptSession.get();
      const metricsSnap = window.Rga.ScriptMetrics.get();
      // Shell layout — six zones.
      const layout = window.Rga.Shell.Layout.get();
      return {
        wordWrap:       wordWrap,
        autosaveOn:     autosaveOn,
        sessionHasKeys: typeof sessionSnap === 'object' && sessionSnap !== null
                          && 'activeScript' in sessionSnap,
        metricsHasKeys: typeof metricsSnap === 'object' && metricsSnap !== null
                          && 'wordCount' in metricsSnap,
        layoutHasZones: typeof layout.sidebar === 'object' &&
                        typeof layout.inspector === 'object' &&
                        typeof layout.studioPanel === 'object' &&
                        typeof layout.titleBar === 'object' &&
                        typeof layout.statusBar === 'object' &&
                        typeof layout.toolbar === 'object'
      };
    });

    // Registry default for editor.wordWrap is 'page'; default for
    // autosave.enabled is true. Standalone boot must produce those.
    expect(moduleHealth.wordWrap).toBe('page');
    expect(moduleHealth.autosaveOn).toBe(true);
    expect(moduleHealth.sessionHasKeys).toBe(true);
    expect(moduleHealth.metricsHasKeys).toBe(true);
    expect(moduleHealth.layoutHasZones).toBe(true);

    // No console error or pageerror referencing the platform namespace.
    // (Other errors are tolerated here — this test guards F1A.1, not
    // the rest of the renderer.)
    const platformErrors = consoleErrors
      .concat(pageErrors)
      .filter((msg) => /platform|rwanga\.platform/i.test(msg));
    expect(platformErrors).toEqual([]);
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 4. CORE-owned DOM regions are all present at boot.
// =================================================================

test('F1A.1 — every protected DOM region declared in the boundary contract is present at boot', async () => {
  const { app, page, userDataDir } = await launchStandalone();
  try {
    // The contract §2 enumerates the CORE-owned selectors. Smoke
    // assertion: each selector resolves to ≥ 1 element on a fresh
    // standalone boot. If any of these disappear, the contract has
    // been violated by a change elsewhere in the codebase.
    await page.waitForSelector('#app', { timeout: 10000 });
    const present = await page.evaluate(() => {
      const selectors = [
        '#app',
        '#rga-shell-titlebar',
        '#rga-shell-menubar',
        '#rga-shell-toolbar',
        '#workspace',
        '#activity-bar',
        '#rga-shell-sidebar-host',
        '#editor-container',
        '#editor',
        '#tab-content-host',
        '#bottom-panel',
        '#inspector-panel',
        '#inspector-toggle',
        '#status-bar'
      ];
      const missing = [];
      selectors.forEach((sel) => {
        if (!document.querySelector(sel)) missing.push(sel);
      });
      return { ok: missing.length === 0, missing: missing };
    });
    expect(present.missing).toEqual([]);
    expect(present.ok).toBe(true);
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 5. Safety property — renderer-side assignment to window.rwanga.platform
//    is silently ignored by Electron's contextBridge. The platform
//    namespace can ONLY be populated by a preload that exposes it; a
//    runaway renderer-side script cannot fake a platform host.
// =================================================================

test('F1A.1 — renderer-side assignment to window.rwanga.platform is silently rejected (contextBridge invariant)', async () => {
  const { app, page, userDataDir } = await launchStandalone();
  try {
    await page.waitForFunction(() => !!(window.Rga && window.Rga.Platform));
    const outcome = await page.evaluate(() => {
      // Try to inject a fake platform shape from the renderer. Electron's
      // contextBridge.exposeInMainWorld freezes the exposed surface, so
      // this write is dropped silently. We assert the drop is invisible
      // to Rga.Platform — has() must continue to return false.
      try {
        window.rwanga.platform = { shareScript: function() { return 'spoofed'; } };
      } catch (_) {
        // contextBridge may throw in strict mode — that's also acceptable.
      }
      return {
        afterAssignment: window.Rga.Platform.has(),
        platformIsStillUndefined: typeof window.rwanga.platform === 'undefined',
        invokeReturnsUndefined: window.Rga.Platform.invoke('shareScript') === undefined
      };
    });
    expect(outcome.afterAssignment).toBe(false);
    expect(outcome.platformIsStillUndefined).toBe(true);
    expect(outcome.invokeReturnsUndefined).toBe(true);
  } finally {
    await teardown(app, userDataDir);
  }
});
