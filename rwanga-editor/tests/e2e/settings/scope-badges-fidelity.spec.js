// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Scope Badge Fidelity — S1 (Phase 2).
//
// Proves the ten S1 assertions against the live Settings workspace:
//   1.  Every row has exactly one scope badge
//   2.  Badge label matches the registry scope
//   3.  Badge has a leading dot (.rga-settings-row-scope-badge-dot)
//   4.  Dot size is 6×6 px
//   5.  Badge font-size is 10px
//   6.  Badge font-weight is 600
//   7.  Badge letter-spacing is 0.04em (~0.4px at 10px font)
//   8.  Badge padding is 2px 7px
//   9.  Badge is inline after the row label (next sibling, same row of
//       the label/helper column)
//  10.  S4 row anatomy + S6 typography invariants still hold (display:
//       grid, two tracks, label 13/500, helper 11/400) after the badge
//       lands.
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
  await page.waitForSelector('.rga-settings-workspace .rga-settings-row');
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

const SCOPE_LABEL = { flow: 'Flow', print: 'Print', export: 'Export', all: 'All' };

// Iterate every section in the layout, render its rows, and gather
// {id, scopeFromRegistry, badgeCount, badgeLabel, dotCount}. Used by
// the per-section assertions below.
async function inventoryRows(page) {
  return await page.evaluate(() => {
    const out = [];
    const L = window.Rga.Settings.Layout;
    const R = window.Rga.Settings.Registry;
    const ws = document.querySelector('.rga-settings-workspace');
    L.sections().forEach((section) => {
      // Navigate to the section so its rows render.
      const navItem = ws.querySelector('.rga-settings-nav-item[data-section-id="' + section.id + '"]');
      if (navItem) navItem.click();
      section.settingIds.forEach((id) => {
        const row = ws.querySelector('.rga-settings-row[data-setting-id="' + id + '"]');
        if (!row) return;
        const badges = row.querySelectorAll('.rga-settings-row-scope-badge');
        const dot    = row.querySelector('.rga-settings-row-scope-badge-dot');
        const entry  = R.get(id);
        out.push({
          id: id,
          scope: entry ? entry.scope : null,
          badgeCount: badges.length,
          badgeText:  badges[0] ? badges[0].textContent.trim() : null,
          badgeAttr:  badges[0] ? badges[0].getAttribute('data-test-scope') : null,
          dotPresent: !!dot
        });
      });
    });
    return out;
  });
}

// -----------------------------------------------------------------
// 1. Every row has exactly one scope badge
// -----------------------------------------------------------------

test('S1 §1 — every row has exactly one scope badge', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's1-count-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettings(page);
    const rows = await inventoryRows(page);
    expect(rows.length).toBeGreaterThan(0);
    const offenders = rows.filter((r) => r.badgeCount !== 1);
    expect(offenders.map((r) => r.id + ' (badges=' + r.badgeCount + ')')).toEqual([]);
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 2. Badge label matches registry scope
// -----------------------------------------------------------------

test('S1 §2 — badge label matches the registry scope value', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's1-label-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettings(page);
    const rows = await inventoryRows(page);
    const offenders = rows.filter((r) =>
      r.badgeText !== SCOPE_LABEL[r.scope] || r.badgeAttr !== r.scope);
    expect(offenders.map((r) =>
      r.id + ' (scope=' + r.scope + ', badgeText=' + r.badgeText + ', badgeAttr=' + r.badgeAttr + ')')
    ).toEqual([]);
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 3. Badge has a leading dot
// -----------------------------------------------------------------

test('S1 §3 — every badge has a leading dot element', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's1-dot-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettings(page);
    const rows = await inventoryRows(page);
    const offenders = rows.filter((r) => !r.dotPresent);
    expect(offenders.map((r) => r.id)).toEqual([]);
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 4. Dot size is 6×6 px
// -----------------------------------------------------------------

test('S1 §4 — badge dot is 6×6 px', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's1-dot-size-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettings(page);
    // theme row is on the default (General) section.
    const dim = await page.evaluate(() => {
      const dot = document.querySelector(
        '.rga-settings-row[data-setting-id="theme"] .rga-settings-row-scope-badge-dot');
      if (!dot) return null;
      const cs = getComputedStyle(dot);
      return { width: cs.width, height: cs.height, borderRadius: cs.borderTopLeftRadius };
    });
    expect(dim).not.toBeNull();
    expect(dim.width).toBe('6px');
    expect(dim.height).toBe('6px');
    // 50% radius → resolves to either '50%' (chromium-native) or '3px'
    // (half of 6px) depending on host. Either form yields a circle.
    expect(['50%', '3px']).toContain(dim.borderRadius);
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 5 + 6. Badge font-size 10px / font-weight 600
// -----------------------------------------------------------------

test('S1 §5 — badge font-size is 10px', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's1-font-size-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettings(page);
    const styles = await page.evaluate(() => {
      const badge = document.querySelector(
        '.rga-settings-row[data-setting-id="theme"] .rga-settings-row-scope-badge');
      return badge ? getComputedStyle(badge).fontSize : null;
    });
    expect(styles).toBe('10px');
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

test('S1 §6 — badge font-weight is 600', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's1-font-weight-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettings(page);
    const w = await page.evaluate(() => {
      const badge = document.querySelector(
        '.rga-settings-row[data-setting-id="theme"] .rga-settings-row-scope-badge');
      return badge ? getComputedStyle(badge).fontWeight : null;
    });
    expect(w).toBe('600');
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 7. Badge letter-spacing 0.04em (resolves to 0.4px at 10px font-size)
// -----------------------------------------------------------------

test('S1 §7 — badge letter-spacing is 0.04em (~0.4px at 10px font)', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's1-tracking-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettings(page);
    const ls = await page.evaluate(() => {
      const badge = document.querySelector(
        '.rga-settings-row[data-setting-id="theme"] .rga-settings-row-scope-badge');
      return badge ? getComputedStyle(badge).letterSpacing : null;
    });
    // 0.04em × 10px font = 0.4px. Browsers may resolve to either string;
    // accept both forms.
    expect(['0.4px', '0.04em']).toContain(ls);
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 8. Badge padding is 2px 7px
// -----------------------------------------------------------------

test('S1 §8 — badge padding is 2px top/bottom, 7px left/right', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's1-pad-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettings(page);
    const pad = await page.evaluate(() => {
      const badge = document.querySelector(
        '.rga-settings-row[data-setting-id="theme"] .rga-settings-row-scope-badge');
      if (!badge) return null;
      const cs = getComputedStyle(badge);
      return { t: cs.paddingTop, r: cs.paddingRight, b: cs.paddingBottom, l: cs.paddingLeft };
    });
    expect(pad).not.toBeNull();
    expect(pad.t).toBe('2px');
    expect(pad.b).toBe('2px');
    expect(pad.l).toBe('7px');
    expect(pad.r).toBe('7px');
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 9. Badge is inline after the row label
// -----------------------------------------------------------------

test('S1 §9 — badge sits inline as the next sibling after the row label', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's1-order-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettings(page);
    const order = await page.evaluate(() => {
      const row = document.querySelector('.rga-settings-row[data-setting-id="theme"]');
      if (!row) return null;
      const label = row.querySelector('.rga-settings-row-label');
      const badge = row.querySelector('.rga-settings-row-scope-badge');
      if (!label || !badge) return null;
      // The badge must be a sibling inside the same row-header container
      // AND come AFTER the label in DOM order.
      const sameParent = label.parentElement === badge.parentElement;
      const labelRect  = label.getBoundingClientRect();
      const badgeRect  = badge.getBoundingClientRect();
      // Inline (same baseline-ish vertical band) and to the right of the
      // label by the header gap.
      const sameRow    = Math.abs(labelRect.top - badgeRect.top) < 10;
      const toRight    = badgeRect.left > labelRect.right;
      const followsInDom =
        !!(label.compareDocumentPosition(badge) & Node.DOCUMENT_POSITION_FOLLOWING);
      return { sameParent: sameParent, sameRow: sameRow, toRight: toRight, followsInDom: followsInDom };
    });
    expect(order).not.toBeNull();
    expect(order.sameParent).toBe(true);
    expect(order.followsInDom).toBe(true);
    expect(order.sameRow).toBe(true);
    expect(order.toRight).toBe(true);
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 10. S4 + S6 invariants still hold
// -----------------------------------------------------------------

test('S1 §10 — S4 row grid + S6 typography invariants still hold after the badge lands', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's1-invariants-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettings(page);
    const inv = await page.evaluate(() => {
      const row    = document.querySelector('.rga-settings-row[data-setting-id="theme"]');
      const label  = row && row.querySelector('.rga-settings-row-label');
      const helper = row && row.querySelector('.rga-settings-row-description');
      const title  = document.querySelector('.rga-settings-content-title');
      const content = document.querySelector('.rga-settings-content');
      return {
        rowDisplay:       row    && getComputedStyle(row).display,
        rowColumnGap:     row    && getComputedStyle(row).columnGap,
        labelFontSize:    label  && getComputedStyle(label).fontSize,
        labelFontWeight:  label  && getComputedStyle(label).fontWeight,
        helperFontSize:   helper && getComputedStyle(helper).fontSize,
        helperFontWeight: helper && getComputedStyle(helper).fontWeight,
        titleFontSize:    title  && getComputedStyle(title).fontSize,
        titleFontWeight:  title  && getComputedStyle(title).fontWeight,
        contentMaxWidth:  content && getComputedStyle(content).maxWidth,
        contentPaddingTop:    content && getComputedStyle(content).paddingTop,
        contentPaddingLeft:   content && getComputedStyle(content).paddingLeft
      };
    });
    // S4 row grid
    expect(inv.rowDisplay).toBe('grid');
    expect(inv.rowColumnGap).toBe('8px');
    // S6 typography
    expect(inv.labelFontSize).toBe('13px');
    expect(inv.labelFontWeight).toBe('500');
    expect(inv.helperFontSize).toBe('11px');
    expect(inv.helperFontWeight).toBe('400');
    expect(inv.titleFontSize).toBe('16px');
    expect(inv.titleFontWeight).toBe('600');
    expect(inv.contentMaxWidth).toBe('680px');
    expect(inv.contentPaddingTop).toBe('24px');
    expect(inv.contentPaddingLeft).toBe('32px');
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});
