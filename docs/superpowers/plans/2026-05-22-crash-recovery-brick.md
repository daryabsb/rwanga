# Brick 4 — Crash Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a crash, the autosave snapshot left on disk is detected on the next launch, the writer is shown a modal Restore / Discard prompt, and Restore reopens the unsaved work as a dirty tab. A graceful quit leaves no snapshot, so the prompt only ever appears after a real crash.

**Architecture:** A new main-process handler `autosave.scanOrphans` lists surviving snapshots; a new renderer module `Rga.Recovery` runs the boot-time recovery flow (scan → prompt → restore/discard); `Rga.Modal` gains a `showRecovery` dialog. A small `close-guard.js` change discards a document's snapshot when its changes are Discarded, so a graceful quit clears every snapshot (making "snapshot present at boot ⇒ crash orphan" hold).

**Tech Stack:** Electron main process, renderer IIFE modules, JSDOM + `node:test` unit tests, Playwright Electron integration/E2E tests.

**Source of truth:** `docs/superpowers/specs/2026-05-22-persistence-safety-contract.md` §5 (crash recovery) + §2 (ownership) + §7 (SP-8, SP-9) + **§0 P6 (Recovery Ownership Rule)**. This plan implements **Brick 4 only** (priority #4) — the final Persistence Safety brick.

**Branch / commits:** The working tree carries unrelated prior-campaign work plus Bricks 1–3's staged-not-committed files. **Brick 4 does not commit.** Each task ends by staging its candidate paths for inspection only; a commit happens only on explicit user approval. A pre-implementation `git status` (below) records the starting state. `renderer/index.html` already carries unrelated prior-campaign changes — its Brick-4 lines are added but **never `git add`-ed** (staging would sweep the unrelated work), the accepted handling from Bricks 2–3.

**Closes:** **PF-08** (crash recovery works) and **QG-11** (crash-recovery tests) — flipped `FALSE → TRUE` at SP-9.

### Ownership (Contract §0 P6 — Recovery Ownership Rule)

Brick 3 owns snapshot *creation* + *persistence*. **Brick 4 owns snapshot
*interpretation*, *orphan detection*, the *Restore / Discard* UX, and
*recovered-tab creation*.** Binding for this plan: only Brick 4 transforms a
snapshot back into a document; nothing restores content automatically — the
modal prompt always gates it; no recovery concern gets two owners.

---

## File structure

### New

| File | Purpose |
|---|---|
| `rwanga-editor/renderer/js/recovery.js` | `Rga.Recovery` — the boot-time scan → prompt → restore/discard flow. |
| `rwanga-editor/tests/unit/recovery.test.js` | JSDOM unit tests for `Rga.Recovery`. |
| `rwanga-editor/tests/unit/modal-recovery.test.js` | JSDOM unit tests for `Rga.Modal.showRecovery`. |
| `rwanga-editor/tests/integration/recovery.spec.js` | Playwright kill-and-recover E2E (this is QG-11). |

### Existing (modified)

| File | Change |
|---|---|
| `rwanga-editor/electron/bridge/autosave.js` | + the `autosave.scanOrphans` handler. |
| `rwanga-editor/renderer/js/shell/modal.js` | + `Rga.Modal.showRecovery(orphans)` — the recovery dialog. |
| `rwanga-editor/renderer/js/close-guard.js` | the `discard` branch also discards the document's snapshot. |
| `rwanga-editor/tests/unit/close-guard.test.js` | +1 test for the discard-snapshot behaviour. |
| `rwanga-editor/renderer/js/tab-manager.js` | `bootSession` dedupes a file already open as a recovered tab (session/recovery merge). |
| `rwanga-editor/tests/unit/tab-manager.test.js` | +1 test for the `bootSession` merge/dedup. |
| `rwanga-editor/renderer/index.html` | + the `recovery.js` `<script>` tag + the boot recovery wiring — **edited, never staged**. |

### Reused, unchanged

`electron/lib/atomic-write.js`, `electron/lib/paths.js` (`autosaveDir` / `autosaveEntryPath`), `Rga.Autosave`, `Rga.Doc`, `Rga.TabManager`.

All paths below are relative to `rwanga-editor/`. Run all commands from `rwanga-editor/`.

---

## Pre-implementation check

- [ ] Run `git status` and record the working-tree state. Note the pre-existing entries (prior campaigns + Bricks 1–3 staged files). Do not stage, commit, or revert any of them. Do not touch `tests/fixtures/mysterious-guest-rtl.rga`.

---

## Task 1 — `autosave.scanOrphans` (main process)

**Files:** modify `electron/bridge/autosave.js`.

Not unit-loadable (requires Electron) — verified by `node --check` and Task 5's E2E.

- [ ] **Step 1: Add the `scanOrphans` handler.** Replace the whole of `electron/bridge/autosave.js` with:

```js
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Persistence Safety Contract §4 / §5 / §2 — the autosave snapshot store. The
// sole writer / deleter / reader of <userData>/autosave/.
'use strict';

const { ipcMain } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { writeFileAtomic } = require('../lib/atomic-write');
const { autosaveEntryPath, autosaveDir } = require('../lib/paths');

function register() {
  // Write a recovery snapshot. The envelope is written ATOMICALLY (Brick 1
  // primitive) so a crash mid-snapshot cannot corrupt the snapshot itself.
  ipcMain.handle('autosave.write', async (_event, docId, envelope) => {
    await writeFileAtomic(autosaveEntryPath(docId), JSON.stringify(envelope, null, 2));
    return { ok: true };
  });

  // Discard a document's snapshot (on a successful manual save, or when the
  // writer discards the changes).
  ipcMain.handle('autosave.discard', async (_event, docId) => {
    await fs.rm(autosaveEntryPath(docId), { force: true });
    return { ok: true };
  });

  // Persistence Safety Contract §5 — list crash-orphan snapshots. A graceful
  // quit discards every snapshot (close guard + manual save), so any
  // *.autosave.json still present is a crash orphan.
  ipcMain.handle('autosave.scanOrphans', async () => {
    let files;
    try { files = await fs.readdir(autosaveDir()); }
    catch (_) { return []; }   // the autosave directory does not exist yet
    const orphans = [];
    for (const f of files) {
      if (!f.endsWith('.autosave.json')) continue;
      try {
        const env = JSON.parse(await fs.readFile(path.join(autosaveDir(), f), 'utf8'));
        orphans.push({
          id: f.slice(0, -'.autosave.json'.length),
          savedAt: env.savedAt || null,
          baseHandle: env.baseHandle || null,
          baseDisplayName: env.baseDisplayName || 'Untitled.rga',
          rga: env.rga
        });
      } catch (_) { /* skip a corrupt / partially-written snapshot */ }
    }
    return orphans;
  });
}

module.exports = { register };
```

- [ ] **Step 2: Syntax-check.**

Run: `node --check electron/bridge/autosave.js`
Expected: no output, exit 0.

- [ ] **Step 3: Run the full unit suite (no regression).**

Run: `npm run test:unit`
Expected: PASS — all green, `# fail 0`.

- [ ] **Step 4: Stage candidate paths for inspection (no commit).**

```bash
git add electron/bridge/autosave.js
git status --short
```

**Touched by this task:** `electron/bridge/autosave.js`

---

## ⛔ STOP — SP-8

**Contract §7 SP-8.** `scanOrphans` exists; the recovery dialog (Task 2) is designed below but not yet implemented.

**Confirm before starting Task 2:**
1. **Recovery dialog copy & behaviour** — a **modal** titled "Recover unsaved work?", listing each recovered document (`baseDisplayName` + "last autosaved <relative time>"), with two buttons: **Restore** and **Discard** (applied to **all** listed orphans — v1 has no per-item granularity).
2. **Recovered tabs open DIRTY** — each restored document is opened as a dirty tab; the writer must consciously Save it.
3. **Snapshot kept until saved (Contract §5)** — achieved by **reusing the orphan's id as the recovered document's `docId`**: the orphan file becomes the recovered document's own autosave snapshot (continuously refreshed by autosave, discarded by the manual save's `clearDirty`). No duplicate snapshot; no separate "keep" bookkeeping.
4. **Boot ordering — recovery and session restore MERGE.** Recovery runs first and opens the orphan (dirty) tabs; session restore then **always** runs and opens the previous session's clean tabs. They are **deduplicated by file path**: a session file already open as a recovered tab is skipped — the recovered (dirty) version wins. Binding rules: recovery owns orphan tabs only; session restore owns clean prior-session tabs only; no duplicate tabs; clean prior-session tabs still appear; recovery never hides unrelated tabs.
5. **Modal CSS** — Task 2 builds the dialog dynamically; its overlay/dialog/button classes must match the existing `#unsaved-modal` so it inherits modal styling. Task 2 Step 1 verifies the real class names.

Record findings in `RWANGA_IDE_LAUNCH_CHECKLIST.md` (Rule 6) and **stop for review**. Do not start Task 2 until SP-8 is signed off.

---

## Task 2 — `Rga.Modal.showRecovery` (the recovery dialog)

**Files:** modify `renderer/js/shell/modal.js`; create `tests/unit/modal-recovery.test.js`.

- [ ] **Step 1: Verify the modal CSS class names.** Read `renderer/index.html`'s `#unsaved-modal` markup and the modal CSS (`renderer/css/overlays.css` or wherever `.modal-*` is defined). Confirm the overlay, dialog, and button class names. The code in Step 3 uses `modal-overlay` / `modal-dialog` / `modal-btn` — **if the real names differ, update Step 3's code to match** (the Brick-2 lesson: never hardcode a class that may not exist).

- [ ] **Step 2: Write the failing test file** `tests/unit/modal-recovery.test.js`:

```js
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function loadModal() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>',
    { runScripts: 'outside-only' });
  global.window = dom.window;
  global.document = dom.window.document;
  dom.window.Rga = {};
  delete require.cache[require.resolve('../../renderer/js/shell/modal.js')];
  require('../../renderer/js/shell/modal.js');
  return dom.window;
}

test('showRecovery shows a modal listing the orphans and resolves on Restore', async () => {
  const w = loadModal();
  const orphans = [
    { id: 'd1', baseDisplayName: 'one.rga', savedAt: Date.now() },
    { id: 'd2', baseDisplayName: 'two.rga', savedAt: Date.now() }
  ];
  const p = w.Rga.Modal.showRecovery(orphans);
  const modal = w.document.getElementById('recovery-modal');
  assert.ok(modal, 'the recovery modal is in the DOM');
  assert.match(modal.textContent, /one\.rga/);
  assert.match(modal.textContent, /two\.rga/);
  modal.querySelector('[data-choice="restore"]').dispatchEvent(
    new w.Event('click', { bubbles: true }));
  assert.equal(await p, 'restore');
  assert.equal(w.document.getElementById('recovery-modal'), null,
    'the modal is removed after a choice');
});

test('showRecovery resolves discard on the Discard button', async () => {
  const w = loadModal();
  const p = w.Rga.Modal.showRecovery([{ id: 'd1', baseDisplayName: 'a.rga', savedAt: Date.now() }]);
  w.document.getElementById('recovery-modal')
    .querySelector('[data-choice="discard"]')
    .dispatchEvent(new w.Event('click', { bubbles: true }));
  assert.equal(await p, 'discard');
});
```

- [ ] **Step 3: Run the test to verify it fails.**

Run: `node --test tests/unit/modal-recovery.test.js`
Expected: FAIL — `w.Rga.Modal.showRecovery is not a function`.

- [ ] **Step 4: Add `showRecovery` to `modal.js`.** In `renderer/js/shell/modal.js`, replace:

```js
  Rga.Modal = {
    showUnsaved: function(filename) {
```

with:

```js
  // Persistence Safety Contract §5 — relative "last autosaved" wording.
  function _relativeTime(ts) {
    if (!ts) return 'recently';
    var secs = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (secs < 60) return 'less than a minute ago';
    var mins = Math.round(secs / 60);
    if (mins < 60) return mins + (mins === 1 ? ' minute ago' : ' minutes ago');
    var hrs = Math.round(mins / 60);
    return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
  }

  Rga.Modal = {
    // Persistence Safety Contract §5 — the crash-recovery prompt. Lists every
    // orphan; Restore / Discard apply to all. Resolves 'restore' | 'discard'.
    showRecovery: function(orphans) {
      return new Promise(function(resolve) {
        var overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'recovery-modal';

        var dialog = document.createElement('div');
        dialog.className = 'modal-dialog';

        var title = document.createElement('div');
        title.className = 'modal-title';
        title.textContent = 'Recover unsaved work?';
        dialog.appendChild(title);

        var msg = document.createElement('div');
        msg.className = 'modal-msg';
        msg.textContent = 'Rwanga found unsaved changes from a previous session:';
        dialog.appendChild(msg);

        var list = document.createElement('ul');
        list.className = 'recovery-list';
        (orphans || []).forEach(function(o) {
          var li = document.createElement('li');
          li.textContent = (o.baseDisplayName || 'Untitled.rga')
            + ' — last autosaved ' + _relativeTime(o.savedAt);
          list.appendChild(li);
        });
        dialog.appendChild(list);

        var actions = document.createElement('div');
        actions.className = 'modal-actions';
        [['discard', 'Discard'], ['restore', 'Restore']].forEach(function(pair) {
          var btn = document.createElement('button');
          btn.className = 'modal-btn' + (pair[0] === 'restore' ? ' primary' : '');
          btn.dataset.choice = pair[0];
          btn.textContent = pair[1];
          actions.appendChild(btn);
        });
        dialog.appendChild(actions);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', function onClick(e) {
          var btn = e.target.closest('[data-choice]');
          if (!btn) return;
          overlay.removeEventListener('click', onClick);
          overlay.remove();
          resolve(btn.dataset.choice);
        });
      });
    },

    showUnsaved: function(filename) {
```

- [ ] **Step 5: Run the test to verify it passes.**

Run: `node --test tests/unit/modal-recovery.test.js`
Expected: PASS — `# pass 2`, `# fail 0`.

- [ ] **Step 6: Run the full unit suite.**

Run: `npm run test:unit`
Expected: PASS — all green, `# fail 0`.

- [ ] **Step 7: Stage candidate paths for inspection (no commit).**

```bash
git add renderer/js/shell/modal.js tests/unit/modal-recovery.test.js
git status --short
```

**Touched by this task:** `renderer/js/shell/modal.js`, `tests/unit/modal-recovery.test.js`

---

## Task 3 — `Rga.Recovery` (the boot-time recovery flow)

**Files:** create `renderer/js/recovery.js`; create `tests/unit/recovery.test.js`; modify `renderer/index.html` (script tag).

- [ ] **Step 1: Write the failing test file** `tests/unit/recovery.test.js`:

```js
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

// Load recovery.js (a renderer IIFE) against a fresh JSDOM window with stubs.
function loadRecovery(opts) {
  opts = opts || {};
  const calls = { opened: [], dirtied: [], discarded: [] };
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>',
    { runScripts: 'outside-only' });
  global.window = dom.window;
  global.document = dom.window.document;
  dom.window.Rga = {
    Modal: { showRecovery: async () => opts.choice || 'discard' },
    Doc: {
      deserialize: (rga) => {
        if (opts.corrupt && rga === opts.corrupt) throw new Error('corrupt');
        return { docId: 'fresh-' + rga, displayName: 'r.rga', body: null, dirty: false };
      },
      markDirty: (d) => calls.dirtied.push(d)
    },
    TabManager: { openDocument: (d) => calls.opened.push(d) }
  };
  dom.window.rwanga = {
    autosave: {
      scanOrphans: async () => opts.orphans || [],
      discard: (id) => calls.discarded.push(id)
    }
  };
  delete require.cache[require.resolve('../../renderer/js/recovery.js')];
  require('../../renderer/js/recovery.js');
  return { R: dom.window.Rga.Recovery, calls };
}

test('run with no orphans returns restoredCount 0 and shows no prompt', async () => {
  let prompted = false;
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { runScripts: 'outside-only' });
  global.window = dom.window; global.document = dom.window.document;
  dom.window.Rga = { Modal: { showRecovery: async () => { prompted = true; return 'discard'; } } };
  dom.window.rwanga = { autosave: { scanOrphans: async () => [] } };
  delete require.cache[require.resolve('../../renderer/js/recovery.js')];
  require('../../renderer/js/recovery.js');
  const result = await dom.window.Rga.Recovery.run();
  assert.deepEqual(result, { restoredCount: 0 });
  assert.equal(prompted, false);
});

test('run with orphans + Restore reopens each as a dirty tab', async () => {
  const { R, calls } = loadRecovery({
    choice: 'restore',
    orphans: [
      { id: 'oA', rga: 'RGA-A', baseHandle: '/x/a.rga', baseDisplayName: 'a.rga' },
      { id: 'oB', rga: 'RGA-B', baseHandle: null, baseDisplayName: 'Untitled.rga' }
    ]
  });
  const result = await R.run();
  assert.equal(result.restoredCount, 2);
  assert.equal(calls.opened.length, 2);
  assert.equal(calls.dirtied.length, 2);
});

test('a restored document reuses the orphan id as its docId', async () => {
  const { R, calls } = loadRecovery({
    choice: 'restore',
    orphans: [{ id: 'orphan-7', rga: 'RGA-A', baseHandle: null, baseDisplayName: 'a.rga' }]
  });
  await R.run();
  assert.equal(calls.opened[0].docId, 'orphan-7');
});

test('run with orphans + Discard deletes each snapshot and opens nothing', async () => {
  const { R, calls } = loadRecovery({
    choice: 'discard',
    orphans: [
      { id: 'oA', rga: 'RGA-A', baseDisplayName: 'a.rga' },
      { id: 'oB', rga: 'RGA-B', baseDisplayName: 'b.rga' }
    ]
  });
  const result = await R.run();
  assert.equal(result.restoredCount, 0);
  assert.deepEqual(calls.discarded.sort(), ['oA', 'oB']);
  assert.equal(calls.opened.length, 0);
});

test('a corrupt orphan is skipped — the others still restore', async () => {
  const { R, calls } = loadRecovery({
    choice: 'restore',
    corrupt: 'RGA-BAD',
    orphans: [
      { id: 'oBad', rga: 'RGA-BAD', baseDisplayName: 'bad.rga' },
      { id: 'oGood', rga: 'RGA-GOOD', baseDisplayName: 'good.rga' }
    ]
  });
  const result = await R.run();
  assert.equal(result.restoredCount, 1);
  assert.equal(calls.opened.length, 1);
  assert.equal(calls.opened[0].docId, 'oGood');
});
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `node --test tests/unit/recovery.test.js`
Expected: FAIL — `Cannot find module '../../renderer/js/recovery.js'`.

- [ ] **Step 3: Write the module** `renderer/js/recovery.js`:

```js
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.Recovery — crash-recovery flow (Persistence Safety Contract §5 / P6).
// Brick 4 owns snapshot interpretation, orphan detection, the Restore/Discard
// UX, and recovered-tab creation. Runs once at boot, before session restore.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  // Restore one orphan as a dirty tab. Returns true on success, false if the
  // snapshot is corrupt (skipped — never fatal to the other orphans).
  function _restoreOne(orphan) {
    let doc;
    try {
      doc = Rga.Doc.deserialize(orphan.rga, orphan.baseHandle || null);
    } catch (_) {
      return false;
    }
    // Reuse the orphan's id as the recovered document's docId — the orphan
    // file becomes this document's own autosave snapshot (Contract §5:
    // kept-until-saved, no duplicate).
    doc.docId = orphan.id;
    Rga.TabManager.openDocument(doc);
    // Recovered work is unsaved — mark dirty so autosave re-arms and the
    // writer must consciously Save (Contract §5; P6 — no auto-restore-to-disk).
    Rga.Doc.markDirty(doc);
    return true;
  }

  function _discardOne(orphan) {
    if (window.rwanga && window.rwanga.autosave
        && typeof window.rwanga.autosave.discard === 'function') {
      window.rwanga.autosave.discard(orphan.id);
    }
  }

  // The boot-time recovery flow. Resolves { restoredCount }.
  async function run() {
    const orphans = (window.rwanga && window.rwanga.autosave
      && typeof window.rwanga.autosave.scanOrphans === 'function')
      ? await window.rwanga.autosave.scanOrphans()
      : [];
    if (!orphans || !orphans.length) return { restoredCount: 0 };

    const choice = (Rga.Modal && typeof Rga.Modal.showRecovery === 'function')
      ? await Rga.Modal.showRecovery(orphans)
      : 'discard';

    if (choice === 'restore') {
      let n = 0;
      for (let i = 0; i < orphans.length; i += 1) {
        if (_restoreOne(orphans[i])) n += 1;
      }
      return { restoredCount: n };
    }

    for (let i = 0; i < orphans.length; i += 1) _discardOne(orphans[i]);
    return { restoredCount: 0 };
  }

  Rga.Recovery = { run, _restoreOne, _discardOne };
})();
```

- [ ] **Step 4: Run the test to verify it passes.**

Run: `node --test tests/unit/recovery.test.js`
Expected: PASS — `# pass 5`, `# fail 0`.

- [ ] **Step 5: Register the script in `index.html`.** From:

```html
    <script src="js/autosave.js"></script>
```

To:

```html
    <script src="js/autosave.js"></script>
    <script src="js/recovery.js"></script>
```

- [ ] **Step 6: Run the full unit suite.**

Run: `npm run test:unit`
Expected: PASS — all green, `# fail 0`.

- [ ] **Step 7: Stage candidate paths for inspection (no commit).**

```bash
git add renderer/js/recovery.js tests/unit/recovery.test.js
git status --short
```

`renderer/index.html` is edited (one `<script>` line) but **NOT staged** — it carries unrelated prior-campaign work. Report it as a Brick-4-owned line.

**Touched by this task:** `renderer/js/recovery.js`, `tests/unit/recovery.test.js`, `renderer/index.html` (unstaged)

---

## Task 4 — Wiring: graceful-quit snapshot discard + session/recovery merge

**Files:** modify `renderer/js/close-guard.js`; modify `tests/unit/close-guard.test.js`; modify `renderer/js/tab-manager.js`; modify `tests/unit/tab-manager.test.js`; modify `renderer/index.html` (boot).

- [ ] **Step 1: Add the failing close-guard test.** Append to `tests/unit/close-guard.test.js`:

```js
test('confirmClose on discard also discards the recovery snapshot', async () => {
  const CG = loadCloseGuard({ Modal: { showUnsaved: async () => 'discard' } });
  const discarded = [];
  global.window.rwanga = { autosave: { discard: (id) => discarded.push(id) } };
  const verdict = await CG.confirmClose(
    { id: 't1', doc: { docId: 'doc-9', displayName: 'a.rga', dirty: true } });
  assert.equal(verdict, 'proceed');
  assert.deepEqual(discarded, ['doc-9']);
  delete global.window.rwanga;
});
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `node --test tests/unit/close-guard.test.js`
Expected: the existing tests PASS; the new test FAILS — `confirmClose` does not discard the snapshot on `discard` yet (`discarded` stays empty).

- [ ] **Step 3: Discard the snapshot on the `discard` branch of `close-guard.js`.** In `renderer/js/close-guard.js`, replace:

```js
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
```

with:

```js
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
    } else if (choice === 'discard') {
      // Persistence Safety Contract §5 — abandoning the changes also discards
      // the recovery snapshot, so a graceful quit leaves no orphan behind.
      if (window.rwanga && window.rwanga.autosave
          && typeof window.rwanga.autosave.discard === 'function') {
        window.rwanga.autosave.discard(tab.doc.docId);
      }
    }
    return 'proceed';   // 'discard' (snapshot cleared) or a successful 'save'
```

- [ ] **Step 4: Run the test to verify it passes.**

Run: `node --test tests/unit/close-guard.test.js`
Expected: PASS — all tests green, including the new discard-snapshot test.

- [ ] **Step 5: Add the failing `bootSession` merge/dedup test.** Append to `tests/unit/tab-manager.test.js`:

```js
test('bootSession merges with recovery — skips a file already open, opens the rest, no duplicates', async () => {
  bootDom();
  const TM = loadTabManager();
  TM.init();
  global.localStorage = (function() {
    const store = new Map();
    return {
      getItem: function(k) { return store.has(k) ? store.get(k) : null; },
      setItem: function(k, v) { store.set(k, String(v)); },
      removeItem: function(k) { store.delete(k); }
    };
  })();
  // A recovered (dirty) tab for a.rga is already open (crash recovery ran first).
  TM.openDocument({ docId: 'rec-a', displayName: 'a.rga', handle: '/x/a.rga', dirty: true });
  // The previous session referenced a.rga (collision) AND b.rga (clean, new).
  global.localStorage.setItem('rga-session-tabs', JSON.stringify({
    tabs: [{ handle: '/x/a.rga', displayName: 'a.rga' },
           { handle: '/x/b.rga', displayName: 'b.rga' }],
    activeIndex: 0
  }));
  const reads = [];
  global.window.rwanga = { files: { read: async (h) => { reads.push(h); return { content: 'STUB' }; } } };
  global.window.Rga.FileManager = {
    openFromContent: (handle) => TM.openDocument(
      { docId: 'sess-' + handle, displayName: handle, handle: handle, dirty: false })
  };
  await TM.bootSession();
  const handles = TM.tabs().map(function(t) { return t.doc.handle; }).sort();
  assert.deepEqual(handles, ['/x/a.rga', '/x/b.rga'],
    'a.rga is not duplicated (recovered tab wins); b.rga (clean) still appears');
  assert.deepEqual(reads, ['/x/b.rga'], 'only the not-already-open file was read');
  delete global.localStorage;
  delete global.window.rwanga;
  delete global.window.Rga.FileManager;
});
```

- [ ] **Step 6: Run the test to verify it fails.**

Run: `node --test tests/unit/tab-manager.test.js`
Expected: the existing tests PASS; the new test FAILS — `bootSession` re-reads and re-opens `/x/a.rga`, producing a duplicate tab (`handles` has `/x/a.rga` twice; `reads` includes `/x/a.rga`).

- [ ] **Step 7: Add the dedup guard to `bootSession` in `tab-manager.js`.** In `renderer/js/tab-manager.js`, inside `bootSession`, replace:

```js
    const reads = saved.tabs.map(function(t) {
      return window.rwanga.files.read(t.handle).then(function(result) {
```

with:

```js
    const reads = saved.tabs.map(function(t) {
      // Brick 4 — session restore MERGES with crash recovery. If this file is
      // already open as a recovered (dirty) tab, the recovered version wins —
      // skip the session reopen so there is no duplicate tab.
      if (tabs.some(function(x) { return x.doc && x.doc.handle === t.handle; })) {
        return Promise.resolve();
      }
      return window.rwanga.files.read(t.handle).then(function(result) {
```

- [ ] **Step 8: Run the test to verify it passes.**

Run: `node --test tests/unit/tab-manager.test.js`
Expected: PASS — all tests green, including the new merge/dedup test.

- [ ] **Step 9: Wire boot recovery in `index.html` — recovery + session MERGE.** In `renderer/index.html`, in the `boot()` function, replace:

```js
    const sessionPromise = (Rga.TabManager && Rga.TabManager.bootSession)
      ? Rga.TabManager.bootSession()
      : Promise.resolve(false);
    sessionPromise.then(function(restored) {
      if (!restored && Rga.FileManager && Rga.FileManager.newScript) {
        Rga.FileManager.newScript();
      }
    });
```

with:

```js
    // Persistence Safety Contract §5 — crash recovery runs FIRST (opens the
    // orphan/dirty tabs), then session restore ALWAYS runs and MERGES with it
    // (bootSession dedupes any file already open as a recovered tab). Fall back
    // to a fresh document only if nothing at all is open.
    const recoveryPromise = (Rga.Recovery && Rga.Recovery.run)
      ? Rga.Recovery.run()
      : Promise.resolve({ restoredCount: 0 });
    recoveryPromise.then(function() {
      const sessionPromise = (Rga.TabManager && Rga.TabManager.bootSession)
        ? Rga.TabManager.bootSession()
        : Promise.resolve(false);
      return sessionPromise.then(function() {
        const open = (Rga.TabManager && Rga.TabManager.tabs)
          ? Rga.TabManager.tabs().length : 0;
        if (open === 0 && Rga.FileManager && Rga.FileManager.newScript) {
          Rga.FileManager.newScript();
        }
      });
    });
```

- [ ] **Step 10: Run the full unit suite.**

Run: `npm run test:unit`
Expected: PASS — all green, `# fail 0`.

- [ ] **Step 11: Stage candidate paths for inspection (no commit).**

```bash
git add renderer/js/close-guard.js tests/unit/close-guard.test.js renderer/js/tab-manager.js tests/unit/tab-manager.test.js
git status --short
```

`renderer/index.html` is edited (the boot wiring) but **NOT staged** — same accepted handling.

**Touched by this task:** `renderer/js/close-guard.js`, `tests/unit/close-guard.test.js`, `renderer/js/tab-manager.js`, `tests/unit/tab-manager.test.js`, `renderer/index.html` (unstaged)

---

## Task 5 — Crash-recovery E2E (this is QG-11)

**Files:** create `tests/integration/recovery.spec.js`.

- [ ] **Step 1: Write the integration spec** `tests/integration/recovery.spec.js`:

```js
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Persistence Safety — Brick 4 (crash recovery). The automated kill-and-recover
// test (QG-11): type → snapshot → crash → relaunch → recovery prompt →
// Restore reopens the unsaved work; Discard clears it.
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
function aSnapshotContains(udd, text) {
  for (const f of listSnapshots(udd)) {
    try {
      const e = JSON.parse(fs.readFileSync(path.join(snapshotDir(udd), f), 'utf8'));
      if (String(e.rga || '').toLowerCase().includes(text)) return true;
    } catch (_) { /* ignore */ }
  }
  return false;
}

let app, userDataDir;

test.beforeEach(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-e2e-'));
});

test.afterEach(async () => {
  if (app) { try { await app.close(); } catch (_) {} app = null; }
  if (userDataDir) {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
    userDataDir = null;
  }
});

async function launch() {
  const a = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const p = await a.firstWindow();
  await p.waitForLoadState('domcontentloaded');
  await p.waitForFunction(() => !!(window.Rga && window.Rga.FileManager));
  return { a, p };
}

// Hard-kill the app (a crash) and wait until the OS process is fully gone.
async function killApp(a) {
  const proc = a.process();
  const exited = new Promise((resolve) => {
    if (proc.exitCode !== null) { resolve(); return; }
    proc.once('exit', () => resolve());
  });
  proc.kill('SIGKILL');
  await exited;
}

// Simulate crash + reopen: hard-kill the app, carry its autosave snapshots into
// a FRESH userData profile, and relaunch. A fresh profile sidesteps the
// single-instance lock that a millisecond-fast same-profile relaunch races; the
// recovery logic is identical — Rga.Recovery scans userData/autosave/ either way.
async function crashAndRelaunch() {
  await killApp(app);
  const fresh = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-e2e-'));
  const src = snapshotDir(userDataDir);
  if (fs.existsSync(src)) {
    fs.cpSync(src, snapshotDir(fresh), { recursive: true });
  }
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  userDataDir = fresh;
  return launch();
}

// Type into a launched window and wait until the full text is in a snapshot.
async function typeAndSnapshot(p, marker) {
  await p.waitForFunction(() => !!(window.Rga.TabManager
    && window.Rga.TabManager._editorView && window.Rga.TabManager._editorView()));
  await p.locator('#editor').click();
  await p.keyboard.type(marker);
  await expect.poll(() => aSnapshotContains(userDataDir, marker)).toBe(true);
}

test('crash recovery — Restore reopens the unsaved work', async () => {
  let win = await launch();
  app = win.a;
  await typeAndSnapshot(win.p, 'recovermarker');

  win = await crashAndRelaunch();
  app = win.a;

  // The recovery prompt appears.
  await expect(win.p.locator('#recovery-modal')).toBeVisible();
  await win.p.locator('#recovery-modal [data-choice="restore"]').click();

  // The recovered document is open, dirty, and carries the typed content.
  await win.p.waitForFunction(() => {
    const d = window.Rga.FileManager.getActive();
    return !!(d && d.dirty === true);
  });
  await expect(win.p.locator('#editor')).toContainText(/recovermarker/i);
});

test('crash recovery — Discard clears the snapshot and opens a clean document', async () => {
  let win = await launch();
  app = win.a;
  await typeAndSnapshot(win.p, 'discardmarker');

  win = await crashAndRelaunch();
  app = win.a;

  await expect(win.p.locator('#recovery-modal')).toBeVisible();
  await win.p.locator('#recovery-modal [data-choice="discard"]').click();

  // The snapshot is gone and the editor holds a fresh, clean document.
  await expect.poll(() => listSnapshots(userDataDir).length).toBe(0);
  const dirty = await win.p.evaluate(() => {
    const d = window.Rga.FileManager.getActive();
    return d ? d.dirty : null;
  });
  expect(dirty).toBe(false);
});
```

- [ ] **Step 2: Build the renderer bundle (integration prerequisite).**

Run: `npm run build:renderer`
Expected: the build completes without error.

- [ ] **Step 3: Run the integration spec.**

Run: `npx playwright test --config=tests/integration/playwright.config.js recovery.spec.js`
Expected: PASS — `2 passed`.

- [ ] **Step 4: Run the full integration suite for no regressions.**

Run: `npm run test:e2e`
Expected: PASS — `17 passed` (the 15 existing specs + the 2 new ones).

- [ ] **Step 5: Run the full unit suite.**

Run: `npm run test:unit`
Expected: PASS — all green, `# fail 0`.

- [ ] **Step 6: Stage candidate paths for inspection (no commit).**

```bash
git add tests/integration/recovery.spec.js
git status --short
```

**Touched by this task:** `tests/integration/recovery.spec.js`

---

## ⛔ STOP — SP-9

**Contract §7 SP-9.** Brick 4 (crash recovery) is complete.

- [ ] **Update `RWANGA_IDE_LAUNCH_CHECKLIST.md` (Rule 6):** append an Implementation-log entry; if the evidence holds, flip **PF-08 `FALSE → TRUE`** (crash recovery works) and **QG-11 `FALSE → TRUE`** (crash-recovery tests — `recovery.spec.js` is the automated kill-and-recover test). Cite evidence: `recovery.test.js`, `modal-recovery.test.js`, the `close-guard` discard test, `recovery.spec.js` 2/2, `npm run test:unit` + `npm run test:e2e` green. Update the §3 totals + the §0 verdict.
- [ ] **Report** the PF-08 + QG-11 evidence. With Brick 4 complete, **the Persistence Safety campaign is complete** — note this and stop for review.

---

## Self-review

- **Spec coverage (Contract §5):** snapshot location / orphan detection — `autosave.scanOrphans` (Task 1); recovery and session restore **merge**, deduplicated by file path — `Rga.Recovery.run`, `bootSession`'s dedup guard, and the boot wiring (Tasks 3, 4); modal Restore/Discard prompt — `Rga.Modal.showRecovery` (Task 2); restored tabs open DIRTY, orphan id reused so the snapshot is kept-until-saved — `_restoreOne` (Task 3); graceful-quit clears snapshots — the `close-guard.js` discard branch (Task 4); cleanup — manual save (`clearDirty` → `autosave.discard`, Brick 3) + Discard (Task 4) + recovery Discard (Task 3). P6 honoured — only `Rga.Recovery` transforms snapshots into documents; the modal always gates restore; recovery owns orphan tabs, session restore owns clean tabs, no concern shared.
- **Placeholder scan:** none — every step carries exact code and exact commands. (Task 2 Step 1 is a genuine verification of existing CSS class names, not a placeholder.)
- **Type consistency:** an orphan is `{ id, savedAt, baseHandle, baseDisplayName, rga }` in `scanOrphans`, `showRecovery`, `recovery.js`, and the tests; `Rga.Recovery.run()` resolves `{ restoredCount }` in the module, the boot wiring, and the tests; `showRecovery` resolves `'restore' | 'discard'`.
- **Brick-1/2 lessons applied:** `electron/bridge/autosave.js` is not unit-loaded — Task 1 `node --check`s it; Task 2 Step 1 verifies the modal CSS classes before relying on them.
- **Scope:** Brick 4 only. With it, the Persistence Safety campaign (Bricks 1–4) is complete.
