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

test('Tag as → Character lists the existing entities (Nali and Baban)', async () => {
  // UX gap fix: a category with entities is NEVER a final/empty create action.
  const { app, page, userDataDir } = await launchApp('alias-list-');
  try {
    await seed(page, 'The Stranger');
    await openMenu(page, 360, 300);
    await page.locator('#context-menu .ctx-item', { hasText: 'Tag as' }).hover();
    const charItem = page.locator('#context-menu .ctx-submenu .ctx-has-submenu', { hasText: 'Character' }).first();
    await expect(charItem).toBeVisible();             // expandable, not a final action
    await charItem.hover();
    const rows = page.locator('#context-menu .ctx-entity-picker .ctx-entity-row');
    await expect(rows.filter({ hasText: 'Nali' })).toHaveCount(1);
    await expect(rows.filter({ hasText: 'Baban' })).toHaveCount(1);
  } finally {
    await teardown(app, userDataDir);
  }
});

test('exact match: the entity is still listed (marked current) and choosing it tags with no alias', async () => {
  // Selecting "Nali" while Nali exists must NOT collapse Character into a final
  // create action — Tag as → Character → Nali stays reachable; Nali is flagged.
  const { app, page, userDataDir } = await launchApp('alias-exact-');
  try {
    await seed(page, 'Nali');   // selection exactly matches the existing entity
    await openMenu(page, 360, 300);
    await page.locator('#context-menu .ctx-item', { hasText: 'Tag as' }).hover();

    const charItem = page.locator('#context-menu .ctx-submenu .ctx-has-submenu', { hasText: 'Character' }).first();
    await expect(charItem).toBeVisible();             // expands even on exact match
    await charItem.hover();
    const nali = page.locator('#context-menu .ctx-entity-picker .ctx-entity-row', { hasText: 'Nali' });
    await expect(nali).toHaveAttribute('aria-current', 'true');   // marked current
    await nali.click();

    const r = await inspect(page, 'Nali');
    expect(r.characterCount).toBe(2);                 // reused, none minted
    expect(r.marks).toContainEqual({ tagType: 'character', entityId: 'nali' });
    expect(r.aliases).toEqual([]);                    // canonical name → no alias
  } finally {
    await teardown(app, userDataDir);
  }
});

test('picker → choose Baban: mention tagged with Baban, surface form recorded as an alias', async () => {
  const { app, page, userDataDir } = await launchApp('alias-baban-');
  try {
    await seed(page, 'The Collector');
    await openMenu(page, 360, 300);
    await page.locator('#context-menu .ctx-item', { hasText: 'Tag as' }).hover();
    await page.locator('#context-menu .ctx-submenu .ctx-has-submenu', { hasText: 'Character' }).hover();
    await page.locator('#context-menu .ctx-entity-picker .ctx-entity-row', { hasText: 'Baban' }).click();

    const r = await page.evaluate(() => {
      const tab = window.Rga.TabManager.activeTab();
      const baban = tab.doc.tagRegistry.characters.find(e => e.id === 'baban');
      const view = window.Rga.TabManager._editorView();
      const marks = [];
      view.state.doc.descendants((node) => {
        if (node.isText && node.text.indexOf('The Collector') !== -1) {
          node.marks.forEach(m => { if (m.type.name === 'tag') marks.push({ tagType: m.attrs.tagType, entityId: m.attrs.entityId }); });
        }
      });
      return { aliases: baban.aliases, count: tab.doc.tagRegistry.characters.length, marks };
    });
    expect(r.count).toBe(2);                          // attached to Baban, none minted
    expect(r.marks).toContainEqual({ tagType: 'character', entityId: 'baban' });
    expect(r.aliases).toContain('The Collector');     // surface form aliased onto Baban
  } finally {
    await teardown(app, userDataDir);
  }
});

test('create-new still works: a type with no entities is a direct create action (first Prop)', async () => {
  const { app, page, userDataDir } = await launchApp('alias-newtype-');
  try {
    await seed(page, 'Crowbar');   // Prop registry is empty (only Characters seeded)
    await openMenu(page, 360, 300);
    await page.locator('#context-menu .ctx-item', { hasText: 'Tag as' }).hover();
    // No props yet → Prop is a DIRECT create action (no third-level picker).
    const propItem = page.locator('#context-menu .ctx-submenu .ctx-item', { hasText: 'Prop' }).first();
    await expect(propItem).not.toHaveClass(/ctx-has-submenu/);
    await propItem.click();

    const r = await page.evaluate(() => {
      const tab = window.Rga.TabManager.activeTab();
      const view = window.Rga.TabManager._editorView();
      const marks = [];
      view.state.doc.descendants((node) => {
        if (node.isText && node.text.indexOf('Crowbar') !== -1) {
          node.marks.forEach(m => { if (m.type.name === 'tag') marks.push(m.attrs.tagType); });
        }
      });
      return { props: tab.doc.tagRegistry.props.map(e => e.name), marks };
    });
    expect(r.props).toContain('Crowbar');             // first prop minted
    expect(r.marks).toContain('prop');                // selection tagged as prop
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
    expect(reloaded.version).toBe('5.0');   // Print Contract V1 bumped 4.0 → 5.0
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
