// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Settings — form-control styling (readability) regression guard.
//
// What this protects (renderer/css/settings-workspace.css):
//   The form controls referenced --surface-tertiary / --surface-secondary /
//   --surface-hover, which were DEFINED NOWHERE — so every control fell back to
//   a translucent rgba(255,255,255,0.0x). That made fields low-contrast over the
//   dark desk and, critically, gave the native <select> popup a near-transparent
//   background → unreadable dropdown options. The fix repoints them to the
//   defined, OPAQUE --bg-* palette and sets an explicit <option> surface.
//
// This spec appends the exact control classes inside a real
// .rga-settings-workspace host and reads getComputedStyle — the loaded
// settings-workspace.css is the single source under test. A token-reference
// element makes the colour assertions theme-independent.
//
// Prerequisite: `npm run build:renderer`. Run with: npm run test:e2e
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const ART_DIR = path.resolve(APP_ROOT, 'test-results', 'settings-form-control-styling');

let app, page, userDataDir;

test.beforeAll(() => { try { fs.mkdirSync(ART_DIR, { recursive: true }); } catch (_) {} });

test.beforeEach(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-setfx-'));
  app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(window.Rga));
});

test.afterEach(async () => {
  if (app) { await app.close(); app = null; }
  if (userDataDir) {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
    userDataDir = null;
  }
});

// Build the real settings control classes inside a .rga-settings-workspace >
// .rga-settings-content host, plus token-reference probes for --bg-tertiary /
// --bg-secondary so colour assertions are theme-independent. Returns computed
// styles for an enabled select, its option, a disabled select, and a text input.
async function probe() {
  return page.evaluate(async () => {
    const host = document.createElement('div');
    host.id = '__setfx_host';
    host.className = 'rga-settings-workspace';
    host.style.cssText = 'position:fixed;inset:0;z-index:99999;';

    const content = document.createElement('div');
    content.className = 'rga-settings-content';

    const mkSelect = (disabled) => {
      const s = document.createElement('select');
      s.className = 'rga-settings-control-select';
      ['Letter', 'A4', 'Legal'].forEach((t) => {
        const o = document.createElement('option'); o.value = t; o.textContent = t; s.appendChild(o);
      });
      if (disabled) s.disabled = true;
      return s;
    };

    const selectEnabled = mkSelect(false);
    const selectDisabled = mkSelect(true);
    const text = document.createElement('input');
    text.type = 'text';
    text.className = 'rga-settings-control-text';
    text.value = 'Some value';

    // Token references — resolve the same defined tokens the fix points at.
    const refTertiary = document.createElement('div');
    refTertiary.style.background = 'var(--bg-tertiary)';
    const refSecondary = document.createElement('div');
    refSecondary.style.background = 'var(--bg-secondary)';
    const refDisabledInk = document.createElement('div');
    refDisabledInk.style.color = 'var(--text-disabled, #6e6e6e)';

    [selectEnabled, selectDisabled, text, refTertiary, refSecondary, refDisabledInk]
      .forEach((el) => content.appendChild(el));
    host.appendChild(content);
    document.body.appendChild(host);

    void host.offsetHeight;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    // Focus the enabled select to read its focus ring.
    selectEnabled.focus();
    void host.offsetHeight;
    await new Promise((r) => requestAnimationFrame(r));

    const csEnabled = getComputedStyle(selectEnabled);
    const csOption = getComputedStyle(selectEnabled.querySelector('option'));
    const csDisabled = getComputedStyle(selectDisabled);
    const csText = getComputedStyle(text);

    return {
      enabled: {
        background: csEnabled.backgroundColor,
        color: csEnabled.color,
        boxShadow: csEnabled.boxShadow
      },
      option: { background: csOption.backgroundColor, color: csOption.color },
      disabled: { background: csDisabled.backgroundColor, color: csDisabled.color },
      text: { background: csText.backgroundColor, color: csText.color },
      ref: {
        tertiary: getComputedStyle(refTertiary).backgroundColor,
        secondary: getComputedStyle(refSecondary).backgroundColor,
        disabledInk: getComputedStyle(refDisabledInk).color
      }
    };
  });
}

// A colour is opaque iff it is not a 4-component rgba(...) with alpha < 1.
// getComputedStyle returns 'rgb(r, g, b)' for fully-opaque (no alpha arg) and
// 'rgba(r, g, b, a)' for translucent. Match the rgba 4-arg form specifically so
// the blue channel of an opaque 'rgb(...)' is never mistaken for an alpha.
function isOpaque(color) {
  const m = /^rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)$/.exec(color);
  if (!m) return true;            // 'rgb(...)' / named → opaque
  return parseFloat(m[1]) === 1;  // rgba with alpha 1 → opaque
}

test('Settings select: OPAQUE surface (not the old translucent fallback), readable ink', async () => {
  const r = await probe();
  await page.locator('#__setfx_host').screenshot({ path: path.join(ART_DIR, 'controls.png') }).catch(() => {});

  // The bug was a translucent background; assert it is now opaque…
  expect(isOpaque(r.enabled.background)).toBe(true);
  // …and that it resolves to the intended --bg-tertiary token (theme-independent).
  expect(r.enabled.background).toBe(r.ref.tertiary);
  // Ink is real, not transparent.
  expect(isOpaque(r.enabled.color)).toBe(true);
  expect(r.enabled.color).not.toBe('rgba(0, 0, 0, 0)');
});

test('Settings select dropdown <option>: opaque surface + readable text', async () => {
  const r = await probe();
  expect(isOpaque(r.option.background)).toBe(true);
  expect(r.option.background).toBe(r.ref.secondary);
  expect(isOpaque(r.option.color)).toBe(true);
});

test('Settings disabled control: intentional (recessed opaque surface + --text-disabled ink), not washed out', async () => {
  const r = await probe();
  expect(isOpaque(r.disabled.background)).toBe(true);
  expect(r.disabled.background).toBe(r.ref.secondary);
  // Disabled ink uses the dedicated disabled token (clearly "off", legible).
  expect(r.disabled.color).toBe(r.ref.disabledInk);
});

test('Settings text input: opaque surface; focused control shows a polished accent ring', async () => {
  const r = await probe();
  expect(isOpaque(r.text.background)).toBe(true);
  expect(r.text.background).toBe(r.ref.tertiary);
  // The focused select carries a non-empty box-shadow focus ring.
  expect(r.enabled.boxShadow).not.toBe('none');
  expect(r.enabled.boxShadow.length).toBeGreaterThan(0);
});
