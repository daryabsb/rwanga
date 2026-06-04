// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Scene Navigator Tags v1.1 — hybrid occurrence model (end-to-end).
//
// The real writer workflow, in the real Electron app, through real UI:
//   1. Type screenplay text, tag names with the REAL toolbar Tag dropdown.
//   2. Open the Scene Navigator with the rail; expand the scene row.
//   3. SEE scene-local tag intelligence: category groups, an entity row per
//      tagged entity with its PER-SCENE count.
//   4. Expand an entity → its occurrence snippets (original screenplay
//      wording). Click a snippet → the editor jumps to that occurrence.
//   5. Click the entity row → its tagged occurrences light up (V1.3 focus).
//   6. RTL mirroring verified.
//
// Screenshots → test-results/scene-navigator-tags/ are the visual
// verification artifacts for the slice report.
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os   = require('os');
const fs   = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const SHOT_DIR = path.join(APP_ROOT, 'test-results', 'scene-navigator-tags');

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
    window.Rga && window.Rga.Shell && window.Rga.Shell.Sidebar &&
    window.Rga.Shell.SceneNavigator &&
    window.Rga.SceneTagOccurrences && typeof window.Rga.SceneTagOccurrences.forScene === 'function' &&
    window.Rga.TabManager && typeof window.Rga.TabManager._editorView === 'function' &&
    window.Rga.TabManager._editorView()));
  return { app, page, userDataDir };
}

async function teardown(app, userDataDir) {
  try { await app.close(); } catch (_) {}
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
}

// Insert a scene whose action text carries taggable names; id matches the
// nav-index scene nodeId.
async function seedSceneText(page) {
  await page.evaluate(() => {
    const view = window.Rga.TabManager._editorView();
    const schema = view.state.schema;
    const heading = schema.nodes.sceneHeading.create({ setting: 'INT.', time: 'NIGHT', headingStyle: null },
      schema.text('OLD HOUSE'));
    const action = schema.nodes.action.create(null,
      schema.text('NALI stands by the window holding the PHOTOGRAPH. NALI smiles.'));
    const transition = schema.nodes.transition.create({ presetType: 'CUT' }, schema.text('CUT'));
    const scene = schema.nodes.scene.create(
      { id: 'sc-nav-1', notes: '', revisionFlag: null,
        metadata: { linkedScenes: [], references: [], production: {} } },
      [heading, action, transition]);
    let bodyPos = null;
    view.state.doc.descendants(function(node, pos) {
      if (node.type.name === 'body') { bodyPos = pos; return false; }
      return true;
    });
    const insertAt = bodyPos + view.state.doc.nodeAt(bodyPos).nodeSize - 1;
    view.dispatch(view.state.tr.insert(insertAt, scene));
  });
}

async function selectOccurrence(page, needle, nth) {
  await page.evaluate(({ needle, nth }) => {
    const view = window.Rga.TabManager._editorView();
    const found = [];
    view.state.doc.descendants(function(node, pos) {
      if (!node.isText) return;
      let i = node.text.indexOf(needle);
      while (i !== -1) {
        found.push({ from: pos + i, to: pos + i + needle.length });
        i = node.text.indexOf(needle, i + 1);
      }
    });
    const target = found[nth];
    const PM = window.RgaProseMirror;
    view.dispatch(view.state.tr.setSelection(
      PM.TextSelection.create(view.state.doc, target.from, target.to)));
    view.focus();
  }, { needle, nth });
}

async function tagSelectionViaToolbar(page, category) {
  await page.selectOption('#rga-shell-toolbar-tag', category);
}

// Open the Scene Navigator (rail open-branch) + expand scene sc-nav-1.
async function openNavigatorAndExpandScene(page) {
  await page.click('[data-panel-id="sceneNavigator"]');
  // Drive the rail's canonical OPEN branch — a raw click TOGGLES, and the
  // navigator is the default-open panel, so we open it deterministically.
  await page.evaluate(() => {
    window.Rga.Shell.Sidebar.activate('sceneNavigator');
    window.Rga.Shell.Layout.set({ sidebar: { visible: true, userOverride: true } });
  });
  await page.waitForFunction(() => window.Rga.Shell.Sidebar.current() === 'sceneNavigator');
  await page.waitForFunction(() => {
    const host = window.Rga.Shell.Sidebar.getHost();
    return host && host.querySelector('[data-scene-node-id="sc-nav-1"] .rga-shell-scene-navigator-chevron');
  });
  await page.evaluate(() => {
    const host = window.Rga.Shell.Sidebar.getHost();
    host.querySelector('[data-scene-node-id="sc-nav-1"] .rga-shell-scene-navigator-chevron').click();
  });
  await page.waitForFunction(() => {
    const host = window.Rga.Shell.Sidebar.getHost();
    return host && host.querySelector('[data-scene-node-id="sc-nav-1"] .rga-shell-scene-navigator-scene-tags');
  });
}

// =================================================================
// 1. Expanded scene → category groups + entity rows with counts
// =================================================================

test('Scene Navigator Tags v1.1 — expanded scene: categories + entity rows with per-scene counts', async () => {
  const { app, page, userDataDir } = await launchApp('scene-nav-tags-');
  try {
    await seedSceneText(page);
    await selectOccurrence(page, 'NALI', 0);
    await tagSelectionViaToolbar(page, 'character');
    await selectOccurrence(page, 'NALI', 1);
    await tagSelectionViaToolbar(page, 'character');
    await selectOccurrence(page, 'PHOTOGRAPH', 0);
    await tagSelectionViaToolbar(page, 'prop');

    await openNavigatorAndExpandScene(page);

    const state = await page.evaluate(() => {
      const host = window.Rga.Shell.Sidebar.getHost();
      const zone = host.querySelector('[data-scene-node-id="sc-nav-1"] .rga-shell-scene-navigator-scene-tags');
      const rows = Array.from(zone.querySelectorAll('.rga-shell-scene-navigator-tag-entity')).map((r) => ({
        name:  r.querySelector('.rga-shell-scene-navigator-tag-entity-name').textContent,
        count: r.querySelector('.rga-shell-scene-navigator-tag-entity-count').textContent
      }));
      return {
        label:  zone.querySelector('.rga-shell-scene-navigator-scene-tags-label').textContent,
        groups: Array.from(zone.querySelectorAll('.rga-shell-scene-navigator-tag-group-label')).map((e) => e.textContent),
        rows:   rows
      };
    });
    expect(state.label).toBe('Tagged in this scene');
    expect(state.groups).toEqual(['Characters', 'Props']);
    expect(state.rows).toContainEqual({ name: 'NALI', count: '·2' });        // counted PER SCENE
    expect(state.rows).toContainEqual({ name: 'PHOTOGRAPH', count: '·1' });
    await page.screenshot({ path: shotPath('01-scene-expanded-counts.png') });
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 2. Expand an entity → occurrence snippets; click snippet → jump
// =================================================================

test('Scene Navigator Tags v1.1 — expand entity → snippets with wording; click snippet → jump', async () => {
  const { app, page, userDataDir } = await launchApp('scene-nav-tags-occ-');
  try {
    await seedSceneText(page);
    await selectOccurrence(page, 'NALI', 0);
    await tagSelectionViaToolbar(page, 'character');
    await selectOccurrence(page, 'NALI', 1);
    await tagSelectionViaToolbar(page, 'character');
    await selectOccurrence(page, 'PHOTOGRAPH', 0);
    await tagSelectionViaToolbar(page, 'prop');

    await openNavigatorAndExpandScene(page);

    // Expand the NALI entity → its 2 occurrence snippets appear.
    await page.evaluate(() => {
      const host = window.Rga.Shell.Sidebar.getHost();
      const nali = Array.from(host.querySelectorAll('[data-scene-node-id="sc-nav-1"] .rga-shell-scene-navigator-tag-entity'))
        .find((r) => /NALI/.test(r.textContent));
      nali.querySelector('.rga-shell-scene-navigator-tag-entity-chevron').click();
    });
    await page.waitForFunction(() => {
      const host = window.Rga.Shell.Sidebar.getHost();
      return host.querySelectorAll('[data-scene-node-id="sc-nav-1"] .rga-shell-scene-navigator-tag-occurrence').length === 2;
    });

    const occ = await page.evaluate(() => {
      const host = window.Rga.Shell.Sidebar.getHost();
      return Array.from(host.querySelectorAll('[data-scene-node-id="sc-nav-1"] .rga-shell-scene-navigator-tag-occurrence'))
        .map((el) => ({ text: el.textContent, match: el.querySelector('.rga-shell-scene-navigator-tag-occurrence-match').textContent }));
    });
    expect(occ.length).toBe(2);
    expect(occ[0].match).toBe('NALI');
    expect(occ[0].text).toMatch(/stands by the window/);   // original screenplay wording
    await page.screenshot({ path: shotPath('02-entity-expanded-snippets.png') });

    // Park the cursor far away, then click the SECOND occurrence snippet →
    // the editor jumps to that occurrence (second NALI, "NALI smiles").
    await selectOccurrence(page, 'CUT', 0);
    const cutPos = await page.evaluate(() => window.Rga.TabManager._editorView().state.selection.from);
    await page.evaluate(() => {
      const host = window.Rga.Shell.Sidebar.getHost();
      const occs = host.querySelectorAll('[data-scene-node-id="sc-nav-1"] .rga-shell-scene-navigator-tag-occurrence');
      occs[1].click();
    });
    const after = await page.evaluate(() => {
      const view = window.Rga.TabManager._editorView();
      const from = view.state.selection.from;
      // The text immediately after the cursor should be the tagged "NALI".
      return { from: from, near: view.state.doc.textBetween(from, from + 4) };
    });
    expect(after.from).not.toBe(cutPos);          // cursor moved
    expect(after.near).toBe('NALI');              // landed on the 2nd NALI occurrence
    await page.screenshot({ path: shotPath('03-occurrence-jump.png') });
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 3. Click entity row → editor highlights its occurrences (V1.3 focus)
// =================================================================

test('Scene Navigator Tags v1.1 — click entity row → editor lights up its occurrences', async () => {
  const { app, page, userDataDir } = await launchApp('scene-nav-tags-focus-');
  try {
    await seedSceneText(page);
    await selectOccurrence(page, 'NALI', 0);
    await tagSelectionViaToolbar(page, 'character');
    await selectOccurrence(page, 'NALI', 1);
    await tagSelectionViaToolbar(page, 'character');

    await openNavigatorAndExpandScene(page);

    await selectOccurrence(page, 'CUT', 0);   // park cursor away to prove no jump
    const before = await page.evaluate(() => window.Rga.TabManager._editorView().state.selection.from);

    await page.evaluate(() => {
      const host = window.Rga.Shell.Sidebar.getHost();
      const nali = Array.from(host.querySelectorAll('[data-scene-node-id="sc-nav-1"] .rga-shell-scene-navigator-tag-entity'))
        .find((r) => /NALI/.test(r.textContent));
      // Click the NAME (not the chevron) → focus-highlight the entity.
      nali.querySelector('.rga-shell-scene-navigator-tag-entity-name').click();
    });
    await page.waitForFunction(() => document.querySelectorAll('.rga-tag-focus-active').length > 0);

    const result = await page.evaluate(() => ({
      decoCount: window.Rga.TagFocusHighlight._decorations(window.Rga.TabManager._editorView().state).length,
      domCount:  document.querySelectorAll('.rga-tag-focus-active').length,
      cursor:    window.Rga.TabManager._editorView().state.selection.from
    }));
    expect(result.decoCount).toBe(2);
    expect(result.domCount).toBe(2);
    expect(result.cursor).toBe(before);   // entity focus did NOT jump the editor
    await page.screenshot({ path: shotPath('04-entity-focus-highlight.png') });
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 4. RTL — tag intelligence renders + mirrors; counts + snippets work
// =================================================================

// Seed an RTL scene with Arabic action text so C8 (Naskh snippet font) and
// the RTL label/tracking polish are genuinely witnessed — matching the
// mysterious-guest-rtl.rga profile, not Latin-in-RTL.
async function seedArabicScene(page) {
  await page.evaluate(() => {
    const view = window.Rga.TabManager._editorView();
    const schema = view.state.schema;
    const heading = schema.nodes.sceneHeading.create({ setting: 'INT.', time: 'NIGHT', headingStyle: null },
      schema.text('غرفة المعيشة'));
    const action = schema.nodes.action.create(null,
      schema.text('تجلس الأم في زاوية الحمّام، تحمل المخلوق الصغير. تبتسم الأم بهدوء.'));
    const transition = schema.nodes.transition.create({ presetType: 'CUT' }, schema.text('CUT'));
    const scene = schema.nodes.scene.create(
      { id: 'sc-nav-1', notes: '', revisionFlag: null,
        metadata: { linkedScenes: [], references: [], production: {} } },
      [heading, action, transition]);
    let bodyPos = null;
    view.state.doc.descendants(function(node, pos) {
      if (node.type.name === 'body') { bodyPos = pos; return false; }
      return true;
    });
    const insertAt = bodyPos + view.state.doc.nodeAt(bodyPos).nodeSize - 1;
    view.dispatch(view.state.tr.insert(insertAt, scene));
  });
}

test('Scene Navigator Tags v1.1 — RTL: Naskh snippets, mirrored layout, active entity', async () => {
  const { app, page, userDataDir } = await launchApp('scene-nav-tags-rtl-');
  try {
    await page.evaluate(() => {
      const doc = window.Rga.TabManager.activeDoc();
      doc.metadata.screenplayProfile = { direction: 'rtl' };
    });
    await seedArabicScene(page);
    // Tag both occurrences of الأم (the mother) via the real toolbar.
    await selectOccurrence(page, 'الأم', 0);
    await tagSelectionViaToolbar(page, 'character');
    await selectOccurrence(page, 'الأم', 1);
    await tagSelectionViaToolbar(page, 'character');

    await openNavigatorAndExpandScene(page);

    const rtl = await page.evaluate(() => {
      const host = window.Rga.Shell.Sidebar.getHost();
      const wrapper = host.querySelector('.rga-shell-scene-navigator');
      const ent = host.querySelector('[data-scene-node-id="sc-nav-1"] .rga-shell-scene-navigator-tag-entity');
      return {
        dir:   wrapper ? wrapper.getAttribute('dir') : null,
        count: ent ? ent.querySelector('.rga-shell-scene-navigator-tag-entity-count').textContent : null
      };
    });
    expect(rtl.dir).toBe('rtl');
    expect(rtl.count).toBe('·2');

    // Expand the entity → Naskh snippets render under RTL.
    await page.evaluate(() => {
      const host = window.Rga.Shell.Sidebar.getHost();
      const ent = host.querySelector('[data-scene-node-id="sc-nav-1"] .rga-shell-scene-navigator-tag-entity');
      ent.querySelector('.rga-shell-scene-navigator-tag-entity-chevron').click();
    });
    await page.waitForFunction(() => {
      const host = window.Rga.Shell.Sidebar.getHost();
      return host.querySelectorAll('[data-scene-node-id="sc-nav-1"] .rga-shell-scene-navigator-tag-occurrence').length === 2;
    });
    // C8 — the occurrence snippet uses the RTL editor (Naskh) font family.
    const occFont = await page.evaluate(() => {
      const host = window.Rga.Shell.Sidebar.getHost();
      const occ = host.querySelector('[data-scene-node-id="sc-nav-1"] .rga-shell-scene-navigator-tag-occurrence');
      return getComputedStyle(occ).fontFamily;
    });
    expect(occFont).toMatch(/Naskh/i);
    await page.screenshot({ path: shotPath('05-rtl-scene-expanded.png') });

    // Click the entity row → RTL active-entity cue (washed row + start-bar).
    await page.evaluate(() => {
      const host = window.Rga.Shell.Sidebar.getHost();
      const ent = host.querySelector('[data-scene-node-id="sc-nav-1"] .rga-shell-scene-navigator-tag-entity');
      ent.querySelector('.rga-shell-scene-navigator-tag-entity-name').click();
    });
    await page.waitForFunction(() => {
      const host = window.Rga.Shell.Sidebar.getHost();
      return !!host.querySelector('[data-scene-node-id="sc-nav-1"] .rga-shell-scene-navigator-tag-entity.is-active');
    });
    await page.screenshot({ path: shotPath('06-rtl-active-entity.png') });
  } finally {
    await teardown(app, userDataDir);
  }
});
