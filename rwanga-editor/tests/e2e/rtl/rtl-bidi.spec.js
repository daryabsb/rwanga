// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// S4.4 — RTL bidi audit: mixed-script readability (RTL-12) + bidi punctuation
// stability (RTL-13).
//
// Law: docs/Filmustageation/redesign_campaign/RTL_SCREENPLAY_CONVENTION.md
// Criteria: docs/plans/evidence/S4.1-rtl-qa-protocol.md (§RTL-12, §RTL-13)
//
// TWO SURFACES, TWO TRUTHS (protocol §0): Flow (`.rga-block-*`) carries
// direction; Print Preview (`.rga-print-block-*`) carries the full law
// (magnitudes + direction). Both surfaces are asserted below because RTL-12
// and RTL-13 are both scoped "Flow + Print Preview" in the protocol table.
//
// FIXTURE LAW (masterplan §0.2): opens a %TEMP% COPY of
// tests/fixtures/mysterious-guest-rtl.rga. The tracked fixture is never
// touched, and this spec types additional battery lines into the COPY only.
//
// Method: Playwright DOM geometry (Range/client-rect reads), per the standing
// project rule "Playwright > screenshots for layout work" — screenshots
// record, they do not measure.
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { closeApp } = require('../../helpers/app-teardown');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const FIXTURE = path.resolve(APP_ROOT, 'tests', 'fixtures', 'mysterious-guest-rtl.rga');
const TOL_PX = 4;   // ~1mm at 96dpi, per S4.1 protocol §0.2

const EVIDENCE_DIR = process.env.RGA_S44_EVIDENCE
  ? path.resolve(APP_ROOT, '..', 'docs', 'plans', 'evidence')
  : null;

let app, page, userDataDir, workDir, fixtureCopy;

test.beforeEach(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-s44-'));
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-s44-doc-'));
  fixtureCopy = path.join(workDir, 'mysterious-guest-rtl.rga');
  fs.copyFileSync(FIXTURE, fixtureCopy);   // §0.2 — open the COPY, never the tracked file

  app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(
    window.Rga && window.Rga.FileManager && window.Rga.FileManager.getActive
    && window.Rga.FileManager.getActive() && window.Rga.PrintPreview));

  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
  }, fixtureCopy);
  await page.evaluate(() => window.Rga.FileManager.openFromDialog());
  await page.waitForFunction(() => {
    const d = window.Rga.FileManager.getActive();
    return !!(d && String(d.displayName || '').indexOf('mysterious') >= 0);
  });
});

test.afterEach(async () => {
  if (app) { await closeApp(app); app = null; }
  for (const d of [userDataDir, workDir]) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {}
  }
  userDataDir = workDir = null;
});

async function shot(name) {
  if (!EVIDENCE_DIR) return;
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  try { await page.screenshot({ path: path.join(EVIDENCE_DIR, name) }); } catch (_) {}
}

async function openPreview() {
  await page.evaluate(() => window.Rga.PrintPreview.open());
  await page.waitForFunction(() => window.Rga.PrintPreview.isActive() === true);
  await page.waitForFunction(() => document.querySelectorAll('.rga-page-sheet').length > 0);
  await page.waitForTimeout(600);
}

async function closePreview() {
  await page.evaluate(() => window.Rga.PrintPreview.hide());
  // Wait on real state, not a fixed sleep: a still-active preview overlays the
  // editor, so a later test's clicks/typing land nowhere (this is exactly what
  // made RTL-13 fail only when run AFTER RTL-12 in the same file).
  await page.waitForFunction(() => window.Rga.PrintPreview.isActive() === false);
  await page.waitForFunction(() => {
    const pm = document.querySelector('#editor .ProseMirror') || document.querySelector('#editor');
    if (!pm) return false;
    const r = pm.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}

// ---------------------------------------------------------------------------
// Shared in-page measurement primitive: find a block (Flow or Print class)
// whose textContent includes `needle`, then resolve arbitrary substrings of
// its full text to Range client-rects (walking text nodes, so it survives any
// inline tag/mark spans splitting the DOM text).
// ---------------------------------------------------------------------------
async function measureLine(page, containerSel, blockSelList, needle, subs) {
  return page.evaluate(({ containerSel, blockSelList, needle, subs }) => {
    function walkTextNodes(el) {
      const out = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let n;
      // eslint-disable-next-line no-cond-assign
      while ((n = walker.nextNode())) out.push(n);
      return out;
    }
    function rangeForIndices(el, startIdx, endIdx) {
      const nodes = walkTextNodes(el);
      let pos = 0, startNode = null, startOff = 0, endNode = null, endOff = 0;
      for (const node of nodes) {
        const len = node.nodeValue.length;
        if (startNode === null && startIdx <= pos + len) { startNode = node; startOff = Math.max(0, startIdx - pos); }
        if (endNode === null && endIdx <= pos + len) { endNode = node; endOff = Math.max(0, endIdx - pos); }
        pos += len;
        if (startNode && endNode) break;
      }
      if (!startNode || !endNode) return null;
      const r = document.createRange();
      try {
        r.setStart(startNode, startOff);
        r.setEnd(endNode, endOff);
      } catch (_) { return null; }
      return r;
    }

    // NOTE: `containerSel` is accepted for readability at call sites but
    // intentionally NOT used to scope the search — Print Preview renders
    // every page's `.rga-page-sheet-content` into the DOM (85 sheets for
    // this fixture), so restricting to `document.querySelector(containerSel)`
    // (singular) would only ever see page 1. Search the whole document; the
    // `.rga-block-*` / `.rga-print-block-*` class prefixes never collide.
    void containerSel;
    let el = null;
    for (const sel of blockSelList) {
      const found = Array.from(document.querySelectorAll(sel)).find((e) => (e.textContent || '').includes(needle));
      if (found) { el = found; break; }
    }
    if (!el) return { ok: false, reason: 'block not found for needle: ' + needle };

    const full = el.textContent || '';
    const cs = getComputedStyle(el);
    const blockRect = el.getBoundingClientRect();
    const lineRange = document.createRange();
    lineRange.selectNodeContents(el);
    const lineRect = lineRange.getBoundingClientRect();

    const subResults = {};
    (subs || []).forEach((s) => {
      const from = s.from || 0;
      const idx = s.last ? full.lastIndexOf(s.text, full.length) : full.indexOf(s.text, from);
      if (idx < 0) { subResults[s.key] = null; return; }
      const r = rangeForIndices(el, idx, idx + s.text.length);
      if (!r) { subResults[s.key] = null; return; }
      const rc = r.getBoundingClientRect();
      subResults[s.key] = { left: rc.left, right: rc.right, width: rc.width, idx };
    });

    return {
      ok: true,
      direction: cs.direction,
      textAlign: cs.textAlign,
      paddingLeft: parseFloat(cs.paddingLeft),
      paddingRight: parseFloat(cs.paddingRight),
      blockRect: { left: blockRect.left, right: blockRect.right, width: blockRect.width },
      lineRect: { left: lineRect.left, right: lineRect.right, width: lineRect.width },
      fullText: full,
      hasReplacementChar: full.indexOf('�') >= 0,
      hasEasternArabicDigit: /[٠-٩]/.test(full),
      hasWesternDigit: /[0-9]/.test(full),
      subs: subResults
    };
  }, { containerSel, blockSelList, needle, subs: subs || [] });
}

const FLOW_SEL = (type) => '.rga-block-' + type;
const PRINT_SEL = (type) => '.rga-print-block-' + type;

// Expected reading-start inset in Print Preview, per S4.1 §0.2 reference table.
const PRINT_INSET_IN = { sceneHeading: 0, action: 0, shot: 0, character: 2.0, parenthetical: 1.5, dialogue: 1.0 };

// ===========================================================================
// RTL-12 — Mixed English/Kurdish text readable
// ===========================================================================
//
// Sample list pulled directly from the fixture body (24 of its 114 mixed
// Latin/Arabic-script blocks — node-walked & regex-filtered offline, not
// hand-typed), spread across the whole 47-scene document. `latinRuns` are the
// exact Latin substrings inside each line, manually identified from the
// source text, used to check visual LTR ordering WITHIN the RTL line.
const RTL12_SAMPLES = [
  { type: 'character', text: 'باخەوان (VOICEOVER، OFF)', latinRuns: ['VOICEOVER', 'OFF'] },
  { type: 'action', text: 'FRAGMENT 1، کەمتر لە ٣ چرکە:', latinRuns: ['FRAGMENT'] },
  { type: 'action', text: 'WIDE SHOT: نالی لەسەر کۆتەرەدارێک لە ناو باخەکەیدا دانیشتووە. خۆری ئێوارەی زەردەپەڕ، هەوایەکی نەرم دارەکان ئەجوڵێنێتەوە.', latinRuns: ['WIDE SHOT'] },
  { type: 'action', text: 'CLOSE ON: پەنجەبڕاوەکە، خوێن.', latinRuns: ['CLOSE ON'] },
  { type: 'parenthetical', text: '(بە AI، voice mode، تەنهایە)', latinRuns: ['AI', 'voice mode'] },
  { type: 'action', text: 'CLOSE ON: مۆبایلەکە، شاحینەكە ئەدۆزێتەوە. نالی هەناسەیەکی ئارامی ئەکێشێت.', latinRuns: ['CLOSE ON'] },
  { type: 'action', text: 'CLOSE ON: مۆبایلی نالی، سیگناڵەکە کەمتر ئەبێت: ٣ خەتەوە بۆ ٢، بۆ ١.', latinRuns: ['CLOSE ON'] },
  { type: 'action', text: 'CLOSE ON: سینیی شەربەتەکە لەسەر مێزەکە، هێشتا نەکراوەتەوە. کامێرا لەسەری دەمێنێتەوە، پاشان دوور دەکەوێتەوە.', latinRuns: ['CLOSE ON'] },
  { type: 'character', text: 'ئەدیب (V.O.)', latinRuns: ['V.O.'] },
  { type: 'action', text: 'WIDE SHOT: هۆڵەکە. گەشە لەسەر قەنەفەکە خەوتووە. بەتانییەکە لەسەریدایە.', latinRuns: ['WIDE SHOT'] },
  { type: 'dialogue', text: 'نازێ (V.O.)', latinRuns: ['V.O.'] },
  { type: 'action', text: 'CLOSE ON: چاوەکانی نالی، بەرفراوان دەبن.', latinRuns: ['CLOSE ON'] },
  { type: 'character', text: 'كارمەندی فریاكەوتن (V.O.)', latinRuns: ['V.O.'] },
  { type: 'action', text: 'بەردی شەکڵدارەکە (stone sculpture) لە گۆشەی هۆڵەکەدا، کامێرا بۆ ساتێک لەسەری دەمێنێتەوە بەبێ هۆکار. بینەر دەیبینێت بەبێ ئەوەی بزانێت بۆچی.', latinRuns: ['stone sculpture'] },
  { type: 'action', text: 'دەنگی بزوێنەرێکی بەهێز، G-Class ێکی ڕەشی Mercedes دێتە ناو حەوشەکە. تارا لە شوفێرییەوە دادەبەزێت، بە پێکەنین و شادی و ئامادەیی. هەوای ئێوارەکە بۆ ئەو دروست کراوە.', latinRuns: ['G-Class', 'Mercedes'] },
  { type: 'action', text: 'CLOSE ON: چاوەکانی نالی، پڕ لە بێزاری و بێتاقەتی، ئاو بەچاویا.', latinRuns: ['CLOSE ON'] },
  { type: 'action', text: 'CLOSE ON: دەستی ئەدیب، لە ژێر قەنەفەکە شتێکی هەست پێدەکات.', latinRuns: ['CLOSE ON'] },
  { type: 'action', text: 'WIDE SHOT: سەیارەی ئەدیب لەسەر جادەیەکی تاک. بایەکی بەقوەت لە پەنجەرەکانەوە دێتە ناوەوە. کەشەکە ماتەمینە، ئاسمان هەورەبار و سارد.', latinRuns: ['WIDE SHOT'] },
  { type: 'action', text: 'MONITOR POV: مۆنیتەری کامێراکان، نالی یەکە یەکەی کامێراکان سەیر ئەکاتەوە.', latinRuns: ['MONITOR POV'] },
  { type: 'action', text: 'CLOSE ON: دەستەکانی نالی. لەرزان.', latinRuns: ['CLOSE ON'] },
  { type: 'action', text: 'EXTREME WIDE SHOT، STATIC: دەشت. ئاگرەکە بچوک ئەبێت. سەیارەکەی نالی دوور ئەبێت. لاشەی گەشە لەتەنیشتی ناسنامەکەیدا، تەنها.', latinRuns: ['EXTREME WIDE SHOT', 'STATIC'] },
  { type: 'action', text: 'CLOSE ON: شاشەی مۆبایل، چەند نامەیەکی بۆ هاتووە. ناتوانێت بیکاتەوە، قفڵە.', latinRuns: ['CLOSE ON'] },
  { type: 'action', text: 'نالی مەجبور دەبێت نامەیەک بنوسێت، نە قسەکردن بەڵکو تایپکردن. ئەمە D3 text mode-ە، بەس لەمەودا نە لەبەر ئەوەی کەسی تر لەوێیە، بەڵکو لەبەر ئەوەی شەبەکە نیە و ناتوانێت بینێرێت. ئەنوسێت بۆ هیچکەس.', latinRuns: ['D3 text mode'] },
  { type: 'action', text: 'CAMERA لەسەر دەستەکانی نالی، پەنجەکانی ڕاوەستان.', latinRuns: ['CAMERA'] }
];

test('RTL-12 — mixed Latin/Kurdish blocks keep RTL base direction and LTR-internal Latin runs (Flow + Print)', async () => {
  const evidence = { flow: [], print: [] };

  // --- Flow surface -----------------------------------------------------
  for (const sample of RTL12_SAMPLES) {
    const m = await measureLine(page, '#editor', [FLOW_SEL(sample.type)], sample.text,
      sample.latinRuns.map((r, i) => ({ key: 'run' + i, text: r })));
    evidence.flow.push({ sample: sample.text.slice(0, 40), type: sample.type, m });

    expect(m.ok, `Flow: could not find "${sample.type}" block containing "${sample.text.slice(0, 30)}…"`).toBe(true);
    expect(m.direction, `Flow base direction flipped to ${m.direction} on "${sample.text.slice(0, 30)}…" — `
      + 'classic base-direction bug (line began with a Latin/neutral token)').toBe('rtl');
    expect(m.hasReplacementChar, `Flow: U+FFFD found in "${sample.text.slice(0, 30)}…"`).toBe(false);

    sample.latinRuns.forEach((run, i) => {
      const r = m.subs['run' + i];
      expect(r, `Flow: Latin run "${run}" not resolvable to a Range in "${sample.text.slice(0, 30)}…"`).not.toBeNull();
    });
  }

  // --- Print Preview surface --------------------------------------------
  await openPreview();
  await shot('S4.4-rtl12-print.png');

  for (const sample of RTL12_SAMPLES) {
    const m = await measureLine(page, '.rga-page-sheet-content', [PRINT_SEL(sample.type)], sample.text,
      sample.latinRuns.map((r, i) => ({ key: 'run' + i, text: r })));
    evidence.print.push({ sample: sample.text.slice(0, 40), type: sample.type, m });

    expect(m.ok, `Print: could not find "${sample.type}" block containing "${sample.text.slice(0, 30)}…"`).toBe(true);
    expect(m.direction, `Print base direction flipped to ${m.direction} on "${sample.text.slice(0, 30)}…"`).toBe('rtl');
    expect(m.hasReplacementChar, `Print: U+FFFD found in "${sample.text.slice(0, 30)}…"`).toBe(false);

    // (b) each Latin run renders LTR within the line: first char left of last char.
    sample.latinRuns.forEach((run, i) => {
      const r = m.subs['run' + i];
      expect(r, `Print: Latin run "${run}" not resolvable in "${sample.text.slice(0, 30)}…"`).not.toBeNull();
      // A single-character run has no internal order to prove; skip.
      if (run.length > 1) {
        // first-char / last-char rects, resolved directly against the same block.
      }
    });

    // (d) start-edge inset matches the block's expected Print magnitude.
    const expIn = PRINT_INSET_IN[sample.type];
    if (typeof expIn === 'number') {
      const insetIn = m.paddingRight / 96;
      expect(Math.abs(insetIn - expIn),
        `Print: "${sample.type}" inset was ${insetIn.toFixed(3)}in, expected ${expIn}in `
        + `on "${sample.text.slice(0, 30)}…"`).toBeLessThanOrEqual(0.04);
    }
  }

  // First/last-char LTR-order check, done as a dedicated pass over the runs
  // that are >1 char (single letters have no internal order to violate).
  const orderChecks = await page.evaluate(({ samples }) => {
    function walkTextNodes(el) {
      const out = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let n;
      // eslint-disable-next-line no-cond-assign
      while ((n = walker.nextNode())) out.push(n);
      return out;
    }
    function rangeForIndices(el, startIdx, endIdx) {
      const nodes = walkTextNodes(el);
      let pos = 0, startNode = null, startOff = 0, endNode = null, endOff = 0;
      for (const node of nodes) {
        const len = node.nodeValue.length;
        if (startNode === null && startIdx <= pos + len) { startNode = node; startOff = Math.max(0, startIdx - pos); }
        if (endNode === null && endIdx <= pos + len) { endNode = node; endOff = Math.max(0, endIdx - pos); }
        pos += len;
        if (startNode && endNode) break;
      }
      if (!startNode || !endNode) return null;
      const r = document.createRange();
      try { r.setStart(startNode, startOff); r.setEnd(endNode, endOff); } catch (_) { return null; }
      return r;
    }
    const out = [];
    samples.forEach((sample) => {
      const els = Array.from(document.querySelectorAll('.rga-print-block-' + sample.type));
      const el = els.find((e) => (e.textContent || '').includes(sample.text));
      if (!el) { out.push({ sample: sample.text.slice(0, 30), skipped: 'not found' }); return; }
      const full = el.textContent || '';
      sample.latinRuns.filter((r) => r.length > 1).forEach((run) => {
        const idx = full.indexOf(run);
        if (idx < 0) { out.push({ sample: sample.text.slice(0, 30), run, skipped: 'not found' }); return; }
        // Protocol PASS(b) names the "first Latin CHARACTER" of a run, not the
        // literal substring's boundary bytes. A run like "V.O." can carry a
        // trailing weak character (the final '.') that UAX#9 attaches to the
        // adjacent RTL/neutral cluster (it sits next to a closing paren) —
        // that is standard bidi resolution, not a base-direction bug, so the
        // order check anchors on the first/last ALPHANUMERIC character of the
        // run rather than its raw string boundaries.
        const alnum = /[A-Za-z0-9]/;
        let firstOff = -1, lastOff = -1;
        for (let i = 0; i < run.length; i++) { if (alnum.test(run[i])) { firstOff = i; break; } }
        for (let i = run.length - 1; i >= 0; i--) { if (alnum.test(run[i])) { lastOff = i; break; } }
        if (firstOff < 0 || lastOff < 0) { out.push({ sample: sample.text.slice(0, 30), run, skipped: 'no alnum char' }); return; }
        const firstR = rangeForIndices(el, idx + firstOff, idx + firstOff + 1);
        const lastR = rangeForIndices(el, idx + lastOff, idx + lastOff + 1);
        if (!firstR || !lastR) { out.push({ sample: sample.text.slice(0, 30), run, skipped: 'range fail' }); return; }
        const fr = firstR.getBoundingClientRect();
        const lr = lastR.getBoundingClientRect();
        // Also record the RAW boundary-character order (including any
        // trailing weak punctuation) as an observation — not asserted — so a
        // later reader can see the V.O.-style attachment behaviour directly.
        const rawFirstR = rangeForIndices(el, idx, idx + 1);
        const rawLastR = rangeForIndices(el, idx + run.length - 1, idx + run.length);
        const rawFirstRect = rawFirstR ? rawFirstR.getBoundingClientRect() : null;
        const rawLastRect = rawLastR ? rawLastR.getBoundingClientRect() : null;
        out.push({
          sample: sample.text.slice(0, 30), run,
          firstLeft: fr.left, lastLeft: lr.left, ltr: fr.left <= lr.left,
          rawBoundaryObservation: rawFirstRect && rawLastRect
            ? { rawFirstLeft: rawFirstRect.left, rawLastLeft: rawLastRect.left, rawLtr: rawFirstRect.left <= rawLastRect.left }
            : null
        });
      });
    });
    return out;
  }, { samples: RTL12_SAMPLES });

  // eslint-disable-next-line no-console
  console.log('[S4.4 RTL-12 order] ' + JSON.stringify(orderChecks));

  orderChecks.forEach((c) => {
    if (c.skipped) return;
    expect(c.ltr, `Latin run "${c.run}" in "${c.sample}…" did not render left-to-right internally `
      + `(firstLeft=${c.firstLeft} lastLeft=${c.lastLeft})`).toBe(true);
  });

  await closePreview();

  // Numerals — RECORD only, per protocol (not an RTL-12 failure).
  const numeralReport = RTL12_SAMPLES.map((s) => ({
    sample: s.text.slice(0, 30),
    hasEasternArabicDigit: /[٠-٩]/.test(s.text),
    hasWesternDigit: /[0-9]/.test(s.text)
  })).filter((r) => r.hasEasternArabicDigit || r.hasWesternDigit);
  // eslint-disable-next-line no-console
  console.log('[S4.4 RTL-12 numerals — SW-23 vocabulary note, not a pass/fail signal] '
    + JSON.stringify(numeralReport));

  // eslint-disable-next-line no-console
  console.log('[S4.4 RTL-12 evidence] sampleCount=' + RTL12_SAMPLES.length
    + ' flowOk=' + evidence.flow.filter((e) => e.m.ok).length
    + ' printOk=' + evidence.print.filter((e) => e.m.ok).length);

  if (EVIDENCE_DIR) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'S4.4-rtl12-measurements.json'),
      JSON.stringify({ evidence, orderChecks, numeralReport }, null, 2));
  }
});

// ===========================================================================
// RTL-13 — Bidi punctuation stable
// ===========================================================================
//
// The fixture's punctuation is naturally occurring, not adversarial (S4.1
// §0.1), so this battery is TYPED into the live Flow editor, at the real
// document's end, through the real ProseMirror pipeline.
const BATTERY = [
  { key: 'period', text: 'گەڕایەوە بۆ ماڵ.', subs: [{ key: 'final', text: '.', last: true }] },
  { key: 'question', text: 'بۆچی وایکرد؟', subs: [{ key: 'final', text: '؟', last: true }] },
  { key: 'parenMixed', text: '(دوو GUN لەناو جانتادا بوون)', subs: [{ key: 'open', text: '(' }, { key: 'close', text: ')', last: true }] },
  { key: 'guillemets', text: '«سڵاو» پێی گوت.', subs: [{ key: 'open', text: '«' }, { key: 'close', text: '»' }, { key: 'final', text: '.', last: true }] },
  { key: 'quotes', text: 'گوتی "چۆنیت؟" و ڕۆیشت.', subs: [{ key: 'final', text: '.', last: true }] },
  { key: 'bracketLatin', text: 'دیمانەکە [OK] بەردەوام بوو.', subs: [{ key: 'open', text: '[' }, { key: 'close', text: ']' }, { key: 'final', text: '.', last: true }] },
  { key: 'latinThenPeriod', text: 'ئەو got OK.', subs: [{ key: 'final', text: '.', last: true }] },
  { key: 'digitPercent', text: 'تەنها ٥٠% ئامادە بوو.', subs: [{ key: 'digits', text: '٥٠' }, { key: 'percent', text: '%' }, { key: 'final', text: '.', last: true }] }
];

async function placeCaretAtEditorEnd(page) {
  await page.evaluate(() => {
    const editor = document.querySelector('#editor .ProseMirror') || document.querySelector('#editor');
    editor.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  });
}

// Place the caret at the LOGICAL start of the block containing `needle`
// (first character in DOM/document order — visually the reading-start side
// of an RTL line) so a typed character lands "earlier in the line".
async function placeCaretAtLogicalStart(page, needle) {
  return page.evaluate((needle) => {
    const els = Array.from(document.querySelectorAll('#editor [class*="rga-block-"]'));
    const el = els.find((e) => (e.textContent || '').includes(needle));
    if (!el) return false;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const firstText = walker.nextNode();
    if (!firstText) return false;
    const sel = window.getSelection();
    const range = document.createRange();
    range.setStart(firstText, 0);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    return true;
  }, needle);
}

test('RTL-13 — bidi punctuation battery renders and stays stable across an edit (Flow + Print)', async () => {
  await page.locator('#editor').click();
  await placeCaretAtEditorEnd(page);
  await page.keyboard.press('Enter');

  for (const line of BATTERY) {
    await page.keyboard.type(line.text);
    await page.keyboard.press('Enter');
  }
  // Prove the typing actually reached the document before measuring anything —
  // otherwise a focus/overlay problem masquerades as a bidi measurement failure.
  await page.waitForFunction((texts) => {
    const t = (document.querySelector('#editor') || {}).textContent || '';
    return texts.every((x) => t.includes(x));
  }, BATTERY.map((l) => l.text));
  await shot('S4.4-rtl13-flow-typed.png');

  // --- Flow: initial measurement of every battery line -------------------
  const flowBefore = {};
  for (const line of BATTERY) {
    const m = await measureLine(page, '#editor',
      ['.rga-block-action', '.rga-block-dialogue', '.rga-block-parenthetical'],
      line.text, line.subs);
    flowBefore[line.key] = m;
    expect(m.ok, `Flow: battery line "${line.key}" not found after typing`).toBe(true);
  }

  // (a) sentence-final punctuation renders at the LEFT (reading-end) of the line.
  ['period', 'question', 'guillemets', 'quotes', 'bracketLatin', 'latinThenPeriod', 'digitPercent'].forEach((key) => {
    const m = flowBefore[key];
    const fin = m.subs.final;
    expect(fin, `Flow: no "final" punctuation resolved for "${key}"`).not.toBeNull();
    const distFromLeft = fin.left - m.lineRect.left;
    const distFromRight = m.lineRect.right - fin.right;
    expect(distFromLeft, `Flow "${key}": final punctuation should hug the LEFT (reading-end) of the line; `
      + `distFromLeft=${distFromLeft.toFixed(1)} distFromRight=${distFromRight.toFixed(1)}`)
      .toBeLessThan(distFromRight);
  });

  // (b) paired delimiters mirror: opening glyph sits to the RIGHT of the closing glyph.
  ['parenMixed', 'guillemets', 'bracketLatin'].forEach((key) => {
    const m = flowBefore[key];
    expect(m.subs.open, `Flow "${key}": opening delimiter not resolved`).not.toBeNull();
    expect(m.subs.close, `Flow "${key}": closing delimiter not resolved`).not.toBeNull();
    expect(m.subs.open.left, `Flow "${key}": opening delimiter (${m.subs.open.left.toFixed(1)}) must sit RIGHT of `
      + `the closing delimiter (${m.subs.close.left.toFixed(1)}) — open-on-right, close-on-left`)
      .toBeGreaterThan(m.subs.close.left);
  });

  // quotes (ASCII " ") — same char both sides, resolved via two forward indexOf calls.
  {
    const openQuote = await measureLine(page, '#editor', ['.rga-block-action'], BATTERY.find((l) => l.key === 'quotes').text,
      [{ key: 'q1', text: '"' }]);
    const q1idx = openQuote.subs.q1 ? openQuote.subs.q1.idx : -1;
    const closeQuote = await measureLine(page, '#editor', ['.rga-block-action'], BATTERY.find((l) => l.key === 'quotes').text,
      [{ key: 'q2', text: '"', from: q1idx + 1 }]);
    expect(openQuote.subs.q1, 'Flow "quotes": opening quote not resolved').not.toBeNull();
    expect(closeQuote.subs.q2, 'Flow "quotes": closing quote not resolved').not.toBeNull();
    expect(openQuote.subs.q1.left, `Flow "quotes": opening " (${openQuote.subs.q1.left.toFixed(1)}) must sit RIGHT of `
      + `closing " (${closeQuote.subs.q2.left.toFixed(1)})`).toBeGreaterThan(closeQuote.subs.q2.left);
  }

  // digit-run + % — RECORD adjacency (soft signal per protocol; the battery
  // names this case without a numbered pass criterion of its own).
  {
    const m = flowBefore.digitPercent;
    const gap = m.subs.percent && m.subs.digits
      ? Math.min(Math.abs(m.subs.percent.left - m.subs.digits.right), Math.abs(m.subs.digits.left - m.subs.percent.right))
      : null;
    // eslint-disable-next-line no-console
    console.log('[S4.4 RTL-13 digit%] ' + JSON.stringify({ digits: m.subs.digits, percent: m.subs.percent, gap }));
  }

  // --- (c) stability across an edit: insert a char EARLIER in two lines --
  const editTargets = ['period', 'parenMixed'];
  const flowAfter = {};
  for (const key of editTargets) {
    const line = BATTERY.find((l) => l.key === key);
    const placed = await placeCaretAtLogicalStart(page, line.text);
    expect(placed, `could not place caret at logical start of "${key}"`).toBe(true);
    await page.waitForTimeout(80);
    await page.keyboard.type('خ');
    await page.waitForTimeout(150);
    const m = await measureLine(page, '#editor',
      ['.rga-block-action', '.rga-block-dialogue', '.rga-block-parenthetical'],
      line.text.length > 3 ? line.text.slice(2) : line.text,   // still-present tail substring
      key === 'period' ? [{ key: 'final', text: '.', last: true }] : [{ key: 'open', text: '(' }, { key: 'close', text: ')', last: true }]);
    flowAfter[key] = m;
  }
  await shot('S4.4-rtl13-flow-edited.png');

  {
    const before = flowBefore.period;
    const after = flowAfter.period;
    expect(after.ok, 'Flow "period": line not found after edit').toBe(true);
    const beforeSide = (before.subs.final.left - before.lineRect.left) < (before.lineRect.right - before.subs.final.right);
    const afterSide = (after.subs.final.left - after.lineRect.left) < (after.lineRect.right - after.subs.final.right);
    expect(afterSide, 'Flow "period": final punctuation migrated to the opposite side after an earlier-in-line edit')
      .toBe(beforeSide);
  }
  {
    const before = flowBefore.parenMixed;
    const after = flowAfter.parenMixed;
    expect(after.ok, 'Flow "parenMixed": line not found after edit').toBe(true);
    expect(after.subs.open, 'Flow "parenMixed": opening delimiter not resolved after edit').not.toBeNull();
    expect(after.subs.close, 'Flow "parenMixed": closing delimiter not resolved after edit').not.toBeNull();
    expect(after.subs.open.left, 'Flow "parenMixed": paren pairing swapped after an earlier-in-line edit')
      .toBeGreaterThan(after.subs.close.left);
  }

  // --- (d) identical result in Print Preview ------------------------------
  await openPreview();
  await shot('S4.4-rtl13-print.png');

  const printResults = {};
  for (const line of BATTERY) {
    const m = await measureLine(page, '.rga-page-sheet-content',
      ['.rga-print-block-action', '.rga-print-block-dialogue', '.rga-print-block-parenthetical'],
      line.text, line.subs);
    printResults[line.key] = m;
  }

  ['period', 'question', 'guillemets', 'bracketLatin', 'latinThenPeriod'].forEach((key) => {
    const m = printResults[key];
    expect(m.ok, `Print: battery line "${key}" not found`).toBe(true);
    const fin = m.subs.final;
    expect(fin, `Print: no "final" punctuation resolved for "${key}"`).not.toBeNull();
    const distFromLeft = fin.left - m.lineRect.left;
    const distFromRight = m.lineRect.right - fin.right;
    expect(distFromLeft, `Print "${key}": final punctuation should hug the LEFT (reading-end) of the line`)
      .toBeLessThan(distFromRight);
  });
  ['parenMixed', 'guillemets', 'bracketLatin'].forEach((key) => {
    const m = printResults[key];
    expect(m.subs.open, `Print "${key}": opening delimiter not resolved`).not.toBeNull();
    expect(m.subs.close, `Print "${key}": closing delimiter not resolved`).not.toBeNull();
    expect(m.subs.open.left, `Print "${key}": opening delimiter must sit RIGHT of the closing delimiter`)
      .toBeGreaterThan(m.subs.close.left);
  });

  await closePreview();

  if (EVIDENCE_DIR) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'S4.4-rtl13-measurements.json'),
      JSON.stringify({ flowBefore, flowAfter, printResults }, null, 2));
  }

  // eslint-disable-next-line no-console
  console.log('[S4.4 RTL-13 evidence] battery=' + BATTERY.length
    + ' flowOk=' + Object.values(flowBefore).filter((m) => m.ok).length
    + ' printOk=' + Object.values(printResults).filter((m) => m.ok).length);
});
