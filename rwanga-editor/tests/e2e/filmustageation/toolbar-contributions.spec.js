// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Filmustageation F1A.6 — toolbar contribution API smoke.
//
// Verifies the real Electron boot path:
//   - Rga.Shell.Toolbar exposes the documented public API
//   - the screenplay plugin's Scene group is registered at boot
//   - the slot mounts the group (block-type select + +Scene button)
//     between the static text group and the static writing group
//   - the visible Row 3 layout matches pre-F1A.6 chrome (text, sep,
//     scene, sep, writing, sep, mode)
//   - the block-type select still drives scene.setBlockType
//   - the Insert Scene button still dispatches scene.insert
//   - invalid registrations fail safely
//   - unregistering the Scene group removes only its DOM and leaves
//     the CORE static groups intact
//   - the prior F1A.5 + F1A.4 + F1A.3 + F1A.2 + F1A.1 invariants
//     continue to hold (smoke for those lives in their own specs)
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os   = require('os');
const fs   = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');

async function launchApp() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1a-6-toolbar-'));
  const app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(
    window.Rga && window.Rga.Shell && window.Rga.Shell.Toolbar &&
    typeof window.Rga.Shell.Toolbar.registerGroup === 'function'));
  await page.waitForSelector(
    '#rga-shell-toolbar [data-toolbar-group-id="scene"]',
    { timeout: 5000 });
  return { app, page, userDataDir };
}

async function teardown(app, userDataDir) {
  try { await app.close(); } catch (_) {}
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
}

// =================================================================
// 1. Public API + screenplay registration.
// =================================================================

test('F1A.6 — Rga.Shell.Toolbar exposes the contribution API at boot', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const apiShape = await page.evaluate(() => {
      const TB = window.Rga.Shell.Toolbar;
      return ['setHost', 'getHost', 'registerGroup', 'unregisterGroup',
              'registered', 'getController', '_reset']
        .every((n) => typeof TB[n] === 'function');
    });
    expect(apiShape).toBe(true);
  } finally {
    await teardown(app, userDataDir);
  }
});

test('F1A.6 — screenplay plugin registers the Scene group at boot', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const state = await page.evaluate(() => ({
      registered:    window.Rga.Shell.Toolbar.registered(),
      controllerId:  window.Rga.Shell.Toolbar.getController('scene') &&
                      window.Rga.Shell.Toolbar.getController('scene').id,
      controllerOrder: window.Rga.Shell.Toolbar.getController('scene') &&
                      window.Rga.Shell.Toolbar.getController('scene').order
    }));
    expect(state.registered).toContain('scene');
    expect(state.controllerId).toBe('scene');
    expect(state.controllerOrder).toBe(200);
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 2. Visible Row 3 layout: text → sep → scene → sep → writing → sep → mode.
// =================================================================

test('F1A.6 — Row 3 visible group order matches pre-F1A.6 chrome', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const layout = await page.evaluate(() => {
      const inner = document.querySelector('#rga-shell-toolbar .rga-shell-toolbar-inner');
      // Walk the inner band's direct children + the contents of the
      // content-slot; assemble a flat sequence the user actually sees.
      const seq = [];
      Array.from(inner.children).forEach((child) => {
        if (child.classList.contains('rga-shell-toolbar-content-slot')) {
          Array.from(child.children).forEach((c) => seq.push(_label(c)));
        } else {
          seq.push(_label(child));
        }
      });
      function _label(el) {
        if (el.classList.contains('rga-shell-toolbar-group-sep')) return 'sep';
        if (el.classList.contains('rga-shell-toolbar-group')) {
          return 'group:' + el.getAttribute('data-group');
        }
        return el.tagName;
      }
      return seq;
    });
    // F1A.7 (2026-05-29): the screenplay plugin now contributes a
    // second group ('tag') at order 300 — landing inside the same
    // content slot after 'scene', with its own leading separator.
    // The static writing + mode segments are unchanged.
    expect(layout).toEqual([
      'group:text',
      'sep',          // plugin-inserted leading sep for scene
      'group:scene',  // plugin-mounted at order 200
      'sep',          // plugin-inserted leading sep for tag
      'group:tag',    // plugin-mounted at order 300 (F1A.7)
      'sep',          // static sep between content-slot and writing
      'group:writing',
      'sep',          // static sep between writing and mode
      'group:mode'
    ]);
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 3. Scene group DOM shape — block-type select + Insert Scene button.
// =================================================================

test('F1A.6 — Scene group exposes the block-type select + Insert Scene button', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const shape = await page.evaluate(() => {
      const group = document.querySelector('[data-toolbar-group-id="scene"]');
      const select = group && group.querySelector('select#rga-shell-toolbar-blocktype');
      const sceneBtn = group && group.querySelector('button[data-command="scene.insert"]');
      const optionValues = select
        ? Array.from(select.options).map((o) => o.value)
        : [];
      return {
        groupExists:  !!group,
        selectExists: !!select,
        sceneBtnText: sceneBtn && sceneBtn.textContent,
        optionValues
      };
    });
    expect(shape.groupExists).toBe(true);
    expect(shape.selectExists).toBe(true);
    expect(shape.sceneBtnText).toBe('+ Scene');
    expect(shape.optionValues).toEqual([
      '', 'action', 'character', 'dialogue', 'parenthetical',
      'shot', 'transition', 'sceneHeading'
    ]);
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 4. Functional: clicking Insert Scene routes through KR → scene.insert.
// =================================================================

test('F1A.6 — clicking +Scene flows through KR → scene.insert → insertSceneSmart', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const result = await page.evaluate(() => {
      // Replace the engine command target with a tracker — the registered
      // production handler (scene.insert) calls sp.v3Commands.insertSceneSmart
      // which we stub here. KR.registerCommand rejects duplicates so we
      // can't swap the registered handler itself; trading the engine
      // call point is the faithful equivalent.
      const sp = window.Rga.DocTypes.screenplay;
      const originalInsertScene = sp.v3Commands.insertSceneSmart;
      let called = 0;
      sp.v3Commands.insertSceneSmart = function() { called += 1; return true; };
      // Provide an editor view so the production handler reaches the
      // engine call point.
      const originalView = window.Rga.TabManager._editorView;
      window.Rga.TabManager._editorView = function() {
        return {
          state: { schema: { nodes: {} } },
          dispatch: function() {},
          focus:    function() {}
        };
      };
      // Row 3 click delegation: reads data-command, invokes via KR.
      const btn = document.querySelector(
        '[data-toolbar-group-id="scene"] button[data-command="scene.insert"]');
      btn.click();
      // Restore.
      sp.v3Commands.insertSceneSmart  = originalInsertScene;
      window.Rga.TabManager._editorView = originalView;
      return { called, btnCommand: btn.getAttribute('data-command') };
    });
    expect(result.btnCommand).toBe('scene.insert');
    expect(result.called).toBe(1);
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 5. Functional: changing the block-type select dispatches to the engine.
// =================================================================

test('F1A.6 — changing block-type select calls PM.setBlockType through the active view', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const result = await page.evaluate(() => {
      // Stub the engine view so setBlockType is observable without an
      // editor mount. The original TabManager._editorView is replaced
      // for the duration of this test (each Playwright test gets its
      // own Electron instance, so leakage across tests is impossible).
      const calls = [];
      window.Rga.TabManager._editorView = function() {
        return {
          state: {
            schema: { nodes: {
              action: { name: 'action' },
              dialogue: { name: 'dialogue' }
            } }
          },
          dispatch: function() {},
          focus:    function() {}
        };
      };
      // Stub PM.setBlockType too — record which node type the toolbar
      // routed to.
      const originalSetBlockType = window.RgaProseMirror.setBlockType;
      window.RgaProseMirror.setBlockType = function(nodeType) {
        return function() { calls.push(nodeType && nodeType.name); return true; };
      };
      const select = document.querySelector(
        '#rga-shell-toolbar select.rga-shell-toolbar-blocktype');
      select.value = 'dialogue';
      select.dispatchEvent(new Event('change'));
      // Restore.
      window.RgaProseMirror.setBlockType = originalSetBlockType;
      return { calls };
    });
    expect(result.calls).toEqual(['dialogue']);
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 6. Failsafe: invalid registrations and unregister leave CORE intact.
// =================================================================

test('F1A.6 — invalid group registrations are rejected without throwing or polluting the registry', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const result = await page.evaluate(() => {
      const TB = window.Rga.Shell.Toolbar;
      const baseline = TB.registered().slice().sort();
      let threw = false;
      let outcomes;
      try {
        outcomes = [
          TB.registerGroup(null),
          TB.registerGroup(undefined),
          TB.registerGroup({}),
          TB.registerGroup({ id: 'no-mount' }),
          TB.registerGroup({ id: 42, mount: function() {} }),
          TB.registerGroup({ id: 'scene', mount: function() {} }),  // duplicate
          TB.registerGroup({ id: 'bad-order', mount: function() {}, order: 'NaN' })
        ];
      } catch (e) {
        threw = true;
      }
      const after = TB.registered().slice().sort();
      return { threw, outcomes, baseline, after };
    });
    expect(result.threw).toBe(false);
    expect(result.outcomes.every((r) => r === false)).toBe(true);
    expect(result.after).toEqual(result.baseline);
  } finally {
    await teardown(app, userDataDir);
  }
});

test('F1A.6 — unregistering Scene group removes only its DOM; static CORE groups remain', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const result = await page.evaluate(() => {
      const TB = window.Rga.Shell.Toolbar;
      const removed = TB.unregisterGroup('scene');
      const sceneStillThere = !!document.querySelector(
        '[data-toolbar-group-id="scene"]');
      const textStillThere = !!document.querySelector(
        '#rga-shell-toolbar [data-group="text"]');
      const writingStillThere = !!document.querySelector(
        '#rga-shell-toolbar [data-group="writing"]');
      const modeStillThere = !!document.querySelector(
        '#rga-shell-toolbar [data-group="mode"]');
      return {
        removed,
        sceneStillThere,
        textStillThere,
        writingStillThere,
        modeStillThere
      };
    });
    expect(result.removed).toBe(true);
    expect(result.sceneStillThere).toBe(false);
    expect(result.textStillThere).toBe(true);
    expect(result.writingStillThere).toBe(true);
    expect(result.modeStillThere).toBe(true);
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 7. CORE format-toolbar.js no longer hardcodes screenplay block names.
// =================================================================

test('F1A.6 — CORE format-toolbar.js no longer DEFINES or CALLS the screenplay dispatchers', async () => {
  // Drift guard: the F1A.6 brief mandates that CORE format-toolbar.js
  // no longer owns the screenplay block-type dictionary or the
  // scene.insert dispatch. We check the source for actual function
  // definitions and call expressions — comments referencing the
  // migration are fine (the file's migration note mentions both
  // names by design).
  const src = fs.readFileSync(
    path.resolve(__dirname, '..', '..', '..', 'renderer', 'js', 'format-toolbar.js'),
    'utf8');
  // Function-definition syntax. A live `function _dispatchBlockType(`
  // declaration would mean the dispatcher is still defined in CORE.
  expect(src).not.toMatch(/function\s+_dispatchBlockType\s*\(/);
  expect(src).not.toMatch(/function\s+_dispatchInsertScene\s*\(/);
  // Call-expression syntax. A live call (not a comment) would mean
  // CORE still drives the screenplay-side engine.
  expect(src).not.toMatch(/_dispatchBlockType\s*\(/);
  expect(src).not.toMatch(/_dispatchInsertScene\s*\(/);
});
