'use strict';
// ============================================================================
// RTL Density Probe — read-only forensic diagnostic.
//
// Measures the Mysterious Guest RTL manuscript's actual rendered height in the
// real Rwanga editor (RTL state, real CSS + bundled fonts) and, for the same
// content, a Word-equivalent Arial-11pt-single flow — then compares both
// against PageMap's predicted page breaks. Answers: how much vertical space
// the same content takes in Rwanga vs Word, and where PageMap diverges.
//
// Changes nothing. RUN:
//   node_modules/.bin/electron tests/diagnostics/rtl-density/probe.js
// ============================================================================
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const RD = path.resolve(HERE, '../../..');
const R = (p) => path.join(RD, p);
const PX = 96;

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
  const pages = Rga.PageMap.build(blocks, profile);
  const samples = blocks.map((b, i) => ({
    index: i,
    type: b.nodeType,
    sceneNumber: b.sceneNumber != null ? b.sceneNumber : null,
    text: b.nodeType === 'sceneHeading' ? ((b.heading && b.heading.location) || '') : (b.text || '')
  }));
  return { samples, profile, pages };
}

function f(n, d) { return Number(n).toFixed(d == null ? 2 : d); }

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  let code = 0;
  try {
    const { samples, profile, pages } = runPrediction();
    const win = new BrowserWindow({ show: false, width: 1400, height: 1000, webPreferences: { webSecurity: false } });
    await win.loadFile(path.join(HERE, 'probe-page.html'));
    const m = await win.webContents.executeJavaScript(
      'window.__measure(' + JSON.stringify({ samples: undefined, blocks: samples, pageWidthIn: profile.pageSize.w }) + ')'
    );
    const pb = m.perBlock;

    // A4 usable content height (inches): Rwanga doc margins top/bottom 1+1.
    const RW_USABLE = (profile.pageSize.h - profile.margins.top - profile.margins.bottom); // 9.69in
    // Word A4 usable: margins top 0.886in / bottom 0.690in (from docx sectPr).
    const WORD_USABLE = profile.pageSize.h - 0.886 - 0.690;                                // 10.12in

    const L = [];
    L.push('# RTL Density Probe — Mysterious Guest');
    L.push('');
    L.push('Generated ' + new Date().toISOString().slice(0, 19).replace('T', ' '));
    L.push('Rwanga: real editor CSS, RTL state, Noto Naskh 12pt. Word-equivalent: Arial 11pt single, 6.79in column.');
    L.push('');

    const firstScene = pb.find((x) => x.sceneNumber != null);
    const titleBlocks = pb.filter((x) => x.sceneNumber == null).length;

    L.push('## Totals');
    L.push('- blocks: ' + pb.length + '  (title-area ' + titleBlocks + ', scene body ' + (pb.length - titleBlocks) + ')');
    L.push('- Rwanga total rendered height: ' + f(m.rwangaTotalPx / PX) + ' in');
    L.push('- Word-equivalent total height: ' + f(m.wordTotalPx / PX) + ' in');
    L.push('- ratio (Rwanga / Word): ' + f(m.rwangaTotalPx / m.wordTotalPx) + '×');
    L.push('- Rwanga A4 pages @ ' + f(RW_USABLE) + 'in usable: ' + Math.ceil((m.rwangaTotalPx / PX) / RW_USABLE));
    L.push('- Word A4 pages @ ' + f(WORD_USABLE) + 'in usable: ' + Math.ceil((m.wordTotalPx / PX) / WORD_USABLE));
    L.push('- PageMap predicted pages: ' + pages.length);
    L.push('');

    // Blocks that fit on one physical A4 page, measured cumulatively from
    // the first scene block (excludes the title area).
    function blocksPerPage(usableIn, key) {
      const startTop = firstScene[key + 'Top'];
      let n = 0;
      for (let i = 0; i < pb.length; i++) {
        if (pb[i].sceneNumber == null) continue;
        if ((pb[i][key + 'Bottom'] - startTop) <= usableIn * PX) n++;
        else break;
      }
      return n;
    }
    const rwFit = blocksPerPage(RW_USABLE, 'rwanga');
    const wdFit = blocksPerPage(WORD_USABLE, 'word');
    L.push('## Page-1 body capacity (from scene 1, one physical A4 page)');
    L.push('- Rwanga renders: **' + rwFit + ' blocks** before the page is full');
    L.push('- Word renders:   **' + wdFit + ' blocks** before the page is full');
    L.push('- density ratio (Word ÷ Rwanga blocks per page): **' + f(wdFit / rwFit) + '×**');
    L.push('- PageMap assigns to its page 1: ' + pages[0].blocks.length + ' blocks');
    L.push('');

    // Per-PageMap-page: what height does each PageMap page actually render to?
    L.push('## PageMap pages vs actual rendered height (first 6)');
    L.push('| PageMap page | blocks | Rwanga rendered in | vs ' + f(RW_USABLE) + 'in A4 |');
    L.push('|---|---|---|---|');
    let prevBottom = 0;
    for (let p = 0; p < Math.min(6, pages.length); p++) {
      const lastIdx = pages[p].blocks[pages[p].blocks.length - 1];
      const lastPb = pb.find((x) => x.index === lastIdx);
      const bottom = lastPb ? lastPb.rwangaBottom : prevBottom;
      const spanIn = (bottom - prevBottom) / PX;
      const verdict = spanIn > RW_USABLE * 1.05 ? 'OVERFLOWS' : (spanIn < RW_USABLE * 0.8 ? 'under-fills' : 'ok');
      L.push('| ' + (p + 1) + ' | ' + pages[p].blocks.length + ' | ' + f(spanIn) + ' | ' + verdict + ' |');
      prevBottom = bottom;
    }
    L.push('');

    // Per-type rendered height: Rwanga vs Word.
    const TYPES = ['sceneHeading', 'action', 'character', 'dialogue', 'parenthetical', 'transition'];
    L.push('## Per-type mean rendered block height (Rwanga vs Word)');
    L.push('| type | n | Rwanga in | Word in | ratio |');
    L.push('|---|---|---|---|---|');
    TYPES.forEach((t) => {
      const rows = pb.filter((x) => x.type === t);
      if (!rows.length) return;
      const rw = rows.reduce((a, x) => a + (x.rwangaBottom - x.rwangaTop), 0) / rows.length / PX;
      const wd = rows.reduce((a, x) => a + (x.wordBottom - x.wordTop), 0) / rows.length / PX;
      L.push('| ' + t + ' | ' + rows.length + ' | ' + f(rw, 3) + ' | ' + f(wd, 3) + ' | ' + f(rw / wd) + '× |');
    });
    L.push('');

    // Scene chrome: gap between a scene's first block top and the previous
    // scene's last content — i.e. badge + scene margin + heading overhead.
    L.push('## Title-area height (Rwanga)');
    const lastTitle = pb.filter((x) => x.sceneNumber == null).slice(-1)[0];
    if (lastTitle) L.push('- title block renders: ' + f(lastTitle.rwangaBottom / PX) + ' in (' + titleBlocks + ' blocks)');
    L.push('');

    const report = L.join('\n');
    fs.writeFileSync(path.join(HERE, 'density-report.md'), report, 'utf8');
    console.log(report);
    console.log('\n[probe] report written to tests/diagnostics/rtl-density/density-report.md');
  } catch (e) {
    console.error('[probe] FAILED:', (e && e.stack) || e);
    code = 1;
  }
  app.exit(code);
});
