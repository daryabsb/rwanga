# Atomic Save (Brick 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every `.rga` write atomic (temp-file + fsync + rename) and retain one rolling previous-version `.bak`, so a crash or disk error mid-save can never corrupt or lose the writer's file.

**Architecture:** A single main-process primitive, `electron/lib/atomic-write.js`, owns atomic writing. `electron/bridge/files.js` (`files.save`, `files.pickSaveAs`) and `electron/lib/json-file.js` (`writeJsonAtomic`) all delegate to it. A failed `.bak` copy is non-fatal — the save still succeeds and the document becomes CLEAN; the failure surfaces only as a non-blocking renderer toast plus a main-process diagnostics-log line.

**Tech Stack:** Electron main process, Node `fs/promises`, `node:test` unit tests, Playwright Electron integration tests.

**Source of truth:** `docs/superpowers/specs/2026-05-22-persistence-safety-contract.md` §3 (atomic save) + Amendment 1. This plan implements **Brick 1 only**; bricks 2–4 are planned separately after each stop-point report.

**Branch / commits (Amendment 1):** The working tree currently carries unrelated uncommitted work from prior campaigns. **Brick 1 does not commit.** Each task ends by staging its candidate paths for inspection only (`git add` + `git status`); a commit happens only if and when the user explicitly approves a commit strategy. A pre-implementation `git status` (see below) records the starting state. If an isolated worktree is used, set it up via `superpowers:using-git-worktrees` at execution time.

**Closes:** checklist item **PF-04** (evidence reported at SP-3).

---

## File structure

| File | Create / Modify | Responsibility |
|---|---|---|
| `rwanga-editor/electron/lib/atomic-write.js` | **Create** | The single atomic-write primitive — `writeFileAtomic(targetPath, content, options)`. |
| `rwanga-editor/tests/unit/electron/atomic-write.test.js` | **Create** | Unit tests for the primitive (real filesystem, temp dirs). |
| `rwanga-editor/electron/bridge/files.js` | **Modify** | `files.save` / `files.pickSaveAs` delegate to the primitive; forward a `backupFailed` flag. |
| `rwanga-editor/electron/lib/json-file.js` | **Modify** | `writeJsonAtomic` delegates to the primitive (single ownership of atomic writing). |
| `rwanga-editor/renderer/js/file-manager.js` | **Modify** | Surface a backup-failure outcome as a non-blocking toast (Amendment 1). |
| `rwanga-editor/tests/integration/atomic-save.spec.js` | **Create** | End-to-end save-to-disk proof through the real app. |

All paths below are relative to `rwanga-editor/`. Run all commands from `rwanga-editor/`.

---

## Pre-implementation check (Amendment 1)

Brick 1 **does not commit.** Before changing any file, record the starting state so prior uncommitted work is never confused with Brick 1's changes.

- [ ] **Record the working-tree state.** Run `git status` (full, not `--short`) and record the output. Note the pre-existing uncommitted entries so they can be distinguished from this brick's files. Do **not** stage, commit, or revert any of them.

After each task, the final step stages **only that task's candidate paths** for inspection and lists them. No commit is made at any point during Brick 1 — a commit happens only if and when the user explicitly approves a commit strategy.

---

## Task 1: The atomic-write primitive (no backup yet)

**Files:**
- Create: `electron/lib/atomic-write.js`
- Test: `tests/unit/electron/atomic-write.test.js`

This task builds atomic write **without** the `.bak` rolling backup — SP-1 verifies the bare temp→rename behaviour before backup complexity is added (Contract §7 SP-1).

- [ ] **Step 1: Write the failing test file**

Create `tests/unit/electron/atomic-write.test.js`:

```js
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const { writeFileAtomic } = require('../../../electron/lib/atomic-write.js');

async function tmpDir() {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'rwanga-atomic-'));
}

test('writeFileAtomic creates a new file with the exact content', async () => {
  const dir = await tmpDir();
  const f = path.join(dir, 'doc.rga');
  await writeFileAtomic(f, 'hello');
  assert.equal(await fs.readFile(f, 'utf8'), 'hello');
});

test('writeFileAtomic overwrites an existing file', async () => {
  const dir = await tmpDir();
  const f = path.join(dir, 'doc.rga');
  await fs.writeFile(f, 'OLD', 'utf8');
  await writeFileAtomic(f, 'NEW');
  assert.equal(await fs.readFile(f, 'utf8'), 'NEW');
});

test('writeFileAtomic leaves no .tmp file behind on success', async () => {
  const dir = await tmpDir();
  const f = path.join(dir, 'doc.rga');
  await writeFileAtomic(f, 'data');
  const entries = await fs.readdir(dir);
  assert.deepEqual(entries.filter((e) => e.endsWith('.tmp')), []);
});

test('writeFileAtomic overwrites a stale leftover .tmp file', async () => {
  const dir = await tmpDir();
  const f = path.join(dir, 'doc.rga');
  await fs.writeFile(f + '.tmp', 'STALE GARBAGE', 'utf8');
  await writeFileAtomic(f, 'clean');
  assert.equal(await fs.readFile(f, 'utf8'), 'clean');
});

test('writeFileAtomic creates missing parent directories', async () => {
  const dir = await tmpDir();
  const f = path.join(dir, 'nested', 'deep', 'doc.rga');
  await writeFileAtomic(f, 'data');
  assert.equal(await fs.readFile(f, 'utf8'), 'data');
});

test('writeFileAtomic throws on a rename failure and leaves no .tmp', async () => {
  const dir = await tmpDir();
  // Target path is an existing directory — rename(file, dir) fails.
  const f = path.join(dir, 'occupied');
  await fs.mkdir(f);
  await assert.rejects(() => writeFileAtomic(f, 'data'));
  const entries = await fs.readdir(dir);
  assert.deepEqual(entries.filter((e) => e.endsWith('.tmp')), []);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/unit/electron/atomic-write.test.js`
Expected: FAIL — every test errors with `Cannot find module '../../../electron/lib/atomic-write.js'`.

- [ ] **Step 3: Write the primitive**

Create `electron/lib/atomic-write.js`:

```js
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

/**
 * Atomically write `content` to `targetPath`: a complete temp file is
 * written and fsync'd, then renamed over the target. The target is never
 * opened for truncation, so a crash mid-write cannot corrupt it
 * (Persistence Safety Contract §3 — PF-04).
 *
 * @param {string} targetPath  full destination path
 * @param {string} content     file content
 * @returns {Promise<{backupError: Error|null}>}
 */
async function writeFileAtomic(targetPath, content) {
  const tmpPath = targetPath + '.tmp';

  // Ensure the destination directory exists.
  await fs.mkdir(path.dirname(targetPath), { recursive: true });

  // 1. Write the full content to the temp file and flush it to disk.
  const fh = await fs.open(tmpPath, 'w');
  try {
    await fh.writeFile(content, 'utf8');
    await fh.sync();
  } finally {
    await fh.close();
  }

  // 2. Atomically replace the target.
  try {
    await fs.rename(tmpPath, targetPath);
  } catch (err) {
    try { await fs.unlink(tmpPath); } catch (_) { /* temp already gone */ }
    throw err;
  }

  return { backupError: null };
}

module.exports = { writeFileAtomic };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/unit/electron/atomic-write.test.js`
Expected: PASS — `# pass 6`, `# fail 0`.

- [ ] **Step 5: Stage candidate paths for inspection (no commit)**

Stage candidate paths only for inspection; do not commit unless the user explicitly approves the commit strategy.

```bash
git add electron/lib/atomic-write.js tests/unit/electron/atomic-write.test.js
git status --short
```

**Touched by this task:** `electron/lib/atomic-write.js`, `tests/unit/electron/atomic-write.test.js`

---

## Task 2: Wire the atomic-write consumers to the primitive

**Files:**
- Modify: `electron/bridge/files.js`
- Modify: `electron/lib/json-file.js`

Still **no backup** — `writeFileAtomic` is called with two arguments only.

- [ ] **Step 1: Point `files.js` at the primitive**

In `electron/bridge/files.js`, add the require near the other requires at the top:

```js
const { writeFileAtomic } = require('../lib/atomic-write');
```

Replace the body of the `files.save` handler. From:

```js
  ipcMain.handle('files.save', async (_event, handle, content) => {
    await fs.writeFile(handle, content, 'utf8');
    const stat = await fs.stat(handle);
    return { handle, savedAt: stat.mtimeMs };
  });
```

To:

```js
  ipcMain.handle('files.save', async (_event, handle, content) => {
    await writeFileAtomic(handle, content);
    const stat = await fs.stat(handle);
    return { handle, savedAt: stat.mtimeMs };
  });
```

In the `files.pickSaveAs` handler, replace the write line. From:

```js
    if (!target.toLowerCase().endsWith('.rga')) target = target + '.rga';
    await fs.writeFile(target, content, 'utf8');
    const stat = await fs.stat(target);
```

To:

```js
    if (!target.toLowerCase().endsWith('.rga')) target = target + '.rga';
    await writeFileAtomic(target, content);
    const stat = await fs.stat(target);
```

- [ ] **Step 2: Point `json-file.js` at the primitive**

Replace the whole of `electron/lib/json-file.js` with:

```js
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const fs = require('node:fs/promises');
const { writeFileAtomic } = require('./atomic-write');

function timestampSuffix() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) + 'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) + 'Z'
  );
}

async function writeJsonAtomic(filePath, value) {
  await writeFileAtomic(filePath, JSON.stringify(value, null, 2));
}

async function readJsonOrSeed(filePath, seed) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    try {
      return JSON.parse(raw);
    } catch (parseErr) {
      const backup = filePath + '.bad-' + timestampSuffix();
      try {
        await fs.rename(filePath, backup);
      } catch (renameErr) {
        // proceed without backup if rename fails
      }
      await writeJsonAtomic(filePath, seed);
      return seed;
    }
  } catch (readErr) {
    if (readErr.code === 'ENOENT') {
      await writeJsonAtomic(filePath, seed);
      return seed;
    }
    throw readErr;
  }
}

module.exports = { readJsonOrSeed, writeJsonAtomic };
```

(Atomic writing now lives only in `atomic-write.js` — Contract §2. `ensureDir` and the `path` import are removed because `writeFileAtomic` creates the directory.)

- [ ] **Step 3: Verify `json-file.js`'s existing tests still pass**

Run: `node --test tests/unit/json-file.test.js`
Expected: PASS — `# pass 5`, `# fail 0` (formatted JSON, no `.tmp` left, seed, corrupt-backup all still hold).

- [ ] **Step 4: Run the full unit suite**

Run: `npm run test:unit`
Expected: PASS — all tests green, `# fail 0` (6 new tests from Task 1 included).

- [ ] **Step 5: Stage candidate paths for inspection (no commit)**

Stage candidate paths only for inspection; do not commit unless the user explicitly approves the commit strategy.

```bash
git add electron/bridge/files.js electron/lib/json-file.js
git status --short
```

**Touched by this task:** `electron/bridge/files.js`, `electron/lib/json-file.js`

---

## ⛔ STOP — SP-1

**Contract §7 SP-1.** Atomic write (temp→fsync→rename) is in place; `.bak` is not yet added.

**Verify on Windows and report. The locked-target test MUST use a real OS lock — _not_ "open the file in Rwanga": Rwanga is not confirmed to hold an exclusive lock, so it is not a valid lock source (Amendment 2).**

1. **Existing-target overwrite.** Run `npm run test:unit` on Windows; the test `writeFileAtomic overwrites an existing file` must pass.

2. **Locked-target behaviour.** Establish a *real* exclusive OS lock on the target, then run an atomic write against the locked path. Use, in order of preference:

   - **Method B (preferred — built-in, deterministic).** In one PowerShell window, hold an exclusive (`FileShare.None`) handle on the target file:
     ```powershell
     $h = [System.IO.File]::Open('C:\full\path\to\target.rga', 'Open', 'ReadWrite', 'None')
     ```
     With that handle held, from a second shell run a one-line Node call to `writeFileAtomic('C:\\full\\path\\to\\target.rga', 'locked-write-probe', { backup: false })` against the same path. Observe and record the outcome. Release the lock afterwards with `$h.Close()`.
   - **Method A (alternative).** A small throwaway Node helper that opens the target and holds it. Note: Node opens files with `FILE_SHARE_*` flags by default, so a Node-held handle may **not** produce a true exclusive lock. If it does not demonstrably block the write, say so and use Method B.
   - **Method C (fallback — only if A and B genuinely cannot be performed in the environment).** Report honestly that a true Windows lock could not be created, and treat the directory-occupied rename-failure unit test (`writeFileAtomic throws on a rename failure and leaves no .tmp`, Task 1) as the verified evidence for the failure path.

**The SP-1 report MUST state:**
- the **existing-target overwrite** result (pass / fail);
- the **locked-target method actually used** (A, B, or C);
- the **exact error code** observed, if any (e.g. `EPERM`, `EBUSY`, `EACCES`) — or "none";
- whether the **`.tmp` file was cleaned up** after the failure;
- whether the **target file stayed intact** (uncorrupted, previous content) after the failed write.

Record findings in `RWANGA_IDE_LAUNCH_CHECKLIST.md` (Rule 6) and **stop for review**. Do not start Task 3 until SP-1 is signed off.

---

## Task 3: Add the rolling `.bak` backup to the primitive

**Files:**
- Modify: `electron/lib/atomic-write.js`
- Test: `tests/unit/electron/atomic-write.test.js`

- [ ] **Step 1: Add the failing backup tests**

Append these three tests to `tests/unit/electron/atomic-write.test.js`:

```js
test('writeFileAtomic with backup rolls the previous version into .bak', async () => {
  const dir = await tmpDir();
  const f = path.join(dir, 'doc.rga');
  await fs.writeFile(f, 'VERSION ONE', 'utf8');
  const result = await writeFileAtomic(f, 'VERSION TWO', { backup: true });
  assert.equal(await fs.readFile(f, 'utf8'), 'VERSION TWO');
  assert.equal(await fs.readFile(f + '.bak', 'utf8'), 'VERSION ONE');
  assert.equal(result.backupError, null);
});

test('writeFileAtomic with backup makes no .bak for a brand-new file', async () => {
  const dir = await tmpDir();
  const f = path.join(dir, 'doc.rga');
  const result = await writeFileAtomic(f, 'first', { backup: true });
  assert.equal(await fs.readFile(f, 'utf8'), 'first');
  await assert.rejects(() => fs.access(f + '.bak'));
  assert.equal(result.backupError, null);
});

test('writeFileAtomic backup failure is non-fatal — the save still succeeds', async () => {
  const dir = await tmpDir();
  const f = path.join(dir, 'doc.rga');
  await fs.writeFile(f, 'OLD', 'utf8');
  // Occupy the .bak path with a directory so the backup copy must fail.
  await fs.mkdir(f + '.bak');
  const result = await writeFileAtomic(f, 'NEW', { backup: true });
  assert.equal(await fs.readFile(f, 'utf8'), 'NEW');   // save still succeeded
  assert.ok(result.backupError, 'backupError should be set');
});
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `node --test tests/unit/electron/atomic-write.test.js`
Expected: the 6 Task-1 tests PASS; the 3 new tests FAIL — the `backup` option is ignored, so `.bak` is never created (`ENOENT` reading `f + '.bak'`).

- [ ] **Step 3: Add the backup branch to the primitive**

Replace the whole of `electron/lib/atomic-write.js` with:

```js
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

/**
 * Atomically write `content` to `targetPath`: a complete temp file is
 * written and fsync'd, then renamed over the target. The target is never
 * opened for truncation, so a crash mid-write cannot corrupt it
 * (Persistence Safety Contract §3 — PF-04).
 *
 * @param {string} targetPath  full destination path
 * @param {string} content     file content
 * @param {{backup?: boolean}} [options]  backup:true rolls the previous
 *        version of an existing target into `<targetPath>.bak` before the
 *        rename. A failed backup copy is non-fatal (Contract §3, Amendment 1):
 *        the save still proceeds and the error is returned in `backupError`.
 * @returns {Promise<{backupError: Error|null}>}
 */
async function writeFileAtomic(targetPath, content, options) {
  options = options || {};
  const tmpPath = targetPath + '.tmp';

  // Ensure the destination directory exists.
  await fs.mkdir(path.dirname(targetPath), { recursive: true });

  // 1. Write the full content to the temp file and flush it to disk.
  const fh = await fs.open(tmpPath, 'w');
  try {
    await fh.writeFile(content, 'utf8');
    await fh.sync();
  } finally {
    await fh.close();
  }

  // 2. Roll the previous version into <target>.bak. Non-fatal (Amendment 1):
  //    a missing target is not an error; any other failure is recorded and
  //    the save still proceeds.
  let backupError = null;
  if (options.backup) {
    try {
      await fs.copyFile(targetPath, targetPath + '.bak');
    } catch (err) {
      if (!err || err.code !== 'ENOENT') backupError = err;
    }
  }

  // 3. Atomically replace the target.
  try {
    await fs.rename(tmpPath, targetPath);
  } catch (err) {
    try { await fs.unlink(tmpPath); } catch (_) { /* temp already gone */ }
    throw err;
  }

  return { backupError };
}

module.exports = { writeFileAtomic };
```

- [ ] **Step 4: Run the tests to verify all pass**

Run: `node --test tests/unit/electron/atomic-write.test.js`
Expected: PASS — `# pass 9`, `# fail 0`.

- [ ] **Step 5: Stage candidate paths for inspection (no commit)**

Stage candidate paths only for inspection; do not commit unless the user explicitly approves the commit strategy.

```bash
git add electron/lib/atomic-write.js tests/unit/electron/atomic-write.test.js
git status --short
```

**Touched by this task:** `electron/lib/atomic-write.js`, `tests/unit/electron/atomic-write.test.js`

---

## Task 4: Request backup in the file bridge and report the outcome

**Files:**
- Modify: `electron/bridge/files.js`

- [ ] **Step 1: Request backup and forward a `backupFailed` flag**

In `electron/bridge/files.js`, replace the `files.save` handler body. From:

```js
  ipcMain.handle('files.save', async (_event, handle, content) => {
    await writeFileAtomic(handle, content);
    const stat = await fs.stat(handle);
    return { handle, savedAt: stat.mtimeMs };
  });
```

To:

```js
  ipcMain.handle('files.save', async (_event, handle, content) => {
    const writeResult = await writeFileAtomic(handle, content, { backup: true });
    if (writeResult.backupError) {
      // Diagnostics-log entry (Contract §3, Amendment 1) — non-fatal.
      console.error('[files.save] previous-version backup failed for', handle, '-', writeResult.backupError.message);
    }
    const stat = await fs.stat(handle);
    return { handle, savedAt: stat.mtimeMs, backupFailed: !!writeResult.backupError };
  });
```

In the `files.pickSaveAs` handler, replace the write + return. From:

```js
    if (!target.toLowerCase().endsWith('.rga')) target = target + '.rga';
    await writeFileAtomic(target, content);
    const stat = await fs.stat(target);
    return { handle: target, displayName: path.basename(target), savedAt: stat.mtimeMs };
```

To:

```js
    if (!target.toLowerCase().endsWith('.rga')) target = target + '.rga';
    const writeResult = await writeFileAtomic(target, content, { backup: true });
    if (writeResult.backupError) {
      console.error('[files.pickSaveAs] previous-version backup failed for', target, '-', writeResult.backupError.message);
    }
    const stat = await fs.stat(target);
    return { handle: target, displayName: path.basename(target), savedAt: stat.mtimeMs, backupFailed: !!writeResult.backupError };
```

- [ ] **Step 2: Run the full unit suite**

Run: `npm run test:unit`
Expected: PASS — all green, `# fail 0` (no test depends on the old return shape; the new `backupFailed` field is additive).

- [ ] **Step 3: Stage candidate paths for inspection (no commit)**

Stage candidate paths only for inspection; do not commit unless the user explicitly approves the commit strategy.

```bash
git add electron/bridge/files.js
git status --short
```

**Touched by this task:** `electron/bridge/files.js`

---

## Task 5: Surface the backup-failure outcome in the renderer

**Files:**
- Modify: `renderer/js/file-manager.js`

Per Contract §3 / Amendment 1: a failed `.bak` is non-fatal — the save succeeds and the document becomes CLEAN normally (the existing `Doc.clearDirty` already does this); the only added behaviour is a **non-blocking** toast. No warning, no modal.

- [ ] **Step 1: Add the notification helper**

In `renderer/js/file-manager.js`, add this function immediately after the `notifyTitle` function (before `newScript`):

```js
  // Persistence Safety Contract §3 / Amendment 1 — a failed previous-version
  // backup is non-fatal: the save succeeded and the document is CLEAN. Surface
  // it only as a non-blocking status notification (no warning, no modal).
  function notifyBackupFailed() {
    if (Rga.Toast && typeof Rga.Toast.show === 'function') {
      Rga.Toast.show('Saved. (Previous-version backup could not be written.)', 'info', 4000);
    }
  }
```

- [ ] **Step 2: Call it from `save()`**

In the `save()` function, in the success branch, add the `notifyBackupFailed` call. From:

```js
      const res = await window.rwanga.files.save(activeDoc.handle, content);
      Doc.clearDirty(activeDoc, res.savedAt);
      notifyTitle();
      if (Rga.TabManager && Rga.TabManager.renderTabBar) Rga.TabManager.renderTabBar();
      console.info('[Rga.FileManager.save] OK', res);
      return res;
```

To:

```js
      const res = await window.rwanga.files.save(activeDoc.handle, content);
      Doc.clearDirty(activeDoc, res.savedAt);
      notifyTitle();
      if (Rga.TabManager && Rga.TabManager.renderTabBar) Rga.TabManager.renderTabBar();
      if (res && res.backupFailed) notifyBackupFailed();
      console.info('[Rga.FileManager.save] OK', res);
      return res;
```

- [ ] **Step 3: Call it from `saveAs()`**

In the `saveAs()` function, in the success branch, add the same call. From:

```js
      const res = await window.rwanga.files.pickSaveAs(suggestedName, content);
      if (!res) return null;
      Doc.rebindHandle(activeDoc, res.handle);
      Doc.clearDirty(activeDoc, res.savedAt);
      notifyTitle();
      if (Rga.TabManager && Rga.TabManager.renderTabBar) Rga.TabManager.renderTabBar();
      return res;
```

To:

```js
      const res = await window.rwanga.files.pickSaveAs(suggestedName, content);
      if (!res) return null;
      Doc.rebindHandle(activeDoc, res.handle);
      Doc.clearDirty(activeDoc, res.savedAt);
      notifyTitle();
      if (Rga.TabManager && Rga.TabManager.renderTabBar) Rga.TabManager.renderTabBar();
      if (res.backupFailed) notifyBackupFailed();
      return res;
```

- [ ] **Step 4: Run the full unit suite**

Run: `npm run test:unit`
Expected: PASS — all green, `# fail 0` (the change is additive; no renderer unit test covers `file-manager.js` save flow — the behaviour is proven by the E2E in Task 6 and at SP-2).

- [ ] **Step 5: Stage candidate paths for inspection (no commit)**

Stage candidate paths only for inspection; do not commit unless the user explicitly approves the commit strategy.

```bash
git add renderer/js/file-manager.js
git status --short
```

**Touched by this task:** `renderer/js/file-manager.js`

---

## ⛔ STOP — SP-2

**Contract §7 SP-2 (resolved by Amendment 1).** Verify the implementation matches the resolved backup-failure policy:
- a failed `.bak` copy ⇒ the save **succeeds**, the document becomes **CLEAN**;
- the failure shows as a **non-blocking status notification** (the toast) + a **diagnostics-log entry** (the main-process `console.error`);
- **no warning dialog, no modal.**

Task 6 below provides the automated end-to-end proof of this. Run it, confirm, record in `RWANGA_IDE_LAUNCH_CHECKLIST.md` (Rule 6), and **stop for review** before SP-3 sign-off.

---

## Task 6: End-to-end save-to-disk proof

**Files:**
- Create: `tests/integration/atomic-save.spec.js`

- [ ] **Step 1: Verify the toast DOM selector before relying on it (Amendment 3)**

The non-fatal-backup test (Step 2) asserts that a toast appears. Before writing that assertion, confirm the toast surface actually exists and what its selector is — do **not** hardcode a selector that may not exist.

Read `renderer/js/shell/toast.js` and confirm: `Rga.Toast.show(message, type, duration)` exists, and `show()` appends a `.toast` element into a `.toast-container` element (creating the container if absent). The selector is therefore `.toast-container .toast`.

At plan-authoring time this was confirmed against the current `toast.js` — `Rga.Toast` exists; `show()` sets `container.className = 'toast-container'` and `toast.className = 'toast'`. **The executor MUST re-confirm against the live file.**

If the toast surface is absent, or its class names differ: **STOP and report.** If the class names merely differ, update the Step 2 selector to the real one. If there is no toast surface at all, do **not** invent a toast system inside Brick 1 without the user's approval.

- [ ] **Step 2: Write the integration spec**

Create `tests/integration/atomic-save.spec.js`:

```js
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Persistence Safety — Brick 1 (atomic save). Proves the wired save path:
// a real Save As / Save writes the .rga atomically and rolls a previous-
// version .bak, and that a failed .bak backup is non-fatal (Amendment 1).
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..');

let app, page, userDataDir, workDir;

test.beforeEach(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-e2e-'));
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-save-'));
  app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(
    () => !!(window.Rga && window.Rga.FileManager
      && window.Rga.FileManager.getActive && window.Rga.FileManager.getActive())
  );
});

test.afterEach(async () => {
  if (app) { await app.close(); app = null; }
  for (const d of [userDataDir, workDir]) {
    if (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} }
  }
  userDataDir = workDir = null;
});

test('atomic Save As writes the .rga, and a later Save rolls a .bak', async () => {
  const target = path.join(workDir, 'script.rga');

  // Stub the native Save dialog (main process) to return our temp path.
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, target);

  // First write: type into the editor, then Save As.
  await page.locator('#editor').click();
  await page.keyboard.type('firstversionmarker');
  await page.evaluate(() => window.Rga.FileManager.saveAs());

  expect(fs.existsSync(target)).toBe(true);
  expect(fs.readFileSync(target, 'utf8').toLowerCase()).toContain('firstversionmarker');
  expect(fs.existsSync(target + '.bak')).toBe(false);   // nothing to back up yet

  // Second write: edit again, then Save (handle is bound — no dialog).
  await page.locator('#editor').click();
  await page.keyboard.type('secondversionmarker');
  await page.evaluate(() => window.Rga.FileManager.save());

  expect(fs.readFileSync(target, 'utf8').toLowerCase()).toContain('secondversionmarker');
  // The previous version is now in .bak.
  expect(fs.existsSync(target + '.bak')).toBe(true);
  const bak = fs.readFileSync(target + '.bak', 'utf8').toLowerCase();
  expect(bak).toContain('firstversionmarker');
  expect(bak).not.toContain('secondversionmarker');

  // No stale .tmp left behind.
  expect(fs.readdirSync(workDir).filter((e) => e.endsWith('.tmp'))).toEqual([]);
});

test('a failed .bak backup is non-fatal — the save still succeeds (Amendment 1)', async () => {
  const target = path.join(workDir, 'script.rga');

  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, target);

  // First save establishes the file.
  await page.locator('#editor').click();
  await page.keyboard.type('alphamarker');
  await page.evaluate(() => window.Rga.FileManager.saveAs());
  expect(fs.existsSync(target)).toBe(true);

  // Occupy the .bak path with a directory so the backup copy must fail.
  fs.mkdirSync(target + '.bak');

  // Edit and Save again — the backup will fail.
  await page.locator('#editor').click();
  await page.keyboard.type('betamarker');
  await page.evaluate(() => window.Rga.FileManager.save());

  // The save still succeeded: the file holds the new content ...
  expect(fs.readFileSync(target, 'utf8').toLowerCase()).toContain('betamarker');
  // ... the document is CLEAN ...
  const dirty = await page.evaluate(() => window.Rga.FileManager.getActive().dirty);
  expect(dirty).toBe(false);
  // ... and a non-blocking toast notification was shown (no modal).
  await expect(page.locator('.toast-container .toast')).toHaveCount(1);
});
```

- [ ] **Step 3: Build the renderer bundle (integration prerequisite)**

Run: `npm run build:renderer`
Expected: the build completes without error (`bundle.js` written).

- [ ] **Step 4: Run the integration spec to verify it passes**

Run: `npx playwright test --config=tests/integration/playwright.config.js atomic-save.spec.js`
Expected: PASS — `2 passed`.

- [ ] **Step 5: Run the full integration suite for no regressions**

Run: `npm run test:e2e`
Expected: PASS — `10 passed` (the 8 existing specs + the 2 new ones).

- [ ] **Step 6: Stage candidate paths for inspection (no commit)**

Stage candidate paths only for inspection; do not commit unless the user explicitly approves the commit strategy.

```bash
git add tests/integration/atomic-save.spec.js
git status --short
```

**Touched by this task:** `tests/integration/atomic-save.spec.js`

---

## ⛔ STOP — SP-3

**Contract §7 SP-3.** Brick 1 (atomic save) is complete.

- [ ] **Update `RWANGA_IDE_LAUNCH_CHECKLIST.md` (Rule 6):** append an Implementation-log entry; if the evidence holds, flip **PF-04 PARTIAL → TRUE** with cited evidence — `atomic-write.test.js` (9 tests), `atomic-save.spec.js` (2 E2E), `npm run test:unit` + `npm run test:e2e` green. Adjust the §3 totals + the §0 verdict block accordingly.
- [ ] **Report** the SP-1 Windows-rename findings, the SP-2 backup-policy confirmation, and the PF-04 evidence. **Stop for review** before Brick 2 (app-close dirty guard) is planned.

---

## Self-review

- **Spec coverage (Contract §3):** temp-file strategy — Task 1; rename strategy — Task 1; failure behavior — Task 1 (rename-failure test) + Task 3 (backup-failure test); corrupted-write prevention — structural, Task 1; backup/orphan rules (`.bak`, stale `.tmp` overwrite) — Task 1 + Task 3; platform note — SP-1 checkpoint; Amendment 1 (save succeeds, CLEAN, status notification + diagnostics log, no modal) — Task 3 test + Task 4 (`console.error`) + Task 5 (toast) + Task 6 E2E. PF-04 — SP-3. All covered.
- **Placeholder scan:** none — every step carries exact code and exact commands.
- **Type consistency:** `writeFileAtomic` returns `{ backupError: Error|null }` in every task (Task 1 returns `{ backupError: null }`; Task 3 returns the real value). `files.js` maps `backupError` → `backupFailed: boolean` in the IPC return; `file-manager.js` reads `res.backupFailed`. Names consistent across Tasks 1→6.
- **Scope:** Brick 1 only (atomic save). Bricks 2–4 are out of scope and planned separately after SP-3.
