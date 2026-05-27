// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Navigation Fidelity — S5 (Phase 2 visual fidelity, final slice).
//
// Proves the ten S5 assertions against the live Settings workspace:
//   1.  Nav items show an icon (SVG inside .rga-settings-nav-item-icon)
//   2.  Nav items show a title (.rga-settings-nav-item-title text)
//   3.  Nav items show a description (.rga-settings-nav-item-desc text)
//   4.  Active item shows the indicator bar (2px accent left border)
//   5.  Active item background appears (--bg-active token)
//   6.  Hover state appears (different background on mouseover)
//   7.  Reset All exists (.rga-settings-nav-reset-all button)
//   8.  Save absent — no Save button anywhere in the workspace
//   9.  Responsive layout survives narrow widths (700px / 500px)
//  10.  S1 + S2 + S3 + S4 + S6 invariants still hold
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os   = require('os');
const fs   = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');

async function launchAndOpen(userDataDir) {
  const app  = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() =>
    !!(window.Rga && window.Rga.SettingsWorkspace && window.Rga.Settings
       && window.Rga.Settings.Store && window.Rga.Settings.Registry));
  return { app, page };
}

async function openSettings(page) {
  await page.evaluate(() => window.Rga.SettingsWorkspace.open());
  await page.waitForSelector('.rga-settings-workspace .rga-settings-nav-item');
}

async function clearDirtyAndClose(app, page) {
  try {
    await page.evaluate(() => {
      const TM = window.Rga && window.Rga.TabManager;
      const docs = TM ? [TM.activeDoc(), TM.lastActiveDoc && TM.lastActiveDoc()].filter(Boolean) : [];
      docs.forEach((d) => {
        if (window.Rga.Doc && window.Rga.Doc.clearDirty) window.Rga.Doc.clearDirty(d);
        else d.dirty = false;
      });
    });
  } catch (_) {}
  await app.close();
}

// -----------------------------------------------------------------
// 1. Nav items show an icon
// -----------------------------------------------------------------

test('S5 §1 — every nav item renders an SVG icon inside .rga-settings-nav-item-icon', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's5-nav-icon-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettings(page);
    const inv = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.rga-settings-nav-item'));
      return items.map((i) => {
        const iconBox = i.querySelector('.rga-settings-nav-item-icon');
        const svg     = iconBox && iconBox.querySelector('svg');
        return {
          id:       i.getAttribute('data-section-id'),
          hasIconBox: !!iconBox,
          hasSvg:     !!svg
        };
      });
    });
    expect(inv.length).toBeGreaterThan(0);
    inv.forEach((it) => {
      expect(it.hasIconBox).toBe(true);
      expect(it.hasSvg).toBe(true);
    });
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 2. Nav items show a title
// -----------------------------------------------------------------

test('S5 §2 — every nav item shows its section label as the title', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's5-nav-title-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettings(page);
    const inv = await page.evaluate(() => {
      const L = window.Rga.Settings.Layout;
      const map = {};
      L.sections().forEach((s) => { map[s.id] = s.label; });
      return Array.from(document.querySelectorAll('.rga-settings-nav-item')).map((i) => ({
        id: i.getAttribute('data-section-id'),
        titleText: (i.querySelector('.rga-settings-nav-item-title') || {}).textContent,
        expected:  map[i.getAttribute('data-section-id')]
      }));
    });
    expect(inv.length).toBeGreaterThan(0);
    inv.forEach((it) => {
      expect(it.titleText).toBe(it.expected);
    });
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 3. Nav items show a description
// -----------------------------------------------------------------

test('S5 §3 — every nav item shows the section description', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's5-nav-desc-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    // The window has to be wide enough that the responsive @media
    // doesn't hide the description (the < 900px rule collapses it).
    await page.setViewportSize({ width: 1280, height: 800 });
    await openSettings(page);
    const inv = await page.evaluate(() => {
      const L = window.Rga.Settings.Layout;
      const map = {};
      L.sections().forEach((s) => { map[s.id] = s.description; });
      return Array.from(document.querySelectorAll('.rga-settings-nav-item')).map((i) => {
        const desc = i.querySelector('.rga-settings-nav-item-desc');
        const cs   = desc ? getComputedStyle(desc) : null;
        return {
          id:        i.getAttribute('data-section-id'),
          descText:  desc && desc.textContent,
          expected:  map[i.getAttribute('data-section-id')],
          display:   cs && cs.display
        };
      });
    });
    expect(inv.length).toBeGreaterThan(0);
    inv.forEach((it) => {
      expect(it.descText).toBe(it.expected);
      expect(it.display).not.toBe('none');
    });
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 4. Active item shows indicator bar
// -----------------------------------------------------------------

test('S5 §4 — the active nav item carries a 2px accent left border (indicator bar)', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's5-nav-bar-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    // Wide enough that the desktop layout (left border bar) applies.
    await page.setViewportSize({ width: 1280, height: 800 });
    await openSettings(page);
    const inv = await page.evaluate(() => {
      const active = document.querySelector('.rga-settings-nav-item.is-active');
      const inactive = document.querySelector('.rga-settings-nav-item:not(.is-active)');
      const cs = active ? getComputedStyle(active) : null;
      const ci = inactive ? getComputedStyle(inactive) : null;
      return {
        activeBorderLeft:   cs && cs.borderLeftWidth,
        activeBorderStyle:  cs && cs.borderLeftStyle,
        activeBorderColor:  cs && cs.borderLeftColor,
        inactiveBorderColor:ci && ci.borderLeftColor
      };
    });
    expect(inv.activeBorderLeft).toBe('2px');
    expect(inv.activeBorderStyle).toBe('solid');
    // Accent colour: non-transparent and different from the inactive
    // (transparent) value.
    expect(inv.activeBorderColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(inv.activeBorderColor).not.toBe(inv.inactiveBorderColor);
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 5. Active item background appears
// -----------------------------------------------------------------

test('S5 §5 — the active nav item has a distinct background', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's5-nav-bg-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openSettings(page);
    const inv = await page.evaluate(() => {
      const active   = document.querySelector('.rga-settings-nav-item.is-active');
      const inactive = document.querySelector('.rga-settings-nav-item:not(.is-active)');
      return {
        activeBg:   active   && getComputedStyle(active).backgroundColor,
        inactiveBg: inactive && getComputedStyle(inactive).backgroundColor
      };
    });
    // Active background should NOT be transparent...
    expect(inv.activeBg).not.toBe('rgba(0, 0, 0, 0)');
    expect(inv.activeBg).not.toBe('transparent');
    // ...and should differ from the inactive item background.
    expect(inv.activeBg).not.toBe(inv.inactiveBg);
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 6. Hover state appears
// -----------------------------------------------------------------

test('S5 §6 — hovering a non-active nav item changes its background', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's5-nav-hover-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openSettings(page);

    // Read the resting background of an inactive item before hover.
    const restingBg = await page.evaluate(() => {
      const inactive = document.querySelector('.rga-settings-nav-item:not(.is-active)');
      return inactive ? getComputedStyle(inactive).backgroundColor : null;
    });

    // Hover the same item.
    await page.hover('.rga-settings-nav-item:not(.is-active)');
    // Allow the 0.1s transition to settle.
    await page.waitForFunction((rest) => {
      const inactive = document.querySelector('.rga-settings-nav-item:not(.is-active)');
      if (!inactive) return false;
      return getComputedStyle(inactive).backgroundColor !== rest;
    }, restingBg, { timeout: 1000 });

    const hoveredBg = await page.evaluate(() => {
      const inactive = document.querySelector('.rga-settings-nav-item:not(.is-active)');
      return inactive ? getComputedStyle(inactive).backgroundColor : null;
    });
    expect(hoveredBg).not.toBe(restingBg);
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 7. Reset All exists
// -----------------------------------------------------------------

test('S5 §7 — the nav footer carries a working Reset All button', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's5-reset-all-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openSettings(page);

    // Set a non-default user-tier value so Reset All has work to do.
    await page.evaluate(() => window.Rga.Settings.Store.set('theme', 'light'));
    await page.waitForFunction(() =>
      window.Rga.Settings.Store.effective('theme') === 'light');

    // The button must exist with the data-test attr.
    const present = await page.evaluate(() => {
      const b = document.querySelector('[data-test-reset-all]');
      return {
        exists:    !!b,
        textTrim:  b ? b.textContent.trim() : null,
        className: b ? b.className : null
      };
    });
    expect(present.exists).toBe(true);
    expect(present.textTrim).toBe('Reset All');
    expect(present.className).toContain('rga-settings-nav-reset-all');

    // Clicking it restores defaults.
    await page.click('[data-test-reset-all]');
    await page.waitForFunction(() =>
      window.Rga.Settings.Store.effective('theme') === 'dark',
      null, { timeout: 1000 });
    const after = await page.evaluate(() =>
      window.Rga.Settings.Store.effective('theme'));
    expect(after).toBe('dark');
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 8. Save absent
// -----------------------------------------------------------------

test('S5 §8 — no Save button exists anywhere in the Settings workspace', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's5-no-save-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openSettings(page);
    // Check that no button text reads "Save" in the entire workspace.
    const saves = await page.evaluate(() => {
      const ws = document.querySelector('.rga-settings-workspace');
      if (!ws) return null;
      return Array.from(ws.querySelectorAll('button'))
        .filter((b) => /^\s*save\s*$/i.test(b.textContent || ''))
        .map((b) => b.outerHTML);
    });
    expect(saves).not.toBeNull();
    expect(saves).toEqual([]);
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 9. Responsive narrow widths
// -----------------------------------------------------------------

test('S5 §9 — responsive layout survives narrow viewport widths', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's5-responsive-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    // Mid-narrow — descriptions collapse but nav stays in the left column.
    await page.setViewportSize({ width: 700, height: 800 });
    await openSettings(page);
    const mid = await page.evaluate(() => {
      const item = document.querySelector('.rga-settings-nav-item');
      const desc = item && item.querySelector('.rga-settings-nav-item-desc');
      const cs   = desc ? getComputedStyle(desc) : null;
      const content = document.querySelector('.rga-settings-content');
      const csContent = content ? getComputedStyle(content) : null;
      return {
        descDisplay: cs && cs.display,
        contentVisible: csContent && csContent.display !== 'none',
        // The workspace remains a working layout — rows are rendered.
        rowCount: document.querySelectorAll('.rga-settings-row').length
      };
    });
    // At 700px the description rule (< 900px) kicks in and hides desc.
    expect(mid.descDisplay).toBe('none');
    expect(mid.contentVisible).toBe(true);
    expect(mid.rowCount).toBeGreaterThan(0);

    // Very narrow — workspace stacks nav above content (single column).
    await page.setViewportSize({ width: 500, height: 800 });
    await page.waitForTimeout(50); // let layout settle
    const narrow = await page.evaluate(() => {
      const ws = document.querySelector('.rga-settings-workspace');
      const csW = ws ? getComputedStyle(ws) : null;
      const navHeader = document.querySelector('.rga-settings-nav-header');
      const csH = navHeader ? getComputedStyle(navHeader) : null;
      return {
        gridTemplateColumns: csW && csW.gridTemplateColumns,
        navHeaderDisplay:    csH && csH.display,
        // Content + nav are both still in DOM.
        contentPresent: !!document.querySelector('.rga-settings-content'),
        navPresent:     !!document.querySelector('.rga-settings-nav'),
        rowCount:       document.querySelectorAll('.rga-settings-row').length
      };
    });
    expect(narrow.contentPresent).toBe(true);
    expect(narrow.navPresent).toBe(true);
    // At < 600px the workspace collapses to a single column and the
    // nav header hides. Rows still render.
    expect(narrow.navHeaderDisplay).toBe('none');
    expect(narrow.rowCount).toBeGreaterThan(0);
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 10. S1 + S2 + S3 + S4 + S6 invariants
// -----------------------------------------------------------------

test('S5 §10 — all prior Phase-2 invariants (S1/S2/S3/S4/S6) still hold', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's5-invariants-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openSettings(page);
    const inv = await page.evaluate(() => {
      const row     = document.querySelector('.rga-settings-row[data-setting-id="theme"]');
      const label   = row && row.querySelector('.rga-settings-row-label');
      const helper  = row && row.querySelector('.rga-settings-row-description');
      const title   = document.querySelector('.rga-settings-content-title');
      const content = document.querySelector('.rga-settings-content');
      const badge   = row && row.querySelector('.rga-settings-row-scope-badge');
      const reset   = row && row.querySelector('.rga-settings-row-reset');
      const radio   = row && row.querySelector('.rga-settings-control-radio');
      return {
        // S4
        rowDisplay:       row && getComputedStyle(row).display,
        rowColumnGap:     row && getComputedStyle(row).columnGap,
        // S6
        labelFontSize:    label && getComputedStyle(label).fontSize,
        labelFontWeight:  label && getComputedStyle(label).fontWeight,
        helperFontSize:   helper && getComputedStyle(helper).fontSize,
        helperFontWeight: helper && getComputedStyle(helper).fontWeight,
        titleFontSize:    title && getComputedStyle(title).fontSize,
        contentMaxWidth:  content && getComputedStyle(content).maxWidth,
        // S1
        badgePresent:     !!badge,
        badgeFontSize:    badge && getComputedStyle(badge).fontSize,
        // S2
        resetPresent:     !!reset,
        // S3 (radio segmented chrome on theme row)
        radioPresent:     !!radio,
        radioBorder:      radio && getComputedStyle(radio).borderTopWidth
      };
    });
    // S4
    expect(inv.rowDisplay).toBe('grid');
    expect(inv.rowColumnGap).toBe('8px');
    // S6
    expect(inv.labelFontSize).toBe('13px');
    expect(inv.labelFontWeight).toBe('500');
    expect(inv.helperFontSize).toBe('11px');
    expect(inv.helperFontWeight).toBe('400');
    expect(inv.titleFontSize).toBe('16px');
    expect(inv.contentMaxWidth).toBe('680px');
    // S1
    expect(inv.badgePresent).toBe(true);
    expect(inv.badgeFontSize).toBe('10px');
    // S2
    expect(inv.resetPresent).toBe(true);
    // S3
    expect(inv.radioPresent).toBe(true);
    expect(inv.radioBorder).toBe('1px');
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});
