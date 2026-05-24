'use strict';
// ============================================================================
// RTL Calibration Probe — Slice 0 (forensic diagnostic, read-only)
//
// PURPOSE
//   Measure REALITY before any PageMap change. For the Mysterious Guest RTL
//   fixture it compares, per block type:
//     - PageMap's predicted line count   (pure-math, Courier monospace model)
//     - the actual rendered geometry      (real editor CSS + bundled fonts)
//   and emits the calibration evidence the forensic report called for:
//   RTL chars-per-inch, leadingBlankLines, and column widths.
//
// IT CHANGES NOTHING. It only *reads* production JS (require) and production
// CSS (the measurement page <link>s it). No PageMap algorithm change, no
// visual change, no production file is written. Output goes to
// tests/diagnostics/rtl-calibration/calibration-report.md + stdout.
//
// HOW IT WORKS
//   Half A (Node)     — load the real Normalizer + LayoutProfile + PageMap,
//                       run them on the fixture, capture measureBlock() per block.
//   Half B (Chromium) — a hidden Electron window renders a faithful replica of
//                       the editor's Flow-view block hierarchy with the real
//                       CSS + bundled Noto Naskh Arabic, and measures every
//                       block with getBoundingClientRect.
//   The two halves are joined into the diagnostic table.
//
// RUN
//   node_modules/.bin/electron tests/diagnostics/rtl-calibration/probe.js
// ============================================================================
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const RD = path.resolve(HERE, '../../..');            // rwanga-editor root
const R = (p) => path.join(RD, p);
const PX_PER_IN = 96;
const TYPES = ['action', 'dialogue', 'character', 'parenthetical', 'sceneHeading', 'transition'];

// ---------------------------------------------------------------------------
// Half A — PageMap prediction (pure Node, real production modules)
// ---------------------------------------------------------------------------
function runPrediction() {
  global.window = { Rga: {} };
  global.window.RgaProseMirror = { Schema: require(R('node_modules/prosemirror-model')).Schema };
  require(R('renderer/js/constants.js'));
  require(R('renderer/js/framework/base-outer-marks.js'));
  require(R('renderer/js/doc-types/screenplay/schema-v3.js'));
  require(R('renderer/js/framework/layout-profile.js'));
  require(R('renderer/js/framework/pagemap-engine.js'));
  require(R('renderer/js/framework/screenplay-normalizer.js'));
  const Rga = global.window.Rga;

  const schema = Rga.DocTypes.screenplay.buildSchemaV3();
  const parsed = JSON.parse(fs.readFileSync(R('tests/fixtures/mysterious-guest-rtl.rga'), 'utf8'));
  const doc = schema.nodeFromJSON(parsed.body);
  const blocks = Rga.Normalizer.normalize(doc);
  const profile = Rga.LayoutProfile.compose(parsed.metadata.screenplayProfile, parsed.settings);

  const samples = blocks.map((b, i) => {
    const content = Rga.PageMap.measureBlock(b, profile, true);   // isFirstOnPage → no leading blank
    const total   = Rga.PageMap.measureBlock(b, profile, false);  // includes leading blank
    const text = b.nodeType === 'sceneHeading'
      ? ((b.heading && b.heading.location) || '')
      : (b.text || '');
    return {
      index: i, type: b.nodeType, text: text,
      predictedContent: content,
      predictedLeadingBlank: total - content
    };
  });
  return { samples, profile, hollywood: Rga.LayoutProfile._HOLLYWOOD_DEFAULTS };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function mean(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }
function sum(a)  { return a.reduce((x, y) => x + y, 0); }
function median(a) {
  if (!a.length) return 0;
  const s = a.slice().sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function f(n, d) { return (n == null || isNaN(n)) ? '—' : Number(n).toFixed(d == null ? 2 : d); }
function pad(s, w) { s = String(s); return s.length >= w ? s : s + ' '.repeat(w - s.length); }
function padL(s, w) { s = String(s); return s.length >= w ? s : ' '.repeat(w - s.length) + s; }

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
function buildReport(profile, hollywood, predByIndex, measured) {
  const L = [];
  L.push('# RTL Calibration Probe — Slice 0');
  L.push('');
  L.push('Fixture: `tests/fixtures/mysterious-guest-rtl.rga`  ·  generated ' + new Date().toISOString().slice(0, 10));
  L.push('Method: PageMap pure-math prediction vs. real-CSS rendered geometry (hidden Electron/Chromium window).');
  L.push('');
  L.push('## PageMap profile under test');
  L.push('');
  L.push('- paper: ' + f(profile.pageSize.w, 3) + ' × ' + f(profile.pageSize.h, 3) + ' in (A4)');
  L.push('- font assumed by PageMap: ' + profile.font.family + ' ' + profile.font.sizePt + 'pt, leading ' + profile.font.leading);
  L.push('- linesPerPage budget: **' + profile.linesPerPage + '**  (theoretical ' + profile.theoreticalLinesPerPage + ' − safety ' + profile.safetyLines + ')');
  L.push('- cpl (chars-per-line) by type: ' + TYPES.map(t => t + ' ' + (profile.blocks[t] ? profile.blocks[t].cpl : '?')).join(', '));
  L.push('- nominal block widths (in): ' + TYPES.map(t => t + ' ' + (hollywood.blockWidthsIn[t] != null ? hollywood.blockWidthsIn[t] : '?')).join(', '));
  L.push('- leadingBlankLines: ' + TYPES.map(t => t + ' ' + (hollywood.leadingBlankLines[t] || 0)).join(', '));
  L.push('');

  measured.scenarios.forEach((sc) => {
    L.push('---');
    L.push('');
    L.push('## Scenario: `' + sc.id + '`');
    L.push('');
    L.push('_' + sc.desc + '_');
    L.push('');

    // group measured blocks by type, join with prediction
    const byType = {};
    TYPES.forEach(t => { byType[t] = []; });
    sc.perBlock.forEach((m) => {
      const p = predByIndex[m.index];
      if (!p || !byType[m.type]) return;
      byType[m.type].push({ m: m, p: p });
    });

    // resolved font (CSS font-family string actually computed on an action block)
    const fontProbe = (byType.action[0] || byType.dialogue[0] || sc.perBlock[0]);
    L.push('- resolved CSS `font-family`: `' + (fontProbe ? fontProbe.m.fontFamily : '?') + '`');
    L.push('- resolved `font-size`: ' + (fontProbe ? fontProbe.m.fontSizePx : '?') + '  ·  CSS `line-height`: ' + (fontProbe ? fontProbe.m.lineHeightCss : '?'));
    L.push('- rendered 1-line box per type (px → in): ' +
      TYPES.map(t => t + ' ' + f(sc.refH[t], 1) + 'px/' + f(sc.refH[t] / PX_PER_IN, 3)).join(', '));
    L.push('- per-scene chrome PageMap ignores: scene-number badge ' +
      f(sc.sceneChrome.numBadgeHeightPx, 1) + 'px (' + f(sc.sceneChrome.numBadgeHeightPx / PX_PER_IN, 3) + 'in)' +
      ', scene margin ' + f(sc.sceneChrome.sceneMarginTopPx, 1) + '+' + f(sc.sceneChrome.sceneMarginBottomPx, 1) + 'px');
    L.push('');

    // ---- main table ----
    L.push('### Predicted vs Actual — content lines');
    L.push('');
    L.push('| BlockType     | Samples | PredictedLines | ActualLines | ErrorRatio | Note |');
    L.push('|---------------|---------|----------------|-------------|------------|------|');
    const corr = {};
    TYPES.forEach((t) => {
      const rows = byType[t];
      if (!rows.length) {
        L.push('| ' + pad(t, 13) + ' | ' + padL(0, 7) + ' | — | — | — | no samples |');
        return;
      }
      const predC = rows.map(r => r.p.predictedContent);
      const actL  = rows.map(r => r.m.actualLines);
      const ratio = sum(predC) / Math.max(1, sum(actL));
      const note = ratio > 1.15 ? 'PageMap OVER-counts' : (ratio < 0.87 ? 'PageMap UNDER-counts' : 'roughly aligned');
      L.push('| ' + pad(t, 13) + ' | ' + padL(rows.length, 7) + ' | ' +
        padL(f(mean(predC)), 14) + ' | ' + padL(f(mean(actL)), 11) + ' | ' +
        padL(f(ratio), 10) + ' | ' + note + ' |');

      // ---- collect correction evidence ----
      const widthsIn = rows.map(r => r.m.widthPx / PX_PER_IN);
      const lineBoxIn = sc.refH[t] / PX_PER_IN;
      const marginLines = rows.map(r => r.m.marginTopPx / Math.max(1, sc.refH[t]));
      // observed chars-per-line, from blocks that actually wrapped (>=2 lines)
      const multi = rows.filter(r => r.m.actualLines >= 2);
      const cplObs = multi.map(r => r.m.chars / r.m.actualLines);
      const widthIn = median(widthsIn);
      corr[t] = {
        samples: rows.length,
        widthIn: widthIn,
        lineBoxIn: lineBoxIn,
        predLBL: median(rows.map(r => r.p.predictedLeadingBlank)),
        measMarginPx: median(rows.map(r => r.m.marginTopPx)),
        measMarginLines: median(marginLines),
        multiCount: multi.length,
        cplObserved: multi.length ? median(cplObs) : null,
        cpiObserved: multi.length ? (median(cplObs) / Math.max(0.01, widthIn)) : null,
        meanHeightIn: mean(rows.map(r => r.m.heightPx)) / PX_PER_IN,
        errorRatio: ratio,
        meanActual: mean(actL),
        meanPredContent: mean(predC)
      };
    });
    L.push('');
    L.push('_ErrorRatio = Σ predicted ÷ Σ actual. >1 ⇒ PageMap reserves more lines than the text renders._');
    L.push('');

    // ---- per-type detail ----
    L.push('### Per-type detail');
    L.push('');
    L.push('| Type | EffWidth in (PageMap nominal) | LineBox in | Mean rendered h (in) | leadingBlank: PageMap → measured | Observed cpl / cpi |');
    L.push('|------|-------------------------------|------------|----------------------|----------------------------------|--------------------|');
    TYPES.forEach((t) => {
      const c = corr[t];
      if (!c) { L.push('| ' + t + ' | — | — | — | — | — |'); return; }
      const nominal = hollywood.blockWidthsIn[t];
      const cplStr = c.cplObserved != null
        ? (f(c.cplObserved, 1) + ' / ' + f(c.cpiObserved, 1) + ' cpi  (n=' + c.multiCount + ')')
        : ('— (no multi-line samples)');
      L.push('| ' + pad(t, 4) + ' | ' +
        f(c.widthIn, 2) + ' in  (PageMap ' + nominal + ' → cpl ' + (profile.blocks[t] ? profile.blocks[t].cpl : '?') + ') | ' +
        f(c.lineBoxIn, 3) + ' | ' +
        f(c.meanHeightIn, 3) + ' | ' +
        (c.predLBL || 0) + ' line → ' + f(c.measMarginPx, 1) + 'px (' + f(c.measMarginLines, 2) + ' line) | ' +
        cplStr + ' |');
    });
    L.push('');
    sc._corr = corr;
  });

  // ---------------------------------------------------------------------
  // Recommended correction values
  // ---------------------------------------------------------------------
  L.push('---');
  L.push('');
  L.push('## Recommended correction values (evidence for Slice 1)');
  L.push('');
  const naskh = measured.scenarios.find(s => s.id === 'naskh-forced') || measured.scenarios[0];
  const appcur = measured.scenarios.find(s => s.id === 'app-current') || measured.scenarios[0];
  const C = naskh._corr;
  const A = appcur._corr;

  L.push('> Two scenarios were measured because the editor only sets `dir=rtl` on `#editor`');
  L.push('> itself, while the font rule `[dir="rtl"] .ProseMirror` needs a `[dir=rtl]`');
  L.push('> *ancestor*. `app-current` = what ships today; `naskh-forced` = the intended');
  L.push('> Naskh rendering. Slice 1 must calibrate against whichever font actually ships.');
  L.push('');
  L.push('Font resolved per scenario (action blocks):');
  L.push('- `app-current`  → `' + ((appcur.perBlock.find(b => b.type === 'action') || {}).fontFamily || '?') + '`');
  L.push('- `naskh-forced` → `' + ((naskh.perBlock.find(b => b.type === 'action') || {}).fontFamily || '?') + '`');
  L.push('');
  L.push('**1. RTL chars-per-inch (cpi)** — PageMap currently hardcodes Courier **10 cpi**:');
  L.push('');
  ['action', 'dialogue'].forEach((t) => {
    if (C[t] && C[t].cpiObserved != null) {
      L.push('- ' + t + ': naskh-forced ≈ **' + f(C[t].cpiObserved, 1) + ' cpi**' +
        (A[t] && A[t].cpiObserved != null ? ('  ·  app-current ≈ ' + f(A[t].cpiObserved, 1) + ' cpi') : '') +
        '  _(observed chars ÷ rendered lines ÷ column width; mild lower bound — last line is partial)_');
    }
  });
  L.push('');
  L.push('**2. leadingBlankLines** — PageMap charges 1 full line (' +
    f((naskh.refH.action || 0) / PX_PER_IN, 3) + ' in) before action/character/sceneHeading/transition:');
  L.push('');
  L.push('| Type | PageMap charges | Measured margin (naskh-forced) | Suggested value |');
  L.push('|------|-----------------|--------------------------------|-----------------|');
  TYPES.forEach((t) => {
    if (!C[t]) return;
    L.push('| ' + pad(t, 4) + ' | ' + (C[t].predLBL || 0) + ' line | ' +
      f(C[t].measMarginPx, 1) + 'px = ' + f(C[t].measMarginLines, 2) + ' line | ' +
      f(C[t].measMarginLines, 2) + ' |');
  });
  L.push('');
  L.push('**3. Column widths** — PageMap derives cpl from Hollywood-LTR nominal widths; ' +
    'measured Flow widths differ:');
  L.push('');
  L.push('| Type | PageMap nominal in | Measured effective in | Δ |');
  L.push('|------|--------------------|-----------------------|---|');
  TYPES.forEach((t) => {
    if (!C[t]) return;
    const nominal = hollywood.blockWidthsIn[t];
    L.push('| ' + pad(t, 4) + ' | ' + nominal + ' | ' + f(C[t].widthIn, 2) +
      ' | ' + (C[t].widthIn > nominal ? '+' : '') + f(C[t].widthIn - nominal, 2) + ' in |');
  });
  L.push('');
  L.push('**4. Per-scene chrome** — PageMap models none of it: scene-number badge ' +
    f((naskh.sceneChrome.numBadgeHeightPx) / PX_PER_IN, 3) + 'in + scene margins ' +
    f((naskh.sceneChrome.sceneMarginTopPx + naskh.sceneChrome.sceneMarginBottomPx) / PX_PER_IN, 3) +
    'in per scene (×47 scenes in this fixture).');
  L.push('');
  L.push('_Slice 0 produces evidence only. No production behavior was changed._');
  L.push('');
  return L.join('\n');
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  let code = 0;
  try {
    const { samples, profile, hollywood } = runPrediction();
    const predByIndex = {};
    samples.forEach((s) => { predByIndex[s.index] = s; });

    const win = new BrowserWindow({
      show: false, width: 1200, height: 900,
      webPreferences: { webSecurity: false, offscreen: false }
    });
    await win.loadFile(path.join(HERE, 'probe-page.html'));

    const payload = {
      pageWidthIn: profile.pageSize.w,
      samples: samples.map((s) => ({ index: s.index, type: s.type, text: s.text }))
    };
    const measured = await win.webContents.executeJavaScript(
      'window.__run(' + JSON.stringify(payload) + ')'
    );

    const report = buildReport(profile, hollywood, predByIndex, measured);
    const outPath = path.join(HERE, 'calibration-report.md');
    fs.writeFileSync(outPath, report, 'utf8');
    console.log(report);
    console.log('\n[probe] full report written to tests/diagnostics/rtl-calibration/calibration-report.md');
  } catch (e) {
    console.error('[probe] FAILED:', (e && e.stack) || e);
    code = 1;
  }
  app.exit(code);
});
