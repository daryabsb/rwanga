# Core Editor Trust — Forensic Investigation

Investigation date 2026-05-22. Stage 1 / Investigation only — no code, no fixes.
Companion to `docs/RWANGA_IDE_LAUNCH_CHECKLIST.md` (the `PF` cluster + `QG-11`).

> **Headline:** the closure report framed Core Editor Trust as "primarily a
> verification campaign — code exists, unverified." The investigation **overturns
> that.** The two load-bearing data-safety features — **autosave (PF-06)** and
> **crash recovery (PF-08)** — do **not exist**. They are scaffolded (preload IPC,
> `electron/lib/`, `constants.js`) but unwired: no main-process handlers, no
> renderer consumers. Core Editor Trust is a **BUILD campaign first**, verification
> second.

Branch / worktree at investigation time: `main`, single worktree `E:/api/rwanga`,
HEAD `b1c1fb22`. No worktree created — investigation is read-only.

---

## 1 — Save ownership map

The path a keystroke travels to disk and back:

```
ProseMirror EditorView.state.doc        ← live edited content (tab-manager.js)
  → captureEditorState()  copies view.state.doc → doc.body   (file-manager.js)
  → Doc.serialize(doc)    builds the .rga JSON string         (doc.js)
  → window.rwanga.files.save(handle, content)   IPC           (preload.js)
  → ipcMain 'files.save' → fs.writeFile(handle, content)      (electron/bridge/files.js)
  ─────────────────────────────────────────────────────────  DISK
  ← bootSession(): localStorage 'rga-session-tabs' → files.read → openFromContent
```

| Role | Owner | Where | Notes |
|---|---|---|---|
| **Document state** | `Rga.Doc` | `renderer/js/doc.js` | The in-memory Doc object: `body` (PM Node), `metadata`, `settings`, `dirty`, `handle`, `lastSavedAt`. `create` / `serialize` / `deserialize` / `markDirty` / `clearDirty` / `rebindHandle`. |
| **Editor state** | `Rga.TabManager` | `renderer/js/tab-manager.js` | One singleton ProseMirror `EditorView` + per-tab `editorState` snapshots. The *live* edit lives in `EditorView.state.doc` until `captureEditorState` copies it into `doc.body`. |
| **Persistence layer** | `Rga.FileManager` | `renderer/js/file-manager.js` | `save()` / `saveAs()`: capture → serialize → IPC → `clearDirty`. |
| **Filesystem write** | `files.js` IPC bridge | `electron/bridge/files.js` | `files.save` → `fs.writeFile` (**non-atomic, truncate-in-place**). `files.pickSaveAs` → save dialog + `fs.writeFile`. |
| **Restore path** | `Rga.TabManager.bootSession` + `_saveSession` | `tab-manager.js` | localStorage `rga-session-tabs` holds `{handle, displayName}` per tab; boot re-reads each from disk via `files.read`. Plus `FileManager.openRecent` from localStorage `rga-recent-files`. |

### The six requested owners

- **Who owns save** — `Rga.FileManager.save()` / `saveAs()`. Triggered by Ctrl+S
  (KeyboardRegistry command `file.save`), the owned menubar, and `closeTab`'s
  "save" choice. Save is **manual only.**
- **Autosave owner** — **NONE.** `constants.js` defines `AUTOSAVE_DEBOUNCE_MS:
  2000` and `AUTOSAVE_MAX_INTERVAL_MS: 10000`, but a project-wide search finds
  **no consumer**. `preload.js` exposes `autosave.write/discard/scanOrphans`, but
  **no `ipcMain.handle` registers them**. No renderer code references `autosave`.
  Autosave does not exist as behaviour — only as unused constants and orphan IPC
  stubs. *(This is the source of the checklist's stale "debounced 2s / max 10s
  exists" note — a constant definition mistaken for a feature.)*
- **Dirty-state owner** — `Rga.Doc`. `doc.dirty` is set by `markDirty` (called
  from `mount.js` `dispatchTransaction` on every `tr.docChanged`, plus the
  page-setup / format-toolbar / units / revision-flags / manuscript-geometry
  mutators) and cleared by `clearDirty` on a successful save. Rendered by
  `tab-manager.renderTabBar` (`●` + `.dirty` class) and `file-manager.notifyTitle`
  (titlebar `●`). **This works.**
- **Recovery owner** — **NONE.** There is no crash-recovery mechanism. The
  closest thing, `bootSession`, restores only the last *saved* disk state — it
  recovers nothing unsaved.
- **Startup restore owner** — `Rga.TabManager.bootSession`, invoked from
  `index.html` boot; reads the localStorage session list, re-reads each handle
  from disk, activates the saved index; falls back to `FileManager.newScript` if
  nothing restores.
- **Backup owner** — **NONE for `.rga` files.** The only backup logic anywhere is
  `electron/lib/json-file.js` `readJsonOrSeed` (renames corrupt JSON to
  `.bad-<timestamp>`) and `writeJsonAtomic` (temp-file + rename) — but
  `json-file.js` is **dead code, required by no production file** (only
  `tests/unit/json-file.test.js` imports it). No `.rga` backup, no autosave
  `.bak`, no versioned history.

### Dead / unwired persistence subsystem

A whole persistence subsystem was designed and scaffolded but never wired:

- `electron/lib/json-file.js` — `writeJsonAtomic` (atomic write), `readJsonOrSeed`
  (corrupt-backup). **Required by nothing.** Tested (`json-file.test.js`).
- `electron/lib/paths.js` — `autosaveDir`, `autosaveManifestPath`,
  `autosaveEntryPath`, `workspacePath`, `prefsPath`, `logDir`, `logPath`.
  **Required by nothing.**
- **25 orphan preload IPC channels** — exposed in `preload.js`, no `ipcMain`
  handler: `files.pickFolder`, `files.listFolder`, `recent.*` (3), `autosave.*`
  (3), `workspace.*` (2), `prefs.*` (2), `export.toPDF`, `storage.*` (9),
  `updates.*` (3). Calling any of them rejects with "No handler registered".
- `constants.js` — `AUTOSAVE_DEBOUNCE_MS`, `AUTOSAVE_MAX_INTERVAL_MS`,
  `WORKSPACE_WRITE_DEBOUNCE_MS`, `RECENT_FILES_MAX`, `STORAGE_PILL_THRESHOLD_BYTES`
  — all unused.

The registered main-process IPC is only: `files.pickOpen/read/save/pickSaveAs/stat`,
`window.minimize/maximize/close/setTitle/getState`, `menu.setViewMode`.

What *is* persisted today is persisted to **localStorage**, not the userData IPC:
recent files (`rga-recent-files`), the session tab list (`rga-session-tabs`),
workspace layout (`rga-workspace-layout`), theme (`rga-theme`).

---

## 2 — Failure scenarios

| # | Scenario | Current behaviour | Expected behaviour | Risk |
|---|---|---|---|---|
| 1 | **Crash during typing** | Edits live only in the in-memory `EditorView` / `doc.body`. No autosave. Everything since the last manual save is **lost.** | Autosave captures within ~2 s; on relaunch the work is offered back. | **CRITICAL** |
| 2 | **Crash during save** | `files.save` → `fs.writeFile(handle, content)` opens the target with `'w'` — it **truncates in place first**, then writes. A crash mid-write leaves a truncated / corrupt `.rga`. No temp-file + rename. (The atomic `writeJsonAtomic` exists but is dead code.) | Temp-file write + atomic rename — the original is never destroyed until the new content is fully on disk. | **CRITICAL** |
| 3 | **App force close** (window `✕`, Alt+F4, Task-Manager kill) | `window.close` IPC calls `win.close()` unconditionally. `main.js` has **no `'close'` event handler**; the renderer has **no `beforeunload`**. Unsaved work is lost silently — no prompt. | A dirty-document check blocks the close and prompts Save / Discard / Cancel. | **CRITICAL** |
| 4 | **OS shutdown / logout** | Same as #3 — Electron's `before-quit` / window-close fire with no handler. No save, no prompt. | Same as #3; OS-shutdown should at minimum flush autosave. | **CRITICAL** |
| 5 | **Multiple tabs / documents** | Per-tab `Doc` + `editorState` snapshots; dirty tracked per-doc; `closeTab` warns per dirty tab. **But** app-close (#3/#4) never iterates tabs for dirty state, and `_saveSession` persists only tabs **with a handle** — untitled tabs are dropped from session restore entirely. | App-close checks every tab; session restore preserves untitled tabs (via autosave keyed by `docId`). | **HIGH** |
| 6 | **Unsaved new document** | `Doc.create` → `handle: null`, `origin: 'untitled'`. `_saveSession` filters out no-handle docs, so an untitled doc is **never** in session restore. On crash or close its content is gone — not even listed for recovery. | An untitled doc with content is autosaved by `docId` and recoverable. | **CRITICAL** |
| 7 | **Corrupted file** (open) | `Doc.deserialize` → `JSON.parse` throws → `Error('File is corrupt…')` → `openFromContent` catch → `alert('Cannot open file')`. A newer-version file gets a clear message too. The app does not crash. | Graceful — as observed. (Optionally: offer the corrupt-file backup.) | **LOW** |
| 8 | **Disk write failure** (full disk, permissions, removed drive) | `fs.writeFile` rejects → IPC rejects → `save()` catch → `alert('Save failed: …')`. The user **is** told. **But** the non-atomic write (#2) may already have truncated the existing file — the user sees "save failed" while the on-disk copy is already destroyed. | The user is told **and** the original file is intact (atomic write). | **HIGH** |
| 9 | **Reopening previous session** | `bootSession` reads `rga-session-tabs`, re-reads each handle from disk, restores tabs, activates the saved index; falls back to a new Untitled doc. Works for **saved** files. Does **not** restore unsaved edits (only last-saved disk content), untitled docs, cursor position, per-tab undo history, or view mode. A file deleted/moved since last run is silently dropped (`bootSession` `.catch` warns only). | Session restore returns the editor to its exact prior state, including unsaved work (via autosave). | **MODERATE** |

Five of nine scenarios are **CRITICAL** — every one of them traces back to the
same two missing features: **autosave** and an **app-close dirty guard**.

---

## 3 — Checklist mapping

| ID | Requirement | Verdict | Evidence |
|---|---|---|---|
| **PF-01** | App opens reliably | **PARTIAL** *(unchanged)* | `main.js` `createMainWindow` is structurally clean; single-instance lock; `ready-to-show` gate. No crash-on-boot found by static read. "Reliably" still needs a cold-start matrix on Win/macOS — no new evidence either way. |
| **PF-02** | New document works | **PARTIAL** *(unchanged)* | `FileManager.newScript` → `Doc.create` → `TabManager.openDocument`. Structurally sound; no E2E test. |
| **PF-03** | Open document works | **PARTIAL** *(unchanged)* | `openFromDialog` → `files.pickOpen` IPC (handler **exists**) → `deserialize`. Corrupt / newer-version files handled gracefully. No open-from-disk E2E. |
| **PF-04** | Save works | **PARTIAL** *(unchanged — risk added)* | `save` → `captureEditorState` → `serialize` → `files.save` IPC (handler **exists**) → `fs.writeFile`. Happy path works. **RISK:** the write is non-atomic truncate-in-place — a crash / disk error mid-write corrupts the file (scenarios #2, #8). |
| **PF-05** | Save As works | **PARTIAL** *(unchanged)* | `saveAs` → `files.pickSaveAs` IPC (handler **exists**, appends `.rga`, returns rebind handle). Structurally sound; no E2E. Same non-atomic-write risk as PF-04. |
| **PF-06** | Autosave works | **FALSE** *(was PARTIAL)* | **Not implemented.** `constants.js` `AUTOSAVE_DEBOUNCE_MS` / `AUTOSAVE_MAX_INTERVAL_MS` have no consumer; `autosave.*` preload IPC has no main handler; project-wide search finds no renderer autosave code. The PARTIAL was a misread of unused constants. |
| **PF-07** | Dirty-state indicator works | **TRUE** *(unchanged)* | `mount.js` `dispatchTransaction` → `markDirty` on `tr.docChanged` → `renderTabBar` (`●` + `.dirty`) + `notifyTitle` (titlebar `●`); `clearDirty` on save. `tab-manager` / titlebar suites pass. |
| **PF-08** | Crash recovery works | **FALSE** *(was UNKNOWN)* | **Not implemented.** No autosave to recover from; `autosave.scanOrphans` IPC unhandled; no recovery-prompt UI anywhere. `bootSession` restores only the last *saved* disk state. |
| **PF-09** | Recent files works | **PARTIAL** *(unchanged)* | Functional via localStorage `rga-recent-files` (max 8 — note `constants.RECENT_FILES_MAX: 10` is unused); rendered in the empty state; stale handles self-prune on open failure. The `recent.*` IPC layer is orphaned. No test. |
| **PF-10** | Tab switching works | **TRUE** *(unchanged)* | `tab-manager.test.js`: open / close / switch all pass; `activate` snapshots + restores per-tab `editorState`. |
| **PF-11** | Unsaved-close warning works | **PARTIAL** *(unchanged — gap identified)* | **Tab close** warns: `closeTab` → `Modal.showUnsaved` (with `confirm()` fallback), Save / Discard / Cancel honoured. **GAP:** **window-close / app-quit / Alt+F4 / OS shutdown have no guard** — `main.js` has no `'close'` handler, the renderer has no `beforeunload`. The warning covers one of the four close paths. |
| **PF-12** | Keyboard shortcuts complete | **PARTIAL** *(unchanged)* | `KeyboardRegistry` owns shortcuts; commands `file.new/open/save/saveAs` registered (and on Windows this is the *only* path — the native menu is suppressed, `Menu.setApplicationMenu(null)`). "Complete" is undefined / unaudited. |
| **PF-13** | No console errors in normal work | **UNKNOWN** *(unchanged)* | Not assessed at runtime. Static read found no happy-path `console.error` source (the dead IPC channels are never invoked, so they never throw); normal flows use `console.info` / `console.log`, not errors. Still needs a runtime console audit. |
| **QG-11** | Crash recovery tests | **FALSE** *(was UNKNOWN)* | No automated kill-and-recover test exists. `tests/unit/editor/editor-recovery-phase*.test.js` cover **Page Setup** recovery, not crash recovery. The feature under test (PF-08) is not implemented. |

**Status flips:** PF-06 PARTIAL→FALSE · PF-08 UNKNOWN→FALSE · QG-11 UNKNOWN→FALSE.
**P0 totals:** 23 TRUE · 24 PARTIAL · 6 UNKNOWN · 7 FALSE (was 23 / 25 / 8 / 4).
Launch remains blocked — 37 P0 not-TRUE.

Within the `PF` cluster (PF-01…PF-13): **2 TRUE** (PF-07, PF-10) · **8 PARTIAL**
(PF-01–05, PF-09, PF-11, PF-12) · **2 FALSE** (PF-06, PF-08) · **1 UNKNOWN**
(PF-13). Plus **QG-11 — FALSE**.

---

## 4 — One recommended campaign

**Core Editor Trust — Persistence Safety.** (Stage 1, P0. One campaign only.)

This is **not** the verification campaign the closure report anticipated. The
investigation shows the foundation is **missing, not merely unverified**: build
the data-safety floor first, verify second.

Risk-first ordering (campaign *shape* only — not a design; each brick needs its
own spec step):

1. **Atomic save** — convert `files.save` to temp-file-write + atomic rename. The
   `writeJsonAtomic` pattern already exists in the dead `electron/lib/json-file.js`.
   Smallest change, highest leverage; closes the PF-04 / scenario #2 / #8
   corruption risk. No UI.
2. **App-close dirty guard** — `main.js` `'close'` (and `before-quit`) handler →
   query the renderer for dirty tabs → block + prompt. Closes the PF-11 gap and
   scenarios #3 / #4.
3. **Autosave** — wire the `autosave.*` IPC handlers (main), build the renderer
   debounce consumer (constants + `electron/lib/paths.js` already exist), write to
   `userData/autosave/` keyed by `docId` (so untitled docs survive — scenario #6).
   Closes PF-06.
4. **Crash recovery** — `autosave.scanOrphans` on boot → recovery prompt →
   restore. Closes PF-08 and scenarios #1 / #5 / #9.
5. **Lifecycle verification** — E2E for PF-01…PF-05, a console-clean audit
   (PF-13), then the automated kill-and-recover test (QG-11).

**Before any code:** this campaign must get its own brainstorm → spec with a
binding **Contract + Stop-Point Register** (Operating Rule 6; the project's
"specs must force STOP at gaps" rule). The dead scaffolding (`json-file.js`,
`paths.js`, the orphan IPC, the constants) is a genuine head start — wire it, do
not delete it.

**Out of scope** (separate campaigns, consistent with the closure report): PDF
export (IE-04 / PP-14 / MT-04), RTL correctness, and the `workspace.*` / `prefs.*`
/ `storage.*` orphan IPC (the Cache-Management / storage cluster).

---

_Investigation only — no implementation, no fixes, no redesign. Checklist updated
per Rule 6 in the same step (Implementation log entry 2026-05-22; PF-06 / PF-08 /
QG-11 flipped to FALSE; §3 totals + verdict reconciled)._
