'use strict';
// ============================================================================
// RTL Font-Chain Verification — Slice 1 (diagnostic, read-only)
//
// Renders the editor's Flow hierarchy and a PrintRenderer page sheet in a
// hidden Electron/Chromium window with the real production CSS + bundled
// fonts, then reports which font each RTL surface actually resolves.
//
// Run it BEFORE and AFTER the Slice 1 fix to capture the before/after font
// resolution. It changes nothing.
//
// RUN
//   node_modules/.bin/electron tests/diagnostics/rtl-font-chain/verify.js
// ============================================================================
const { app, BrowserWindow } = require('electron');
const path = require('path');

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  let code = 0;
  try {
    const win = new BrowserWindow({
      show: false, width: 1200, height: 900,
      webPreferences: { webSecurity: false }
    });
    await win.loadFile(path.join(__dirname, 'verify-page.html'));
    const result = await win.webContents.executeJavaScript('window.__verify()');

    console.log('RTL Font-Chain Verification  ·  ' + new Date().toISOString().slice(0, 19).replace('T', ' '));
    console.log('='.repeat(92));
    const order = ['flow-ku-block', 'flow-ku-heading', 'flow-en-block',
                   'print-rtl-block', 'print-rtl-heading', 'print-ltr-block'];
    order.forEach((k) => {
      const x = result[k];
      if (!x) return;
      console.log(k.padEnd(20) + '→ ' + x.resolved);
      console.log('  '.padEnd(20) + '  computed font-family: ' + x.computedFamily);
      console.log('  '.padEnd(20) + '  width(px) target/naskh-ref/courier-ref: ' +
        x.wTarget + ' / ' + x.wNaskh + ' / ' + x.wCourier);
    });
    console.log('='.repeat(92));
    console.log('Expected after Slice 1: every RTL surface (flow-ku-*, print-rtl-*) → Noto Naskh Arabic;');
    console.log('LTR surfaces (flow-en-block, print-ltr-block) → unchanged (Courier stack).');
  } catch (e) {
    console.error('[verify] FAILED:', (e && e.stack) || e);
    code = 1;
  }
  app.exit(code);
});
