// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Filmustageation F1A.3 — Inspector panel-host smoke.
//
// The new Rga.Shell.Inspector registry is frame-only. No production
// module registers an inspector panel yet; the static empty-state
// markup must remain visible at boot, and the collapse/expand
// affordance must continue to function. The registry must be exposed,
// the host must be wired, and a fake panel must be able to mount +
// unmount + restore the empty state (the lifecycle proof).
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os   = require('os');
const fs   = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');

async function launchApp() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1a-3-inspector-host-'));
  const app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(
    window.Rga && window.Rga.Shell && window.Rga.Shell.Inspector &&
    typeof window.Rga.Shell.Inspector.registerPanel === 'function'));
  return { app, page, userDataDir };
}

async function teardown(app, userDataDir) {
  try { await app.close(); } catch (_) {}
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
}

// =================================================================
// 1. Rga.Shell.Inspector exposes the documented public API at boot.
// =================================================================

test('F1A.3 — Rga.Shell.Inspector exposes the F1A.3 public API at boot', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const apiShape = await page.evaluate(() => {
      const I = window.Rga.Shell.Inspector;
      const names = ['setHost', 'getHost',
                     'registerPanel', 'unregisterPanel', 'registered',
                     'getController', 'activate', 'deactivate',
                     'current', 'isActive', 'isApplicable', 'onChange'];
      return names.every((n) => typeof I[n] === 'function');
    });
    expect(apiShape).toBe(true);
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 2. F1A.3 dormancy — no production module registers a panel.
// =================================================================

test('F1A.3 — inspector host boots with no panel ACTIVE (no auto-open)', async () => {
  // Updated for F1A.5 (2026-05-29): the registry is no longer
  // "frame-only" — the screenplay plugin contributes the scene-notes
  // panel at script-load. The F1A.3 invariant being guarded here is
  // narrower: NO panel is auto-activated, so the captured empty state
  // remains visible at boot. The presence of a registered panel is
  // expected; auto-activation is not.
  const { app, page, userDataDir } = await launchApp();
  try {
    const state = await page.evaluate(() => ({
      registered: window.Rga.Shell.Inspector.registered(),
      current:    window.Rga.Shell.Inspector.current()
    }));
    // F1A.5 lands the first production panel: 'scene-notes'.
    expect(state.registered).toContain('scene-notes');
    expect(state.current).toBe(null);
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 3. Static empty-state is visible at boot.
// =================================================================

test('F1A.3 — the static .inspector-empty markup remains visible after F1A.3 wiring', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    await page.waitForSelector('#inspector-panel .inspector-body .inspector-empty',
      { timeout: 5000 });
    const text = await page.evaluate(() => {
      const el = document.querySelector(
        '#inspector-panel .inspector-body .inspector-empty');
      return {
        present: !!el,
        title: el.querySelector('.inspector-empty-title').textContent,
        help:  el.querySelector('.inspector-empty-help').textContent
      };
    });
    expect(text.present).toBe(true);
    expect(text.title).toMatch(/No details to show/);
    expect(text.help).toMatch(/Select.*inspect/);
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 4. The inspector host is wired to the .inspector-body element.
// =================================================================

test('F1A.3 — Rga.Shell.Inspector.getHost() returns the .inspector-body element', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const wired = await page.evaluate(() => {
      const host = window.Rga.Shell.Inspector.getHost();
      const expected = document.querySelector('#inspector-panel .inspector-body');
      return {
        hostExists:   !!host,
        hostIsBody:   host === expected,
        hostClass:    host && host.className
      };
    });
    expect(wired.hostExists).toBe(true);
    expect(wired.hostIsBody).toBe(true);
    expect(wired.hostClass).toContain('inspector-body');
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 5. End-to-end lifecycle proof — register, activate, deactivate,
//    empty state restored.
// =================================================================

test('F1A.3 — register / activate / deactivate round-trips and restores the empty state', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const result = await page.evaluate(() => {
      const I = window.Rga.Shell.Inspector;
      const host = I.getHost();
      const beforeHtml = host.innerHTML;
      // Inject a fake panel from the renderer test harness.
      const ok = I.registerPanel({
        id: 'f1a3-smoke',
        label: 'Smoke',
        mount: function(container) { container.innerHTML = '<div class="smoke">SMOKE</div>'; },
        unmount: function() { /* no-op */ }
      });
      const activated = I.activate('f1a3-smoke');
      const duringHtml = host.innerHTML;
      const smokePresent = !!document.querySelector('.inspector-body .smoke');
      I.deactivate();
      const afterHtml = host.innerHTML;
      // Clean up — unregister our test panel so we don't leak state
      // into other tests that share the userDataDir teardown timing.
      I.unregisterPanel('f1a3-smoke');
      return { ok, activated, beforeHtml, duringHtml, afterHtml, smokePresent };
    });
    expect(result.ok).toBe(true);
    expect(result.activated).toBe(true);
    expect(result.smokePresent).toBe(true);
    expect(result.duringHtml).toContain('SMOKE');
    expect(result.afterHtml).toBe(result.beforeHtml);
    // Sanity: the captured "before" HTML actually contains the empty
    // state — i.e., F1A.3 didn't clear it at boot.
    expect(result.beforeHtml).toContain('inspector-empty');
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 6. Invalid registrations fail safely.
// =================================================================

test('F1A.3 — invalid panel registrations return false without throwing or polluting the registry', async () => {
  // Updated for F1A.5: registered() now contains the production
  // 'scene-notes' panel. The invariant being guarded is unchanged —
  // none of the invalid registration attempts may pollute the
  // registry — but the baseline is "the scene-notes panel exists",
  // not "the registry is empty".
  const { app, page, userDataDir } = await launchApp();
  try {
    const result = await page.evaluate(() => {
      const I = window.Rga.Shell.Inspector;
      const baseline = I.registered().slice();
      let anyThrow = false;
      let results;
      try {
        results = [
          I.registerPanel(null),
          I.registerPanel(undefined),
          I.registerPanel({}),
          I.registerPanel({ id: '' }),
          I.registerPanel({ id: 42 }),
          I.registerPanel({ id: 'no-mount' }),
          I.registerPanel({ id: 'bad-mount', mount: 'not-fn' })
        ];
      } catch (_) {
        anyThrow = true;
      }
      return {
        anyThrow:   anyThrow,
        results:    results,
        baseline:   baseline,
        registered: I.registered()
      };
    });
    expect(result.anyThrow).toBe(false);
    expect(result.results.every((r) => r === false)).toBe(true);
    // No invalid attempt joined the registry; production panel still there.
    expect(result.registered).toEqual(result.baseline);
    expect(result.registered).toContain('scene-notes');
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 7. Collapse / expand affordance still works (no regression on
//    inspector visibility ownership in StudioPanel).
// =================================================================

test('F1A.3 — inspector collapse/expand toggle still routes through StudioPanel (no regression)', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    await page.waitForFunction(() => !!(
      window.Rga.Shell.StudioPanel &&
      typeof window.Rga.Shell.StudioPanel.toggleInspector === 'function'));
    const result = await page.evaluate(() => {
      const ws = document.getElementById('workspace');
      const startCollapsed = ws.classList.contains('inspector-collapsed');
      window.Rga.Shell.StudioPanel.toggleInspector();
      const afterToggleA = ws.classList.contains('inspector-collapsed');
      window.Rga.Shell.StudioPanel.toggleInspector();
      const afterToggleB = ws.classList.contains('inspector-collapsed');
      return { startCollapsed, afterToggleA, afterToggleB };
    });
    expect(result.afterToggleA).toBe(!result.startCollapsed);
    expect(result.afterToggleB).toBe(result.startCollapsed);
  } finally {
    await teardown(app, userDataDir);
  }
});
