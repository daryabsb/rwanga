'use strict';
// Empty-Line Geometry Probe (Slice B investigation, read-only).
// Measures rendered heights of text vs empty paragraphs vs the Flow
// page-break marker, and prints PageMap's budget for the same blocks.
// RUN: node_modules/.bin/electron tests/diagnostics/empty-line-geometry/probe.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const RD = path.resolve(HERE, '../../..');
const R = (p) => path.join(RD, p);
const PX = 96;

function pagemapBudget() {
  global.window = { Rga: {} };
  global.window.RgaProseMirror = { Schema: require(R('node_modules/prosemirror-model')).Schema };
  require(R('renderer/js/constants.js'));
  require(R('renderer/js/framework/base-outer-marks.js'));
  require(R('renderer/js/doc-types/screenplay/schema-v3.js'));
  require(R('renderer/js/framework/layout-profile.js'));
  require(R('renderer/js/framework/pagemap-engine.js'));
  const Rga = global.window.Rga;
  const parsed = JSON.parse(fs.readFileSync(R('tests/fixtures/mysterious-guest-rtl.rga'), 'utf8'));
  const profile = Rga.LayoutProfile.compose(parsed.metadata.screenplayProfile, parsed.settings);
  const emptyPara = { nodeType: 'paragraph', text: '' };
  const textPara = { nodeType: 'paragraph', text: 'a normal line of text in a paragraph block here' };
  return {
    linesPerPage: profile.linesPerPage,
    inchesPerLine: (profile.pageSize.h - profile.margins.top - profile.margins.bottom) / profile.linesPerPage,
    emptyParaLines: Rga.PageMap.measureBlock(emptyPara, profile, false),
    emptyParaLinesFirst: Rga.PageMap.measureBlock(emptyPara, profile, true),
    textParaLines: Rga.PageMap.measureBlock(textPara, profile, false)
  };
}

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  let code = 0;
  try {
    const budget = pagemapBudget();
    const win = new BrowserWindow({ show: false, width: 1200, height: 1400, webPreferences: { webSecurity: false } });
    await win.loadFile(path.join(HERE, 'probe-page.html'));
    const m = await win.webContents.executeJavaScript('window.__measure({})');

    const L = [];
    L.push('# Empty-Line Geometry Probe — Slice B');
    L.push('');
    L.push('## PageMap budget (what the engine reserves)');
    L.push('- linesPerPage: ' + budget.linesPerPage + '   (1 PageMap-line = ' + budget.inchesPerLine.toFixed(3) + ' in = ' + (budget.inchesPerLine * PX).toFixed(1) + ' px)');
    L.push('- empty paragraph: ' + budget.emptyParaLines + ' lines  → ' + (budget.emptyParaLines * budget.inchesPerLine * PX).toFixed(1) + ' px budgeted  (first-on-page: ' + budget.emptyParaLinesFirst + ')');
    L.push('- text paragraph:  ' + budget.textParaLines + ' lines  → ' + (budget.textParaLines * budget.inchesPerLine * PX).toFixed(1) + ' px budgeted');
    L.push('');

    ['rtl', 'ltr'].forEach((dir) => {
      const d = m[dir];
      L.push('## Flow render — ' + dir.toUpperCase());
      L.push('| element | rendered height px | top→next-top gap px |');
      L.push('|---|---|---|');
      ['text1', 'text2', 'empty1', 'empty2', 'empty3', 'marker', 'empty4', 'empty5'].forEach((k) => {
        L.push('| ' + k + ' | ' + d[k].heightPx + ' | ' + (d[k].gapToNext != null ? d[k].gapToNext : '—') + ' |');
      });
      L.push('');
    });

    L.push('## Print render');
    L.push('- text print block:  ' + m.print.textBlock + ' px');
    L.push('- empty print block: ' + m.print.emptyBlock + ' px');
    L.push('');

    L.push('## Read');
    const eRtl = m.rtl.empty2.heightPx, mk = m.rtl.marker.heightPx;
    const budgetEmptyPx = budget.emptyParaLines * budget.inchesPerLine * PX;
    L.push('- empty paragraph renders ' + eRtl + 'px; PageMap budgets ' + budgetEmptyPx.toFixed(1) + 'px → ratio ' + (eRtl / budgetEmptyPx).toFixed(2) + '×');
    L.push('- Flow page-break marker renders ' + mk + 'px; PageMap budgets it 0 (widgets are not normalized blocks)');

    const report = L.join('\n');
    fs.writeFileSync(path.join(HERE, 'geometry-report.md'), report, 'utf8');
    console.log(report);
  } catch (e) {
    console.error('[probe] FAILED:', (e && e.stack) || e);
    code = 1;
  }
  app.exit(code);
});
