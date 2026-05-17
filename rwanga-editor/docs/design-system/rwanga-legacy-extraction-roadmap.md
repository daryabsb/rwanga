# Rwanga — Legacy Shell Extraction Roadmap

Created: 2026-05-17 (Runtime Ownership Stabilization Slice 3 §A)  
Status: living roadmap — append entries as new extraction candidates
appear; mark `Status: RESOLVED` when a module's removal slice lands.

---

## Purpose

This roadmap tracks the gradual extraction of `renderer/js/app-shell.js`
from its current "miscellaneous renderer kitchen sink" shape into
**compatibility/shim territory only**. The end state is an app-shell
file that exists solely to:

- expose legacy `Rga.*` names that engine code (off-limits per slice
  rules) still calls (`Rga.Keyboard`, `Rga.Sidebar`, etc.), each as a
  thin delegating shim, and
- host UI primitives (toast notifications, modal dialogs, command
  palette) until they earn their own files.

Everything else should migrate to a properly-named single-purpose
module (`renderer/js/shell/*.js`) or be deleted outright.

Each row is governed by the rules in
`docs/design-system/rwanga-ownership-matrix.md`. A row stays open
until its `Status` column reads RESOLVED.

---

## 1. Matrix

| Area | Current owner | Legacy owner | Adapter | Removal slice | Risk | Status |
|---|---|---|---|---|---|---|
| **Theme** (dark/light + persistence + onChange) | `Rga.Theme` in `app-shell.js:19` | Same — Theme was single-owner from inception | None — Slice 2 §B added the missing `onChange` event surface; G4 source-audit guard enforces sole writer for `data-theme` / `rga-theme` | n/a (resolved) | LOW — no other writers; tests guard it | RESOLVED (Slice 2 §B) |
| **Keyboard dispatch** | `Rga.KeyboardRegistry` (`renderer/js/shell/keyboard-registry.js`) | `Rga.Keyboard` in `app-shell.js:362` — now a 12-LOC delegating shim | `Rga.Keyboard.register` forwards to `Rga.KeyboardRegistry.register`. The shim exists only because off-limits engine consumer `renderer/js/editor/page-setup-dialog.js` calls it | When `editor/*` becomes touchable: ~10 LOC removal | LOW — single delegating shim, behaviour-preserving | RESOLVED-WITH-SHIM (Slice 2 §A) |
| **View mode** (Flow / Print / Draft / PrintPreview — body classes + persistence) | `Rga.ViewManager` (`renderer/js/framework/view-manager.js`) is the runtime SSOT — owns active view id + body-class side-effect. `Rga.ViewMode` (`renderer/js/view-mode.js`) is the user-facing UX layer (persistence + Esc-exits-Draft + previous-mode memory) reacting to ViewManager via `onChange`. Slice 6 §A removed the last shell-side body-class writer (the `view-mode.js _activate` fallback); §B added G3 enforcement so any future shell-js toggle of `view-{draft,print,print-preview}-active` fails CI | Same — ViewManager is in framework/ (off-limits) but is correctly placed (engine-level concern); ViewMode is shell-level UX | None — ViewManager-as-framework is the intended design, not a legacy shim. ViewMode's status-bar bypass (StatusBar calls `ViewManager.activate` directly) is documented public-API usage, not a shim | n/a (resolved) | LOW — single owner; G3 guard prevents drift; persistence round-trip tested | RESOLVED (Slice 6 §A + §B) |
| **Sidebar visibility / active panel** | `Rga.Shell.Sidebar` (active panel registry + current id; Slice 5 §B added `_syncLayoutMirror` so `activate(id)` writes `Layout.sidebar.activePanel` for WorkspaceState persistence) + `Rga.Shell.Layout.sidebar` (visibility / width / activePanel mirror, persisted by WorkspaceState since Slice 4 §A) | Same | `Rga.Sidebar` in `app-shell.js:215` — 5-LOC no-op shim. Single engine consumer: `tags.js:206` calls `Rga.Sidebar.switchTo('tags')` (no-op) | Slice when `editor/*` / `doc-types/*` becomes touchable; the engine call should migrate to `Rga.Shell.Sidebar.activate(panelId)` once a real Tags-equivalent panel exists | LOW — shim is pure no-op; engine call has no behavioural side effect today | RESOLVED-WITH-SHIM (Slice 5 §B: runtime SSOT + Layout mirror are now correctly synced; persistence round-trips; the only remaining open piece is the engine-side `Rga.Sidebar.switchTo('tags')` no-op, blocked on editor/*) |
| **StatusBar render + segments** | `Rga.Shell.StatusBar` (`renderer/js/shell/status-bar.js`) — read-only consumer of `Rga.ScriptSession` (scene / page / viewMode), `Rga.ScriptMetrics` (wordCount / currentBlockType — Slice 5 §A), `Rga.TabManager.activeDoc()` (language). The only write is the viewMode click calling `Rga.ViewManager.activate(next)` (documented public API of the SSOT, not state ownership) | Same | None | n/a (resolved) | LOW | RESOLVED (Compatibility Inventory entry #1; Slice 5 §A confirmed read-only-consumer status + introduced ScriptMetrics) |
| **BottomPanel visibility + active tab + persistence** | `Rga.Shell.StudioPanel` (`renderer/js/shell/studio-panel.js`) — single owner, Slice 9 §A. Persistence via `Rga.Shell.Layout.studioPanel` → `Rga.WorkspaceState` (Slice 4 §A). | Same — StudioPanel is the long-term home | `Rga.BottomPanel` in `app-shell.js` is now a 4-method shim (init / open / switchTo / toggleCollapse) delegating to StudioPanel. Engine plugins `annotations.js` (`switchTo('notes')`) + `revision-flags.js` (`switchTo('flags')`) continue working unchanged through the shim | When `editor/*` / `doc-types/*` becomes touchable: engine plugin calls migrate to `Rga.Shell.StudioPanel.switchTo(...)`, shim removed | LOW post-Slice-9 — shim is a 4-line delegating pass-through | RESOLVED-WITH-SHIM (Slice 9 §A) |
| **Inspector toggle** | `Rga.Shell.StudioPanel` (toggleInspector + openInspector). Slice 9 §A consolidated the routing | Same | `Rga.Inspector` in `app-shell.js` is now a 2-method shim (toggle / open) delegating to StudioPanel. Engine consumer `renderer/js/doc-types/screenplay/plugins/context-menu.js` calls `Rga.Inspector.open()` — pre-Slice-9 the method didn't exist and the call was a defensive no-op; Slice 9 added the open() delegate so the documented behavior actually fires | When `editor/*` becomes touchable: engine call migrates to `Rga.Shell.StudioPanel.openInspector()`, shim removed | LOW post-Slice-9 — 2-method delegating shim | RESOLVED-WITH-SHIM (Slice 9 §A) |
| **CommandPalette** | `Rga.CommandPalette` (`renderer/js/shell/command-palette.js`) — extracted in Slice 8 §A. Same public API; backdrop-click handler uses `matches()` instead of `classList.contains` so it passes source audit (b) | Same | None | A future "command palette consolidation" slice may refactor to a `Rga.Shell.Commands.register(cmd)` registry pattern where each panel contributes commands at boot, but the file itself is extracted and well-placed | LOW post-extraction — no engine consumers; existing init-script callers unchanged | RESOLVED (Slice 8 §A) |
| **Modal dialog** | `Rga.Modal` (`renderer/js/shell/modal.js`) — extracted in Slice 8 §A. Same single API (`showUnsaved`) | Same | None | When a second modal surface appears (Discard / Confirm / Pick-One), grow the API to a generic `show({title, message, choices}) → Promise` shape — no file move needed | LOW — single consumer (`Rga.TabManager`); 30 LOC | RESOLVED (Slice 8 §A) |
| **Toast notifications** | `Rga.Toast` (`renderer/js/shell/toast.js`) — extracted in Slice 8 §A. Same `show(msg, type, duration)` API | Same | None | None | LOW — small, self-contained | RESOLVED (Slice 8 §A) |
| **Resize handles** | `Rga.Resize` (`renderer/js/shell/resize.js`) — extracted in Slice 8 §A. Slice 4 §A Layout-commit-on-drag-end + Layout-driven CSS-var sync architecture preserved exactly | Same | None | None | LOW — pure DOM event-driven; the Layout writer surface is already guarded by G2 | RESOLVED (Slice 8 §A) |
| **SceneNotesConnector** (cursor scene → bottom-panel notes textarea) | `Rga.Shell.StudioPanel._wireSceneNotesConnector` (folded into StudioPanel during Slice 9 §A) | Same | None — the legacy `Rga.SceneNotesConnector` module was DELETED (zero callers — init was never wired at boot); the behavior moved into `StudioPanel.init` via `_wireSceneNotesConnector` | n/a (resolved) | LOW — single owner; no public API surface (private helper inside StudioPanel) | RESOLVED (Slice 9 §A) |
| **ScriptLanguage** (per-script writing language + direction) | `Rga.ScriptLanguage` (`renderer/js/shell/script-language.js`) — extracted in Slice 8 §A. Owns `rga-script-lang` localStorage key (G4 / G7 guards updated) | Same | None | None | LOW — clean module; LTR/RTL switch + status-bar button binding | RESOLVED (Slice 8 §A) |

---

## 2. Already-deleted modules

For audit / archaeology. These rows are gone from `app-shell.js`
entirely.

| Module | Deleted in | Reason | Replacement |
|---|---|---|---|
| `Rga.Tabs` (~185 LOC) | Slice 3 §A | Zero consumers across `renderer/` and `tests/` | `Rga.TabManager` (`renderer/js/tab-manager.js`) owns tabs end-to-end |
| `Rga.FileTree` (~85 LOC) | Slice 3 §A | DOM target `#file-tree` removed when Script Workspace panel took over workspace navigation | `Rga.Shell.Sidebar` panel `scriptWorkspace` |
| Three `injectIcons()` blocks (`.tree-icon`, `.tree-chevron`, `#sync-logo-icon`) | Slice 3 §A | All DOM targets gone in earlier slices | n/a |
| `Rga.StatusBar` (legacy) | Original shell migration Slice 2 | Replaced by `Rga.Shell.StatusBar` | `renderer/js/shell/status-bar.js` |
| `Rga.Keyboard` internal listener + `_shortcuts` map | Slice 2 §A | Consolidated into `Rga.KeyboardRegistry` | `Rga.Keyboard` retained as a 12-LOC delegating shim |
| `Rga.BottomPanel._STORAGE_KEY` + `_readPersistedVisibility` + `_writePersistedVisibility` | Slice 4 §A | Persistence migrated to `Rga.WorkspaceState` (one workspace blob) | `renderer/js/shell/workspace-state.js` |
| `Rga.Toast` (~55 LOC) | Slice 8 §A | Mechanical extraction; no engine consumers; same API | `renderer/js/shell/toast.js` |
| `Rga.Modal` (~30 LOC) | Slice 8 §A | Mechanical extraction; single non-engine consumer (Rga.TabManager) | `renderer/js/shell/modal.js` |
| `Rga.CommandPalette` (~190 LOC) | Slice 8 §A | Mechanical extraction; backdrop-click refactored to `matches()` for source-audit compliance | `renderer/js/shell/command-palette.js` |
| `Rga.Resize` (~120 LOC) | Slice 8 §A | Mechanical extraction; Slice 4 §A Layout integration preserved | `renderer/js/shell/resize.js` |
| `Rga.ScriptLanguage` (~100 LOC) | Slice 8 §A | Mechanical extraction; storage-ownership registry updated for `rga-script-lang` | `renderer/js/shell/script-language.js` |
| `Rga.BottomPanel` body (~95 LOC) | Slice 9 §A | Body moved to `Rga.Shell.StudioPanel`; thin 4-method delegating shim retained for engine consumers | `renderer/js/shell/studio-panel.js` |
| `Rga.Inspector` body (~5 LOC) | Slice 9 §A | Body moved to `Rga.Shell.StudioPanel`; thin 2-method delegating shim retained for engine consumer; `open()` method added (was missing pre-Slice-9 — context-menu.js was silently no-op'd) | `renderer/js/shell/studio-panel.js` |
| `Rga.SceneNotesConnector` (~110 LOC) | Slice 9 §A | Deleted (zero callers — init was never wired at boot); behavior folded into `Rga.Shell.StudioPanel._wireSceneNotesConnector` | `renderer/js/shell/studio-panel.js` |

---

## 3. Sequencing

Slice 8 §A landed five mechanical extractions (Toast, Modal,
CommandPalette, Resize, ScriptLanguage). Slice 9 §A consolidated
three more into `Rga.Shell.StudioPanel` (BottomPanel + Inspector +
SceneNotesConnector). What remains in app-shell.js is shim-only
territory:

**Stays in place (single-owner SSOT, fine where it is):**

- `Rga.Theme` (~80 LOC).

**Shim-only, OPEN indefinitely until `editor/*` becomes touchable:**

1. `Rga.Keyboard` (~12 LOC) — delegating shim to KeyboardRegistry;
   engine consumer `editor/page-setup-dialog.js`.
2. `Rga.Sidebar` (~5 LOC) — no-op shim for engine `tags.js`.
3. `Rga.BottomPanel` (~20 LOC after Slice 9) — 4-method delegating
   shim to StudioPanel; engine consumers `annotations.js`,
   `revision-flags.js`.
4. `Rga.Inspector` (~10 LOC after Slice 9) — 2-method delegating
   shim to StudioPanel; engine consumer `context-menu.js`.

All four shims combined cost ~47 LOC. Leaving them in place is
strictly cheaper than negotiating engine-code changes.

**Remaining extraction estimate (Slice 9 §C update):**

| Item | LOC in app-shell.js | Removal slice |
|---|---|---|
| `Rga.Theme` (stays — single-owner SSOT) | ~80 | n/a — RESOLVED, no extraction planned |
| `Rga.Sidebar` shim | 5 | Blocked on `editor/*` / `doc-types/*` touchability |
| `Rga.Keyboard` shim | 12 | Blocked on `editor/*` touchability |
| `Rga.BottomPanel` shim | ~20 | Blocked on `editor/*` / `doc-types/*` touchability |
| `Rga.Inspector` shim | ~10 | Blocked on `editor/*` / `doc-types/*` touchability |

Estimated post-engine-touchability target: **~80 LOC** (Theme only).
Current line count: 201 LOC. Difference vs target: ~120 LOC of
shims, all blocked on the same engine-touchability gate.

---

## 4. Definition of done

`app-shell.js` is "fully extracted" when the file contains only:

- `Rga.Theme` (single-owner, ownership matrix-blessed)
- `Rga.Keyboard` shim (~12 LOC, gated on engine touchability)
- `Rga.Sidebar` shim (~5 LOC, gated on engine touchability)
- one IIFE wrapper

Estimated target line count: **< 100 LOC**. Current line count:
**201 LOC** (down from 1080 pre-Slice 3 §A; -81% so far).

Progress meter: ~81% extracted; the remaining ~120 LOC is all
shim-only territory blocked on engine-code touchability. No further
extraction work is possible without crossing the `editor/*` /
`doc-types/*` line.

Slice 8 §B added the G11 drift guards and Slice 9 §B added the G12
guards so future contributors **cannot re-grow the monolith**:
app-shell.js's allowed top-level modules are a fixed allow-list; a
soft 450-LOC ceiling prevents stealth growth; an explicit deny-list
catches attempted re-insertion of any extracted/deleted module; and
the StudioPanel-delegating shims are pinned shape (G12 prevents
re-implementation drift).

---

## 5. Cross-references

- Ownership matrix — `docs/design-system/rwanga-ownership-matrix.md`
- Compatibility inventory — `docs/rwanga-shell-compatibility-inventory.md`
- Runtime audit — `docs/design-system/rwanga-runtime-audit.md`
- Drift guards (the source-level audit tests preventing regression) —
  `tests/unit/shell/ownership-drift-guards.test.js`

End of roadmap.
