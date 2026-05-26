// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Human Labels — H4 (RC1 §6 + §6.4).
//
// Proves the H4 brief end-to-end:
//   1. No raw enum values visible in any select/radio option text
//   2. No internal setting IDs visible anywhere in Settings
//   3. Language options render English / Kurdish / Arabic
//   4. Human labels survive a close + reopen cycle
//   5. The unsupported-control inventory document exists
//   6. Unsupported controls do not expose implementation text
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os   = require('os');
const fs   = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');

// Enum tokens that must NEVER appear as user-facing option text.
// Drawn from every registry entry whose `options` contained raw
// values before H4. If any of these surfaces as <option> text or
// radio label text, H4 has regressed.
const FORBIDDEN_ENUM_TEXT = [
  'en', 'ku', 'ar',
  'standard_us', 'standard_eu',
  'top_right', 'top_center', 'bottom_right', 'bottom_center',
  'bw', 'pdf', 'docx', 'fdx',
  'rga',
  'rwanga', 'none',
  'pageSetup.headerText'   // internal id sample
];

// Setting IDs that must NEVER appear as visible UI text. We sample a
// few across sections — a leak anywhere is a leak.
const FORBIDDEN_INTERNAL_IDS = [
  'editor.fontSize', 'editor.lineHeight', 'editor.wordWrap',
  'screenplay.profile', 'screenplay.sceneNumberPosition',
  'pageSetup.paperSize', 'pageSetup.orientation', 'pageSetup.margins',
  'export.defaultFormat', 'export.branding', 'export.colorMode',
  'autosave.enabled', 'autosave.interval',
  'files.defaultSaveFormat', 'files.defaultDirectory',
  'appearance.sidebarPosition', 'appearance.statusBar',
  'advanced.logLevel', 'advanced.debugMode',
  'windowZoom', 'recentFilesLimit'
];

// Control-type words forbidden anywhere in the Settings UI text
// (RC1 §7.3 + §14.2). Some appear as substrings of human strings
// (e.g. "Toggle Sidebar") so checking is exact-word against rendered
// option/select content, not loose substring.
const FORBIDDEN_CONTROL_WORDS = [
  'TOGGLE', 'SELECT', 'RADIO', 'NUMBER', 'SLIDER', 'SHORTCUT',
  'MARGIN_GROUP', 'COLOR', 'READONLY'
];

async function launchAndOpen(userDataDir) {
  const app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(
    window.Rga && window.Rga.Settings && window.Rga.Settings.Store && window.Rga.SettingsWorkspace));
  await page.evaluate(async () => { await window.Rga.Settings.Store.init(); });
  await page.evaluate(() => window.Rga.SettingsWorkspace.open());
  await page.waitForSelector('.rga-settings-row');
  return { app, page };
}

async function visitAllSections(page) {
  const ids = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-section-id]'))
      .map((el) => el.getAttribute('data-section-id')));
  for (const id of ids) {
    await page.click('[data-section-id="' + id + '"]');
    await page.waitForSelector('.rga-settings-row');
  }
  return ids;
}

// Collect every <option> textContent + every radio <span> textContent
// across every section. These are the strings users actually read in
// the option list.
async function collectOptionLabels(page) {
  const ids = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-section-id]'))
      .map((el) => el.getAttribute('data-section-id')));
  const collected = [];
  for (const sid of ids) {
    await page.click('[data-section-id="' + sid + '"]');
    await page.waitForSelector('.rga-settings-row');
    const here = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll(
        '.rga-settings-row select option').forEach((o) => out.push(o.textContent.trim()));
      document.querySelectorAll(
        '.rga-settings-row .rga-settings-control-radio label span').forEach((s) => out.push(s.textContent.trim()));
      return out;
    });
    collected.push(...here);
  }
  return collected;
}

// -----------------------------------------------------------------
// 1. No raw enum values visible in any option text
// -----------------------------------------------------------------

test('H4 — no raw enum value appears as user-facing option text', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h4-no-enums-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    const labels = await collectOptionLabels(page);
    expect(labels.length).toBeGreaterThan(0);
    for (const tok of FORBIDDEN_ENUM_TEXT) {
      // exact-match: the option's text must not equal the raw enum.
      // Substring matches are allowed for legitimate uses (e.g. a
      // human label that contains "PDF" as an acronym).
      expect(labels).not.toContain(tok);
    }
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 2. No internal setting IDs visible anywhere in Settings
// -----------------------------------------------------------------

test('H4 — no internal setting id (dot-notation or camelCase) appears anywhere in the Settings UI text', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h4-no-ids-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await visitAllSections(page);
    // Sweep every visible text node inside the Settings workspace.
    const visibleText = await page.evaluate(() => {
      const root = document.querySelector(
        '[data-renderer="workspace"][data-workspace-kind="settings"]');
      return root ? root.innerText : '';
    });
    for (const id of FORBIDDEN_INTERNAL_IDS) {
      expect(visibleText).not.toContain(id);
    }
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 3. Language options render English / Kurdish / Arabic
// -----------------------------------------------------------------

test('H4 — Language options render as "English", "Kurdish", "Arabic"', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h4-language-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await page.click('[data-section-id="general"]');
    const labels = await page.$$eval(
      '.rga-settings-row[data-setting-id="language"] select option',
      (els) => els.map((e) => e.textContent.trim()));
    expect(labels).toEqual(['English', 'Kurdish', 'Arabic']);
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 4. Human labels survive a close + reopen cycle
// -----------------------------------------------------------------

test('H4 — human labels persist across a close + reopen (labels live in registry, no localStorage round-trip)', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h4-reload-'));
  try {
    {
      const { app, page } = await launchAndOpen(userDataDir);
      await page.click('[data-section-id="general"]');
      const labels1 = await page.$$eval(
        '.rga-settings-row[data-setting-id="language"] select option',
        (els) => els.map((e) => e.textContent.trim()));
      expect(labels1).toEqual(['English', 'Kurdish', 'Arabic']);
      await app.close();
    }
    {
      const { app, page } = await launchAndOpen(userDataDir);
      try {
        await page.click('[data-section-id="general"]');
        const labels2 = await page.$$eval(
          '.rga-settings-row[data-setting-id="language"] select option',
          (els) => els.map((e) => e.textContent.trim()));
        expect(labels2).toEqual(['English', 'Kurdish', 'Arabic']);
      } finally {
        await app.close();
      }
    }
  } finally {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 5. The unsupported-control inventory document exists
// -----------------------------------------------------------------

test('H4 — UNSUPPORTED_CONTROL_INVENTORY.md exists and lists the deferred control types (post-H6)', () => {
  const docPath = path.resolve(__dirname, '..', '..', '..',
    'docs', 'rwanga-settings', 'UNSUPPORTED_CONTROL_INVENTORY.md');
  expect(fs.existsSync(docPath)).toBe(true);
  const body = fs.readFileSync(docPath, 'utf8');
  // H5 retired `slider` (windowZoom); H6 retired `shortcut` (kb.*).
  // The remaining deferred types are `margins` and `color`.
  // `slider` and `shortcut` continue to appear in the Shipped section.
  expect(body).toMatch(/`shortcut`/);
  expect(body).toMatch(/`margins`/);
  expect(body).toMatch(/`color`/);
  expect(body).toMatch(/`slider`/);
  expect(body).toMatch(/\bH5\b/);
  expect(body).toMatch(/\bH6\b/);
});

// -----------------------------------------------------------------
// 6. Unsupported controls do not expose implementation text
// -----------------------------------------------------------------

test('H4 — unsupported-control rows do not expose control-type words or setting IDs in their visible value', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h4-fallback-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    // H5 shipped the slider control; H6 shipped the shortcut control.
    // Both windowZoom and the kb.* rows are now editable and no longer
    // render as the read-only fallback. The remaining unsupported
    // types still render as read-only text.
    const unsupportedIds = [
      'pageSetup.margins',           // margins
      'appearance.editorDeskColor'   // color
    ];

    // Helper: find the section containing an id from the registry.
    const sectionMap = await page.evaluate(() => {
      const L = window.Rga.Settings.Layout;
      const map = {};
      L.sections().forEach((s) => {
        s.settingIds.forEach((id) => { map[id] = s.id; });
      });
      return map;
    });

    for (const sid of unsupportedIds) {
      const section = sectionMap[sid];
      await page.click('[data-section-id="' + section + '"]');
      await page.waitForSelector('.rga-settings-row[data-setting-id="' + sid + '"]');
      const value = await page.$eval(
        '.rga-settings-row[data-setting-id="' + sid + '"] .rga-settings-row-value',
        (el) => el.textContent.trim());
      // The setting id itself must not appear in the value.
      expect(value).not.toContain(sid);
      // Forbidden control-type words must not appear.
      for (const w of FORBIDDEN_CONTROL_WORDS) {
        expect(value.toUpperCase()).not.toContain(w);
      }
    }
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});
