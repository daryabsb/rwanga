# App-Close Dirty Guard (Brick 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No close path can silently discard unsaved work — closing the app (window ✕, Alt+F4, Quit, OS shutdown) with a dirty document prompts Save / Discard / Cancel, and Cancel aborts the quit; tab-close uses the same single prompt.

**Architecture:** A new renderer module `Rga.CloseGuard` becomes the *single* owner of the unsaved-changes prompt — both `TabManager.closeTab` and the app-close flow route through it (no duplicated prompt logic). `electron/main.js` intercepts the window `'close'` event, asks the renderer via a new IPC round-trip, and obeys the verdict; a bounded timeout is the renderer-unresponsive fallback.

**Tech Stack:** Electron main process, `contextBridge` IPC, renderer IIFE modules, JSDOM (`node:test`) unit tests, Playwright Electron integration tests.

**Source of truth:** `docs/superpowers/specs/2026-05-22-persistence-safety-contract.md` §6 (app-close) + §2 (ownership) + §7 (SP-4, SP-5). This plan implements **Brick 2 only** (priority #2). Bricks 3–4 are planned separately.

**Closes:** checklist item **PF-11** (evidence reported at SP-5).

**Build-order note:** the Contract §6 "flush all autosave snapshots before any prompt" pre-step belongs to autosave (Brick 3) and is **not** part of Brick 2 — the close guard at priority #2 is correct standalone (it prompts). Force-close (§6.3) and the OS-shutdown snapshot fallback (§6.4) likewise depend on Brick 3 and are out of scope here.

**Amendment — timeout fallback (2026-05-22).** Contract §6.1 specifies "main proceeds" if the renderer never replies — but that is safe **only once autosave (Brick 3) protects the work.** Until then, Brick 2's renderer-unresponsive timeout **aborts the close (keeps the window open) and logs the timeout** — proceeding would silently lose unsaved work, defeating Brick 2's whole purpose. So Brick 2 behaviour is: renderer replies *allow* → close; replies *cancel* → stay open; **does not reply within 10 s → stay open + log the timeout.** The §6.1 proceed-on-timeout end state is revisited when Brick 3 lands.

**Branch / commits:** The working tree carries unrelated uncommitted work plus Brick 1's staged-not-committed files. **Brick 2 does not commit.** Each task ends by staging its candidate paths for inspection only (`git add` + `git status`); a commit happens only on explicit user approval of a commit strategy. A pre-implementation `git status` (below) records the starting state.

---

## File structure

| File | Create / Modify | Responsibility |
|---|---|---|
| `rwanga-editor/renderer/js/close-guard.js` | **Create** | `Rga.CloseGuard` — `confirmClose(tab)` + `confirmAppClose()`; the single unsaved-changes prompt owner. |
| `rwanga-editor/tests/unit/close-guard.test.js` | **Create** | JSDOM unit tests for `Rga.CloseGuard`. |
| `rwanga-editor/renderer/index.html` | **Modify** | Register `close-guard.js`; wire the app-close IPC to `CloseGuard.confirmAppClose`. |
| `rwanga-editor/renderer/js/tab-manager.js` | **Modify** | `closeTab` delegates its dirty prompt to `Rga.CloseGuard` (inline prompt removed). |
| `rwanga-editor/tests/unit/tab-manager.test.js` | **Modify** | Add a test that `closeTab` honors a `cancel` verdict. |
| `rwanga-editor/electron/preload.js` | **Modify** | Expose `window.rwanga.lifecycle` (the close handshake). |
| `rwanga-editor/electron/main.js` | **Modify** | Intercept the window `'close'` event; `app.closeResponse` handler; unresponsive timeout. |
| `rwanga-editor/tests/integration/app-close.spec.js` | **Create** | End-to-end proof: dirty doc → close → prompt → Cancel / Discard. |

All paths below are relative to `rwanga-editor/`. Run all commands from `rwanga-editor/`.

---

## Pre-implementation check

Brick 2 **does not commit.** Before changing any file, record the starting state.

- [ ] **Record the working-tree state.** Run `git status` and record the output. Note the pre-existing entries (prior campaigns + Brick 1's staged files) so they stay distinguishable. Do not stage, commit, or revert any of them.

---

## Task 1: `Rga.CloseGuard` — the single unsaved-changes prompt owner

**Files:**
- Create: `renderer/js/close-guard.js`
- Test: `tests/unit/close-guard.test.js`
- Modify: `renderer/index.html` (register the script)

- [ ] **Step 1: Write the failing test file**

Create `tests/unit/close-guard.test.js`:

```js
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

// Load close-guard.js (a renderer IIFE) against a fresh JSDOM window whose
// window.Rga is pre-seeded with the given stub collaborators.
function loadCloseGuard(rgaStubs) {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>',
    { runScripts: 'outside-only' });
  global.window = dom.window;
  global.document = dom.window.document;
  dom.window.Rga = rgaStubs || {};
  delete require.cache[require.resolve('../../renderer/js/close-guard.js')];
  require('../../renderer/js/close-guard.js');
  return dom.window.Rga.CloseGuard;
}

test('confirmClose on a clean document proceeds without a prompt', async () => {
  let prompted = false;
  const CG = loadCloseGuard({
    Modal: { showUnsaved: async () => { prompted = true; return 'cancel'; } }
  });
  const verdict = await CG.confirmClose({ id: 't1', doc: { displayName: 'a.rga', dirty: false } });
  assert.equal(verdict, 'proceed');
  assert.equal(prompted, false);
});

test('confirmClose returns cancel when the user cancels', async () => {
  const CG = loadCloseGuard({ Modal: { showUnsaved: async () => 'cancel' } });
  const verdict = await CG.confirmClose({ id: 't1', doc: { displayName: 'a.rga', dirty: true } });
  assert.equal(verdict, 'cancel');
});

test('confirmClose returns proceed on discard', async () => {
  const CG = loadCloseGuard({ Modal: { showUnsaved: async () => 'discard' } });
  const verdict = await CG.confirmClose({ id: 't1', doc: { displayName: 'a.rga', dirty: true } });
  assert.equal(verdict, 'proceed');
});

test('confirmClose on save activates the tab, saves, and proceeds', async () => {
  let activated = null;
  let saved = false;
  const CG = loadCloseGuard({
    Modal: { showUnsaved: async () => 'save' },
    TabManager: { activate: (id) => { activated = id; } },
    FileManager: { save: async () => { saved = true; return { savedAt: 1 }; } }
  });
  const verdict = await CG.confirmClose({ id: 't7', doc: { displayName: 'a.rga', dirty: true } });
  assert.equal(verdict, 'proceed');
  assert.equal(activated, 't7');
  assert.equal(saved, true);
});

test('confirmClose returns cancel when the save fails', async () => {
  const CG = loadCloseGuard({
    Modal: { showUnsaved: async () => 'save' },
    TabManager: { activate: () => {} },
    FileManager: { save: async () => null }   // save failed / cancelled
  });
  const verdict = await CG.confirmClose({ id: 't1', doc: { displayName: 'a.rga', dirty: true } });
  assert.equal(verdict, 'cancel');
});

test('confirmAppClose returns true when no document is dirty', async () => {
  let prompted = false;
  const CG = loadCloseGuard({
    Modal: { showUnsaved: async () => { prompted = true; return 'cancel'; } },
    TabManager: { tabs: () => [
      { id: 't1', doc: { dirty: false } },
      { id: 't2', doc: { dirty: false } }
    ] }
  });
  assert.equal(await CG.confirmAppClose(), true);
  assert.equal(prompted, false);
});

test('confirmAppClose returns false when a dirty document is cancelled', async () => {
  const CG = loadCloseGuard({
    Modal: { showUnsaved: async () => 'cancel' },
    TabManager: { tabs: () => [ { id: 't1', doc: { displayName: 'a.rga', dirty: true } } ] }
  });
  assert.equal(await CG.confirmAppClose(), false);
});

test('confirmAppClose returns true when every dirty document is discarded', async () => {
  const CG = loadCloseGuard({
    Modal: { showUnsaved: async () => 'discard' },
    TabManager: { tabs: () => [
      { id: 't1', doc: { displayName: 'a.rga', dirty: true } },
      { id: 't2', doc: { displayName: 'b.rga', dirty: true } }
    ] }
  });
  assert.equal(await CG.confirmAppClose(), true);
});

test('confirmAppClose stops at the first cancel — sequential per-document', async () => {
  let prompts = 0;
  const CG = loadCloseGuard({
    Modal: { showUnsaved: async () => { prompts += 1; return 'cancel'; } },
    TabManager: { tabs: () => [
      { id: 't1', doc: { displayName: 'a.rga', dirty: true } },
      { id: 't2', doc: { displayName: 'b.rga', dirty: true } }
    ] }
  });
  assert.equal(await CG.confirmAppClose(), false);
  assert.equal(prompts, 1);   // did not prompt t2 after t1 cancelled
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/unit/close-guard.test.js`
Expected: FAIL — every test errors with `Cannot find module '../../renderer/js/close-guard.js'`.

- [ ] **Step 3: Write the module**

Create `renderer/js/close-guard.js`:

```js
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.CloseGuard — the single owner of the unsaved-changes confirmation
// (Persistence Safety Contract §6 / §2). Both Rga.TabManager.closeTab and
// the app-close flow route through it; there is no other unsaved prompt.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  // Confirm closing ONE tab's document.
  //   tab = { id, doc }
  // Returns 'proceed' (clean, discarded, or successfully saved) or 'cancel'.
  async function confirmClose(tab) {
    if (!tab || !tab.doc || !tab.doc.dirty) return 'proceed';

    const name = tab.doc.displayName;
    const choice = (Rga.Modal && typeof Rga.Modal.showUnsaved === 'function')
      ? await Rga.Modal.showUnsaved(name)
      : (window.confirm('"' + name + '" has unsaved changes. Discard?') ? 'discard' : 'cancel');

    if (choice === 'cancel') return 'cancel';
    if (choice === 'save') {
      // The document must be the active tab for FileManager.save to target it.
      if (Rga.TabManager && typeof Rga.TabManager.activate === 'function') {
        Rga.TabManager.activate(tab.id);
      }
      const saved = (Rga.FileManager && typeof Rga.FileManager.save === 'function')
        ? await Rga.FileManager.save()
        : null;
      if (!saved) return 'cancel';   // save failed or was cancelled
    }
    return 'proceed';   // 'discard' or a successful 'save'
  }

  // Confirm closing the whole app. Prompts each dirty document SEQUENTIALLY
  // (Contract §6, locked decision 4). Any 'cancel' aborts the whole quit.
  // Returns true to allow the close, false to abort it.
  async function confirmAppClose() {
    const tabs = (Rga.TabManager && typeof Rga.TabManager.tabs === 'function')
      ? Rga.TabManager.tabs()
      : [];
    for (let i = 0; i < tabs.length; i += 1) {
      const tab = tabs[i];
      if (!tab || !tab.doc || !tab.doc.dirty) continue;
      const verdict = await confirmClose(tab);
      if (verdict === 'cancel') return false;
    }
    return true;
  }

  Rga.CloseGuard = { confirmClose, confirmAppClose };
})();
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/unit/close-guard.test.js`
Expected: PASS — `# pass 9`, `# fail 0`.

- [ ] **Step 5: Register the script in `index.html`**

In `renderer/index.html`, add the `close-guard.js` script tag immediately after the `tab-manager.js` one. From:

```html
    <script src="js/tab-manager.js"></script>
```

To:

```html
    <script src="js/tab-manager.js"></script>
    <script src="js/close-guard.js"></script>
```

- [ ] **Step 6: Stage candidate paths for inspection (no commit)**

Stage candidate paths only for inspection; do not commit unless the user explicitly approves the commit strategy.

```bash
git add renderer/js/close-guard.js tests/unit/close-guard.test.js renderer/index.html
git status --short
```

**Touched by this task:** `renderer/js/close-guard.js`, `tests/unit/close-guard.test.js`, `renderer/index.html`

---

## Task 2: Delegate `TabManager.closeTab` to `CloseGuard`

**Files:**
- Modify: `renderer/js/tab-manager.js`
- Test: `tests/unit/tab-manager.test.js`

- [ ] **Step 1: Add the failing delegation test**

In `tests/unit/tab-manager.test.js`, append this test at the end of the file (after the last test):

```js
test('closeTab honors a CloseGuard cancel verdict — the tab is kept', async () => {
  bootDom();
  const TM = loadTabManager();
  TM.init();
  // CloseGuard is a renderer peer module; stub it to veto the close.
  global.window.Rga.CloseGuard = { confirmClose: async () => 'cancel' };
  const doc = { docId: 'd1', displayName: 'one.rga', dirty: true };
  const tab = TM.openDocument(doc);
  await TM.closeTab(tab.id);
  assert.equal(TM.tabs().length, 1, 'a cancelled close must keep the tab');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/unit/tab-manager.test.js`
Expected: the existing tests PASS; the new test FAILS — `closeTab` still runs its own inline prompt (which, with `Rga.Modal` absent in the stub, falls back to `confirm()` → stubbed `true` → `'discard'` → the tab is removed), so `tabs().length` is `0`, not `1`.

- [ ] **Step 3: Replace `closeTab`'s inline prompt with the delegation**

In `renderer/js/tab-manager.js`, inside `closeTab`, replace the inline prompt block. From:

```js
    const tab = tabs[idx];
    if (tab.doc.dirty) {
      const choice = (Rga.Modal && Rga.Modal.showUnsaved)
        ? await Rga.Modal.showUnsaved(tab.doc.displayName)
        : (confirm('"' + tab.doc.displayName + '" has unsaved changes. Discard?') ? 'discard' : 'cancel');
      if (choice === 'cancel') return;
      if (choice === 'save') {
        if (activeTabId !== tabId) activate(tabId);
        const saved = await Rga.FileManager.save();
        if (!saved) return;
      }
    }
    // Re-find in case tabs shifted during async save
```

To:

```js
    const tab = tabs[idx];
    // Persistence Safety Contract §6.2 — the unsaved-changes prompt is owned
    // solely by Rga.CloseGuard; closeTab no longer has its own prompt logic.
    const verdict = (Rga.CloseGuard && typeof Rga.CloseGuard.confirmClose === 'function')
      ? await Rga.CloseGuard.confirmClose(tab)
      : 'proceed';
    if (verdict === 'cancel') return;
    // Re-find in case tabs shifted during async save
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/unit/tab-manager.test.js`
Expected: PASS — all tests green, including `closeTab honors a CloseGuard cancel verdict`.

- [ ] **Step 5: Run the full unit suite**

Run: `npm run test:unit`
Expected: PASS — all green, `# fail 0` (Task 1's 9 + Task 2's 1 new test included).

- [ ] **Step 6: Stage candidate paths for inspection (no commit)**

Stage candidate paths only for inspection; do not commit unless the user explicitly approves the commit strategy.

```bash
git add renderer/js/tab-manager.js tests/unit/tab-manager.test.js
git status --short
```

**Touched by this task:** `renderer/js/tab-manager.js`, `tests/unit/tab-manager.test.js`

---

## ⛔ STOP — SP-4

**Contract §7 SP-4.** `Rga.CloseGuard` exists and `closeTab` delegates to it; the IPC round-trip (Task 3) is designed below but not yet implemented.

**Confirm and report before starting Task 3:**
1. **`closeTab`'s prompt was moved, not duplicated** — verify `tab-manager.js` no longer contains `Modal.showUnsaved` or a `confirm(`-based unsaved prompt, and that `close-guard.js` is now the only renderer file with unsaved-prompt logic.
2. **The IPC round-trip design** (implemented in Task 3): `electron/main.js` intercepts the window `'close'` event → `event.preventDefault()` → sends `app.closeRequested` to the renderer; the renderer runs `CloseGuard.confirmAppClose()` and replies via `window.rwanga.lifecycle.respondClose(allow)` → `ipcMain` handles `app.closeResponse` → on `allow` it sets an approved flag and closes the window, on abort it does nothing.
3. **The renderer-unresponsive timeout** — Task 3 sets `CLOSE_RESPONSE_TIMEOUT_MS = 10000` (10 s). **Per the Brick 2 amendment, on timeout the close is ABORTED — the window stays open and the timeout is logged** (`console.error`). Proceeding-on-timeout (Contract §6.1) would silently lose unsaved work while autosave does not yet exist; it is revisited at Brick 3. **Confirm the 10 s value.** The timer is cleared the moment a response arrives, so a `Cancel` reply does not later trigger anything.

Record findings in `RWANGA_IDE_LAUNCH_CHECKLIST.md` (Rule 6) and **stop for review**. Do not start Task 3 until SP-4 is signed off.

---

## Task 3: The main ↔ renderer close handshake

**Files:**
- Modify: `electron/preload.js`
- Modify: `electron/main.js`
- Modify: `renderer/index.html`

`main.js` and `preload.js` are **not** unit-loaded (they require Electron), so a syntax error there is invisible to `npm run test:unit` — every edit below is followed by `node --check`.

- [ ] **Step 1: Expose `window.rwanga.lifecycle` in the preload**

In `electron/preload.js`, add a `lifecycle` section. From:

```js
    // Regression Fix §B — initial state query for the maximize-button
    // icon resolver in title-bar.js.
    getState: () => ipcRenderer.invoke('window.getState'),
  },
  menu: {
```

To:

```js
    // Regression Fix §B — initial state query for the maximize-button
    // icon resolver in title-bar.js.
    getState: () => ipcRenderer.invoke('window.getState'),
  },
  lifecycle: {
    // Persistence Safety Contract §6 — the app-close handshake. main sends
    // `app.closeRequested`; the renderer replies with respondClose(allow).
    onCloseRequested: (callback) => {
      const handler = () => callback();
      ipcRenderer.on('app.closeRequested', handler);
      return () => ipcRenderer.removeListener('app.closeRequested', handler);
    },
    respondClose: (allow) => ipcRenderer.invoke('app.closeResponse', allow),
  },
  menu: {
```

- [ ] **Step 2: Syntax-check the preload**

Run: `node --check electron/preload.js`
Expected: no output, exit 0 (valid syntax).

- [ ] **Step 3: Intercept the window `'close'` event in `main.js`**

In `electron/main.js`, make three changes.

**(a)** Add `ipcMain` to the electron require. From:

```js
const { app, BrowserWindow } = require('electron');
```

To:

```js
const { app, BrowserWindow, ipcMain } = require('electron');
```

**(b)** Add the close-handshake module state. From:

```js
let mainWindow = null;
const DEV = process.argv.includes('--dev');
```

To:

```js
let mainWindow = null;
const DEV = process.argv.includes('--dev');

// Persistence Safety Contract §6 — app-close dirty guard.
// The window 'close' is intercepted and the renderer is asked for a verdict.
// CLOSE_RESPONSE_TIMEOUT_MS bounds the wait; on timeout the close is ABORTED
// (Brick 2 amendment — proceeding is unsafe until Autosave / Brick 3 exists).
let _closeApproved = false;
let _closeTimer = null;
const CLOSE_RESPONSE_TIMEOUT_MS = 10000;
```

**(c)** Add the `'close'` handler. From:

```js
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
```

To:

```js
  // Persistence Safety Contract §6.1 — intercept the close, ask the renderer.
  mainWindow.on('close', (event) => {
    if (_closeApproved) return;   // verdict already given — let it close
    const wc = mainWindow ? mainWindow.webContents : null;
    if (!wc || wc.isDestroyed()) return;   // renderer gone — nothing to ask
    event.preventDefault();
    if (_closeTimer) return;   // a close request is already in flight
    wc.send('app.closeRequested');
    _closeTimer = setTimeout(() => {
      _closeTimer = null;
      // Brick 2 amendment — until Autosave (Brick 3) exists, a renderer that
      // never replies must NOT be force-closed: proceeding would silently lose
      // unsaved work. Abort the close (the window stays open — the original
      // 'close' was already prevented) and log the timeout. The Contract §6.1
      // "proceed on timeout" end state is revisited once Brick 3 lands.
      console.error('[app-close] renderer did not respond within '
        + CLOSE_RESPONSE_TIMEOUT_MS + 'ms — close aborted, window kept open.');
    }, CLOSE_RESPONSE_TIMEOUT_MS);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
```

- [ ] **Step 4: Register the `app.closeResponse` handler**

In `electron/main.js`, in the `app.whenReady().then(...)` block, register the IPC handler. From:

```js
  app.whenReady().then(() => {
    filesBridge.register();
    windowControls.register();
    registerMenuIpc();
    createMainWindow();
    if (DEV) startDevLiveReload();
  });
```

To:

```js
  app.whenReady().then(() => {
    filesBridge.register();
    windowControls.register();
    registerMenuIpc();
    // Persistence Safety Contract §6.1 — the renderer's close verdict.
    ipcMain.handle('app.closeResponse', (_event, allow) => {
      if (_closeTimer) { clearTimeout(_closeTimer); _closeTimer = null; }
      if (allow) {
        _closeApproved = true;
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
      }
      // allow === false → abort: the timer is cleared, the window stays open.
    });
    createMainWindow();
    if (DEV) startDevLiveReload();
  });
```

- [ ] **Step 5: Syntax-check `main.js`**

Run: `node --check electron/main.js`
Expected: no output, exit 0 (valid syntax).

- [ ] **Step 6: Wire the renderer's close handler in `index.html`**

In `renderer/index.html`, in the `boot()` function, add the close-guard wiring immediately before the final init log. From:

```js
    console.log('[Rwanga] Script Editor initialized — Phase 0 (no editor mounted).');
  }
```

To:

```js
    // Persistence Safety Contract §6.1 — main asks before the app closes;
    // Rga.CloseGuard runs the sequential per-document prompt and replies.
    if (window.rwanga && window.rwanga.lifecycle
        && typeof window.rwanga.lifecycle.onCloseRequested === 'function') {
      window.rwanga.lifecycle.onCloseRequested(function() {
        Promise.resolve(
          (Rga.CloseGuard && Rga.CloseGuard.confirmAppClose)
            ? Rga.CloseGuard.confirmAppClose()
            : true
        ).then(function(allow) {
          window.rwanga.lifecycle.respondClose(allow);
        });
      });
    }

    console.log('[Rwanga] Script Editor initialized — Phase 0 (no editor mounted).');
  }
```

- [ ] **Step 7: Run the full unit suite**

Run: `npm run test:unit`
Expected: PASS — all green, `# fail 0` (the IPC changes are main/preload/index.html — no unit test depends on them; the suite confirms no renderer regression).

- [ ] **Step 8: Stage candidate paths for inspection (no commit)**

Stage candidate paths only for inspection; do not commit unless the user explicitly approves the commit strategy.

```bash
git add electron/preload.js electron/main.js renderer/index.html
git status --short
```

**Touched by this task:** `electron/preload.js`, `electron/main.js`, `renderer/index.html`

---

## Task 4: End-to-end app-close proof

**Files:**
- Create: `tests/integration/app-close.spec.js`

- [ ] **Step 1: Write the integration spec**

Create `tests/integration/app-close.spec.js`:

```js
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Persistence Safety — Brick 2 (app-close dirty guard). Proves: closing the
// app with unsaved changes intercepts the close and prompts; Cancel keeps the
// app open; Discard lets it close.
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..');

let app, page, userDataDir;

test.beforeEach(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-e2e-'));
  app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(
    () => !!(window.Rga && window.Rga.FileManager
      && window.Rga.FileManager.getActive && window.Rga.FileManager.getActive()
      && window.Rga.TabManager && window.Rga.TabManager._editorView
      && window.Rga.TabManager._editorView())
  );
});

test.afterEach(async () => {
  if (app) { try { await app.close(); } catch (_) {} app = null; }
  if (userDataDir) {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
    userDataDir = null;
  }
});

test('closing with unsaved changes prompts, and Cancel keeps the app open', async () => {
  // Make the active document dirty. A dirty document is this test's premise —
  // wait until the edit has registered before proceeding.
  await page.locator('#editor').click();
  await page.keyboard.type('unsavedmarker');
  await page.waitForFunction(() => window.Rga.FileManager.getActive().dirty);

  // Trigger an app close.
  await page.evaluate(() => window.rwanga.window.close());

  // The guard intercepted it — the unsaved-changes modal appears.
  await expect(page.locator('#unsaved-modal')).toBeVisible();

  // Cancel.
  await page.locator('#unsaved-modal [data-choice="cancel"]').click();
  await expect(page.locator('#unsaved-modal')).toBeHidden();

  // The app is still alive and the document is still here, still dirty.
  expect(await page.evaluate(() => window.Rga.FileManager.getActive().dirty)).toBe(true);
});

test('closing with unsaved changes and choosing Discard closes the app', async () => {
  await page.locator('#editor').click();
  await page.keyboard.type('unsavedmarker');
  await page.waitForFunction(() => window.Rga.FileManager.getActive().dirty);

  const appClosed = app.waitForEvent('close');
  await page.evaluate(() => window.rwanga.window.close());
  await expect(page.locator('#unsaved-modal')).toBeVisible();

  // Clicking Discard makes the app quit. Use dispatchEvent so the click is not
  // followed by Playwright's post-action wait, which would race the teardown
  // the click itself triggers.
  await page.locator('#unsaved-modal [data-choice="discard"]').dispatchEvent('click');

  // The verdict was "allow" — the app actually closes.
  await appClosed;
});
```

- [ ] **Step 2: Build the renderer bundle (integration prerequisite)**

Run: `npm run build:renderer`
Expected: the build completes without error (`bundle.js` written).

- [ ] **Step 3: Run the integration spec to verify it passes**

Run: `npx playwright test --config=tests/integration/playwright.config.js app-close.spec.js`
Expected: PASS — `2 passed`.

- [ ] **Step 4: Run the full integration suite for no regressions**

Run: `npm run test:e2e`
Expected: PASS — `12 passed` (the 10 existing specs + the 2 new ones).

- [ ] **Step 5: Stage candidate paths for inspection (no commit)**

Stage candidate paths only for inspection; do not commit unless the user explicitly approves the commit strategy.

```bash
git add tests/integration/app-close.spec.js
git status --short
```

**Touched by this task:** `tests/integration/app-close.spec.js`

---

## ⛔ STOP — SP-5

**Contract §7 SP-5.** Brick 2 (app-close dirty guard) is complete.

- [ ] **Update `RWANGA_IDE_LAUNCH_CHECKLIST.md` (Rule 6):** append an Implementation-log entry; if the evidence holds, flip **PF-11 PARTIAL → TRUE** with cited evidence — `close-guard.test.js` (9 tests), the `tab-manager.test.js` delegation test, `app-close.spec.js` (2 E2E), `npm run test:unit` + `npm run test:e2e` green. Adjust the §3 totals + the §0 verdict block accordingly.
- [ ] **Report** the PF-11 evidence — all four close paths (window ✕ / Alt+F4 / Quit / OS shutdown all flow through the window `'close'` interception; tab-close flows through the same `CloseGuard.confirmClose`). **Stop for review** before Brick 3 (autosave) is planned.

---

## Self-review

- **Spec coverage (Contract §6):** §6.1 app close — `main.js` `'close'` interception + `confirmAppClose` + sequential prompts (Tasks 1, 3; E2E Task 4); §6.2 tab close — `closeTab` delegates to `CloseGuard.confirmClose` (Task 2); §6.3 force close / §6.4 OS-shutdown snapshot fallback — depend on autosave (Brick 3), explicitly out of scope per the Build-order note; renderer-unresponsive timeout — aborts the close, stays open + logs (Brick 2 amendment), Task 3 + SP-4; single ownership (§2) — `CloseGuard` is the only unsaved-prompt module, verified at SP-4. PF-11 — SP-5.
- **Placeholder scan:** none — every step carries exact code and exact commands.
- **Type consistency:** `confirmClose(tab)` returns `'proceed'` | `'cancel'` in every task and test; `confirmAppClose()` returns `boolean`; `closeTab` reads `'cancel'`; the IPC verdict is the same boolean (`respondClose(allow)` → `app.closeResponse(allow)`). The `_closeApproved` / `_closeTimer` names are consistent across `main.js` Steps 3b/3c/4.
- **Brick-1 lesson applied:** `main.js` and `preload.js` are not unit-loaded — Task 3 `node --check`s both after editing.
- **Scope:** Brick 2 only (app-close dirty guard). Bricks 3–4 are out of scope and planned separately after SP-5.
