// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Filmustageation SN-Bundle-1 — Scenes Sidebar Catalogue header + empty
// state + find/filter foundation.
//
// Coverage (per slice brief):
//   1. Header renders count when scenes exist.
//   2. Empty-state copy is doc-type-neutral.
//   3. Find filters by heading (substring, case-insensitive).
//   4. Find filters by scene number.
//   5. No-results state renders with query echo + Clear affordance.
//   6. Clear restores the full list.
//   7. Escape precedence — filter first, then selection.
//   8. SEPARATION INVARIANT (current vs selected) holds under filter.
//   9. SN.1 auto-scroll re-fires after a Clear.
//  10. SN.2 indicators still render on rows post-Bundle-1.
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os   = require('os');
const fs   = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');

async function launchApp() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sn-bundle1-'));
  const app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(
    window.Rga && window.Rga.Shell && window.Rga.Shell.Sidebar &&
    window.Rga.Shell.SceneNavigator &&
    window.Rga.Icons && window.Rga.Icons.Lucide &&
    window.Rga.ScriptSession && typeof window.Rga.ScriptSession.get === 'function'));
  await page.waitForFunction(() =>
    window.Rga.Shell.Sidebar.current() === 'sceneNavigator', null, { timeout: 5000 });
  return { app, page, userDataDir };
}

async function teardown(app, userDataDir) {
  try { await app.close(); } catch (_) {}
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
}

// Seed a known fixture and force a re-render. Filter state is reset on
// every seed so each test starts from the unfiltered baseline.
async function seedScenes(page, count, opts) {
  return page.evaluate(({ count, opts }) => {
    const scenes = [];
    const headings = opts && opts.headings ? opts.headings : null;
    for (let i = 0; i < count; i += 1) {
      const heading = headings && headings[i]
        ? headings[i]
        : 'INT. LOCATION ' + (i + 1) + ' — DAY';
      const sceneNum = (opts && opts.sceneNumbers) ? opts.sceneNumbers[i] : (i + 1);
      scenes.push({
        nodeId:               'sc-' + i,
        sceneNumber:          sceneNum,
        pmPos:                i * 100,
        pmEndPos:             i * 100 + 100,
        headingDisplay:       heading,
        setting:              'INT.',
        locationText:         'LOCATION ' + (i + 1),
        time:                 'DAY',
        transitionDisplay:    '',
        transitionPresetType: null,
        blockCount:           5,
        hasNotes:             !!(opts && opts.indicatorsAt && opts.indicatorsAt[i] && opts.indicatorsAt[i].hasNotes),
        hasRevisionFlag:      !!(opts && opts.indicatorsAt && opts.indicatorsAt[i] && opts.indicatorsAt[i].hasRevisionFlag)
      });
    }
    const fakeIndex = { scenes: scenes, pages: [], characters: [], tags: {}, notes: [], flags: [] };
    window.__rgaNavOriginal = window.Rga.Nav.getIndex;
    window.Rga.Nav.getIndex = function() { return fakeIndex; };
    window.Rga.Shell.SceneNavigator._render();
    return { sceneCount: scenes.length };
  }, { count, opts: opts || {} });
}

async function typeFind(page, text) {
  // Clear then type — JSDOM-free path uses Playwright's keyboard.
  await page.focus('.rga-shell-scene-navigator-find-input');
  await page.fill('.rga-shell-scene-navigator-find-input', text);
}

// =================================================================
// 1. Header renders count when scenes exist.
// =================================================================

test('SN-Bundle-1 — header renders "Scenes" + count when scenes exist', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    await seedScenes(page, 7);
    const header = page.locator('.rga-shell-scene-navigator-section-header');
    await expect(header).toHaveCount(1);
    await expect(header.locator('.rga-shell-scene-navigator-section-header-label')).toHaveText('Scenes');
    await expect(header.locator('.rga-shell-scene-navigator-section-header-count')).toHaveText(' · 7');
    // No buttons in the header — identity + count only.
    await expect(header.locator('button')).toHaveCount(0);
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 2. Empty-state copy is doc-type-neutral (no header, no find).
// =================================================================

test('SN-Bundle-1 — true-empty state renders refreshed doc-neutral copy without header or find', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    await seedScenes(page, 0);
    const empty = page.locator('.rga-shell-panel-empty');
    await expect(empty).toHaveCount(1);
    await expect(empty.locator('.rga-shell-panel-empty-title')).toHaveText('Scenes');
    await expect(empty.locator('.rga-shell-panel-empty-body'))
      .toHaveText('Scenes will appear here as you write.');
    // True empty hides header + find so the calm empty surface owns identity.
    await expect(page.locator('.rga-shell-scene-navigator-section-header')).toHaveCount(0);
    await expect(page.locator('.rga-shell-scene-navigator-find-input')).toHaveCount(0);
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 3. Find filters by heading (substring, case-insensitive).
// =================================================================

test('SN-Bundle-1 — find filters by heading substring, case-insensitive', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    await seedScenes(page, 5, {
      headings: [
        'INT. KITCHEN — DAY',
        'EXT. ROOFTOP — NIGHT',
        'INT. CAFÉ — DAY',
        'EXT. STREET — NIGHT',
        'INT. KITCHEN — NIGHT'
      ]
    });
    await typeFind(page, 'kitchen');
    const rows = page.locator('.rga-shell-scene-navigator-row');
    await expect(rows).toHaveCount(2);
    // Case-insensitive: 'kitchen' matches 'KITCHEN'.
    const ids = await rows.evaluateAll(rs => rs.map(r => r.getAttribute('data-scene-node-id')));
    expect(ids.sort()).toEqual(['sc-0', 'sc-4']);
    // Header count remains the unfiltered total.
    await expect(page.locator('.rga-shell-scene-navigator-section-header-count'))
      .toHaveText(' · 5');
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 4. Find filters by scene number.
// =================================================================

test('SN-Bundle-1 — find filters by scene number string', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    await seedScenes(page, 5, { sceneNumbers: [1, 12, 22, 30, 121] });
    await typeFind(page, '12');
    const rows = page.locator('.rga-shell-scene-navigator-row');
    // '12' matches '12' and '121' (substring on number string).
    await expect(rows).toHaveCount(2);
    const ids = await rows.evaluateAll(rs => rs.map(r => r.getAttribute('data-scene-node-id')));
    expect(ids.sort()).toEqual(['sc-1', 'sc-4']);
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 5. No-results state renders with query echo + Clear affordance.
// =================================================================

test('SN-Bundle-1 — no-results surface renders with query echo + Clear button', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    await seedScenes(page, 3);
    await typeFind(page, 'xyz-impossible');
    // No rows.
    await expect(page.locator('.rga-shell-scene-navigator-row')).toHaveCount(0);
    // Unified empty-panel surface used.
    const empty = page.locator('.rga-shell-panel-empty');
    await expect(empty).toHaveCount(1);
    await expect(empty.locator('.rga-shell-panel-empty-title')).toHaveText('No scenes found');
    // Query echoed in the body.
    const bodyText = await empty.locator('.rga-shell-panel-empty-body').textContent();
    expect(bodyText).toContain('xyz-impossible');
    // Clear affordance present.
    const clearBtn = empty.locator('.rga-shell-panel-empty-action');
    await expect(clearBtn).toHaveCount(1);
    await expect(clearBtn).toHaveText('Clear');
    // Header + find input persist through the no-results state.
    await expect(page.locator('.rga-shell-scene-navigator-section-header')).toHaveCount(1);
    await expect(page.locator('.rga-shell-scene-navigator-find-input')).toHaveCount(1);
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 6. Clear restores the full list.
// =================================================================

test('SN-Bundle-1 — Clear button restores full list and clears find input', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    await seedScenes(page, 3);
    await typeFind(page, 'nothing-matches');
    await expect(page.locator('.rga-shell-scene-navigator-row')).toHaveCount(0);
    await page.locator('.rga-shell-panel-empty-action').click();
    await expect(page.locator('.rga-shell-scene-navigator-row')).toHaveCount(3);
    const inputValue = await page.locator('.rga-shell-scene-navigator-find-input').inputValue();
    expect(inputValue).toBe('');
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 7. Escape precedence — filter first, then selection.
// =================================================================

test('SN-Bundle-1 — Escape precedence: filter has text → first Escape clears filter, not selection', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    await seedScenes(page, 3, {
      headings: [
        'INT. KITCHEN — DAY',
        'EXT. ROOFTOP — NIGHT',
        'INT. STREET — DAY'
      ]
    });
    // Keyboard-select scene 0 (focusRow is the cross-panel API that
    // selects without moving the editor cursor).
    await page.evaluate(() => window.Rga.Shell.SceneNavigator.focusRow('sc-1'));
    await typeFind(page, 'STREET');
    // Escape on the input — should clear filter, NOT selection.
    await page.focus('.rga-shell-scene-navigator-find-input');
    await page.keyboard.press('Escape');
    const inputAfter = await page.locator('.rga-shell-scene-navigator-find-input').inputValue();
    expect(inputAfter).toBe('');
    const selectedAfter = await page.evaluate(() =>
      window.Rga.Shell.SceneNavigator.selectedRowNodeId());
    expect(selectedAfter).toBe('sc-1');
    // Second Escape — filter is empty now, so selection clears.
    await page.focus('.rga-shell-scene-navigator-find-input');
    await page.keyboard.press('Escape');
    const selectedFinal = await page.evaluate(() =>
      window.Rga.Shell.SceneNavigator.selectedRowNodeId());
    expect(selectedFinal).toBeNull();
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 8. SEPARATION INVARIANT holds under filter.
// =================================================================

test('SN-Bundle-1 — current vs selected separation invariant survives a filter', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    await seedScenes(page, 3, {
      headings: [
        'INT. KITCHEN — DAY',
        'EXT. ROOFTOP — NIGHT',
        'INT. STREET — DAY'
      ]
    });
    // Park current on sc-1, keyboard-select sc-2.
    await page.evaluate(() => {
      window.__rgaSessionOriginalGet = window.Rga.ScriptSession.get.bind(window.Rga.ScriptSession);
      const baseSnap = window.__rgaSessionOriginalGet();
      window.Rga.ScriptSession.get = function() {
        return Object.assign({}, baseSnap, {
          currentScene: { nodeId: 'sc-1', sceneNumber: 2, headingDisplay: 'EXT. ROOFTOP — NIGHT' }
        });
      };
      window.Rga.Shell.SceneNavigator._render();
      window.Rga.Shell.SceneNavigator.focusRow('sc-2');
    });
    // Filter includes both (substring 'T' appears in ROOFTOP and STREET).
    await typeFind(page, 'T');
    const state = await page.evaluate(() => {
      const r = (id) => document.querySelector(
        '.rga-shell-scene-navigator-row[data-scene-node-id="' + id + '"]');
      return {
        sc1Current:    r('sc-1') && r('sc-1').classList.contains('rga-shell-scene-navigator-row-current'),
        sc1Selected:   r('sc-1') && r('sc-1').classList.contains('rga-shell-scene-navigator-row-selected'),
        sc2Current:    r('sc-2') && r('sc-2').classList.contains('rga-shell-scene-navigator-row-current'),
        sc2Selected:   r('sc-2') && r('sc-2').classList.contains('rga-shell-scene-navigator-row-selected')
      };
    });
    expect(state.sc1Current).toBe(true);
    expect(state.sc1Selected).toBe(false);
    expect(state.sc2Current).toBe(false);
    expect(state.sc2Selected).toBe(true);
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 9. SN.1 auto-scroll re-fires after a Clear.
// =================================================================

test('SN-Bundle-1 — SN.1 auto-scroll re-fires after a Clear when current was filtered out', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    await seedScenes(page, 20, {
      headings: Array.from({ length: 20 }, (_, i) =>
        i === 5 ? 'INT. CURRENT SCENE — DAY' : 'EXT. LOCATION ' + (i + 1) + ' — NIGHT')
    });
    // Install scroll spy AFTER seeding so initial mount isn't measured.
    await page.evaluate(() => {
      window.__sn1Calls = [];
      window.Element.prototype.scrollIntoView = function(opts) {
        window.__sn1Calls.push({
          isCurrent: this.classList && this.classList.contains('rga-shell-scene-navigator-row-current'),
          opts: opts || {}
        });
      };
    });
    // Park current on sc-5 (the "CURRENT SCENE" row).
    await page.evaluate(() => {
      window.__rgaSessionOriginalGet = window.Rga.ScriptSession.get.bind(window.Rga.ScriptSession);
      const baseSnap = window.__rgaSessionOriginalGet();
      window.Rga.ScriptSession.get = function() {
        return Object.assign({}, baseSnap, {
          currentScene: { nodeId: 'sc-5', sceneNumber: 6, headingDisplay: 'INT. CURRENT SCENE — DAY' }
        });
      };
      window.Rga.Shell.SceneNavigator._render();
    });
    const afterCurrentSet = await page.evaluate(() =>
      (window.__sn1Calls || []).filter(c => c.opts && c.opts.behavior === 'auto' && c.isCurrent).length);
    expect(afterCurrentSet).toBeGreaterThanOrEqual(1);
    // Filter to exclude the current row.
    await typeFind(page, 'LOCATION');
    const filteredCount = await page.evaluate(() =>
      (window.__sn1Calls || []).filter(c => c.opts && c.opts.behavior === 'auto' && c.isCurrent).length);
    expect(filteredCount).toBe(afterCurrentSet);
    // Clear — current returns, SN.1 re-fires.
    await page.fill('.rga-shell-scene-navigator-find-input', '');
    // Trigger an input event manually since .fill('') may not fire input on empty.
    await page.evaluate(() => {
      const input = document.querySelector('.rga-shell-scene-navigator-find-input');
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const finalCount = await page.evaluate(() =>
      (window.__sn1Calls || []).filter(c => c.opts && c.opts.behavior === 'auto' && c.isCurrent).length);
    expect(finalCount).toBeGreaterThan(filteredCount);
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 10. SN.2 indicators still render on rows post-Bundle-1.
// =================================================================

test('SN-Bundle-1 — SN.2 Lucide indicators still render on rows with hasNotes / hasRevisionFlag', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    await seedScenes(page, 2, {
      indicatorsAt: [
        { hasNotes: true,  hasRevisionFlag: false },
        { hasNotes: false, hasRevisionFlag: true  }
      ]
    });
    // Notes row → square-pen SVG.
    const notesInd = page.locator(
      '.rga-shell-scene-navigator-row[data-scene-node-id="sc-0"] .rga-shell-scene-navigator-indicator');
    await expect(notesInd).toHaveCount(1);
    await expect(notesInd).toHaveAttribute('data-icon-name', 'square-pen');
    await expect(notesInd.locator('svg path')).toHaveCount(2);
    // Revision row → flag-triangle-right SVG.
    const revInd = page.locator(
      '.rga-shell-scene-navigator-row[data-scene-node-id="sc-1"] .rga-shell-scene-navigator-indicator');
    await expect(revInd).toHaveCount(1);
    await expect(revInd).toHaveAttribute('data-icon-name', 'flag-triangle-right');
    await expect(revInd.locator('svg path')).toHaveCount(1);
  } finally {
    await teardown(app, userDataDir);
  }
});
