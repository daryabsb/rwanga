// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { ipcMain, BrowserWindow, screen } = require('electron');

function senderWindow(event) {
  return BrowserWindow.fromWebContents(event.sender);
}

// Final Hardening — DPI-aware OS-extension overflow.
//
// When a `frame: false` BrowserWindow is maximized on Win11, the OS
// extends the window past each visible screen edge so the resize
// border can live outside the viewport. The amount comes from
// GetSystemMetrics(SM_CXSIZEFRAME) + SM_CXPADDEDBORDER — typically
// 8px at 100% DPI but scales with the display's scale factor
// (12px CSS at 150%, 16px CSS at 200%, etc.).
//
// Electron does NOT expose GetSystemMetrics directly, but the same
// information is derivable from public API: the difference between
// `win.getBounds()` (OS-extended bounds when maximized) and
// `screen.getDisplayMatching(bounds).workArea` (visible usable area).
// Both are returned in CSS pixels, so the result is intrinsically
// DPI-aware — the renderer can consume it as raw `px` units without
// further scaling.
//
// Returned shape: { top, left, right, bottom } in CSS pixels. All
// zero when the window is NOT maximized. Negative values are clamped
// to 0 so multi-monitor edge cases never produce nonsense padding.
function computeMaximizeOverflow(win) {
  const zero = { top: 0, left: 0, right: 0, bottom: 0 };
  if (!win || typeof win.isMaximized !== 'function' || !win.isMaximized()) return zero;
  try {
    const bounds = win.getBounds();
    const display = screen.getDisplayMatching(bounds);
    const wa = display && display.workArea;
    if (!wa) return zero;
    return {
      top:    Math.max(0, wa.y - bounds.y),
      left:   Math.max(0, wa.x - bounds.x),
      right:  Math.max(0, (bounds.x + bounds.width)  - (wa.x + wa.width)),
      bottom: Math.max(0, (bounds.y + bounds.height) - (wa.y + wa.height))
    };
  } catch (_) { return zero; }
}

function register() {
  ipcMain.handle('window.minimize', (event) => {
    const win = senderWindow(event);
    if (win) win.minimize();
  });
  ipcMain.handle('window.maximize', (event) => {
    const win = senderWindow(event);
    if (!win) return;
    if (win.isMaximized()) win.unmaximize(); else win.maximize();
  });
  ipcMain.handle('window.close', (event) => {
    const win = senderWindow(event);
    if (win) win.close();
  });
  ipcMain.handle('window.setTitle', (event, title) => {
    const win = senderWindow(event);
    if (win) win.setTitle(title);
  });
  // Regression Fix §B — let the renderer query the current maximize
  // state on boot so the icon paints correctly (Win11 + frameless can
  // boot maximized via OS state restoration). Hardening: also returns
  // the OS-extension overflow so the renderer can apply DPI-aware
  // padding immediately on boot (not just after the first state event).
  ipcMain.handle('window.getState', (event) => {
    const win = senderWindow(event);
    if (!win) return { maximized: false, overflow: { top: 0, left: 0, right: 0, bottom: 0 } };
    return {
      maximized: win.isMaximized(),
      overflow:  computeMaximizeOverflow(win)
    };
  });
}

// Regression Fix §B + §A — push window state changes to the renderer
// so the maximize-button icon flips to "restore" while maximized, AND
// the renderer can apply body.window-maximized for CSS compensation
// of the Win11 frameless-overflow border (the OS extends the window
// ~8px past the visible edges when maximized, clipping right-zone
// title-bar controls without padding compensation).
function attach(win) {
  if (!win || typeof win.on !== 'function') return;
  const push = function(maximized) {
    try {
      if (!win.webContents || win.webContents.isDestroyed()) return;
      win.webContents.send('window.state', {
        maximized: !!maximized,
        // Recompute on every push so display/DPI changes (e.g., the
        // user drags the window to a different monitor between
        // maximize cycles) are reflected immediately.
        overflow:  computeMaximizeOverflow(win)
      });
    } catch (_) { /* window torn down — ignore. */ }
  };
  win.on('maximize',   function() { push(true);  });
  win.on('unmaximize', function() { push(false); });
  // Push an initial snapshot once the renderer is ready so a window
  // that boots maximized doesn't sit on the wrong icon until the user
  // toggles it.
  if (win.webContents) {
    win.webContents.once('did-finish-load', function() { push(win.isMaximized()); });
  }
}

module.exports = { register, attach, computeMaximizeOverflow };
