// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Shared Playwright-Electron teardown helper (GAP-3-3).
//
// WHY THIS EXISTS
// ---------------
// The app has a correct, deliberate quit guard (Persistence Safety Contract
// §6.1): `electron/main.js` intercepts the window `close`, asks the renderer
// (`app.closeRequested`), and the renderer runs `Rga.CloseGuard.confirmAppClose()`
// — which shows the unsaved-changes modal for every dirty document and waits
// for a human. Under automation there is no human, so the renderer never
// replies; main's CLOSE_RESPONSE_TIMEOUT_MS elapses and the close is ABORTED
// (by design: never force-quit over unsaved work). Playwright's `app.close()`
// therefore never resolves, the test's `afterEach` blows its 60 s timeout, and
// the orphaned Electron process leaks.
//
// That is test hygiene, not a product defect: any spec that types into the
// editor and then calls `app.close()` directly will hang. The fix is for
// teardown to leave no unsaved work behind — the same idiom already used by
// `tests/e2e/filmustageation/print-contract.spec.js` (`clearDirtyAndClose`),
// generalised to ALL tabs (the guard iterates every dirty document, not just
// the active one).
//
// This helper asserts nothing and weakens nothing. Specs that deliberately
// exercise the guard (`tests/integration/app-close.spec.js`) keep their own
// assertions; they simply use this to get the app down afterwards.
'use strict';

// Mark every open document clean, dismiss any modal the test body left on
// screen, then close the app. Safe to call when the page/app is already gone.
async function closeApp(app, page) {
  if (!app) return;
  try {
    const target = page || (await app.firstWindow());
    if (target && !target.isClosed()) {
      await target.evaluate(() => {
        const Rga = window.Rga || {};
        const TM = Rga.TabManager;
        const docs = [];
        if (TM && typeof TM.tabs === 'function') {
          (TM.tabs() || []).forEach((t) => { if (t && t.doc) docs.push(t.doc); });
        }
        if (TM && typeof TM.activeDoc === 'function' && TM.activeDoc()) {
          docs.push(TM.activeDoc());
        }
        docs.forEach((d) => {
          if (Rga.Doc && typeof Rga.Doc.clearDirty === 'function') Rga.Doc.clearDirty(d);
          else d.dirty = false;
        });
        // A test body may have left the unsaved-changes modal open; the guard
        // reads document state, not the modal, but leave the DOM tidy.
        const el = document.getElementById('unsaved-modal');
        if (el) el.hidden = true;
      });
    }
  } catch (_) { /* page already gone — fall through to close */ }
  try { await app.close(); } catch (_) { /* already closed */ }
}

// Hard-kill the app (simulating a crash) and wait until the OS process is gone.
//
// GAP-3-3: this kills the whole process TREE, not just the main process.
// Electron spawns GPU / renderer / utility children that inherit the pipe
// Playwright talks to; killing only the parent leaves that pipe open, so
// Playwright never observes the app dying. It then blocks for the full 60 s
// timeout disposing the object at WORKER teardown, and the children leak as
// orphaned Electron processes. The `a.close()` afterwards disposes the
// Playwright handle so teardown has nothing left to close.
async function killApp(a) {
  const proc = a.process();
  const exited = new Promise((resolve) => {
    if (proc.exitCode !== null) { resolve(); return; }
    proc.once('exit', () => resolve());
  });
  if (process.platform === 'win32') {
    try {
      require('child_process').execFileSync(
        'taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }
      );
    } catch (_) { proc.kill('SIGKILL'); }
  } else {
    proc.kill('SIGKILL');
  }
  await exited;
  await Promise.race([
    a.close().catch(() => {}),
    new Promise((r) => setTimeout(r, 5000))
  ]);
}

module.exports = { closeApp, killApp };
