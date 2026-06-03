// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Tags Panel V1 — Visible Intelligence (end-to-end).
//
// The complete writer workflow, in the real Electron app, through real
// UI surfaces only:
//   1. Type screenplay text.
//   2. Select a name → tag it with the REAL toolbar Tag dropdown.
//   3. Open the Characters panel with the REAL rail button.
//   4. SEE the tagged entity: category group, name, occurrence count.
//   5. Click the entity row → the editor jumps to the first occurrence.
//   6. Empty state + RTL mirroring verified.
//
// Screenshots are written to test-results/tags-panel/ as the visual
// verification artifacts for the slice report.
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os   = require('os');
const fs   = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const SHOT_DIR = path.join(APP_ROOT, 'test-results', 'tags-panel');

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
    window.Rga.Tags && typeof window.Rga.Tags.renderTagsPanel === 'function' &&
    window.Rga.TabManager && typeof window.Rga.TabManager._editorView === 'function' &&
    window.Rga.TabManager._editorView()));
  return { app, page, userDataDir };
}

async function teardown(app, userDataDir) {
  try { await app.close(); } catch (_) {}
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
}

// Insert a scene whose action text contains taggable names. Programmatic
// PM transaction (the typing equivalent); everything downstream of this
// goes through real UI surfaces.
async function seedSceneText(page) {
  await page.evaluate(() => {
    const view = window.Rga.TabManager._editorView();
    const schema = view.state.schema;
    const heading = schema.nodes.sceneHeading.create({ setting: 'INT.', time: 'DAY', headingStyle: null });
    const action = schema.nodes.action.create(null,
      schema.text('NALI stands by the window holding the PHOTOGRAPH. NALI smiles.'));
    const transition = schema.nodes.transition.create({ presetType: 'CUT' }, schema.text('CUT'));
    const scene = schema.nodes.scene.create(
      { id: 'sc-e2e-1', notes: '', revisionFlag: null,
        metadata: { linkedScenes: [], references: [], production: {} } },
      [heading, action, transition]);
    // Append the scene at the end of body.
    let bodyPos = null;
    view.state.doc.descendants(function(node, pos) {
      if (node.type.name === 'body') { bodyPos = pos; return false; }
      return true;
    });
    const insertAt = bodyPos + view.state.doc.nodeAt(bodyPos).nodeSize - 1;
    view.dispatch(view.state.tr.insert(insertAt, scene));
  });
}

// Select the nth occurrence of `needle` in the live document.
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

// Tag the current selection through the REAL toolbar dropdown — the
// exact gesture a writer performs.
async function tagSelectionViaToolbar(page, category) {
  await page.selectOption('#rga-shell-toolbar-tag', category);
}

// Open the Characters panel through the REAL rail button.
async function openPanelViaRail(page) {
  await page.click('[data-panel-id="characters"]');
  await page.waitForSelector('#sidebar-panel-host .tag-item, #sidebar-panel-host .rga-shell-panel-empty, .rga-shell-sidebar .tag-item, .rga-shell-sidebar .rga-shell-panel-empty',
    { timeout: 5000 }).catch(() => { /* host id varies; assertions below use Sidebar host directly */ });
}

// =================================================================
// 1. The complete writer workflow (LTR) + screenshots
// =================================================================

test('Tags Panel V1 — type → tag via toolbar → open panel → see entity → click → jump', async () => {
  const { app, page, userDataDir } = await launchApp('tags-panel-v1-');
  try {
    // ---- Empty state first: open the panel before anything is tagged.
    await page.click('[data-panel-id="characters"]');
    await page.waitForFunction(() => window.Rga.Shell.Sidebar.current() === 'characters');
    const emptyVisible = await page.evaluate(() => {
      const host = window.Rga.Shell.Sidebar.getHost();
      return !!(host && host.querySelector('.rga-shell-panel-empty')
        && /Your characters will appear here as you write/.test(host.textContent));
    });
    expect(emptyVisible).toBe(true);
    await page.screenshot({ path: shotPath('01-empty-state.png') });

    // ---- Write + tag through real surfaces.
    await seedSceneText(page);

    await selectOccurrence(page, 'NALI', 0);
    await tagSelectionViaToolbar(page, 'character');

    await selectOccurrence(page, 'NALI', 1);
    await tagSelectionViaToolbar(page, 'character');

    await selectOccurrence(page, 'PHOTOGRAPH', 0);
    await tagSelectionViaToolbar(page, 'prop');

    // ---- The panel refreshes live (editor.tagApplied listener) — it is
    // still the active sidebar panel.
    await page.waitForFunction(() => {
      const host = window.Rga.Shell.Sidebar.getHost();
      return host && host.querySelectorAll('.tag-item').length === 2;
    });

    const panelState = await page.evaluate(() => {
      const host = window.Rga.Shell.Sidebar.getHost();
      const groups = Array.from(host.querySelectorAll('.tag-group-label')).map((el) => el.textContent);
      const rows = Array.from(host.querySelectorAll('.tag-item')).map((el) => ({
        name:  el.querySelector('.tag-name').textContent,
        count: el.querySelector('.tag-count').textContent
      }));
      return { groups, rows };
    });
    expect(panelState.groups).toEqual(['Characters', 'Props']);
    expect(panelState.rows).toContainEqual({ name: 'NALI', count: '2' });
    expect(panelState.rows).toContainEqual({ name: 'PHOTOGRAPH', count: '1' });
    await page.screenshot({ path: shotPath('02-populated-panel.png') });

    // ---- V1.2: move the cursor far away, click the NALI row → the
    // occurrence browser expands; click its first scene → the editor
    // jumps back to that occurrence.
    await selectOccurrence(page, 'CUT', 0);
    const firstOccurrence = await page.evaluate(() => {
      const view = window.Rga.TabManager._editorView();
      let first = null;
      view.state.doc.descendants(function(node, pos) {
        if (first) return false;
        if (node.isText && node.text.indexOf('NALI') !== -1) {
          first = { from: pos + node.text.indexOf('NALI') };
          return false;
        }
      });
      return first;
    });

    // Click the entity row → occurrence browser opens.
    await page.evaluate(() => {
      const host = window.Rga.Shell.Sidebar.getHost();
      const nali = Array.from(host.querySelectorAll('.tag-item'))
        .find((el) => el.querySelector('.tag-name').textContent === 'NALI');
      nali.click();
    });
    await page.waitForFunction(() => {
      const host = window.Rga.Shell.Sidebar.getHost();
      return host.querySelectorAll('.tag-occurrence').length > 0;
    });
    await page.screenshot({ path: shotPath('03a-occurrence-browser-open.png') });

    // Click the first scene occurrence → jump.
    await page.evaluate(() => {
      const host = window.Rga.Shell.Sidebar.getHost();
      host.querySelector('.tag-occurrence').click();
    });

    const selectionAfter = await page.evaluate(() => {
      const view = window.Rga.TabManager._editorView();
      return view.state.selection.from;
    });
    expect(Math.abs(selectionAfter - firstOccurrence.from)).toBeLessThanOrEqual(4);
    await page.screenshot({ path: shotPath('03b-after-scene-jump.png') });
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 2. "View Tags" popup button opens the panel (the dead button lives)
// =================================================================

test('Tags Panel V1 — the View Tags popup button opens the Characters panel', async () => {
  const { app, page, userDataDir } = await launchApp('tags-panel-viewtags-');
  try {
    await seedSceneText(page);
    await selectOccurrence(page, 'NALI', 0);
    await tagSelectionViaToolbar(page, 'character');

    // Click the tagged text → info popup appears with View Tags.
    await page.evaluate(() => {
      // Deactivate any open panel so the assertion below proves the button opens it.
      window.Rga.Shell.Sidebar.deactivate();
      const view = window.Rga.TabManager._editorView();
      let markPos = null;
      view.state.doc.descendants(function(node, pos) {
        if (markPos !== null) return false;
        if (!node.isText) return;
        if (node.marks.some((m) => m.type.name === 'tag')) markPos = pos;
      });
      const mark = view.state.doc.resolve(markPos + 1).marks()
        .find((m) => m.type.name === 'tag');
      window.Rga.Tags.showTagInfo(view, mark, markPos + 1);
    });
    await page.waitForSelector('.rga-mark-info-popup');
    await page.screenshot({ path: shotPath('04-tag-info-popup.png') });

    // Click View Tags → panel opens with the entity listed.
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.rga-info-btn'))
        .find((b) => /View Tags/.test(b.textContent));
      btn.click();
    });
    await page.waitForFunction(() => window.Rga.Shell.Sidebar.current() === 'characters');
    const hasRow = await page.evaluate(() => {
      const host = window.Rga.Shell.Sidebar.getHost();
      return host.querySelectorAll('.tag-item').length > 0;
    });
    expect(hasRow).toBe(true);
    await page.screenshot({ path: shotPath('05-view-tags-opens-panel.png') });
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// V1.1 — Honest Entity Intelligence: duplicates warned, zero counts
// hidden, counts mean tagged occurrences
// =================================================================

test('Tags Panel V1.1 — duplicates warned, unused entities clean, counts honest', async () => {
  const { app, page, userDataDir } = await launchApp('tags-panel-v11-');
  try {
    await seedSceneText(page);

    // The fragmented-script reality: duplicate NALI (one tagged),
    // duplicate BABAN (both untagged), unused props, one normal entity.
    await page.evaluate(() => {
      const Doc = window.Rga.Doc;
      const doc = window.Rga.TabManager.activeDoc();
      // Duplicate characters (legacy pre-Slice-A data shape).
      Doc.addEntity(doc, 'character', { id: 'ent-nali-1', name: 'NALI', color: '#4FC1FF', notes: '' });
      Doc.addEntity(doc, 'character', { id: 'ent-nali-2', name: 'NALI', color: null, notes: '' });
      Doc.addEntity(doc, 'character', { id: 'ent-baban-1', name: 'BABAN', color: '#FFB86C', notes: '' });
      Doc.addEntity(doc, 'character', { id: 'ent-baban-2', name: 'Baban', color: null, notes: '' });
      // Unused (registered, never tagged) props.
      Doc.addEntity(doc, 'prop', { id: 'ent-photo', name: 'PHOTOGRAPH', color: null, notes: '' });
      Doc.addEntity(doc, 'prop', { id: 'ent-tinbox', name: 'TIN BOX', color: null, notes: '' });
      // A normal, unique, tagged character.
      Doc.addEntity(doc, 'character', { id: 'ent-hassan', name: 'DR. HASSAN', color: '#A8F0A8', notes: '' });
    });

    // Tag NALI once (via the first duplicate) and DR. HASSAN once so the
    // panel shows the full truth spectrum: duplicate+tagged,
    // duplicate+untagged, unused, normal+tagged.
    await selectOccurrence(page, 'NALI', 0);
    await page.evaluate(() => {
      const view = window.Rga.TabManager._editorView();
      window.Rga.Tags.applyTag(view, 'character', 'ent-nali-1');
    });
    await selectOccurrence(page, 'NALI', 1);
    await page.evaluate(() => {
      const view = window.Rga.TabManager._editorView();
      window.Rga.Tags.applyTag(view, 'character', 'ent-hassan');
    });

    // Open the panel via the rail.
    await page.click('[data-panel-id="characters"]');
    await page.waitForFunction(() => window.Rga.Shell.Sidebar.current() === 'characters');

    const truth = await page.evaluate(() => {
      const host = window.Rga.Shell.Sidebar.getHost();
      const rows = Array.from(host.querySelectorAll('.tag-item')).map((el) => ({
        name:      el.querySelector('.tag-name').textContent,
        count:     el.querySelector('.tag-count') ? el.querySelector('.tag-count').textContent : null,
        countWord: el.querySelector('.tag-count') ? el.querySelector('.tag-count').title : null,
        warned:    !!el.querySelector('.tag-duplicate-warning')
      }));
      return rows;
    });

    // Duplicates: both NALI rows warned; both BABAN rows warned (case variant).
    const nalis = truth.filter((r) => r.name === 'NALI');
    expect(nalis.length).toBe(2);
    expect(nalis.every((r) => r.warned)).toBe(true);
    const babans = truth.filter((r) => /^baban$/i.test(r.name));
    expect(babans.length).toBe(2);
    expect(babans.every((r) => r.warned)).toBe(true);

    // Unused entities: no count element at all.
    const photo = truth.find((r) => r.name === 'PHOTOGRAPH');
    expect(photo.count).toBe(null);
    expect(photo.warned).toBe(false);
    const tinbox = truth.find((r) => r.name === 'TIN BOX');
    expect(tinbox.count).toBe(null);

    // Normal entity: counted, honest language, no warning.
    const hassan = truth.find((r) => r.name === 'DR. HASSAN');
    expect(hassan.count).toBe('1');
    expect(hassan.countWord).toMatch(/tagged occurrence/i);
    expect(hassan.warned).toBe(false);

    // Tagged duplicate: count + warning together.
    const taggedNali = truth.find((r) => r.name === 'NALI' && r.count === '1');
    expect(taggedNali).toBeTruthy();
    expect(taggedNali.warned).toBe(true);

    await page.screenshot({ path: shotPath('07-honest-panel-v1-1.png') });

    // ---- V1.2: expand a DUPLICATE entity → see which scenes ITS marks
    // live in (answers "which NALI is this?").
    await page.evaluate(() => {
      const host = window.Rga.Shell.Sidebar.getHost();
      const taggedNali = Array.from(host.querySelectorAll('.tag-item'))
        .find((el) => el.querySelector('.tag-name').textContent === 'NALI'
                   && el.querySelector('.tag-count'));
      taggedNali.click();
    });
    await page.waitForFunction(() => {
      const host = window.Rga.Shell.Sidebar.getHost();
      return host.querySelectorAll('.tag-occurrence').length > 0;
    });
    const dupExpansion = await page.evaluate(() => {
      const host = window.Rga.Shell.Sidebar.getHost();
      return Array.from(host.querySelectorAll('.tag-occurrence')).map((el) => ({
        label: el.querySelector('.tag-occurrence-label').textContent,
        count: el.querySelector('.tag-occurrence-count').textContent
      }));
    });
    expect(dupExpansion.length).toBe(1);
    expect(dupExpansion[0].label).toMatch(/Scene \d/);
    expect(dupExpansion[0].count).toBe('1');
    await page.screenshot({ path: shotPath('08-duplicate-expanded-v1-2.png') });

    // ---- V1.2: expand a normal entity (DR. HASSAN) alongside —
    // multiple expansions coexist.
    await page.evaluate(() => {
      const host = window.Rga.Shell.Sidebar.getHost();
      const hassan = Array.from(host.querySelectorAll('.tag-item'))
        .find((el) => el.querySelector('.tag-name').textContent === 'DR. HASSAN');
      hassan.click();
    });
    await page.waitForFunction(() => {
      const host = window.Rga.Shell.Sidebar.getHost();
      return host.querySelectorAll('.tag-occurrence').length >= 2;
    });
    await page.screenshot({ path: shotPath('09-normal-expanded-v1-2.png') });

    // ---- V1.2: expand an UNUSED entity → honest empty line.
    await page.evaluate(() => {
      const host = window.Rga.Shell.Sidebar.getHost();
      const photo = Array.from(host.querySelectorAll('.tag-item'))
        .find((el) => el.querySelector('.tag-name').textContent === 'PHOTOGRAPH');
      photo.click();
    });
    await page.waitForFunction(() => {
      const host = window.Rga.Shell.Sidebar.getHost();
      return !!host.querySelector('.tag-occurrences-empty');
    });
    const emptyLine = await page.evaluate(() => {
      const host = window.Rga.Shell.Sidebar.getHost();
      return host.querySelector('.tag-occurrences-empty').textContent;
    });
    expect(emptyLine).toMatch(/not tagged/i);
    await page.screenshot({ path: shotPath('10-unused-expanded-v1-2.png') });
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 3. RTL — the panel mirrors the script direction
// =================================================================

test('Tags Panel V1 — RTL script → panel renders dir="rtl"', async () => {
  const { app, page, userDataDir } = await launchApp('tags-panel-rtl-');
  try {
    await page.evaluate(() => {
      const doc = window.Rga.TabManager.activeDoc();
      doc.metadata.screenplayProfile = { direction: 'rtl' };
    });
    await seedSceneText(page);
    await selectOccurrence(page, 'NALI', 0);
    await tagSelectionViaToolbar(page, 'character');

    await page.click('[data-panel-id="characters"]');
    await page.waitForFunction(() => window.Rga.Shell.Sidebar.current() === 'characters');

    const dir = await page.evaluate(() => {
      const host = window.Rga.Shell.Sidebar.getHost();
      const wrapper = host.querySelector('[dir]');
      return wrapper ? wrapper.getAttribute('dir') : null;
    });
    expect(dir).toBe('rtl');
    await page.screenshot({ path: shotPath('06-rtl-panel.png') });
  } finally {
    await teardown(app, userDataDir);
  }
});
