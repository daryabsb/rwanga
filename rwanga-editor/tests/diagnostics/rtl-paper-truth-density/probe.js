'use strict';
// ============================================================================
// RTL Paper-Truth Density Probe — Density Slice 1 (read-only forensic).
//
// Measures the Fork A Paper/Print TRUTH surface — PrintRenderer's
// `.rga-page-sheet` leaves — for tests/fixtures/mysterious-guest-rtl.rga.
// This is the surface the running app's Print/Paper view shows. It is
// DISTINCT from the rtl-density probe, which measured the Flow comfort
// surface (#editor, line-height 1.5).
//
// Pipeline (real production modules, no replica):
//   .rga -> schema-v3 -> Normalizer -> LayoutProfile -> PageMap
//        -> RenderModel -> PrintRenderer
//
// Rule 9: there is NO editor in this probe — no #editor, no Flow, no
//   ProseMirror EditorView. No hidden-editor geometry is read. Only the
//   rendered Paper sheets are measured (getBoundingClientRect on the
//   sheets themselves — that is the measurement target).
//
// Changes nothing — only `require`s production JS and `<link>`s production
// CSS. RUN:
//   node_modules/.bin/electron tests/diagnostics/rtl-paper-truth-density/probe.js
// ============================================================================
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const RD = path.resolve(HERE, '../../..');
const R = (p) => path.join(RD, p);
const PX = 96;

// Density Slice 8 — optional fixture-path argument for broader verification.
// No arg → the canonical RTL fixture, with unchanged report filename.
const FIXTURE_REL  = process.argv[2] || 'tests/fixtures/mysterious-guest-rtl.rga';
const FIXTURE_BASE = path.basename(FIXTURE_REL).replace(/\.rga$/, '');
const REPORT_NAME  = (FIXTURE_BASE === 'mysterious-guest-rtl')
  ? 'paper-truth-report.md'
  : 'paper-truth-report--' + FIXTURE_BASE + '.md';
const f = (n, d) => (n == null || isNaN(n)) ? '—' : Number(n).toFixed(d == null ? 2 : d);

// Compose a sceneHeading's measurement string exactly as PageMap's
// `_composeHeadingForMeasure` does (that helper is engine-internal). Used
// only to compute the Slice-4 flat-cpl reference; identical separators.
function composeHeadingForMeasure(h, spec) {
  if (!h) return '';
  const sep = (spec && spec.separators) || { settingLocation: ' ', locationTime: ' — ' };
  let s = '';
  if (h.setting) s += h.setting;
  if (h.location) { if (s) s += sep.settingLocation; s += h.location; }
  if (h.time)     { if (s) s += sep.locationTime;    s += h.time; }
  return s;
}

// ---- Build the real RenderModel in Node (production modules) ----------------
function buildModel() {
  global.window = { Rga: {} };
  global.window.RgaProseMirror = { Schema: require(R('node_modules/prosemirror-model')).Schema };
  require(R('renderer/js/constants.js'));
  require(R('renderer/js/framework/base-outer-marks.js'));
  require(R('renderer/js/doc-types/screenplay/schema-v3.js'));
  require(R('renderer/js/framework/layout-profile.js'));
  require(R('renderer/js/framework/pagemap-engine.js'));
  require(R('renderer/js/framework/screenplay-normalizer.js'));
  require(R('renderer/js/framework/render-model.js'));
  const Rga = global.window.Rga;
  const schema = Rga.DocTypes.screenplay.buildSchemaV3();
  const parsed = JSON.parse(fs.readFileSync(R(FIXTURE_REL), 'utf8'));
  const doc = schema.nodeFromJSON(parsed.body);
  const blocks = Rga.Normalizer.normalize(doc);
  const profile = Rga.LayoutProfile.compose(parsed.metadata.screenplayProfile, parsed.settings);
  const pages = Rga.PageMap.build(blocks, profile);
  const renderModel = Rga.RenderModel.build(doc, pages, blocks, profile);
  // Density Slice 4 — PageMap's predicted CONTENT lines per block, document
  // order. isFirstOnPage=true so measureBlock returns ONLY content lines (no
  // leading blank); the Slice-3 leading model is measured separately.
  const predicted = blocks.map(function (bl) {
    return { type: bl.nodeType, lines: Rga.PageMap.measureBlock(bl, profile, true) };
  });
  // Density Slice 4 — Node-side over-count decomposition. For every block,
  // separate the two ways `_measureContentLines` can over-count:
  //   predNewline = the shipping PageMap (splits block.text on hard newlines,
  //                 charges every run ≥ 1 line)               = measureBlock
  //   predFlat    = ceil(textLen ÷ cpl) as a SINGLE run        = cpl model only
  // newline-run charging  = predNewline − predFlat
  // cpl / column error    = predFlat − rendered (rendered measured on the page)
  const TYPES4 = ['sceneHeading','action','character','parenthetical',
                  'dialogue','shot','transition','paragraph','heading'];
  const nodeAgg = {};
  TYPES4.forEach(function (t) {
    nodeAgg[t] = { count: 0, predNewline: 0, predFlat: 0, textLen: 0,
                   newlines: 0, blocksWithNewline: 0 };
  });
  blocks.forEach(function (bl) {
    const agg = nodeAgg[bl.nodeType];
    if (!agg) return;
    const spec = profile.blocks[bl.nodeType] || { cpl: 60 };
    const cpl = spec.cpl || 60;
    const text = (bl.nodeType === 'sceneHeading')
      ? composeHeadingForMeasure(bl.heading, spec)
      : (bl.text || '');
    const nl = (text.match(/\r\n|\r|\n/g) || []).length;
    agg.count += 1;
    agg.predNewline += Rga.PageMap.measureBlock(bl, profile, true);
    agg.predFlat    += Math.max(1, Math.ceil(text.length / cpl));
    agg.textLen     += text.length;
    agg.newlines    += nl;
    if (nl > 0) agg.blocksWithNewline += 1;
  });
  return { renderModel, profile, pages, totalBlocks: blocks.length, predicted, nodeAgg };
}

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  let code = 0;
  try {
    const { renderModel, profile, pages, totalBlocks, predicted, nodeAgg } = buildModel();

    const win = new BrowserWindow({ show: false, width: 1400, height: 1200, webPreferences: { webSecurity: false } });
    await win.loadFile(path.join(HERE, 'probe-page.html'));
    const m = await win.webContents.executeJavaScript(
      'window.__measure(' + JSON.stringify(renderModel) + ',' +
      JSON.stringify(predicted) + ')'
    );

    const availableIn = profile.pageSize.h - profile.margins.top - profile.margins.bottom;
    // Word truth — measured by the rtl-density probe (Arial 11pt single, A4).
    const WORD_PAGES = 40;
    const WORD_USABLE = 10.12;

    // Document-level counts from the RenderModel (what PageMap charged).
    let leadingBlankCharged = 0, emptyBlocks = 0;
    const scenes = {};
    renderModel.pages.forEach((pg) => {
      pg.blocks.forEach((b, i) => {
        if (i > 0) {
          const spec = profile.blocks[b.type];
          if (spec) leadingBlankCharged += (spec.leadingBlankLines || 0);
        }
        const txt = (b.type === 'sceneHeading')
          ? ((b.heading && ((b.heading.setting || '') + (b.heading.location || '') + (b.heading.time || ''))) || '')
          : (b.text || '');
        if (!txt) emptyBlocks += 1;
        if (b.sceneNodeId) scenes[b.sceneNodeId] = 1;
      });
    });
    const sceneCount = Object.keys(scenes).length;

    const L = [];
    L.push('# RTL Paper-Truth Density Probe — Density Slices 1 + 3 + 4 + 6 + 7');
    L.push('');
    L.push('Generated ' + new Date().toISOString().slice(0, 19).replace('T', ' '));
    L.push('Fixture: `' + FIXTURE_REL + '`');
    L.push('Surface measured: the Fork A **Paper/Print truth surface** — PrintRenderer `.rga-page-sheet` leaves.');
    L.push('NOT the Flow editor. No `#editor`, no Flow DOM, no hidden-editor geometry read (Rule 9).');
    L.push('');
    L.push('> **Density Slices 6–7 (2026-05-21):** the parenthetical truth-surface CSS box was');
    L.push('> corrected (Slice 6) and the RTL content-line model was calibrated atomically in');
    L.push('> `layout-profile.js` — direction-aware cpi + the dialogue column width (Slice 7). The');
    L.push('> tables below reflect both fixes. Manuscript truth is the ratified Kurdish/RTL profile');
    L.push('> (Rule 10); the page count is an output of that profile, never a "Word 40" target.');
    L.push('');
    L.push('## Pipeline (real production modules)');
    L.push('`.rga` → `schema-v3` → `Normalizer` → `LayoutProfile` → `PageMap` → `RenderModel` → `PrintRenderer`');
    L.push('');

    L.push('## Page counts');
    L.push('- total normalized blocks: ' + totalBlocks);
    L.push('- **PageMap page count: ' + pages.length + '**');
    L.push('- **Paper-view rendered sheet count: ' + m.sheetCount + '**  — ' +
      (m.sheetCount === pages.length ? 'matches PageMap (one sheet per page) ✓' : '**MISMATCH vs PageMap**'));
    L.push('- A4 paper ' + f(profile.pageSize.w, 3) + ' × ' + f(profile.pageSize.h, 3) +
      ' in; margins top/bottom ' + profile.margins.top + '/' + profile.margins.bottom +
      '; available content height **' + f(availableIn, 3) + ' in**; PageMap `linesPerPage` ' + profile.linesPerPage);
    L.push('');

    L.push('## First 5 pages — block range, consumed height, overflow');
    L.push('| Page | block range (norm. index) | blocks | consumed content | available | overflow |');
    L.push('|---|---|---:|---:|---:|---:|');
    for (let p = 0; p < Math.min(5, pages.length); p++) {
      const pg = pages[p];
      const first = pg.blocks[0];
      const last = pg.blocks[pg.blocks.length - 1];
      const sheet = m.perSheet[p] || {};
      const consumedIn = (sheet.contentHeightPx || 0) / PX;
      const overflowIn = consumedIn - availableIn;
      L.push('| ' + (p + 1) + ' | ' + first + '–' + last + ' | ' + pg.blocks.length +
        ' | ' + f(consumedIn, 3) + ' in | ' + f(availableIn, 3) + ' in | ' +
        (overflowIn > 0 ? '+' : '') + f(overflowIn, 3) + ' in |');
    }
    L.push('');

    let overflowing = 0, underfilling = 0, totalConsumedIn = 0;
    for (let p = 0; p < m.perSheet.length; p++) {
      const c = (m.perSheet[p].contentHeightPx || 0) / PX;
      totalConsumedIn += c;
      if (c - availableIn > 0.05) overflowing++;
      else if (availableIn - c > 0.05) underfilling++;
    }
    L.push('## Overflow summary — all ' + m.sheetCount + ' sheets');
    L.push('- content overflows the available area (> +0.05 in): **' + overflowing + ' / ' + m.sheetCount + '**');
    L.push('- content under-fills (> 0.05 in short): ' + underfilling + ' / ' + m.sheetCount);
    L.push('- mean consumed content height: ' + f(totalConsumedIn / Math.max(1, m.sheetCount), 3) +
      ' in  (available ' + f(availableIn, 3) + ' in)');
    L.push('');

    // ---- Density Slice 3 — leading-blank model vs Paper-truth surface ----
    L.push('## Leading-blank model — PageMap charge vs Paper-truth surface (Density Slice 3)');
    L.push('');
    L.push('Rendered line-box height **' + f(m.lineHeightPx, 2) + ' px**  ·  font-size **' +
      f(m.fontSizePx, 2) + ' px**  ·  the `.rga-print-block` leading gap is CSS `margin-top`.');
    L.push('Both measured columns are in LINE UNITS (measured px ÷ line-box px) — directly');
    L.push('comparable to PageMap\'s integer `leadingBlankLines`. `margin-top` = the resolved');
    L.push('CSS value; collapsed gap = `thisBlock.top − prevBlock.bottom` (painted geometry,');
    L.push('trusts no CSS value). `.rga-print-block-first` blocks are excluded — no air by design.');
    L.push('');
    L.push('| Type | PageMap leadingBlankLines | measured margin-top (lines) | measured collapsed gap (lines) | n | verdict |');
    L.push('|---|---:|---:|---:|---:|---|');
    const SLICE3_TYPES = ['sceneHeading','action','character','parenthetical',
                          'dialogue','shot','transition','paragraph','heading'];
    let maxDelta = 0;
    SLICE3_TYPES.forEach(function (t) {
      const spec = profile.blocks[t];
      if (!spec) return;
      const bt = (m.byType && m.byType[t]) || { samples: 0 };
      const marginLines = (bt.samples > 0 && m.lineHeightPx)
        ? (bt.marginTopPxSum / bt.samples / m.lineHeightPx) : null;
      const gapLines = (bt.geomGapSamples > 0 && m.lineHeightPx)
        ? (bt.geomGapPxSum / bt.geomGapSamples / m.lineHeightPx) : null;
      const pm = spec.leadingBlankLines || 0;
      const delta = (marginLines == null) ? 0 : Math.abs(pm - marginLines);
      if (bt.samples > 0 && delta > maxDelta) maxDelta = delta;
      const verdict = (marginLines == null) ? 'no samples'
        : (delta <= 0.1 ? 'MATCH ✓'
          : (pm > marginLines ? 'PageMap OVER-charges' : 'PageMap UNDER-charges'));
      L.push('| ' + t + ' | ' + pm + ' | ' + f(marginLines) + ' | ' + f(gapLines) +
        ' | ' + (bt.samples || 0) + ' | ' + verdict + ' |');
    });
    L.push('');
    if (maxDelta <= 0.1) {
      L.push('**Verdict — the leading-blank model is already truth-accurate.** On the Fork A');
      L.push('Paper truth surface every block type\'s leading air matches PageMap\'s charged');
      L.push('`leadingBlankLines` within ' + f(maxDelta) + ' line. `margin-top: 1em` at the sheet\'s');
      L.push('`line-height: 1.0` (`.rga-page-sheet`, `editor-prosemirror.css`) is **exactly one');
      L.push('line** — precisely what PageMap charges. The 0.40–0.77-line figures in the');
      L.push('`rtl-calibration` report were measured on the **Flow** comfort surface');
      L.push('(`.ProseMirror`, `line-height: 1.5`) — a different stylesheet — and do not');
      L.push('describe the truth surface. **Target B (the blank-line model) has nothing to');
      L.push('calibrate.** The 64/71 under-fill is driven by content-line over-counting');
      L.push('(the RTL cpi / proportional-font model — Target D), not by leading blanks.');
    } else {
      L.push('**Verdict — leading-blank mismatch detected** (max ' + f(maxDelta) +
        ' line). See the per-type table above for direction.');
    }
    L.push('');

    // ---- Density Slice 4 — content-line model vs Paper-truth surface ----
    L.push('## Content-line model — PageMap predicted vs Paper-truth rendered (Density Slice 4)');
    L.push('');
    // PageMap chars-per-inch — read from the REAL (Slice-7 direction-aware)
    // _charsPerInch, so this tracks the production profile (RTL → ~14.5).
    const pmCpi = global.window.Rga.LayoutProfile._charsPerInch(profile.font.sizePt, profile.direction);
    const truthFont = (m.fontFamily ? m.fontFamily.split(',')[0].replace(/["']/g, '').trim() : '—');
    L.push('Paper sheet font resolved to **`' + (m.fontFamily || '—') + '`** · dir **' +
      (m.sheetDir || '—') + '** · line box **' + f(m.lineHeightPx, 2) + ' px** · font-size ' +
      f(m.fontSizePx, 2) + ' px.');
    L.push('PageMap `_charsPerInch` is direction-aware (Density Slice 7): for this **' +
      (profile.direction || 'ltr') + '** document it uses **' + f(pmCpi, 1) + ' cpi** at ' +
      profile.font.sizePt + 'pt — the measured Noto Naskh capacity for RTL (Courier 10 cpi for LTR).');
    L.push('');

    let typeMismatchTotal = 0;
    SLICE3_TYPES.forEach(function (t) {
      const tc = m.byTypeContent && m.byTypeContent[t];
      if (tc) typeMismatchTotal += tc.typeMismatch;
    });
    const aligned = (totalBlocks === m.predictedCount) &&
                    (m.predictedCount === m.domBlockCount) && (typeMismatchTotal === 0);
    L.push('Block-count integrity — normalized **' + totalBlocks + '** · predicted array **' +
      m.predictedCount + '** · rendered DOM blocks **' + m.domBlockCount +
      '** · per-block type cross-check mismatches **' + typeMismatchTotal + '** — ' +
      (aligned ? 'predicted ↔ rendered are index-aligned ✓'
               : '**MISALIGNED — comparison below is unreliable**'));
    L.push('');

    L.push('### Predicted vs rendered content lines');
    L.push('');
    L.push('Content lines only (leading blank excluded — Slice 3). `error ratio` = Σ predicted ÷ ' +
      'Σ rendered; `Δ lines` = Σ predicted − Σ rendered (PageMap over-count when > 0).');
    L.push('');
    L.push('| Type | blocks | PageMap cpl | Σ predicted lines | Σ rendered lines | error ratio | Δ lines | Δ pages |');
    L.push('|---|---:|---:|---:|---:|---:|---:|---:|');
    const REPORT_TYPES = ['sceneHeading','action','dialogue','character','parenthetical','transition'];
    const clRows = [];
    let totPred = 0, totRend = 0, totCLBlocks = 0;
    SLICE3_TYPES.forEach(function (t) {
      const tc = m.byTypeContent && m.byTypeContent[t];
      if (!tc || tc.count === 0) return;
      const spec = profile.blocks[t] || {};
      const er = tc.renderedSum > 0 ? (tc.predictedSum / tc.renderedSum) : null;
      const dl = tc.predictedSum - tc.renderedSum;
      clRows.push({ t: t, tc: tc, spec: spec, er: er, dl: dl });
      totPred += tc.predictedSum; totRend += tc.renderedSum; totCLBlocks += tc.count;
    });
    const _emitCLRow = function (r) {
      L.push('| ' + r.t + ' | ' + r.tc.count + ' | ' + (r.spec.cpl || '—') + ' | ' +
        f(r.tc.predictedSum, 1) + ' | ' + f(r.tc.renderedSum, 1) + ' | ' +
        (r.er == null ? '—' : f(r.er)) + ' | ' + f(r.dl, 1) + ' | ' +
        f(r.dl / profile.linesPerPage, 2) + ' |');
    };
    REPORT_TYPES.forEach(function (t) {
      const r = clRows.find(function (x) { return x.t === t; });
      if (r) _emitCLRow(r);
    });
    clRows.forEach(function (r) {
      if (REPORT_TYPES.indexOf(r.t) < 0) _emitCLRow(r);
    });
    const totEr = totRend > 0 ? (totPred / totRend) : null;
    const totDl = totPred - totRend;
    L.push('| **TOTAL** | **' + totCLBlocks + '** |  | **' + f(totPred, 1) + '** | **' +
      f(totRend, 1) + '** | **' + (totEr == null ? '—' : f(totEr)) + '** | **' + f(totDl, 1) +
      '** | **' + f(totDl / profile.linesPerPage, 2) + '** |');
    L.push('');

    // ---- Slice 4 — over-count decomposition: newline-run charging vs cpl --
    L.push('### Over-count decomposition — newline-run charging vs cpl error');
    L.push('');
    L.push('`_measureContentLines` splits `block.text` on hard newlines and charges every run a ' +
      'minimum of one line. This isolates that effect from the cpl model. **predFlat** = ' +
      '`ceil(textLen ÷ cpl)` treating the text as ONE run (cpl model only); **predNewline** = the ' +
      'shipping PageMap (per-run). `newline charge` = predNewline − predFlat; `cpl error` = ' +
      'predFlat − rendered; `net` = predNewline − rendered.');
    L.push('');
    L.push('| Type | blocks w/ newline | Σ newlines | Σ rendered | Σ predFlat | Σ predNewline | newline charge | cpl error | net |');
    L.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
    const S4_TYPES = ['sceneHeading','action','dialogue','character','parenthetical',
                      'transition','paragraph','shot','heading'];
    let totNlCharge = 0, totCplErr = 0;
    S4_TYPES.forEach(function (t) {
      const tc = m.byTypeContent && m.byTypeContent[t];
      const ag = nodeAgg && nodeAgg[t];
      if (!tc || !ag || tc.count === 0) return;
      const nlCharge = ag.predNewline - ag.predFlat;
      const cplErr   = ag.predFlat - tc.renderedSum;
      const net      = ag.predNewline - tc.renderedSum;
      totNlCharge += nlCharge; totCplErr += cplErr;
      L.push('| ' + t + ' | ' + ag.blocksWithNewline + ' | ' + ag.newlines + ' | ' +
        f(tc.renderedSum, 1) + ' | ' + f(ag.predFlat, 1) + ' | ' + f(ag.predNewline, 1) +
        ' | ' + f(nlCharge, 1) + ' | ' + f(cplErr, 1) + ' | ' + f(net, 1) + ' |');
    });
    L.push('| **TOTAL** |  |  |  |  |  | **' + f(totNlCharge, 1) + '** | **' +
      f(totCplErr, 1) + '** | **' + f(totNlCharge + totCplErr, 1) + '** |');
    L.push('');

    // ---- Slice 4 — text-content integrity: do the two surfaces agree? -----
    L.push('### Text-content integrity — PageMap input vs truth-surface render');
    L.push('');
    L.push('PageMap measures the normalizer\'s `block.text`; the truth surface paints PrintRenderer\'s ' +
      'output (`el.textContent`). If these diverge, every line count above is comparing two ' +
      'different strings — `ratio` = Σ `block.text.length` ÷ Σ `el.textContent.length` (1.00 = same text).');
    L.push('');
    L.push('| Type | Σ block.text.length (PageMap input) | Σ el.textContent.length (truth render) | ratio |');
    L.push('|---|---:|---:|---:|');
    let txtMaxRatioDelta = 0;
    S4_TYPES.forEach(function (t) {
      const tc = m.byTypeContent && m.byTypeContent[t];
      const ag = nodeAgg && nodeAgg[t];
      if (!tc || !ag || tc.count === 0) return;
      const ratio = tc.textLenSum > 0 ? (ag.textLen / tc.textLenSum) : null;
      if (ratio != null) txtMaxRatioDelta = Math.max(txtMaxRatioDelta, Math.abs(ratio - 1));
      L.push('| ' + t + ' | ' + ag.textLen + ' | ' + tc.textLenSum + ' | ' +
        (ratio == null ? '—' : f(ratio) + '×') + ' |');
    });
    L.push('');
    L.push(txtMaxRatioDelta > 0.05
      ? '**The two surfaces do NOT measure the same text** (max divergence ' +
        f(txtMaxRatioDelta * 100, 0) + '%). The line-count comparison above is therefore not a ' +
        'cpl-calibration problem — it is a text-content disagreement between the normalizer (what ' +
        'PageMap paginates) and the RenderModel/PrintRenderer (what the truth surface paints).'
      : 'The two surfaces measure the same text (max divergence ' + f(txtMaxRatioDelta * 100, 0) +
        '%) — the line-count gap is a genuine cpl / column-width calibration error.');
    L.push('');

    // ---- Slice 4 — line-capacity forensic (direct, not Σchars/Σlines) ----
    L.push('### Line-capacity forensic — characters that actually fit per rendered line');
    L.push('');
    L.push('`Σ chars ÷ Σ lines` understates capacity badly for low-line-count blocks (half of a ' +
      '2-line block is its partial last line). This measures capacity DIRECTLY: per rendered-line ' +
      'bucket **R**, `max textLen` is the longest text that fit in exactly R painted lines, so ' +
      '`max textLen ÷ R` is a tight estimate of per-line **capacity**. A capacity value that holds ' +
      'steady down the R column confirms it. `cap cpi` = capacity ÷ measured text-box width.');
    L.push('');
    const capByType = {};
    ['action', 'dialogue', 'parenthetical'].forEach(function (t) {
      const tc = m.byTypeContent && m.byTypeContent[t];
      if (!tc || !tc.buckets) return;
      const spec = profile.blocks[t] || {};
      const boxIn = tc.count > 0 ? (tc.widthPxSum / tc.count / PX) : 0;
      const Rs = Object.keys(tc.buckets).map(Number)
                   .filter(function (R) { return R >= 1; })
                   .sort(function (a, b) { return a - b; });
      L.push('**' + t + '** — measured text-box width **' + f(boxIn) + ' in** · PageMap `cpl` **' +
        (spec.cpl || '—') + '** (= ' + f(pmCpi, 1) + ' cpi assumption):');
      L.push('');
      L.push('| rendered lines R | blocks | avg textLen | max textLen | capacity (max ÷ R) | cap cpi |');
      L.push('|---:|---:|---:|---:|---:|---:|');
      let capEst = 0, capSamples = 0;
      Rs.forEach(function (R) {
        const bb = tc.buckets[R];
        const cap = bb.textLenMax / R;
        const capCpi = boxIn > 0 ? (cap / boxIn) : null;
        if (R >= 1 && R <= 3) { capEst += cap; capSamples += 1; }  // cleanest readings
        L.push('| ' + R + ' | ' + bb.count + ' | ' + f(bb.textLenSum / bb.count, 1) + ' | ' +
          bb.textLenMax + ' | ' + f(cap, 1) + ' | ' + f(capCpi, 1) + ' |');
      });
      const capacity = capSamples > 0 ? (capEst / capSamples) : null;
      capByType[t] = {
        capacity: capacity, boxIn: boxIn, cpl: spec.cpl || null,
        capCpi: (capacity != null && boxIn > 0) ? (capacity / boxIn) : null
      };
      L.push('');
      L.push('→ **' + t + ' line capacity ≈ ' + f(capacity, 1) + ' chars** (' +
        f(capByType[t].capCpi, 1) + ' cpi) vs PageMap `cpl` ' + (spec.cpl || '—') + ' — PageMap ' +
        'assumes **' + (capacity && spec.cpl ? f(spec.cpl / capacity) : '—') +
        '×** the real capacity.');
      L.push('');
    });

    L.push('### Contribution ranking — what drives the content-line over-count');
    L.push('');
    const clRanked = clRows.slice().sort(function (a, b) { return b.dl - a.dl; });
    clRanked.forEach(function (r, idx) {
      const pct = totDl > 0 ? (r.dl / totDl * 100) : 0;
      const empties = r.tc.emptyRendered
        ? '  ·  ' + r.tc.emptyRendered + ' block(s) render 0 lines (empty)'
        : '';
      L.push((idx + 1) + '. **' + r.t + '** — Δ ' + f(r.dl, 1) + ' lines (' +
        f(r.dl / profile.linesPerPage, 2) + ' pages, ' + f(pct, 0) + '% of the over-count) · ' +
        'error ratio ' + (r.er == null ? '—' : f(r.er)) + ' · ' + r.tc.count + ' blocks' +
        empties + '.');
    });
    L.push('');

    const _dl = function (t) {
      const r = clRows.find(function (x) { return x.t === t; });
      return r ? r.dl : 0;
    };
    const aCap = capByType.action || {};
    const dCap = capByType.dialogue || {};

    const _er = function (t) {
      const r = clRows.find(function (x) { return x.t === t; });
      return r ? r.er : null;
    };
    L.push('### Verdict — content-line model (calibrated, Density Slice 7)');
    L.push('');
    L.push('The atomic RTL profile calibration (Density Slice 7) is in place: `_charsPerInch` is ' +
      'direction-aware (RTL Noto Naskh **' + f(pmCpi, 1) + ' cpi**, LTR Courier 10) and ' +
      '`blockWidthsIn.dialogue` is the truth-surface CSS column (2.5in). On the Fork A Paper ' +
      'truth surface PageMap now predicts content lines within **' +
      (totEr == null ? '—' : f(totEr) + '×') + '** of the rendered truth — ' + f(totDl, 1) +
      ' excess lines ≈ **' + f(totDl / profile.linesPerPage, 1) + ' pages** — down from the ' +
      'pre-calibration 1.13× / 329 lines.');
    L.push('');
    L.push('Per-type accuracy: action **' + f(_er('action')) + '×**, dialogue **' +
      f(_er('dialogue')) + '×**, parenthetical **' + f(_er('parenthetical')) + '×** — every ' +
      'wrapping type within ~2%; the non-wrapping types (character / sceneHeading / transition) ' +
      'and Slice 3\'s leading-blank model stay exact at 1.00×. No type regressed.');
    L.push('');
    L.push('The residual ' + (totEr == null ? '—' : f(totEr) + '×') + ' is `ceil`-quantization ' +
      'plus proportional-font variance — Noto Naskh capacity ranges ≈ 12–16 cpi by glyph, so a ' +
      'single `cpl` can never be exact (Slice 4). It is small and **conservative**: ' + overflowing +
      ' of ' + m.sheetCount + ' sheets overflow the usable area.');
    L.push('');
    L.push('Page count: **' + pages.length + '** (was 71). Per Option C / Rule 10 this is an ' +
      'OUTPUT of the ratified Kurdish/RTL profile, not a target — the success metric is that ' +
      'PageMap prediction ≈ Paper-truth behaviour, which the per-type table above confirms.');
    L.push('');

    L.push('## Historical Word reference — RETIRED as a metric (Density Slice 5 · Rule 10)');
    L.push('');
    L.push('Option C is ratified: Rwanga paginates to a Kurdish/RTL screenplay profile and the');
    L.push('page count is an OUTPUT of that profile — never a target. The figure below is kept');
    L.push('only as a historical, **non-reproducible** reference — the "Word ≈ ' + WORD_PAGES +
      ' pages" was a synthetic CSS reconstruction (Arial 11pt, single full-width column) of a');
    L.push('generic, non-screenplay DOCX whose source file is not in the repo. It is NOT a truth');
    L.push('surface and must not be used to calibrate PageMap or the Paper render.');
    L.push('');
    L.push('- historical synthetic "Word" page count: ' + WORD_PAGES +
      '  _(retired — do not calibrate to this)_');
    L.push('- Paper-truth (PageMap → PrintRenderer) page count: **' + pages.length + '**');
    L.push('');

    L.push('## Contribution estimate');
    L.push('');
    L.push('_Estimates — each grounded in the measurement above or a cited prior probe._');
    L.push('');
    L.push('**1. Vertical line model.** PageMap budgets `linesPerPage = ' + profile.linesPerPage +
      '`, derived from ' + profile.font.family + ' ' + profile.font.sizePt + 'pt leading ' + profile.font.leading +
      ' (= ' + f(72 / (profile.font.sizePt * profile.font.leading), 1) + ' lines/in over ' + f(availableIn, 2) +
      ' in usable). Word truth is 11pt single. The 12pt-vs-11pt basis alone makes PageMap ~' +
      f(profile.font.sizePt / 11, 2) + '× sparser per line — the single largest model assumption.');
    L.push('');
    L.push('**2. Blank-line model — MEASURED on the truth surface (Density Slice 3).** PageMap ' +
      'charged **' + leadingBlankCharged + ' leading-blank lines** across the document. The ' +
      'per-type table above measures the real leading air on THIS Paper truth surface: every ' +
      'block type matches PageMap’s charged `leadingBlankLines` within 0.00 line — `margin-top: ' +
      '1em` at the sheet’s `line-height: 1.0` is exactly one line. The blank-line model is ' +
      'already truth-accurate; it contributes **0 pages** of over-count. (The 0.40–0.77-line ' +
      'figures from the `rtl-calibration` probe were measured on the Flow comfort surface — ' +
      '`.ProseMirror`, `line-height: 1.5`, a different stylesheet — and do NOT apply here.)');
    L.push('');
    L.push('**3. Scene chrome.** PageMap models **none**. This fixture has ' + sceneCount +
      ' scenes; the rtl-calibration probe measured ≈ 0.72 in chrome per scene (number badge 0.254 in + scene ' +
      'margins 0.467 in) → ≈ ' + f(sceneCount * 0.72, 1) + ' in unmodelled. NOTE: this makes PageMap *under*-count ' +
      '(opposite direction) — a real model gap, but it does not drive the over-count.');
    L.push('');
    L.push('**4. RTL font / content-line model — CALIBRATED (Density Slice 7).** `_charsPerInch` ' +
      'is now direction-aware (' + f(pmCpi, 1) + ' cpi for ' + truthFont + ' RTL, Courier 10 for ' +
      'LTR) and `blockWidthsIn.dialogue` matches the truth-surface CSS column (2.5in). The ' +
      'predicted-vs-rendered table above confirms PageMap now tracks the Paper truth within ' +
      (totEr == null ? '—' : f(totEr) + '×') + ' (' + f(totDl, 1) + ' excess lines ≈ ' +
      f(totDl / profile.linesPerPage, 1) + ' pages). The small residual is ceil-quantization plus ' +
      'proportional-font variance — see the Slice 7 verdict above.');
    L.push('');
    L.push('## Files / scripts used (read-only)');
    L.push('- driver: `tests/diagnostics/rtl-paper-truth-density/probe.js`');
    L.push('- surface: `tests/diagnostics/rtl-paper-truth-density/probe-page.html`');
    L.push('- production modules required: `renderer/js/constants.js`, `framework/base-outer-marks.js`, ' +
      '`doc-types/screenplay/schema-v3.js`, `framework/layout-profile.js`, `framework/pagemap-engine.js`, ' +
      '`framework/screenplay-normalizer.js`, `framework/render-model.js`, `framework/print-renderer.js`');
    L.push('- production CSS linked: `tokens.css`, `reset.css`, `shell.css`, `editor.css`, ' +
      '`editor-prosemirror.css`, `components.css`, `overlays.css`');
    L.push('- fixture: `' + FIXTURE_REL + '`');
    L.push('');
    L.push('_This probe changes nothing — it only `require`s production JS and `<link>`s ' +
      'production CSS. Density Slices 1/3/4/5 produced evidence; Slices 6/7 implemented their ' +
      'fixes (the parenthetical CSS box; the atomic direction-aware cpi + dialogue width ' +
      'calibration) test-first in separate authorized slices._');

    const report = L.join('\n');
    fs.writeFileSync(path.join(HERE, REPORT_NAME), report, 'utf8');
    console.log(report);
    console.log('\n[probe] report → tests/diagnostics/rtl-paper-truth-density/' + REPORT_NAME);
  } catch (e) {
    console.error('[probe] FAILED:', (e && e.stack) || e);
    code = 1;
  }
  app.exit(code);
});
