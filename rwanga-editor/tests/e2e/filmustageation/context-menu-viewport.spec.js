// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Context menu viewport clamping — end-to-end (Electron).
//
// Bug: right-clicking near the last words of a long line opened the custom
// context menu off-screen (partially or fully outside the window), forcing the
// writer into an Enter → right-click → Add Tag → Backspace workaround. Tagging
// is now a core workflow, so the menu must ALWAYS stay fully inside the
// viewport. This spec right-clicks near each edge in the real app and asserts
// the menu's bounding rect is inside the window; screenshots are the visual
// proof for the slice report.
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os   = require('os');
const fs   = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const SHOT_DIR = path.join(APP_ROOT, 'test-results', 'context-menu-viewport');

function shotPath(name) {
  if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });
  return path.join(SHOT_DIR, name);
}

async function launchApp(prefix) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(
    window.Rga && window.Rga.TabManager &&
    typeof window.Rga.TabManager._editorView === 'function' &&
    window.Rga.TabManager._editorView()));
  return { app, page, userDataDir };
}

async function teardown(app, userDataDir) {
  try { await app.close(); } catch (_) {}
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
}

// Seed an action line + a non-empty selection so the Tag/Add note items are
// enabled (the submenu only exists when there is a selection).
async function seedSelection(page) {
  await page.evaluate(() => {
    const view = window.Rga.TabManager._editorView();
    const schema = view.state.schema;
    const heading = schema.nodes.sceneHeading.create(
      { setting: 'INT.', time: 'NIGHT', headingStyle: null }, schema.text('OLD HOUSE'));
    const action = schema.nodes.action.create(null,
      schema.text('NALI stands by the window holding the PHOTOGRAPH at the very end of a long line.'));
    const scene = schema.nodes.scene.create(
      { id: 'sc-ctx-1', notes: '', revisionFlag: null,
        metadata: { linkedScenes: [], references: [], production: {} } },
      [heading, action]);
    let bodyPos = null;
    view.state.doc.descendants((node, pos) => {
      if (node.type.name === 'body') { bodyPos = pos; return false; }
      return true;
    });
    const insertAt = bodyPos + view.state.doc.nodeAt(bodyPos).nodeSize - 1;
    view.dispatch(view.state.tr.insert(insertAt, scene));
    // Select the word NALI so mark items (and the Tag submenu) are enabled.
    const found = [];
    view.state.doc.descendants((node, pos) => {
      if (node.isText) {
        const i = node.text.indexOf('NALI');
        if (i !== -1) found.push({ from: pos + i, to: pos + i + 4 });
      }
    });
    const PM = window.RgaProseMirror;
    view.dispatch(view.state.tr.setSelection(
      PM.TextSelection.create(view.state.doc, found[0].from, found[0].to)));
    view.focus();
  });
}

// Fire a real right-click at a viewport coordinate and return the menu rect
// relative to the viewport.
async function rightClickAt(page, x, y) {
  return page.evaluate(({ x, y }) => {
    window.Rga.ContextMenu.hide();
    const view = window.Rga.TabManager._editorView();
    const ev = new MouseEvent('contextmenu',
      { bubbles: true, cancelable: true, clientX: x, clientY: y });
    view.dom.dispatchEvent(ev);
    const el = document.getElementById('context-menu');
    const r = el.getBoundingClientRect();
    return {
      hidden: el.hidden,
      left: r.left, top: r.top, right: r.right, bottom: r.bottom,
      width: r.width, height: r.height,
      vw: window.innerWidth, vh: window.innerHeight
    };
  }, { x, y });
}

// Hover the "Tag as ▶" item with a REAL pointer (triggers CSS :hover AND the
// mouseenter that runs positionSubmenu), then measure the submenu's actual rect.
async function hoverTagAndMeasureSubmenu(page) {
  await page.hover('#context-menu .ctx-has-submenu');
  return page.evaluate(() => {
    const sub = document.querySelector('#context-menu .ctx-submenu');
    const cs = getComputedStyle(sub);
    const r = sub.getBoundingClientRect();
    return {
      display: cs.display,
      left: r.left, top: r.top, right: r.right, bottom: r.bottom,
      width: r.width, height: r.height,
      vw: window.innerWidth, vh: window.innerHeight
    };
  });
}

function assertInsideViewport(rect) {
  expect(rect.hidden).toBe(false);
  expect(rect.width).toBeGreaterThan(0);
  expect(rect.height).toBeGreaterThan(0);
  expect(rect.left).toBeGreaterThanOrEqual(0);
  expect(rect.top).toBeGreaterThanOrEqual(0);
  expect(rect.right).toBeLessThanOrEqual(rect.vw + 0.5);
  expect(rect.bottom).toBeLessThanOrEqual(rect.vh + 0.5);
}

function assertSubmenuInsideViewport(rect) {
  expect(rect.display).toBe('block');
  expect(rect.width).toBeGreaterThan(0);
  expect(rect.height).toBeGreaterThan(0);
  expect(rect.left).toBeGreaterThanOrEqual(-0.5);
  expect(rect.top).toBeGreaterThanOrEqual(-0.5);
  expect(rect.right).toBeLessThanOrEqual(rect.vw + 0.5);
  expect(rect.bottom).toBeLessThanOrEqual(rect.vh + 0.5);
}

test('normal middle-of-line right-click places the menu at the click point; submenu opens right', async () => {
  const { app, page, userDataDir } = await launchApp('ctx-mid-');
  try {
    await seedSelection(page);
    const r = await rightClickAt(page, 420, 320);
    assertInsideViewport(r);
    // Click point is honored where there is room.
    expect(Math.round(r.left)).toBe(420);
    expect(Math.round(r.top)).toBe(320);
    const sub = await hoverTagAndMeasureSubmenu(page);
    assertSubmenuInsideViewport(sub);
    await page.screenshot({ path: shotPath('01-middle-submenu.png') });
  } finally {
    await teardown(app, userDataDir);
  }
});

test('right-edge right-click keeps BOTH the menu and the "Tag as" submenu inside the viewport', async () => {
  const { app, page, userDataDir } = await launchApp('ctx-right-');
  try {
    await seedSelection(page);
    const vw = await page.evaluate(() => window.innerWidth);
    const r = await rightClickAt(page, vw - 3, 300);
    assertInsideViewport(r);
    const sub = await hoverTagAndMeasureSubmenu(page);
    // This is the reported bug: the submenu used to spill off the right edge.
    assertSubmenuInsideViewport(sub);
    // It must have flipped to the LEFT of the parent menu.
    expect(sub.right).toBeLessThanOrEqual(r.right + 0.5);
    await page.screenshot({ path: shotPath('02-right-edge-submenu.png') });
  } finally {
    await teardown(app, userDataDir);
  }
});

test('bottom-edge right-click keeps the menu inside the viewport', async () => {
  const { app, page, userDataDir } = await launchApp('ctx-bottom-');
  try {
    await seedSelection(page);
    const vh = await page.evaluate(() => window.innerHeight);
    const r = await rightClickAt(page, 420, vh - 3);
    assertInsideViewport(r);
    await page.screenshot({ path: shotPath('03-bottom-edge.png') });
  } finally {
    await teardown(app, userDataDir);
  }
});

test('bottom-right corner right-click keeps the whole menu inside the viewport', async () => {
  const { app, page, userDataDir } = await launchApp('ctx-corner-');
  try {
    await seedSelection(page);
    const vp = await page.evaluate(() => ({ vw: window.innerWidth, vh: window.innerHeight }));
    const r = await rightClickAt(page, vp.vw - 3, vp.vh - 3);
    assertInsideViewport(r);
    const sub = await hoverTagAndMeasureSubmenu(page);
    // Near the corner the submenu must flip left AND shift up to stay inside.
    assertSubmenuInsideViewport(sub);
    await page.screenshot({ path: shotPath('04-corner-submenu.png') });
  } finally {
    await teardown(app, userDataDir);
  }
});

test('RTL: left-edge right-click keeps the menu inside the viewport', async () => {
  const { app, page, userDataDir } = await launchApp('ctx-rtl-');
  try {
    await seedSelection(page);
    // Mirror the editor surface so the left edge is the "line end" side.
    await page.evaluate(() => {
      const view = window.Rga.TabManager._editorView();
      view.dom.setAttribute('dir', 'rtl');
    });
    const r = await rightClickAt(page, 3, 300);
    assertInsideViewport(r);
    await page.screenshot({ path: shotPath('05-rtl-left-edge.png') });
  } finally {
    await teardown(app, userDataDir);
  }
});
