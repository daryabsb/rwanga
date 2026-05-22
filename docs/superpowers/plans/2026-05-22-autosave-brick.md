# Brick 3 — Autosave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every dirty document is continuously snapshotted to a `userData` sidecar — an immediate seed on the first edit, then debounced (2 s) and max-interval-capped (10 s) — so a crash loses at most ~10 s of work. **Brick 3 writes snapshots only. It does not recover or restore — that is Brick 4.**

**Architecture:** A new renderer module `Rga.Autosave` owns the per-document debounce/max-interval timers and builds the snapshot envelope; a new main-process bridge `electron/bridge/autosave.js` is the sole writer/deleter of the snapshot store, writing each envelope atomically (reusing Brick 1's `writeFileAtomic`). `Rga.Doc.markDirty` / `clearDirty` are the triggers.

**Tech Stack:** Electron main process, `contextBridge` IPC, renderer IIFE modules, JSDOM + `node:test` (with `mock.timers`) unit tests, Playwright Electron integration/E2E tests.

**Source of truth:** `docs/superpowers/specs/2026-05-22-persistence-safety-contract.md` §4 (autosave) + §2 (ownership) + §7. This plan implements **Brick 3 only** (priority #3). Brick 4 (crash recovery) is planned separately.

**Branch / commits:** The working tree carries unrelated uncommitted work plus Bricks 1–2's staged-not-committed files. **Brick 3 does not commit.** Each task ends by staging its candidate paths for inspection only; a commit happens only on explicit user approval. A pre-implementation `git status` (below) records the starting state. `renderer/index.html` already carries unrelated prior-campaign changes — its one Brick-3 line is added but **never `git add`-ed** (staging would sweep the unrelated work), the accepted handling from Brick 2.

**Closes:** checklist item **PF-06** — "Autosave works" = the autosave **write** path. Brick 3 flips PF-06 `FALSE → TRUE` at SP-7 (candidate flip, contingent on the eight autosave-evidence points — §7). PF-06 does **not** depend on crash recovery; PF-08 / QG-11 remain FALSE until Brick 4.

---

## 1. Scope boundaries

### Exactly IN

- `Rga.Autosave` — per-document debounce (2 s) + max-interval (10 s) + the immediate first-dirty seed; builds the snapshot envelope; discards on manual save.
- `electron/bridge/autosave.js` — the main-process snapshot store: the `autosave.write` and `autosave.discard` IPC handlers, writing each envelope **atomically** via the Brick 1 `writeFileAtomic` primitive.
- `electron/lib/paths.js` — adjusted: `autosaveEntryPath` returns `<userData>/autosave/<safe-docId>.autosave.json`; the unused `autosaveManifestPath` is removed (Contract §5 — per-document self-describing envelopes, no shared manifest).
- Trigger wiring — `Rga.Doc.markDirty` notifies `Rga.Autosave.notifyChange`; `Rga.Doc.clearDirty` notifies `Rga.Autosave.notifyClean`.
- The snapshot envelope: `{ schemaVersion, savedAt, baseHandle, baseDisplayName, baseSavedAt, rga }`.
- Untitled-document autosave (keyed by `docId`, `baseHandle: null`).

### Exactly OUT

- **All recovery and restore.** No `scanOrphans`, no orphan detection, no boot-time recovery scan, no recovery dialog, no restoring a snapshot into the editor. (Brick 4.)
- **`Rga.Recovery`** — not created.
- **"Discard all snapshots on graceful quit"** — the close guard does not yet flush/clear snapshots; that glue belongs with recovery (Brick 4), since its only purpose is making "any snapshot at boot = orphan" hold.
- **Crash recovery and its checklist items** — PF-08 (crash recovery) and QG-11 (crash-recovery tests) stay FALSE until Brick 4. *(PF-06 "Autosave works" is the write path and is not gated on recovery — Brick 3 flips it; see §7.)*
- Any change to the Brick 1 atomic-write primitive or the Brick 2 close guard.

---

## 2. Ownership activation

**Activate (new, live in Brick 3):**

| Owner | Module | Responsibility |
|---|---|---|
| `Rga.Autosave` | `renderer/js/autosave.js` *(new)* | Per-document debounce/max-interval timers; the snapshot decision; building the envelope. |
| Autosave snapshot store | `electron/bridge/autosave.js` *(new)* | Sole writer/deleter of `<userData>/autosave/`. Owns `autosave.write` + `autosave.discard`. |

**Reused, unchanged:** `electron/lib/atomic-write.js` (Brick 1) — the atomic snapshot write.

**Kept DORMANT (not created, not implemented in Brick 3):**

- `Rga.Recovery` — the recovery flow. Not created.
- `autosave.scanOrphans` — orphan detection. Not implemented (the preload channel stub stays handler-less, exactly as today).
- Boot-time recovery wiring in `index.html` — not added.
- The recovery dialog / restore UX — not built.

---

## 3. RED → GREEN sequence

Five tasks, two stop-points. `electron/` files are not unit-loadable (they require Electron) — every `electron/` edit is followed by `node --check` (the Brick 1 lesson). Each task ends by staging for inspection — **no commit**.

### Pre-implementation check

- [ ] Run `git status` and record the working-tree state. Note the pre-existing entries (prior campaigns + Bricks 1–2 staged files) so they stay distinguishable. Do not stage, commit, or revert any of them.

---

### Task 1 — The autosave snapshot store (main process)

**Files:** modify `electron/lib/paths.js`; create `electron/bridge/autosave.js`; modify `electron/main.js`.

No unit test — these require Electron and are not unit-loadable; verified by `node --check` (syntax) and by Task 4's integration tests (the real write path). This mirrors how Brick 1's `files.js` was handled.

- [ ] **Step 1: Adjust `electron/lib/paths.js`.** Change the snapshot filename and drop the unused manifest path.

Replace:

```js
function autosaveManifestPath() {
  return path.join(autosaveDir(), 'manifest.json');
}

function autosaveEntryPath(docId) {
  const safe = String(docId).replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(autosaveDir(), safe + '.bak');
}
```

with:

```js
function autosaveEntryPath(docId) {
  const safe = String(docId).replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(autosaveDir(), safe + '.autosave.json');
}
```

And in `module.exports`, remove the `autosaveManifestPath,` line.

- [ ] **Step 2: Create `electron/bridge/autosave.js`.**

```js
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Persistence Safety Contract §4 / §2 — the autosave snapshot store. The sole
// writer/deleter of <userData>/autosave/. Brick 3 implements write + discard;
// scanOrphans (recovery) is Brick 4.
'use strict';

const { ipcMain } = require('electron');
const fs = require('node:fs/promises');
const { writeFileAtomic } = require('../lib/atomic-write');
const { autosaveEntryPath } = require('../lib/paths');

function register() {
  // Write a recovery snapshot. The envelope is written ATOMICALLY (Brick 1
  // primitive) so a crash mid-snapshot cannot corrupt the snapshot itself.
  ipcMain.handle('autosave.write', async (_event, docId, envelope) => {
    await writeFileAtomic(autosaveEntryPath(docId), JSON.stringify(envelope, null, 2));
    return { ok: true };
  });

  // Discard a document's snapshot (on a successful manual save).
  ipcMain.handle('autosave.discard', async (_event, docId) => {
    await fs.rm(autosaveEntryPath(docId), { force: true });
    return { ok: true };
  });
}

module.exports = { register };
```

- [ ] **Step 3: Wire the bridge into `electron/main.js`.**

Add the require alongside the others. From:

```js
const filesBridge = require('./bridge/files');
const windowControls = require('./bridge/window-controls');
```

To:

```js
const filesBridge = require('./bridge/files');
const windowControls = require('./bridge/window-controls');
const autosaveBridge = require('./bridge/autosave');
```

Register it in `app.whenReady()`. From:

```js
    filesBridge.register();
    windowControls.register();
    registerMenuIpc();
```

To:

```js
    filesBridge.register();
    windowControls.register();
    registerMenuIpc();
    autosaveBridge.register();
```

- [ ] **Step 4: Syntax-check all three `electron/` files.**

Run: `node --check electron/lib/paths.js && node --check electron/bridge/autosave.js && node --check electron/main.js`
Expected: no output, exit 0.

- [ ] **Step 5: Stage candidate paths for inspection (no commit).**

```bash
git add electron/lib/paths.js electron/bridge/autosave.js electron/main.js
git status --short
```

**Touched by this task:** `electron/lib/paths.js`, `electron/bridge/autosave.js`, `electron/main.js`

---

### Task 2 — `Rga.Autosave` (renderer)

**Files:** create `renderer/js/autosave.js`; create `tests/unit/autosave.test.js`; modify `renderer/index.html`.

- [ ] **Step 1: Write the failing test file** `tests/unit/autosave.test.js`:

```js
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

// Load autosave.js (a renderer IIFE) against a fresh JSDOM window with stub
// collaborators. Returns the module plus arrays capturing IPC calls.
function loadAutosave(opts) {
  opts = opts || {};
  const writes = [];
  const discards = [];
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>',
    { runScripts: 'outside-only' });
  global.window = dom.window;
  global.document = dom.window.document;
  dom.window.Rga = { Doc: { serialize: () => opts.serialized || 'RGA-STRING' } };
  dom.window.rwanga = {
    autosave: {
      write: (docId, envelope) => writes.push({ docId, envelope }),
      discard: (docId) => discards.push(docId)
    }
  };
  delete require.cache[require.resolve('../../renderer/js/autosave.js')];
  require('../../renderer/js/autosave.js');
  return { A: dom.window.Rga.Autosave, writes, discards };
}

test('first edit writes an immediate seed snapshot — no debounce wait', () => {
  const { A, writes } = loadAutosave();
  A.notifyChange({ docId: 'd1', displayName: 'a.rga', handle: '/x/a.rga' });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].docId, 'd1');
  assert.equal(writes[0].envelope.schemaVersion, 1);
  assert.equal(writes[0].envelope.rga, 'RGA-STRING');
});

test('debounce — a 2s pause after a follow-up edit triggers a snapshot', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const { A, writes } = loadAutosave();
  const doc = { docId: 'd1', displayName: 'a.rga', handle: null };
  A.notifyChange(doc);                 // seed (immediate)
  assert.equal(writes.length, 1);
  A.notifyChange(doc);                 // arms the 2s debounce
  t.mock.timers.tick(1999);
  assert.equal(writes.length, 1);      // not yet
  t.mock.timers.tick(1);               // 2000ms elapsed
  assert.equal(writes.length, 2);      // debounce fired
});

test('max interval — a snapshot is forced within 10s of continuous editing', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const { A, writes } = loadAutosave();
  const doc = { docId: 'd1', displayName: 'a.rga', handle: null };
  A.notifyChange(doc);                 // seed at t=0
  for (let i = 0; i < 8; i += 1) {     // edit every 1.5s for 12s
    t.mock.timers.tick(1500);
    A.notifyChange(doc);
  }
  // The debounce (2s) never fires — it is re-armed every 1.5s — yet the
  // max-interval forced at least one extra snapshot by the ~10s mark.
  assert.ok(writes.length >= 2, 'max interval should force a snapshot');
});

test('multiple documents — independent seeds and timers', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const { A, writes } = loadAutosave();
  const docA = { docId: 'dA', displayName: 'a.rga', handle: null };
  const docB = { docId: 'dB', displayName: 'b.rga', handle: null };
  A.notifyChange(docA);
  A.notifyChange(docB);
  assert.deepEqual(writes.map((w) => w.docId).sort(), ['dA', 'dB']);
  A.notifyChange(docA);                // arm dA debounce
  A.notifyChange(docB);                // arm dB debounce
  t.mock.timers.tick(2000);
  const ids = writes.map((w) => w.docId);
  assert.ok(ids.filter((x) => x === 'dA').length >= 2);
  assert.ok(ids.filter((x) => x === 'dB').length >= 2);
});

test('untitled document — autosave still writes, with baseHandle null', () => {
  const { A, writes } = loadAutosave();
  A.notifyChange({ docId: 'd1', displayName: 'Untitled.rga', handle: null });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].envelope.baseHandle, null);
});

test('manual save discards the snapshot and cancels pending autosave', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const { A, writes, discards } = loadAutosave();
  const doc = { docId: 'd1', displayName: 'a.rga', handle: '/x/a.rga' };
  A.notifyChange(doc);                 // seed
  A.notifyChange(doc);                 // arms debounce
  A.notifyClean(doc);                  // manual save
  assert.deepEqual(discards, ['d1']);
  t.mock.timers.tick(5000);
  assert.equal(writes.length, 1, 'no autosave write after the snapshot was discarded');
});

test('a document that is never edited produces no autosave writes', () => {
  const { A, writes } = loadAutosave();
  assert.ok(A, 'module loaded');
  assert.equal(writes.length, 0);
});
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `node --test tests/unit/autosave.test.js`
Expected: FAIL — every test errors with `Cannot find module '../../renderer/js/autosave.js'`.

- [ ] **Step 3: Write the module** `renderer/js/autosave.js`:

```js
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.Autosave — background recovery snapshots (Persistence Safety Contract §4).
// Owns the per-document debounce / max-interval timers and the snapshot writes.
// It does NOT recover or restore — that is Brick 4.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  const C = Rga.Constants || {};
  const DEBOUNCE_MS = C.AUTOSAVE_DEBOUNCE_MS || 2000;
  const MAX_INTERVAL_MS = C.AUTOSAVE_MAX_INTERVAL_MS || 10000;
  const SCHEMA_VERSION = 1;

  // docId -> { lastSnapshotAt: number, debounceTimer: timerId|null }
  const _state = new Map();

  // Sync the latest editor content into doc.body before serializing — only for
  // the active document (its live edits are in the EditorView, not doc.body).
  function _capture(doc) {
    const TM = Rga.TabManager;
    if (!TM || typeof TM._editorView !== 'function') return;
    const view = TM._editorView();
    if (view && typeof TM.activeDoc === 'function' && TM.activeDoc() === doc) {
      doc.body = view.state.doc;
    }
  }

  function _writeSnapshot(doc) {
    if (!window.rwanga || !window.rwanga.autosave
        || typeof window.rwanga.autosave.write !== 'function') return;
    if (!Rga.Doc || typeof Rga.Doc.serialize !== 'function') return;
    const envelope = {
      schemaVersion: SCHEMA_VERSION,
      savedAt: Date.now(),
      baseHandle: doc.handle || null,
      baseDisplayName: doc.displayName,
      baseSavedAt: doc.lastSavedAt || null,
      rga: Rga.Doc.serialize(doc)
    };
    window.rwanga.autosave.write(doc.docId, envelope);
  }

  function _armDebounce(doc, st) {
    if (st.debounceTimer) clearTimeout(st.debounceTimer);
    st.debounceTimer = setTimeout(function() {
      st.debounceTimer = null;
      _writeSnapshot(doc);
      st.lastSnapshotAt = Date.now();
    }, DEBOUNCE_MS);
  }

  // Called by Rga.Doc.markDirty on every document-changing edit.
  function notifyChange(doc) {
    if (!doc || !doc.docId) return;
    _capture(doc);
    const id = doc.docId;
    const st = _state.get(id);
    const now = Date.now();
    if (!st) {
      // CLEAN -> DIRTY: write the immediate seed snapshot; no debounce yet.
      _writeSnapshot(doc);
      _state.set(id, { lastSnapshotAt: now, debounceTimer: null });
      return;
    }
    // Already dirty: enforce the max interval, then (re)arm the debounce.
    if (now - st.lastSnapshotAt >= MAX_INTERVAL_MS) {
      _writeSnapshot(doc);
      st.lastSnapshotAt = now;
    }
    _armDebounce(doc, st);
  }

  // Called by Rga.Doc.clearDirty on a successful manual save.
  function notifyClean(doc) {
    if (!doc || !doc.docId) return;
    const id = doc.docId;
    const st = _state.get(id);
    if (st && st.debounceTimer) clearTimeout(st.debounceTimer);
    _state.delete(id);
    if (window.rwanga && window.rwanga.autosave
        && typeof window.rwanga.autosave.discard === 'function') {
      window.rwanga.autosave.discard(id);
    }
  }

  function _reset() {
    _state.forEach(function(st) { if (st.debounceTimer) clearTimeout(st.debounceTimer); });
    _state.clear();
  }

  Rga.Autosave = { notifyChange, notifyClean, _reset, _state: _state };
})();
```

- [ ] **Step 4: Run the test to verify it passes.**

Run: `node --test tests/unit/autosave.test.js`
Expected: PASS — `# pass 7`, `# fail 0`.

- [ ] **Step 5: Register the script in `index.html`.** From:

```html
    <script src="js/close-guard.js"></script>
```

To:

```html
    <script src="js/close-guard.js"></script>
    <script src="js/autosave.js"></script>
```

- [ ] **Step 6: Run the full unit suite.**

Run: `npm run test:unit`
Expected: PASS — all green, `# fail 0` (the 7 new autosave tests included).

- [ ] **Step 7: Stage candidate paths for inspection (no commit).**

```bash
git add renderer/js/autosave.js tests/unit/autosave.test.js
git status --short
```

`renderer/index.html` is edited (one `<script>` line) but **NOT staged** — it carries unrelated prior-campaign uncommitted work; `git add` would sweep it. Report it as the Brick-3-owned line.

**Touched by this task:** `renderer/js/autosave.js`, `tests/unit/autosave.test.js`, `renderer/index.html` (unstaged)

---

### Task 3 — Trigger wiring (`markDirty` / `clearDirty` → `Rga.Autosave`)

**Files:** modify `renderer/js/doc.js`; modify `tests/unit/doc.test.js`.

- [ ] **Step 1: Add the failing wiring test.** Append to the end of `tests/unit/doc.test.js`:

```js
test('markDirty notifies Rga.Autosave.notifyChange; clearDirty notifies notifyClean', () => {
  const changes = [];
  const cleans = [];
  global.window.Rga.Autosave = {
    notifyChange: (d) => changes.push(d),
    notifyClean: (d) => cleans.push(d)
  };
  const doc = Doc.create();
  Doc.markDirty(doc);
  assert.deepEqual(changes, [doc]);
  Doc.clearDirty(doc, Date.now());
  assert.deepEqual(cleans, [doc]);
  delete global.window.Rga.Autosave;
});
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `node --test tests/unit/doc.test.js`
Expected: the existing tests PASS; the new test FAILS — `markDirty` / `clearDirty` do not notify `Rga.Autosave` yet (`changes` / `cleans` stay empty).

- [ ] **Step 3: Wire the notifications in `renderer/js/doc.js`.**

Replace `markDirty`:

```js
  function markDirty(doc) {
    doc.dirty = true;
    if (doc.metadata) {
      doc.metadata.modified = new Date().toISOString();
    }
  }
```

with:

```js
  function markDirty(doc) {
    doc.dirty = true;
    if (doc.metadata) {
      doc.metadata.modified = new Date().toISOString();
    }
    // Persistence Safety Contract §4 — autosave is triggered by every edit.
    if (Rga.Autosave && typeof Rga.Autosave.notifyChange === 'function') {
      Rga.Autosave.notifyChange(doc);
    }
  }
```

Replace `clearDirty`:

```js
  function clearDirty(doc, savedAt) {
    doc.dirty = false;
    doc.lastSavedAt = savedAt || Date.now();
  }
```

with:

```js
  function clearDirty(doc, savedAt) {
    doc.dirty = false;
    doc.lastSavedAt = savedAt || Date.now();
    // Persistence Safety Contract §4 — a manual save discards the snapshot.
    if (Rga.Autosave && typeof Rga.Autosave.notifyClean === 'function') {
      Rga.Autosave.notifyClean(doc);
    }
  }
```

- [ ] **Step 4: Run the test to verify it passes.**

Run: `node --test tests/unit/doc.test.js`
Expected: PASS — all tests green, including the new wiring test.

- [ ] **Step 5: Run the full unit suite.**

Run: `npm run test:unit`
Expected: PASS — all green, `# fail 0`.

- [ ] **Step 6: Stage candidate paths for inspection (no commit).**

```bash
git add renderer/js/doc.js tests/unit/doc.test.js
git status --short
```

**Touched by this task:** `renderer/js/doc.js`, `tests/unit/doc.test.js`

---

### Task 4 — Integration tests (snapshot on disk)

**Files:** create `tests/integration/autosave.spec.js`.

- [ ] **Step 1: Write the integration spec** `tests/integration/autosave.spec.js`:

```js
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Persistence Safety — Brick 3 (autosave). Proves the wired write path: a
// dirty document is snapshotted to <userData>/autosave/, one file per document,
// and the snapshot survives a force-kill. Brick 3 does NOT restore (Brick 4).
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..');

function snapshotDir(udd) { return path.join(udd, 'autosave'); }
function listSnapshots(udd) {
  try {
    return fs.readdirSync(snapshotDir(udd)).filter((f) => f.endsWith('.autosave.json'));
  } catch (_) { return []; }
}

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

test('autosave writes a snapshot to userData/autosave while typing', async () => {
  await page.locator('#editor').click();
  await page.keyboard.type('autosavemarker');

  // The immediate seed lands at once; the debounce snapshot — carrying the
  // full typed text — lands ~2s after typing stops. Poll the snapshot content.
  await expect.poll(() => {
    const list = listSnapshots(userDataDir);
    if (list.length !== 1) return '';
    try {
      const e = JSON.parse(fs.readFileSync(path.join(snapshotDir(userDataDir), list[0]), 'utf8'));
      return String(e.rga || '').toLowerCase();
    } catch (_) { return ''; }
  }).toContain('autosavemarker');

  // The snapshot is a single valid envelope.
  const snaps = listSnapshots(userDataDir);
  expect(snaps.length).toBe(1);
  const env = JSON.parse(fs.readFileSync(path.join(snapshotDir(userDataDir), snaps[0]), 'utf8'));
  expect(env.schemaVersion).toBe(1);
  expect(typeof env.rga).toBe('string');
});

test('multiple tabs keep separate snapshots', async () => {
  // Document 1.
  await page.locator('#editor').click();
  await page.keyboard.type('firsttab');
  await expect.poll(() => listSnapshots(userDataDir).length).toBeGreaterThanOrEqual(1);

  // Document 2 — a new script, then type.
  await page.evaluate(() => window.Rga.FileManager.newScript());
  await page.locator('#editor').click();
  await page.keyboard.type('secondtab');
  await expect.poll(() => listSnapshots(userDataDir).length).toBeGreaterThanOrEqual(2);

  // Two distinct snapshot files — one per document.
  expect(listSnapshots(userDataDir).length).toBe(2);
});
```

- [ ] **Step 2: Build the renderer bundle (integration prerequisite).**

Run: `npm run build:renderer`
Expected: the build completes without error.

- [ ] **Step 3: Run the integration spec.**

Run: `npx playwright test --config=tests/integration/playwright.config.js autosave.spec.js`
Expected: PASS — `2 passed`.

- [ ] **Step 4: Stage candidate paths for inspection (no commit).**

```bash
git add tests/integration/autosave.spec.js
git status --short
```

**Touched by this task:** `tests/integration/autosave.spec.js`

---

## ⛔ STOP — SP-6

Verify and report:
1. **Snapshot location** — the integration test confirms snapshots land at `<userData>/autosave/<safe-docId>.autosave.json`. Report the observed path.
2. **Immediate seed** — `autosave.test.js` `first edit writes an immediate seed snapshot` is green; the integration test's snapshot appears without a debounce wait.
3. **Multiple-document isolation** — `autosave.test.js` `multiple documents — independent seeds and timers` is green; the integration test `multiple tabs keep separate snapshots` confirms one file per document.

Record findings in `RWANGA_IDE_LAUNCH_CHECKLIST.md` (Rule 6) and **stop for review**. Do not start Task 5 until SP-6 is signed off.

---

### Task 5 — E2E (crash → reopen → snapshot present, no restore)

**Files:** modify `tests/integration/autosave.spec.js`.

- [ ] **Step 1: Append the E2E test** to `tests/integration/autosave.spec.js`:

```js
test('a snapshot survives a force-kill and is present after reopen (no restore)', async () => {
  await page.locator('#editor').click();
  await page.keyboard.type('crashmarker');
  await expect.poll(() => listSnapshots(userDataDir).length).toBeGreaterThan(0);
  const before = listSnapshots(userDataDir);
  expect(before.length).toBe(1);

  // Force-terminate the app — a crash, no graceful shutdown.
  app.process().kill('SIGKILL');
  await app.waitForEvent('close').catch(() => {});
  app = null;

  // Reopen with the SAME userData directory.
  app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const page2 = await app.firstWindow();
  await page2.waitForLoadState('domcontentloaded');
  await page2.waitForFunction(() => !!(window.Rga && window.Rga.FileManager));

  // The pre-crash snapshot is still on disk — Brick 3 does NOT restore it.
  expect(listSnapshots(userDataDir)).toContain(before[0]);

  // The reopened editor shows a fresh, clean document — nothing was restored.
  const dirty = await page2.evaluate(() => {
    const d = window.Rga.FileManager.getActive();
    return d ? d.dirty : false;
  });
  expect(dirty).toBe(false);
});
```

- [ ] **Step 2: Run the integration spec (all three tests).**

Run: `npx playwright test --config=tests/integration/playwright.config.js autosave.spec.js`
Expected: PASS — `3 passed`.

- [ ] **Step 3: Run the full integration suite for no regressions.**

Run: `npm run test:e2e`
Expected: PASS — `15 passed` (the 12 existing specs + the 3 new ones).

- [ ] **Step 4: Run the full unit suite.**

Run: `npm run test:unit`
Expected: PASS — all green, `# fail 0`.

- [ ] **Step 5: Stage candidate paths for inspection (no commit).**

```bash
git add tests/integration/autosave.spec.js
git status --short
```

**Touched by this task:** `tests/integration/autosave.spec.js`

---

## ⛔ STOP — SP-7

Brick 3 (autosave) is complete.

- [ ] **Update `RWANGA_IDE_LAUNCH_CHECKLIST.md` (Rule 6):** append an Implementation-log entry; if the eight autosave-evidence points (§7) are all green, **flip PF-06 `FALSE → TRUE`** with cited evidence and update the §3 totals + the §0 verdict. PF-08 and QG-11 stay FALSE (Brick 4).
- [ ] **Report** the PF-06 evidence and the flip, and **stop for review** before Brick 4 (crash recovery) is planned.

---

## 4. Exact files touched

### New

| File | Purpose |
|---|---|
| `rwanga-editor/electron/bridge/autosave.js` | The autosave snapshot store (`autosave.write` + `autosave.discard`). |
| `rwanga-editor/renderer/js/autosave.js` | `Rga.Autosave` — debounce / seed / max-interval. |
| `rwanga-editor/tests/unit/autosave.test.js` | 7 JSDOM unit tests for `Rga.Autosave`. |
| `rwanga-editor/tests/integration/autosave.spec.js` | 3 Playwright tests (2 integration + 1 E2E). |

### Existing (modified)

| File | Change |
|---|---|
| `rwanga-editor/electron/lib/paths.js` | `autosaveEntryPath` → `.autosave.json`; `autosaveManifestPath` removed. |
| `rwanga-editor/electron/main.js` | require + `register()` the autosave bridge. |
| `rwanga-editor/renderer/js/doc.js` | `markDirty` / `clearDirty` notify `Rga.Autosave`. |
| `rwanga-editor/tests/unit/doc.test.js` | +1 wiring test. |
| `rwanga-editor/renderer/index.html` | +1 `<script>` line (autosave.js) — **edited, never staged** (carries unrelated prior work). |

### Reused, unchanged

`rwanga-editor/electron/lib/atomic-write.js` (Brick 1) — the atomic snapshot write.

---

## 5. Required tests

### Unit — `tests/unit/autosave.test.js` (Task 2)

| Test | Asserts |
|---|---|
| dirty → immediate seed snapshot | first `notifyChange` writes synchronously, before any debounce |
| debounce (2 s) | a follow-up edit + a 2 s pause triggers exactly one snapshot |
| max interval (10 s) | continuous editing (debounce never settling) still forces a snapshot by ~10 s |
| multiple documents — independent timers | two docs get independent seeds and independent debounce timers |
| untitled document support | a `handle: null` doc is snapshotted, envelope `baseHandle: null` |
| cleanup on manual save | `notifyClean` → `autosave.discard` called + pending debounce cancelled |
| no writes while CLEAN | a never-edited document produces zero `autosave.write` calls |

Plus the wiring test in `tests/unit/doc.test.js` (Task 3): `markDirty` → `notifyChange`, `clearDirty` → `notifyClean`.

### Integration — `tests/integration/autosave.spec.js` (Task 4)

| Test | Asserts |
|---|---|
| crash during typing leaves snapshot | typing produces a valid envelope at `<userData>/autosave/*.autosave.json` carrying the typed text |
| multiple tabs keep separate snapshots | two edited documents → two distinct snapshot files |

### E2E — `tests/integration/autosave.spec.js` (Task 5)

| Test | Asserts |
|---|---|
| type → force-terminate (`SIGKILL`) → reopen → verify snapshot presence | the pre-crash snapshot is still on disk after a hard kill + relaunch; the reopened editor is a fresh clean document — **nothing is restored** (recovery is Brick 4) |

---

## 6. Stop-points

| ID | Stop point | Verify / report |
|---|---|---|
| **SP-6** | After Task 4 (the autosave write path is built + unit-tested + integration-tested). | (1) **Snapshot location** verified — `<userData>/autosave/<safe-docId>.autosave.json`; (2) **immediate seed** verified — unit test + the integration snapshot appears with no debounce wait; (3) **multiple-document isolation** verified — unit test + the multi-tab integration test (one file per document). Checklist Rule 6 update; stop for review. |
| **SP-7** | After Task 5 (E2E green, full suites green). | Brick 3 complete. **Flip PF-06 `FALSE → TRUE`** if the eight autosave-evidence points (§7) are all green. PF-08 / QG-11 stay FALSE (Brick 4). Checklist Rule 6 update; stop for review before Brick 4 is planned. |

---

## 7. Checklist Rule 6 impact

- **Expected ID:** `PF-06` — **flips `FALSE → TRUE` at SP-7** (a candidate flip presented at the stop-point for sign-off, like every other brick flip). PF-06 is currently `FALSE` (the Core Editor Trust forensic set it FALSE when autosave did not exist).
- **PF-06 = "Autosave works" = the autosave _write_ path. It does not depend on crash recovery.** PF-06 flips to `TRUE` only if all eight autosave-evidence points are green:
  1. CLEAN → DIRTY creates an immediate seed snapshot;
  2. a debounce snapshot writes after an edit quiet period;
  3. a max-interval snapshot writes during continuous edits;
  4. untitled documents are snapshotted;
  5. multiple tabs have isolated snapshot files;
  6. a manual save discards the snapshot;
  7. CLEAN documents do not write snapshots;
  8. a force-termination leaves the snapshot present on disk.
  Points 1–7 are the `autosave.test.js` unit tests + the multi-tab integration test; point 8 is the E2E. The current checklist PF-06 Evidence-required text mentions "recover" — that wording is **superseded**: recover belongs to PF-08 (crash recovery), not PF-06. When PF-06 is flipped, its row is rewritten to cite the eight points above.
- **PF-08 (crash recovery) and QG-11 (crash-recovery tests) remain `FALSE`** — Brick 4 owns the startup orphan scan, the Restore / Discard prompt, and reopening recovered tabs.
- **No other checklist ID changes.** At SP-7: P0 `TRUE` 25 → **26**, `FALSE` 7 → **6** (`PARTIAL` 22, `UNKNOWN` 6 unchanged); the §0 verdict and §3 totals update accordingly.
- Each stop-point (SP-6, SP-7) appends an Implementation-log entry in the same step (Operating Rule 6).

---

## Self-review

- **Spec coverage (Contract §4):** trigger = `markDirty` (Task 3); debounce 2 s + max-interval 10 s (Task 2 + tests); document identity = `docId`, envelope shape (Task 2); untitled-document handling (Task 2 test + integration); multiple-tab independence (Task 2 test + integration); atomic snapshot write (Task 1, via `writeFileAtomic`); discard-on-save (Task 3 wiring + Task 2 test). Recovery (§5) explicitly OUT.
- **Placeholder scan:** none — every step carries exact code and exact commands.
- **Type consistency:** `notifyChange(doc)` / `notifyClean(doc)` take a doc object throughout; the envelope shape `{ schemaVersion, savedAt, baseHandle, baseDisplayName, baseSavedAt, rga }` is identical in `autosave.js`, the unit tests, and the integration assertions; `autosave.write(docId, envelope)` / `autosave.discard(docId)` match the preload channels.
- **Brick-1 lesson applied:** `electron/lib/paths.js`, `electron/bridge/autosave.js`, `electron/main.js` are not unit-loaded — Task 1 `node --check`s all three.
- **Scope:** Brick 3 only (autosave write path). Recovery/restore is Brick 4, planned separately after SP-7.
