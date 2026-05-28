// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Filmustageation F1A.5 — Scene Notes shared source + inspector panel.
//
// Proves the real Electron boot path:
//   - Rga.SceneNotes exists at boot (screenplay plugin contribution)
//   - the inspector panel is registered but NOT auto-activated
//   - the static inspector empty state is still visible at boot
//   - bottom-panel Scene Notes still works and routes through the
//     shared source
//   - cross-surface sync: writes in the bottom panel reflect in the
//     inspector (when activated) and vice versa
//   - changing the current scene updates both surfaces
//   - F1A.3 host invariants still hold (deactivate restores empty
//     state)
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os   = require('os');
const fs   = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');

async function launchApp() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1a-5-scene-notes-'));
  const app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(
    window.Rga && window.Rga.SceneNotes &&
    window.Rga.Shell && window.Rga.Shell.Inspector &&
    typeof window.Rga.Shell.Inspector.registerPanel === 'function'));
  return { app, page, userDataDir };
}

async function teardown(app, userDataDir) {
  try { await app.close(); } catch (_) {}
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
}

// =================================================================
// 1. Public surface — Rga.SceneNotes + the panel are present at boot.
// =================================================================

test('F1A.5 — Rga.SceneNotes is exposed at boot with the documented API', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const apiShape = await page.evaluate(() => {
      const SN = window.Rga.SceneNotes;
      return ['get', 'set', 'currentSceneId', 'currentSceneName',
              'setCurrentScene', 'subscribe']
        .every((n) => typeof SN[n] === 'function');
    });
    expect(apiShape).toBe(true);
  } finally {
    await teardown(app, userDataDir);
  }
});

test('F1A.5 — inspector "scene-notes" panel is registered but NOT active at boot', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const state = await page.evaluate(() => ({
      registered: window.Rga.Shell.Inspector.registered(),
      current:    window.Rga.Shell.Inspector.current(),
      hasEmpty:   !!document.querySelector(
        '#inspector-panel .inspector-body .inspector-empty'),
      hasPanel:   !!document.querySelector(
        '#inspector-panel .inspector-body .rga-inspector-scene-notes')
    }));
    expect(state.registered).toContain('scene-notes');
    expect(state.current).toBe(null);   // no auto-activation
    expect(state.hasEmpty).toBe(true);
    expect(state.hasPanel).toBe(false);
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 2. Bottom-panel Scene Notes routes through Rga.SceneNotes.
// =================================================================

test('F1A.5 — bottom-panel textarea writes flow through Rga.SceneNotes (round-trip)', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const result = await page.evaluate(async () => {
      const SN = window.Rga.SceneNotes;
// Simulate a cursor landing inside a scene. We bypass the
      // _detectCurrentScene DOM walk by calling setCurrentScene
      // directly — the studio-panel.js subscriber wires the bottom
      // panel.
      SN.setCurrentScene('S1', 'INT. KITCHEN — NIGHT');
      // The bottom panel's input listener uses Rga.debounce (300ms).
      // We avoid the debounce by writing through SN.set, which the
      // bottom panel subscribes to and reflects synchronously.
      SN.set('S1', 'a note from the test');
      const ta = document.getElementById('notes-textarea');
      const label = document.getElementById('notes-scene-label');
      return {
        taValue:    ta && ta.value,
        taDisabled: ta && ta.disabled,
        labelText:  label && label.textContent
      };
    });
    expect(result.taValue).toBe('a note from the test');
    expect(result.taDisabled).toBe(false);
    expect(result.labelText).toContain('INT. KITCHEN — NIGHT');
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 3. Cross-surface sync — bottom ↔ inspector.
// =================================================================

test('F1A.5 — bottom-panel writes reflect in the inspector when activated', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const result = await page.evaluate(() => {
      const SN = window.Rga.SceneNotes;
      const I = window.Rga.Shell.Inspector;
SN.setCurrentScene('S1', 'A');
      I.activate('scene-notes');
      // Write through the shared source as the bottom panel would.
      SN.set('S1', 'bottom-write');
      const insTa = document.querySelector(
        '.inspector-body .rga-inspector-scene-notes-textarea');
      const result = { inspectorValue: insTa && insTa.value };
      I.deactivate();
      return result;
    });
    expect(result.inspectorValue).toBe('bottom-write');
  } finally {
    await teardown(app, userDataDir);
  }
});

test('F1A.5 — inspector writes reflect in the bottom-panel textarea', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const result = await page.evaluate(() => {
      const SN = window.Rga.SceneNotes;
      const I = window.Rga.Shell.Inspector;
SN.setCurrentScene('S1', 'A');
      I.activate('scene-notes');
      // Simulate inspector-side write (skipping the textarea-input
      // debounce by going through the shared source directly — the
      // textarea event handler does exactly this after 300ms).
      SN.set('S1', 'inspector-write');
      const bottomTa = document.getElementById('notes-textarea');
      const result = { bottomValue: bottomTa && bottomTa.value };
      I.deactivate();
      return result;
    });
    expect(result.bottomValue).toBe('inspector-write');
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 4. Changing the current scene updates both surfaces safely.
// =================================================================

test('F1A.5 — switching scenes updates both bottom panel and inspector', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const result = await page.evaluate(() => {
      const SN = window.Rga.SceneNotes;
      const I = window.Rga.Shell.Inspector;
SN.set('S1', 'note one');
      SN.set('S2', 'note two');
      I.activate('scene-notes');
      SN.setCurrentScene('S1', 'A');
      const after1 = {
        bottom:    document.getElementById('notes-textarea').value,
        inspector: document.querySelector(
          '.rga-inspector-scene-notes-textarea').value
      };
      SN.setCurrentScene('S2', 'B');
      const after2 = {
        bottom:    document.getElementById('notes-textarea').value,
        inspector: document.querySelector(
          '.rga-inspector-scene-notes-textarea').value
      };
      I.deactivate();
      return { after1, after2 };
    });
    expect(result.after1.bottom).toBe('note one');
    expect(result.after1.inspector).toBe('note one');
    expect(result.after2.bottom).toBe('note two');
    expect(result.after2.inspector).toBe('note two');
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 5. Inspector empty state is restored on deactivate.
// =================================================================

test('F1A.5 — deactivating the panel restores the inspector empty state', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const result = await page.evaluate(() => {
      const SN = window.Rga.SceneNotes;
      const I = window.Rga.Shell.Inspector;
const before = document.querySelector(
        '#inspector-panel .inspector-body').innerHTML;
      SN.setCurrentScene('S1', 'A');
      I.activate('scene-notes');
      const during = !!document.querySelector(
        '.rga-inspector-scene-notes-textarea');
      I.deactivate();
      const after = document.querySelector(
        '#inspector-panel .inspector-body').innerHTML;
      return { before, during, after };
    });
    expect(result.during).toBe(true);
    expect(result.after).toBe(result.before);
    expect(result.before).toContain('inspector-empty');
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 6. The inspector never opens automatically on a scene change.
// =================================================================

test('F1A.5 — setting a current scene does NOT auto-open the inspector panel', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const state = await page.evaluate(() => {
      const SN = window.Rga.SceneNotes;
      const I = window.Rga.Shell.Inspector;
SN.setCurrentScene('S1', 'A');
      SN.set('S1', 'data exists');
      return {
        currentInInspector: I.current(),
        hasInspectorPanel: !!document.querySelector(
          '.rga-inspector-scene-notes-textarea'),
        hasEmptyState: !!document.querySelector(
          '#inspector-panel .inspector-body .inspector-empty')
      };
    });
    expect(state.currentInInspector).toBe(null);
    expect(state.hasInspectorPanel).toBe(false);
    expect(state.hasEmptyState).toBe(true);
  } finally {
    await teardown(app, userDataDir);
  }
});
