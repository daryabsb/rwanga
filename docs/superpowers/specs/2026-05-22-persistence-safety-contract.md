# Persistence Safety Contract v1

Campaign: **Core Editor Trust — Persistence Safety** (Stage 1, launch-blocker).
Date 2026-05-22. Stage: investigation + architecture only — **no code in this document.**
Companion to `docs/core-editor-trust-forensic.md` and `docs/RWANGA_IDE_LAUNCH_CHECKLIST.md`.

Branch / worktree at authoring time: `main`, single worktree `E:/api/rwanga`, HEAD
`b1c1fb22`. Working tree carries 44 uncommitted entries from prior engagements
(commit strategy still unresolved — out of this contract's scope).

---

## 0. Status of this document

**RATIFIED 2026-05-22** — approved by the user with two amendments (recorded below),
both applied. SP-0 condition (a), "user approves this contract," is **satisfied**.

This is a **binding contract.** It governs every implementation step of the
Persistence Safety campaign. `MUST` / `MUST NOT` / `MUST ONLY` are binding; a step
that violates a clause is wrong even if its tests pass. The contract may be amended
only by an explicit user decision recorded as a new revision.

It does **not** authorise implementation. Implementation begins only once a separate
implementation plan exists (SP-0 condition (b), still pending).

### Amendments (2026-05-22, post-review — ratified)

- **Amendment 1 — SP-2 backup-failure UX.** A failed `.bak` copy is non-fatal and
  the save proceeds (unchanged). The outcome is now specified as: the save succeeds
  normally, the document becomes CLEAN normally, and the failure is surfaced **only**
  as a non-blocking status notification plus a diagnostics-log entry — **no warning,
  no modal**. Rationale: atomic save is the primary guarantee; `.bak` is secondary.
  SP-2 is hereby **resolved** (see §3, §7).
- **Amendment 2 — first-dirty snapshot seed.** Autosave gains an immediate seed
  snapshot on the CLEAN → DIRTY transition, ahead of the debounce (see §4).
- **Amendment 3 — Recovery Ownership Rule (P6).** Added a binding architectural
  principle (§0 P6) drawing the Brick 3 / Brick 4 line: Brick 3 (autosave) owns
  snapshot *creation* and *persistence*; Brick 4 (crash recovery) owns snapshot
  *interpretation*, *orphan detection*, the *Restore / Discard* UX, and
  *recovered-tab creation*. Brick 3 never auto-restores; pre-Brick-4 startup
  always opens a clean document.

### Problem this contract closes

Per the forensic (`docs/core-editor-trust-forensic.md`): autosave (PF-06) and crash
recovery (PF-08) **do not exist**; `files.save` is a non-atomic truncate-in-place
write (PF-04 corruption risk); the unsaved-close warning covers only tab-close, not
app-close / Alt+F4 / OS shutdown (PF-11 gap). Five of nine failure scenarios are
CRITICAL. A writer can lose work today.

### Locked decisions (user, 2026-05-22)

1. **Priority order:** (1) atomic save → (2) app-close dirty guard → (3) autosave →
   (4) crash recovery. Each is a brick; bricks ship in this order.
2. **Crash recovery UX:** an orphan snapshot found at startup triggers a **modal
   recovery prompt** (Restore / Discard). Nothing is silently restored.
3. **Manual-save backup:** a successful manual save **also retains one rolling
   previous-version backup** beside the file (e.g. `script.rga` → `script.rga.bak`).
4. **Multi-document app-close:** **sequential per-document** prompts (reuse
   `Modal.showUnsaved`); Cancel on any one aborts the whole quit.

### Architectural principles (binding)

- **P1 — Autosave never touches the writer's file.** Autosave writes **only** to a
  sidecar inside Electron `userData`. The writer's `.rga` on disk changes **only**
  through a manual Save / Save As. (Consistent with the save-vs-export and privacy
  principles.)
- **P2 — The writer's file is never left corrupt.** Every write to a `.rga` is
  atomic: a complete temp file is built, then atomically renamed over the target.
  The target is never opened for truncation.
- **P3 — Single ownership.** Every persistence concern has exactly one owner module
  (§2). No concern is owned by two modules.
- **P4 — One-way truth for recovery.** Snapshot → disk → scan → prompt → restore is
  one-directional. A recovered document is opened as a normal dirty tab; it is the
  writer who commits it back to their file.
- **P5 — Background operations never interrupt.** Autosave and snapshot writes
  never raise a modal or block typing. Only a manual save or a close decision may
  show a dialog.
- **P6 — Recovery Ownership Rule.** Snapshot **creation** and **persistence** are
  owned by **Brick 3** (autosave). Snapshot **interpretation**, **orphan
  detection**, the **Restore / Discard** UX, and **recovered-tab creation** are
  owned by **Brick 4** (crash recovery). Binding consequences: (a) Brick 3 MUST
  NEVER restore content automatically; (b) until Brick 4 ships, application
  startup MUST always open a clean document; (c) only Brick 4 may transform a
  snapshot back into a document; (d) no recovery concern has two owners.
  *(Amendment 3, 2026-05-22.)*

---

## 1. Save lifecycle

A document moves through four persistence states. The state is a function of
`doc.dirty` and whether an autosave snapshot exists on disk.

| State | `doc.dirty` | Snapshot on disk | Meaning |
|---|---|---|---|
| **CLEAN** | `false` | none | On-disk `.rga` matches the document. Nothing at risk. |
| **DIRTY** | `true` | none yet | Edited within the last debounce window; not yet snapshotted. |
| **SNAPSHOTTED** | `true` | yes | Edits are recovery-safe in the sidecar; the `.rga` on disk is stale. |
| **SAVED** | `false` | none | Manual save just completed; snapshot discarded; `.bak` refreshed. → CLEAN. |

### The lifecycle, end to end

```
  typing
    │  a docChanged transaction (mount.js dispatchTransaction)
    ▼
  dirty ──────────────► Rga.Doc.markDirty(doc): doc.dirty = true, metadata.modified
    │                   updated; tab ● + titlebar ● shown.        [state: DIRTY]
    │
    ├──► autosave (background, continuous)
    │      On the CLEAN→DIRTY crossing, Rga.Autosave writes an IMMEDIATE seed
    │      snapshot (§4, Amendment 2); thereafter it (re)arms a 2 s debounce,
    │      capped by a 10 s max-interval. On fire: capture editor state →
    │      Doc.serialize → window.rwanga.autosave.write(docId, envelope) → the
    │      autosave bridge writes the sidecar snapshot ATOMICALLY.   [state: SNAPSHOTTED]
    │
    └──► manual save (on user action: Ctrl+S / menu / close-prompt "Save")
           Rga.FileManager.save() → captureEditorState → Doc.serialize
             │
             ▼
           disk write
             window.rwanga.files.save(handle, content) → the file bridge performs
             the ATOMIC SAVE (§3): temp file → fsync → roll <file>.bak →
             atomic rename. On success: Doc.clearDirty; Rga.Autosave discards the
             doc's snapshot (autosave.discard).                      [state: SAVED → CLEAN]

  ─────────────────────  (app exits — gracefully via §6, or by a crash)  ─────────────────────

  recovery (next launch, before normal session restore)
    Rga.Recovery calls window.rwanga.autosave.scanOrphans(). A graceful quit clears
    all snapshots, so ANY snapshot still present is a crash orphan. If orphans
    exist → the modal recovery prompt (Restore / Discard).
    │
    ▼
  restore
    On Restore: each orphan's serialized .rga payload is handed to Rga.TabManager,
    which opens it as a tab — bound to its original file handle if it had one,
    untitled otherwise — and marked DIRTY so the writer saves it back. The snapshot
    is NOT deleted until that recovered document is saved or explicitly discarded.
    On Discard: the orphan snapshots are deleted.
    Separately, Rga.TabManager.bootSession restores the previous session's saved
    files from disk as normal.
```

The two save paths are **parallel**, not sequential: autosave runs continuously in
the background; manual save runs on user action. Both converge on disk; recovery
and restore happen on the next launch.

---

## 2. Ownership map

Every persistence concern has **exactly one** owner. This table is binding (P3).

| Concern | Sole owner | Module | Responsibility |
|---|---|---|---|
| **Dirty state** | `Rga.Doc` | `renderer/js/doc.js` | The `doc.dirty` field. `markDirty` / `clearDirty` are its only mutators. (Already true today.) |
| **Manual save** | `Rga.FileManager` | `renderer/js/file-manager.js` | `save()` / `saveAs()` — user-initiated writes of the `.rga`. (Already true today.) |
| **Autosave** | `Rga.Autosave` *(new)* | `renderer/js/autosave.js` | The per-document debounce timers, the decision to snapshot, the call to the autosave IPC. |
| **Recovery snapshot store** | autosave IPC bridge *(new)* | `electron/bridge/autosave.js` | Sole reader / writer / deleter of `userData/autosave/`. Owns `autosave.write` / `discard` / `scanOrphans`. |
| **Atomic disk write + previous-version backup** | file IPC bridge | `electron/bridge/files.js` + `electron/lib/atomic-write.js` *(new)* | The temp-file + fsync + `.bak` roll + atomic rename. Owns the `<file>.rga.bak`. |
| **Restore (document → open tab)** | `Rga.TabManager` | `renderer/js/tab-manager.js` | Turning a document — from disk or from a recovered snapshot — into an open tab. Owns `bootSession`. |
| **Recovery flow** | `Rga.Recovery` *(new)* | `renderer/js/recovery.js` | Startup orchestration: scan orphans → show the recovery prompt → route Restore/Discard. Owns nothing on disk and no tabs — it only orchestrates. |
| **Close confirmation (tab + app)** | `Rga.CloseGuard` *(new)* | `renderer/js/close-guard.js` | The single owner of the unsaved-changes prompt. Both tab-close and app-close route through it. |
| **OS close-event interception** | `electron/main.js` | `electron/main.js` | Intercepts the window `'close'` / `before-quit` events; obeys CloseGuard's verdict. |

### No-duplication clarifications

- **"Backup / orphans" is two distinct concerns, each singly owned.** The
  *previous-version backup* (`<file>.bak`, e.g. `script.rga.bak`) is part of the
  atomic save → owned by the **file bridge**. The *orphan autosave snapshots* are
  part of the snapshot store → owned by the **autosave bridge**. They never overlap.
- **Close confirmation is not duplicated.** `TabManager.closeTab` currently inlines
  its own unsaved prompt. This contract **moves** that logic into `Rga.CloseGuard`
  (`confirmDocClose(doc)`); `closeTab` becomes a caller. After this campaign there
  is exactly one unsaved-prompt implementation.
- **Restore vs recovery flow.** `Rga.Recovery` decides *what* to recover and asks
  the user; `Rga.TabManager` performs the *act* of opening it. Orchestration and
  mechanism are separate owners.
- **Atomic write has one primitive.** `electron/lib/atomic-write.js` exposes the
  single atomic-write function; `files.save`, `files.pickSaveAs`, and the autosave
  bridge all call it. No module reimplements atomic writing.

### New modules introduced

`renderer/js/autosave.js`, `renderer/js/recovery.js`, `renderer/js/close-guard.js`,
`electron/bridge/autosave.js`, `electron/lib/atomic-write.js`. The dead scaffolding
is **wired, not deleted** — it is a genuine head start: `electron/lib/json-file.js`'s
temp-file+rename pattern is the basis for the new `atomic-write.js` (atomic writing
then lives in exactly one place — §2 ownership; `json-file.js` keeps `readJsonOrSeed`
for config files or is retired); `electron/lib/paths.js` is adjusted where §5
requires (snapshot filename); the orphan preload channels gain their main-process
handlers; the `constants.js` autosave constants go live.

---

## 3. Atomic save contract

Governs every write of a `.rga` to the writer's chosen path (`files.save` and
`files.pickSaveAs`). Closes PF-04.

> **Notation.** `<file>` is the writer's full file path, which ends in `.rga`
> (e.g. `script.rga`). The temp file is `<file>.tmp` (`script.rga.tmp`); the
> backup is `<file>.bak` (`script.rga.bak`).

### Temp-file strategy

- The new content MUST be written in full to a temp file in the **same directory**
  as `<file>` (same volume — a cross-volume rename is not atomic).
- Temp name: `<file>.tmp`. A pre-existing stale `.tmp` is overwritten.
- After writing, the temp file MUST be flushed with `fsync` (and closed) **before**
  the rename, so the new bytes are durable before the rename commits.

### Rename strategy

- `<file>` is replaced by a single `fs.rename(<file>.tmp, <file>)` — atomic on the
  same volume. `<file>` is **never** opened with a truncating mode (`'w'`).
- Ordering of one save:
  1. Write content → `<file>.tmp`; `fsync`; close.
  2. If `<file>` already exists → copy it to `<file>.bak` (overwriting any prior
     `.bak`).
  3. `fs.rename(<file>.tmp, <file>)`.
- After step 3 `<file>` is the new content and `<file>.bak` is the previous version.

### Failure behavior

- **Failure at step 1** (write/fsync the temp): delete the `.tmp`; the target and
  `.bak` are untouched; reject the IPC. `FileManager` shows "Save failed: …"; the
  document stays DIRTY.
- **Failure at step 2** (the `.bak` copy): the save **succeeds normally** and
  proceeds to step 3 — the atomic write (steps 1 and 3) is the primary guarantee
  and is unaffected; `.bak` is secondary protection. The document becomes **CLEAN**
  exactly as on any successful save. The backup failure MUST NOT raise a warning or
  modal: it is recorded as a **diagnostics-log entry** and shown as a
  **non-blocking status notification** only. *(Amendment 1, 2026-05-22 — SP-2
  resolved.)*
- **Failure at step 3** (the rename): `fs.rename` is all-or-nothing; the target is
  either fully old or fully new. Delete the `.tmp` if it survived; reject the IPC;
  document stays DIRTY.
- Under no failure is a partially-written `.rga` ever visible at the target path.

### Corrupted-write prevention

- Corruption is structurally impossible: the target changes only via atomic rename
  of an already-complete, fsync'd file. A crash, power loss, or disk error at any
  instant leaves the target either entirely the old version or entirely the new
  one. This is the PF-04 guarantee.

### Backup / orphan rules

- `<file>.bak` is **one rolling copy** of the immediately-previous version,
  beside the file. It is written only when an existing file is overwritten (a
  first-ever save or a Save As to a new path has nothing to back up).
- Rwanga overwrites `.bak` on each save and never otherwise deletes it; it is the
  writer's safety net. Rwanga does not present, rotate, or manage `.bak` history —
  versioned history is explicitly out of scope (§8).
- A leftover `<file>.tmp` from a crashed save is **ignored** (never read) and
  is overwritten by the next save. The file bridge MAY delete a stale `.tmp` it
  encounters for the same target.

### Platform note (binding verification, not a design choice)

- On Windows, `fs.rename` over an existing target, and over a target locked/open
  by another process (EPERM / EBUSY), MUST be verified before atomic save is
  declared done — see **SP-1**.

---

## 4. Autosave contract

Governs the background recovery snapshots. Closes PF-06. Owner: `Rga.Autosave`
(renderer) + the autosave bridge (main).

### Trigger

- Autosave is armed by a document's transition into the DIRTY state — i.e. by
  `Rga.Doc.markDirty`. `markDirty` MUST notify `Rga.Autosave` (via a document-change
  event or a direct call; the implementation plan picks one).
- Autosave fires **only** for DIRTY documents. A CLEAN document is never snapshotted
  and has no snapshot file.

### First-dirty snapshot seed *(Amendment 2, 2026-05-22)*

- On a document's transition from **CLEAN → DIRTY**, `Rga.Autosave` MUST write an
  **immediate** snapshot — the standard envelope of this section (metadata + a full
  `Doc.serialize` baseline) — **without** waiting for the debounce.
- This **seed** closes the first-edit exposure window: the sequence
  open → paste → immediate force-close would otherwise lose everything, because the
  2 s debounce has not yet fired. The seed is written at the moment the document
  becomes dirty, so it already contains that first edit.
- The seed fires on **every** CLEAN → DIRTY crossing — including the first edit
  after a manual save (a save returns the document to CLEAN, so the next edit
  crosses CLEAN → DIRTY again and re-seeds). It does **not** fire for edits made
  while the document is already DIRTY — those follow the normal debounce.
- After the seed, autosave continues normally for that document: debounced at 2 s,
  capped at the 10 s max-interval.
- The seed is a normal snapshot write and obeys every other rule of this section
  (atomic write, per-`docId` file, untitled-document handling, discard-on-save).

### Debounce and max interval

- **Debounce:** `AUTOSAVE_DEBOUNCE_MS` = 2000 ms. After the last edit, 2 s of quiet
  triggers a snapshot.
- **Max interval:** `AUTOSAVE_MAX_INTERVAL_MS` = 10000 ms. If edits never pause for
  2 s, a snapshot is forced every 10 s of continuous editing, so a fast typist is
  never more than ~10 s exposed.
- Both constants already exist in `constants.js`; this contract makes them live.

### Document identity

- The autosave key is `doc.docId` (session-scoped — regenerated each `Doc.create` /
  open; that is acceptable, see §5 orphan detection).
- One snapshot file per document: `userData/autosave/<safe-docId>.autosave.json`
  (`safe-docId` = `docId` with non-`[A-Za-z0-9_-]` replaced by `_`, per the existing
  `paths.js` sanitiser).
- The snapshot is a JSON **envelope**, not a bare `.rga`:
  ```
  { schemaVersion, savedAt, baseHandle, baseDisplayName, baseSavedAt, rga: <full Doc.serialize object> }
  ```
  `baseHandle` is the document's file path, or `null` for an untitled document.
  `baseSavedAt` is the file's last manual-save timestamp, or `null`.

### Untitled-document handling

- An untitled document (`handle === null`) **IS autosaved**, keyed by its `docId`,
  with `baseHandle: null`. This is the fix for the CRITICAL "unsaved new document"
  scenario — an untitled draft survives a crash. On recovery it is restored as a
  new untitled, dirty tab carrying the content (the writer then chooses Save As).

### Multiple-tab behavior

- Every open document is autosaved **independently**, keyed by its own `docId`, to
  its own snapshot file. `Rga.Autosave` keeps a per-document debounce state
  (`Map<docId, timerState>`).
- Switching tabs does not cancel a pending snapshot for the backgrounded document.
  Background documents simply hold their last snapshot until next edited.

### Snapshot writes, discards, failures

- The snapshot file MUST be written **atomically** (temp + rename inside
  `userData/autosave/`, via `electron/lib/atomic-write.js`) — a crash mid-snapshot
  must not corrupt the snapshot itself.
- A document's snapshot is **discarded** (`autosave.discard(docId)`) on: a
  successful manual save of that document; a tab close after save/discard; a
  graceful app quit once the document is handled.
- Autosave **never** writes to the writer's `.rga` file (P1) and **never** raises a
  modal (P5). An autosave IPC failure is logged and MAY show a subtle status-bar
  indicator; it is retried on the next trigger. It never interrupts typing.

---

## 5. Crash recovery contract

Governs detecting and restoring work after a crash. Closes PF-08 (and unblocks
QG-11). Owner: `Rga.Recovery` (flow) + the autosave bridge (disk) + `Rga.TabManager`
(restore).

### Snapshot location

- `userData/autosave/` (Electron `app.getPath('userData')`, via `electron/lib/
  paths.js`). One `*.autosave.json` envelope per document.
- `paths.js` is adjusted: `autosaveEntryPath(docId)` returns the `.autosave.json`
  path; `autosaveManifestPath` is **dropped** — there is no shared manifest (each
  envelope is self-describing, which removes all multi-tab write-concurrency on a
  shared file).

### Orphan detection

- **Rule: a graceful shutdown discards every snapshot (§6); therefore any
  `*.autosave.json` present at the next startup is a crash orphan.** Presence is the
  detection — no timestamp heuristic is required.
- `window.rwanga.autosave.scanOrphans()` returns the list of orphan envelopes with
  their metadata (`baseDisplayName`, `baseHandle`, `savedAt`).
- Secondary guard: if an orphan's `baseHandle` file exists and its current mtime is
  **newer** than the orphan's `baseSavedAt` *and* the orphan adds nothing, the
  orphan MAY be treated as stale. v1 keeps it simple: presence ⇒ offer it.

### Startup recovery flow

- In `index.html` boot, `Rga.Recovery.run()` executes **before** `bootSession`
  opens files and before the fallback new-document is created.
- `run()` calls `scanOrphans()`. No orphans → return; boot proceeds normally. One
  or more orphans → show the recovery prompt.
- Deduplication: if a recovered orphan's `baseHandle` equals a file that
  `bootSession` would also reopen, the **recovered (newer) version wins** — the
  orphan is opened and the stale disk reopen of that path is skipped.

### Restore UI behavior

- The recovery prompt is a **modal dialog** (per the locked decision). It lists the
  recovered document(s) — `baseDisplayName` and a relative "last autosaved N
  minutes ago" from `savedAt`. Choices: **Restore** / **Discard** (applied to all
  listed orphans; v1 does not offer per-item granularity).
- On **Restore**: each orphan's `rga` payload is deserialized and opened as a tab
  via `Rga.TabManager`. If `baseHandle` is set, the tab is bound to that handle;
  otherwise it opens untitled. Every restored tab is marked **DIRTY** — the writer
  must consciously Save it back to their file.
- The orphan snapshot is **kept** until the recovered document is manually saved or
  explicitly discarded — so a crash *during* recovery loses nothing.
- On **Discard**: every listed orphan snapshot is deleted (`autosave.discard`).
- The recovery prompt requires a generic modal (title / message / choices). Per the
  `modal.js` roadmap note, `Rga.Modal` grows a generic `show({title, message,
  choices})`; `showUnsaved` becomes a thin caller of it.

### Cleanup rules

A snapshot is removed when, and only when:
- (a) the document is manually saved;
- (b) the document's tab is closed after a save/discard decision;
- (c) the app quits gracefully and the document was handled (§6);
- (d) the writer chooses Discard in the recovery prompt;
- (e) a recovered document is saved back to its file.

Stale `*.tmp` files inside `userData/autosave/` (from a crashed snapshot write) are
ignored and MAY be cleaned opportunistically. The autosave directory MUST NOT grow
unbounded — its contents are later surfaced by the Cache-Management UI (out of
scope here; noted for continuity).

---

## 6. App-close contract

Governs the four ways the editor can stop. Closes PF-11. Owner: `Rga.CloseGuard`
(decision) + `electron/main.js` (OS-event interception).

**Binding pre-step for every close path that Rwanga can intercept:** the close
guard's **first action is to flush all DIRTY documents' autosave snapshots
immediately**, *before* any prompt. This guarantees that even if the close is then
cut short (an impatient user, an OS deadline), the work is already recovery-safe.

> **Build-order note.** The close guard ships at priority #2, *before* autosave
> (#3). The close guard is correct standalone — it prompts Save / Discard / Cancel,
> and that prompt is its guarantee. The snapshot-flush pre-step above becomes
> active only once autosave (#3) lands; until then it is a no-op. This contract
> describes the completed end state — §0's priority order assembles it
> incrementally. The same applies to §6.3 / §6.4, whose "autosave is the
> protection" clauses hold once #3 is in place.

### 6.1 App close (graceful quit)

Triggers: menu Quit, `Cmd/Ctrl+Q`, the renderer window-control close button
(`window.close` IPC), the last window closing.

- `electron/main.js` intercepts the window `'close'` event (`event.preventDefault()`
  on first pass) and the `before-quit` event.
- Main asks the renderer to confirm via a new IPC round-trip; `Rga.CloseGuard.
  confirmAppClose()` runs:
  1. Flush all dirty snapshots (the binding pre-step).
  2. Enumerate dirty documents across all tabs.
  3. For each, **sequentially**, show `Modal.showUnsaved(displayName)` →
     Save / Discard / Cancel:
     - **Save** → `FileManager.save()` (which routes to Save As if untitled). A
       failed or cancelled Save As is treated as Cancel.
     - **Discard** → leave it; its snapshot will be cleared.
     - **Cancel** → **abort the entire quit**; remaining documents are not
       prompted; the app stays open.
  4. All dirty documents resolved without a Cancel → discard all snapshots → reply
     **allow**.
- Main, on **allow**, removes the interceptor and proceeds with the close; on
  **abort**, the app simply stays open.
- **Renderer-unresponsive fallback:** if the renderer does not reply within a
  bounded timeout, main proceeds with the close — the snapshots flushed in the
  pre-step are the safety net. *(The timeout value and this fallback are a
  stop-point — SP-4.)*

### 6.2 Tab close

Trigger: a tab's `×`, or a close-tab command.

- `Rga.TabManager.closeTab` delegates the dirty check to
  `Rga.CloseGuard.confirmDocClose(doc)` — the **same** single prompt implementation
  used by 6.1. Save / Discard / Cancel; Cancel keeps the tab open.
- On close, the document's autosave snapshot is discarded.
- `closeTab`'s current inline prompt is **removed** in favour of this delegation
  (no duplication — see §2).

### 6.3 Force close

Triggers: Task-Manager / `SIGKILL`, a renderer-process crash, power loss.

- This path **cannot** be intercepted, by definition. The close guard contributes
  nothing here.
- The **sole** protection is autosave: whatever was snapshotted (≤ 2 s / ≤ 10 s
  old) survives; crash recovery (§5) offers it on the next launch. The contract
  states this honestly — force-close has a bounded, non-zero exposure window equal
  to the autosave interval.

### 6.4 OS shutdown / logout

Trigger: the OS sends the app a quit signal; Electron emits `before-quit` / the
window receives `'close'`.

- Rwanga treats this as a graceful close (6.1) — same `confirmAppClose` flow.
- **But** the OS may impose a short deadline and may force-kill before a modal is
  answered. The binding pre-step (flush all snapshots first) ensures the work is
  recovery-safe even if the prompt is cut off — degrading OS-shutdown gracefully to
  the force-close guarantee (6.3) in the worst case, with the graceful prompt in
  the normal case.

---

## 7. Stop-point register

Per Operating Rule 6 and the project's "specs must force STOP at gaps" rule.
Implementation **MUST stop and report** at each point below, and not proceed until
the named condition is met. Every brick is built test-first (RED → GREEN) and
updates `RWANGA_IDE_LAUNCH_CHECKLIST.md` in the same step (Rule 6).

| ID | Stop point | Why it stops here |
|---|---|---|
| **SP-0** | Before any code. | Implementation does not begin until this contract is approved by the user **and** a separate implementation plan exists. |
| **SP-1** | After the atomic-write primitive + `files.save` conversion, **before** adding `.bak`. | Verify on Windows that temp→rename atomically replaces an existing target, and behaves correctly when the target is open in another process (EPERM/EBUSY). Report the observed behavior. |
| **SP-2** | After the rolling `.bak` is added. | **RESOLVED** by Amendment 1 — no longer an open decision. Remains a checkpoint: verify the implementation matches the resolved policy (§3) — `.bak` failure ⇒ save succeeds, document CLEAN, non-blocking status notification + diagnostics-log entry, no warning/modal. |
| **SP-3** | Atomic save complete (priority #1 done). | Report PF-04 evidence (atomic-write + `.bak` tests, E2E save-to-disk). Do not start the close guard until reported. |
| **SP-4** | Close-guard IPC round-trip designed, **before** implementing it. | Confirm the renderer-unresponsive timeout value + fallback (§6.1), and confirm `closeTab`'s prompt is being *moved* into `CloseGuard`, not duplicated. |
| **SP-5** | App-close dirty guard complete (priority #2 done). | Report PF-11 evidence (tab + app + OS-shutdown paths). Do not start autosave until reported. |
| **SP-6** | Autosave snapshot format + sidecar layout decided, **before** implementing. | Confirm the `.autosave.json` envelope shape and that `paths.js` is being adjusted (filename suffix; `autosaveManifestPath` dropped). |
| **SP-7** | Autosave complete (priority #3 done). | Report PF-06 evidence (debounce + max-interval + multi-tab + untitled-doc tests). Do not start crash recovery until reported. |
| **SP-8** | Recovery dialog UX, **before** implementing. | Confirm the recovery-prompt copy and behavior (modal; Restore-all / Discard-all; recovered tabs open DIRTY; snapshot kept until saved). |
| **SP-9** | Crash recovery complete (priority #4 done). | Report PF-08 + QG-11 evidence (orphan detection, startup flow, the automated kill-and-recover test). |
| **SP-10** | Any time a decision arises that this contract does not cover. | A gap in the contract is a hard STOP — surface it, do not guess. |

---

## 8. Out of scope (explicitly fenced)

To honour "no speculative future ideas," the following are **not** part of this
campaign and MUST NOT be built under it:

- PDF / DOCX export (IE-04 / PP-14 / MT-04) — a separate campaign.
- The `workspace.*` / `prefs.*` / `storage.*` orphan IPC and the Cache-Management
  UI — a separate campaign (the autosave directory is merely *noted* for it).
- Versioned file history / multi-generation backups — `.bak` is one rolling copy,
  nothing more.
- Cloud sync / server-side backup.
- Per-item granularity in the recovery prompt (Restore-all / Discard-all only).
- Cross-restart stable document IDs — not needed (orphan detection is
  presence-based).

---

## 9. Checklist items this contract serves

PF-04 (atomic save), PF-11 (app-close guard), PF-06 (autosave), PF-08 (crash
recovery), QG-11 (crash-recovery test). All remain **FALSE / PARTIAL** until
implementation lands evidence — a contract is not evidence of working code
(Operating Rule 4).

---

_Contract only — no implementation. Next step is user review of this document;
implementation begins only after approval and a written implementation plan
(SP-0)._
