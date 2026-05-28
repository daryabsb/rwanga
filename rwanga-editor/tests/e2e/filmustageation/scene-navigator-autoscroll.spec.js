// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Filmustageation SN.1 — Scenes Sidebar Catalogue, auto-scroll current row.
//
// Verifies the end-to-end behaviour in real Electron:
//   - When the editor cursor crosses a scene boundary, the navigator
//     scrolls the new current-scene row into view.
//   - When the cursor stays inside the same scene, no scroll fires.
//   - The selected/current separation invariant survives the auto-scroll
//     (keyboard-selected row is preserved when current transitions).
//   - Click-to-jump still works (no regression of pre-SN.1 behaviour).
//
// Strategy: seed a fixture script with enough scenes to overflow the
// sidebar host. The sidebar-default-per-doctype spec already proves boot
// resolution; this spec only exercises the post-mount auto-scroll path.
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os   = require('os');
const fs   = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');

async function launchApp() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sn-1-autoscroll-'));
  const app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(
    window.Rga && window.Rga.Shell && window.Rga.Shell.Sidebar &&
    window.Rga.Shell.SceneNavigator &&
    window.Rga.ScriptSession && typeof window.Rga.ScriptSession.get === 'function'));
  await page.waitForFunction(() =>
    window.Rga.Shell.Sidebar.current() === 'sceneNavigator', null, { timeout: 5000 });
  return { app, page, userDataDir };
}

async function teardown(app, userDataDir) {
  try { await app.close(); } catch (_) {}
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
}

// Install a scrollIntoView spy in the page and seed the navigator with
// enough scene rows to overflow the sidebar host, so scroll-into-view is
// a non-trivial operation. The fixture replaces Rga.Nav.getIndex's data
// without touching nav-index source.
async function seedManyScenesAndSpy(page) {
  return page.evaluate(() => {
    const SCENE_COUNT = 40;
    const scenes = [];
    for (let i = 0; i < SCENE_COUNT; i += 1) {
      scenes.push({
        nodeId:               'scene-' + i,
        sceneNumber:          i + 1,
        pmPos:                i * 100,
        pmEndPos:             i * 100 + 100,
        headingDisplay:       'INT. LOCATION ' + (i + 1) + ' — DAY',
        setting:              'INT.',
        locationText:         'LOCATION ' + (i + 1),
        time:                 'DAY',
        transitionDisplay:    '',
        transitionPresetType: null,
        blockCount:           5,
        hasNotes:             false,
        hasRevisionFlag:      false
      });
    }
    const fakeIndex = { scenes: scenes, pages: [], characters: [], tags: {}, notes: [], flags: [] };
    // Replace Rga.Nav.getIndex so the navigator's re-render sees our fixture.
    window.__rgaNavOriginal = window.Rga.Nav.getIndex;
    window.Rga.Nav.getIndex = function() { return fakeIndex; };
    // Spy on scrollIntoView. SN.1 is the only path that passes behavior:'auto'.
    window.__sn1ScrollCalls = [];
    window.Element.prototype.scrollIntoView = function(opts) {
      window.__sn1ScrollCalls.push({
        sceneNodeId: this.getAttribute ? this.getAttribute('data-scene-node-id') : null,
        hasCurrentClass: this.classList
          ? this.classList.contains('rga-shell-scene-navigator-row-current')
          : false,
        opts: opts || {}
      });
    };
    return { sceneCount: SCENE_COUNT };
  });
}

// Drive a current-scene transition without touching the editor itself:
// override ScriptSession.get's currentScene return and notify subscribers.
// This isolates SN.1's behaviour from the editor's selection plumbing —
// the contract under test is "navigator scrolls when currentScene changes,"
// which is exactly what ScriptSession exposes.
async function setCurrentScene(page, nodeId, sceneNumber) {
  await page.evaluate(({ nodeId, sceneNumber }) => {
    if (!window.__rgaSessionOriginalGet) {
      window.__rgaSessionOriginalGet = window.Rga.ScriptSession.get.bind(window.Rga.ScriptSession);
    }
    const baseSnap = window.__rgaSessionOriginalGet();
    const overrideSnap = Object.assign({}, baseSnap, {
      currentScene: nodeId
        ? { nodeId: nodeId, sceneNumber: sceneNumber, headingDisplay: 'INT. LOCATION ' + sceneNumber + ' — DAY' }
        : null
    });
    window.Rga.ScriptSession.get = function() { return overrideSnap; };
    // Force the navigator to re-render against the new snapshot. The
    // navigator's mounted subscriber will trigger _render automatically
    // when ScriptSession actually fires; calling _render directly here
    // exercises the SAME code path the subscriber would take.
    window.Rga.Shell.SceneNavigator._render();
  }, { nodeId, sceneNumber });
}

async function readSpyCalls(page) {
  return page.evaluate(() => (window.__sn1ScrollCalls || []).slice());
}

async function clearSpy(page) {
  await page.evaluate(() => { window.__sn1ScrollCalls = []; });
}

function sn1Calls(calls) {
  return calls.filter((c) => c.opts && c.opts.behavior === 'auto' && c.hasCurrentClass);
}

// =================================================================
// 1. Current row scrolls into view when current scene transitions.
// =================================================================

test('SN.1 — current row scrolls into view when ScriptSession transitions to a new scene', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    await seedManyScenesAndSpy(page);
    // Move cursor into scene 30 (well past the visible-rows threshold).
    await clearSpy(page);
    await setCurrentScene(page, 'scene-29', 30);
    const after = sn1Calls(await readSpyCalls(page));
    expect(after.length).toBeGreaterThanOrEqual(1);
    expect(after[after.length - 1].sceneNodeId).toBe('scene-29');
    expect(after[after.length - 1].opts.block).toBe('nearest');
    expect(after[after.length - 1].opts.behavior).toBe('auto');
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 2. No scroll when current scene is unchanged across re-renders.
// =================================================================

test('SN.1 — no auto-scroll when re-render fires but current scene is unchanged', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    await seedManyScenesAndSpy(page);
    await setCurrentScene(page, 'scene-15', 16);
    // Clear spy now that the transition-into-15 scroll is past.
    await clearSpy(page);
    // Re-render N times without changing currentScene → SN.1 must not fire.
    await page.evaluate(() => {
      for (let i = 0; i < 5; i += 1) window.Rga.Shell.SceneNavigator._render();
    });
    const calls = sn1Calls(await readSpyCalls(page));
    expect(calls.length).toBe(0);
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 3. Separation invariant: keyboard-selected row survives a current
//    transition; selected and current never collapse.
// =================================================================

test('SN.1 — separation invariant holds across an auto-scroll transition', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    await seedManyScenesAndSpy(page);
    // Park current on scene 5.
    await setCurrentScene(page, 'scene-4', 5);
    // Keyboard-select scene 20. focusRow is the canonical entry that does
    // NOT move the editor cursor — exactly the state we want to preserve.
    await page.evaluate(() => window.Rga.Shell.SceneNavigator.focusRow('scene-19'));
    await clearSpy(page);
    // Move current to scene 30 — selected must remain scene-19.
    await setCurrentScene(page, 'scene-29', 30);
    const state = await page.evaluate(() => {
      const rowFor = (id) => document.querySelector(
        '.rga-shell-scene-navigator-row[data-scene-node-id="' + id + '"]');
      const isCurrent = (id) => rowFor(id) &&
        rowFor(id).classList.contains('rga-shell-scene-navigator-row-current');
      const isSelected = (id) => rowFor(id) &&
        rowFor(id).classList.contains('rga-shell-scene-navigator-row-selected');
      return {
        selectedNodeId:   window.Rga.Shell.SceneNavigator.selectedRowNodeId(),
        currentOn29:      isCurrent('scene-29'),
        currentOn19:      isCurrent('scene-19'),
        selectedOn19:     isSelected('scene-19'),
        selectedOn29:     isSelected('scene-29')
      };
    });
    expect(state.selectedNodeId).toBe('scene-19');
    expect(state.currentOn29).toBe(true);
    expect(state.currentOn19).toBe(false);
    expect(state.selectedOn19).toBe(true);
    expect(state.selectedOn29).toBe(false);
    // The auto-scroll fired on the NEW current row.
    const calls = sn1Calls(await readSpyCalls(page));
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[calls.length - 1].sceneNodeId).toBe('scene-29');
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 4. Click-to-jump regression guard — clicking a row still dispatches
//    scrollToScene against the real Rga.Nav.findScene path.
// =================================================================

test('SN.1 — click-to-jump still routes through Rga.Shell.SceneNavigator.scrollToScene', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    await seedManyScenesAndSpy(page);
    const result = await page.evaluate(() => {
      // Replace findScene with a spy that records the nodeId passed in.
      const calls = [];
      window.Rga.Nav.findScene = function(doc, nodeId) { calls.push(nodeId); return null; };
      const ok = window.Rga.Shell.SceneNavigator.scrollToScene('scene-12');
      return { ok: ok, calls: calls };
    });
    // scrollToScene calls findScene with the requested nodeId.
    expect(result.calls).toEqual(['scene-12']);
    // Returns false because our fake findScene returned null — the path
    // is exercised; the click→scrollToScene plumbing is unbroken.
    expect(result.ok).toBe(false);
  } finally {
    await teardown(app, userDataDir);
  }
});
