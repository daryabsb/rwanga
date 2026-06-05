// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Semantic Entity Layer S1 — create an alias through the tagging flow (Electron).
//
// Flow: select "The Teacher" → right-click → Tag as ▶ → Character ▶ → Entity
// Picker → click Nali. Result: the mention is tagged with Nali's entityId and
// "The Teacher" is recorded in Nali.aliases. Also covers the exact-match fast
// path (no picker), the viewport-safe nested picker, .rga persistence, and that
// the document words are never rewritten (print/export stay clean).
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os   = require('os');
const fs   = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const SHOT_DIR = path.join(APP_ROOT, 'test-results', 'alias-create');

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

// Seed two live characters (Nali, Baban) and an action line containing the
// distinctive surface form `phrase`; select that phrase.
async function seed(page, phrase) {
  await page.evaluate((phrase) => {
    const view = window.Rga.TabManager._editorView();
    const schema = view.state.schema;
    const tab = window.Rga.TabManager.activeTab();
    window.Rga.Doc.addEntity(tab.doc, 'character', { id: 'nali',  name: 'Nali' });
    window.Rga.Doc.addEntity(tab.doc, 'character', { id: 'baban', name: 'Baban' });

    const heading = schema.nodes.sceneHeading.create(
      { setting: 'INT.', time: 'NIGHT', headingStyle: null }, schema.text('OLD HOUSE'));
    const action = schema.nodes.action.create(null, schema.text(phrase + ' enters the room.'));
    const scene = schema.nodes.scene.create(
      { id: 'sc-alias-1', notes: '', revisionFlag: null,
        metadata: { linkedScenes: [], references: [], production: {} } },
      [heading, action]);
    let bodyPos = null;
    view.state.doc.descendants((node, pos) => {
      if (node.type.name === 'body') { bodyPos = pos; return false; }
      return true;
    });
    const insertAt = bodyPos + view.state.doc.nodeAt(bodyPos).nodeSize - 1;
    view.dispatch(view.state.tr.insert(insertAt, scene));

    const found = [];
    view.state.doc.descendants((node, pos) => {
      if (node.isText) {
        const i = node.text.indexOf(phrase);
        if (i !== -1) found.push({ from: pos + i, to: pos + i + phrase.length });
      }
    });
    const PM = window.RgaProseMirror;
    view.dispatch(view.state.tr.setSelection(
      PM.TextSelection.create(view.state.doc, found[0].from, found[0].to)));
    view.focus();
  }, phrase);
}

async function openMenu(page, x, y) {
  await page.evaluate(({ x, y }) => {
    window.Rga.ContextMenu.hide();
    const view = window.Rga.TabManager._editorView();
    view.dom.dispatchEvent(new MouseEvent('contextmenu',
      { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  }, { x, y });
}

// Read the registry + the marks over `phrase` back out of the running app.
function inspect(page, phrase) {
  return page.evaluate((phrase) => {
    const view = window.Rga.TabManager._editorView();
    const tab = window.Rga.TabManager.activeTab();
    const nali = tab.doc.tagRegistry.characters.find(e => e.id === 'nali');
    const marks = [];
    view.state.doc.descendants((node, pos) => {
      if (node.isText && node.text.indexOf(phrase) !== -1) {
        node.marks.forEach(m => {
          if (m.type.name === 'tag') marks.push({ tagType: m.attrs.tagType, entityId: m.attrs.entityId });
        });
      }
    });
    return {
      aliases: (nali && nali.aliases) || [],
      characterCount: tab.doc.tagRegistry.characters.length,
      marks: marks,
      docText: view.state.doc.textContent
    };
  }, phrase);
}

test('picker → choose Nali: mention tagged with Nali, "The Teacher" recorded as an alias', async () => {
  const { app, page, userDataDir } = await launchApp('alias-create-');
  try {
    await seed(page, 'The Teacher');
    await openMenu(page, 360, 300);

    await page.locator('#context-menu .ctx-item', { hasText: 'Tag as' }).hover();
    // Character is the only type with entities → the only third-level picker.
    await page.locator('#context-menu .ctx-submenu .ctx-has-submenu', { hasText: 'Character' }).hover();
    await page.locator('#context-menu .ctx-entity-picker .ctx-entity-row', { hasText: 'Nali' }).click();

    const r = await inspect(page, 'The Teacher');
    expect(r.characterCount).toBe(2);                 // no new entity minted
    expect(r.marks).toContainEqual({ tagType: 'character', entityId: 'nali' });
    expect(r.aliases).toContain('The Teacher');       // alias recorded on Nali
    expect(r.docText).toContain('The Teacher');       // words never rewritten
    expect(r.docText).not.toContain('Nali enters');   // canonical name not injected
    await page.screenshot({ path: shotPath('01-alias-created.png') });
  } finally {
    await teardown(app, userDataDir);
  }
});

test('exact-match fast path: tagging "Nali" stays silent (no picker, no alias)', async () => {
  const { app, page, userDataDir } = await launchApp('alias-fastpath-');
  try {
    await seed(page, 'Nali');   // selection exactly matches the existing entity
    await openMenu(page, 360, 300);
    await page.locator('#context-menu .ctx-item', { hasText: 'Tag as' }).hover();

    // The Character type item must be a DIRECT action (no third-level picker)
    // because the selection is an exact match.
    const charItem = page.locator('#context-menu .ctx-submenu .ctx-item', { hasText: 'Character' }).first();
    await expect(charItem).not.toHaveClass(/ctx-has-submenu/);
    await charItem.click();

    const r = await inspect(page, 'Nali');
    expect(r.characterCount).toBe(2);                 // reused, none minted
    expect(r.marks).toContainEqual({ tagType: 'character', entityId: 'nali' });
    expect(r.aliases).toEqual([]);                    // exact match adds no alias
  } finally {
    await teardown(app, userDataDir);
  }
});

test('nested Entity Picker stays inside the viewport near the right edge', async () => {
  const { app, page, userDataDir } = await launchApp('alias-viewport-');
  try {
    await seed(page, 'The Teacher');
    const vw = await page.evaluate(() => window.innerWidth);
    await openMenu(page, vw - 3, 300);

    await page.locator('#context-menu .ctx-item', { hasText: 'Tag as' }).hover();
    await page.locator('#context-menu .ctx-submenu .ctx-has-submenu', { hasText: 'Character' }).hover();

    const rect = await page.evaluate(() => {
      const picker = document.querySelector('#context-menu .ctx-entity-picker');
      const cs = getComputedStyle(picker);
      const r = picker.getBoundingClientRect();
      return { display: cs.display, left: r.left, top: r.top, right: r.right, bottom: r.bottom,
               width: r.width, height: r.height, vw: window.innerWidth, vh: window.innerHeight };
    });
    expect(rect.display).toBe('block');
    expect(rect.width).toBeGreaterThan(0);
    expect(rect.left).toBeGreaterThanOrEqual(-0.5);
    expect(rect.right).toBeLessThanOrEqual(rect.vw + 0.5);
    expect(rect.bottom).toBeLessThanOrEqual(rect.vh + 0.5);
    await page.screenshot({ path: shotPath('02-picker-viewport.png') });
  } finally {
    await teardown(app, userDataDir);
  }
});

test('alias survives a .rga serialize → deserialize round-trip; alias mention renders dotted', async () => {
  const { app, page, userDataDir } = await launchApp('alias-roundtrip-');
  try {
    await seed(page, 'The Teacher');
    await openMenu(page, 360, 300);
    await page.locator('#context-menu .ctx-item', { hasText: 'Tag as' }).hover();
    await page.locator('#context-menu .ctx-submenu .ctx-has-submenu', { hasText: 'Character' }).hover();
    await page.locator('#context-menu .ctx-entity-picker .ctx-entity-row', { hasText: 'Nali' }).click();

    // Save → reload through the real serialize/deserialize pipeline.
    const reloaded = await page.evaluate(() => {
      const tab = window.Rga.TabManager.activeTab();
      const json = window.Rga.Doc.serialize(tab.doc);
      const parsed = JSON.parse(json);
      const onDiskAlias = parsed.tag_registry.characters.find(e => e.id === 'nali').aliases;
      const back = window.Rga.Doc.deserialize(json, null);
      const reloadedAlias = back.tagRegistry.characters.find(e => e.id === 'nali').aliases;
      return { version: parsed.rga_version, onDiskAlias, reloadedAlias };
    });
    expect(reloaded.version).toBe('4.0');
    expect(reloaded.onDiskAlias).toContain('The Teacher');
    expect(reloaded.reloadedAlias).toContain('The Teacher');

    // The alias mention is rendered with a DOTTED underline (derived marker).
    const style = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('.ProseMirror .rga-tag'));
      const el = spans.find(s => s.textContent.indexOf('The Teacher') !== -1);
      return el ? getComputedStyle(el).borderBottomStyle : null;
    });
    expect(style).toBe('dotted');
    await page.screenshot({ path: shotPath('03-dotted-marker.png') });
  } finally {
    await teardown(app, userDataDir);
  }
});
