// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Filmustageation — Print Recognition Bundle v1, Package A.
//
// Source of truth: SCENE_HEADING_IDENTITY_AUDIT.md (the brand-pink underline is
// the single Critical, geometry-FREE identity carrier) + PRINT_RECOGNITION_
// BUNDLE_PHASE0.md (Recommended v1: R-1 slug underline, unconditional).
//
// What Package A changed (renderer/css/editor-prosemirror.css):
//   .rga-print-block-sceneHeading gains
//     border-bottom: 3px solid var(--accent-rwanga, #C2185B)
//   — matching Flow's .rga-scene-heading-v3 brand underline.
//
// WHY a computed-style probe: Print Preview and PDF export consume the SAME
// .rga-print-block-* CSS (single resolver, Law 12), so proving the rule
// resolves on a real .rga-page-sheet proves both surfaces. This is the
// computed-style + LTR/RTL-screenshot check the Recognition Bundle prescribes.
//
// The doctrine guarantee: a border-bottom adds NO geometry — it does not change
// font-size, line-height, margin, letter-spacing, or the block's text column,
// and PageMap is pure arithmetic that never reads the DOM. This spec asserts
// BOTH: (1) the brand underline is present + correct colour, and (2) every
// geometry-bearing property of the scene heading still equals the body block.
//
// Prerequisite: `npm run build:renderer`. Run with: npm run test:e2e
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const ART_DIR = path.resolve(APP_ROOT, 'test-results', 'print-recognition-underline');

let app, page, userDataDir;

test.beforeAll(() => { try { fs.mkdirSync(ART_DIR, { recursive: true }); } catch (_) {} });

test.beforeEach(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-recog-'));
  app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(window.Rga && window.Rga.PrintRenderer));
});

test.afterEach(async () => {
  if (app) { await app.close(); app = null; }
  if (userDataDir) {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
    userDataDir = null;
  }
});

// Build a real .rga-page-sheet carrying a sceneHeading + an action block (the
// body-geometry reference) and a token-reference probe, append on-screen so
// layout is live, and read getComputedStyle. The loaded editor-prosemirror.css
// is the single source under test.
async function probe(direction) {
  return page.evaluate(async (dir) => {
    const host = document.createElement('div');
    host.id = '__recog_probe_host';
    host.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#3a3a3a;'
      + 'display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow:auto';

    const sheet = document.createElement('div');
    sheet.className = 'rga-page-sheet';
    if (dir === 'rtl') sheet.setAttribute('dir', 'rtl');

    const content = document.createElement('div');
    content.className = 'rga-page-sheet-content';

    const mk = (type, text) => {
      const el = document.createElement('div');
      el.className = 'rga-print-block rga-print-block-' + type;
      el.setAttribute('data-block-type', type);
      el.textContent = text;
      return el;
    };
    content.appendChild(mk('sceneHeading', dir === 'rtl' ? 'داخلي. شقة — ليل' : 'INT. APARTMENT — NIGHT'));
    content.appendChild(mk('action', dir === 'rtl' ? 'الغرفة معتمة.' : 'The room is dim.'));

    // Token-reference element: resolves --accent-rwanga the same way the rule
    // does, so the colour assertion is theme-independent.
    const ref = document.createElement('div');
    ref.id = '__accent_ref';
    ref.style.borderBottom = '3px solid var(--accent-rwanga, #C2185B)';
    content.appendChild(ref);

    sheet.appendChild(content);
    host.appendChild(sheet);
    document.body.appendChild(host);

    void sheet.offsetHeight;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const slug = content.querySelector('.rga-print-block-sceneHeading');
    const action = content.querySelector('.rga-print-block-action');
    const csSlug = getComputedStyle(slug);
    const csAction = getComputedStyle(action);
    const csRef = getComputedStyle(ref);

    return {
      slug: {
        borderBottomWidth: csSlug.borderBottomWidth,
        borderBottomStyle: csSlug.borderBottomStyle,
        borderBottomColor: csSlug.borderBottomColor,
        fontSize: csSlug.fontSize,
        lineHeight: csSlug.lineHeight,
        letterSpacing: csSlug.letterSpacing,
        marginTop: csSlug.marginTop,
        paddingTop: csSlug.paddingTop,
        paddingBottom: csSlug.paddingBottom
      },
      action: {
        fontSize: csAction.fontSize,
        lineHeight: csAction.lineHeight,
        letterSpacing: csAction.letterSpacing,
        marginTop: csAction.marginTop
      },
      refColor: csRef.borderBottomColor
    };
  }, direction);
}

async function snap(name) {
  const host = page.locator('#__recog_probe_host');
  await host.screenshot({ path: path.join(ART_DIR, name) });
}

async function clearProbe() {
  await page.evaluate(() => {
    const h = document.getElementById('__recog_probe_host');
    if (h) h.remove();
  });
}

const px = (s) => parseFloat(s);

// =================================================================
// 1. The brand-pink underline is present and resolves to --accent-rwanga.
// =================================================================
test('Package A — Print scene heading carries the 3px brand-pink underline', async () => {
  const r = await probe('ltr');
  await snap('ltr.png');

  expect(px(r.slug.borderBottomWidth)).toBeCloseTo(3, 0);
  expect(r.slug.borderBottomStyle).toBe('solid');
  // Theme-independent: the slug border resolves to the SAME colour as a probe
  // that uses var(--accent-rwanga) — i.e. it IS the brand accent, not text ink.
  expect(r.slug.borderBottomColor).toBe(r.refColor);
  // And it is a real, non-transparent accent.
  expect(r.slug.borderBottomColor).not.toBe('rgba(0, 0, 0, 0)');

  await clearProbe();
});

// =================================================================
// 2. Geometry UNCHANGED — the underline is decoration only. Every
//    geometry-bearing property of the slug still equals the body block.
// =================================================================
test('Package A — NO geometry change: font-size / line-height / letter-spacing / margin match the body block', async () => {
  const r = await probe('ltr');

  // Type-step forbidden: slug font-size == body (action) font-size.
  expect(r.slug.fontSize).toBe(r.action.fontSize);
  // Leading forbidden to change: slug line-height == body line-height.
  expect(r.slug.lineHeight).toBe(r.action.lineHeight);
  // Letter-spacing forbidden to change: equal to the body's.
  expect(r.slug.letterSpacing).toBe(r.action.letterSpacing);
  // Margin unchanged (the pre-existing 1em top, same as action).
  expect(r.slug.marginTop).toBe(r.action.marginTop);
  // No padding was added (border-bottom only).
  expect(px(r.slug.paddingTop)).toBeCloseTo(0, 0);
  expect(px(r.slug.paddingBottom)).toBeCloseTo(0, 0);

  await clearProbe();
});

// =================================================================
// 3. RTL parity — the underline is direction-agnostic (border-bottom),
//    present identically for Arabic/Kurdish print.
// =================================================================
test('Package A — RTL: the brand underline is present identically (direction-agnostic)', async () => {
  const r = await probe('rtl');
  await snap('rtl.png');

  expect(px(r.slug.borderBottomWidth)).toBeCloseTo(3, 0);
  expect(r.slug.borderBottomStyle).toBe('solid');
  expect(r.slug.borderBottomColor).toBe(r.refColor);

  await clearProbe();
});
