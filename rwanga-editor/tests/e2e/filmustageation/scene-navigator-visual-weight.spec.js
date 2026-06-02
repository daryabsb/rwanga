// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Scene Navigator visual-weight polish — focused computed-style confirmation.
// CSS-only change (shell.css). Verifies the applied presentation values:
//   1. Chevron is visible at rest (opacity > 0) — no longer hover-only.
//   2. Scene titles carry more weight (heading font-weight 500).
//   3. Rows have hairline separation (border-bottom present).
//   4. Expanded marks read as secondary (italic).
//   5. Density preserved (row height stays compact).
// Functional behaviour is covered by the unit suites (no JS changed).
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os   = require('os');
const fs   = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');

async function launchApp() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sn-visual-weight-'));
  const app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(
    window.Rga && window.Rga.Shell && window.Rga.Shell.Sidebar &&
    window.Rga.Shell.SceneNavigator && window.Rga.ScriptSession));
  await page.waitForFunction(() =>
    window.Rga.Shell.Sidebar.current() === 'sceneNavigator', null, { timeout: 5000 });
  return { app, page, userDataDir };
}

async function teardown(app, userDataDir) {
  try { await app.close(); } catch (_) {}
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
}

async function seed(page) {
  return page.evaluate(() => {
    const scenes = [
      { nodeId: 'sc-1', sceneNumber: 1, pmPos: 0,   pmEndPos: 100, headingDisplay: 'INT. KITCHEN — DAY',  hasNotes: false, hasRevisionFlag: false },
      { nodeId: 'sc-2', sceneNumber: 2, pmPos: 100, pmEndPos: 200, headingDisplay: 'EXT. STREET — NIGHT', hasNotes: true,  hasRevisionFlag: true  }
    ];
    const fakeIndex = { scenes: scenes, pages: [], characters: [], tags: {}, notes: [], flags: [] };
    window.Rga.Nav.getIndex = function() { return fakeIndex; };
    window.Rga.Shell.SceneNavigator._render();
  });
}

test('SN visual-weight — chevron visible at rest, titles heavier, rows separated, marks italic, density kept', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    await seed(page);

    // Expand the marked row so the marks zone renders.
    await page.locator('.rga-shell-scene-navigator-row[data-scene-node-id="sc-2"] .rga-shell-scene-navigator-chevron').click();

    const styles = await page.evaluate(() => {
      const q = (sel) => document.querySelector(sel);
      const cs = (el) => (el ? getComputedStyle(el) : null);
      const row1 = q('.rga-shell-scene-navigator-row[data-scene-node-id="sc-1"]');
      const heading1 = q('.rga-shell-scene-navigator-row[data-scene-node-id="sc-1"] .rga-shell-scene-navigator-heading');
      const chevron = q('.rga-shell-scene-navigator-row[data-scene-node-id="sc-2"] .rga-shell-scene-navigator-chevron');
      const mark = q('.rga-shell-scene-navigator-row[data-scene-node-id="sc-2"] .rga-shell-scene-navigator-mark');
      return {
        chevronPresent:     !!chevron,
        chevronOpacity:     chevron ? parseFloat(cs(chevron).opacity) : null,
        headingWeight:      heading1 ? cs(heading1).fontWeight : null,
        rowBorderBottomW:   row1 ? cs(row1).borderBottomWidth : null,
        rowBorderBottomSty: row1 ? cs(row1).borderBottomStyle : null,
        markPresent:        !!mark,
        markFontStyle:      mark ? cs(mark).fontStyle : null,
        rowHeight:          row1 ? Math.round(row1.getBoundingClientRect().height) : null
      };
    });

    // 1. Chevron visible at rest (not hovered) — opacity clearly above zero.
    expect(styles.chevronPresent).toBe(true);
    expect(styles.chevronOpacity).toBeGreaterThan(0.4);

    // 2. Scene titles carry more weight.
    expect(styles.headingWeight).toBe('500');

    // 3. Hairline row separation present.
    expect(styles.rowBorderBottomSty).toBe('solid');
    expect(parseFloat(styles.rowBorderBottomW)).toBeGreaterThanOrEqual(1);

    // 4. Expanded mark reads as secondary (italic).
    expect(styles.markPresent).toBe(true);
    expect(styles.markFontStyle).toBe('italic');

    // 5. Density preserved — rows stay compact (not card-sized).
    expect(styles.rowHeight).toBeGreaterThanOrEqual(28);
    expect(styles.rowHeight).toBeLessThanOrEqual(34);
  } finally {
    await teardown(app, userDataDir);
  }
});
