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
| **Sidebar visibility / active panel** | `Rga.Shell.Sidebar` (active panel registry + current id; Slice 5 §B added `_syncLayoutMirror` so `activate(id)` writes `Layout.sidebar.activePanel` for WorkspaceState persistence) + `Rga.Shell.Layout.sidebar` (visibility / width / activePanel mirror, persisted by WorkspaceState since Slice 4 §A) | Same | `Rga.Sidebar` in `app-shell.js:215` — 5-LOC no-op shim. Single engine consumer: `tags.js:206` calls `Rga.Sidebar.switchTo('tags')` (no-op) | Slice when `editor/*` / `doc-types/*` becomes touchable; the engine call should migrate to `Rga.Shell.Sidebar.activate(panelId)` once a real Tags-equivalent panel exists | LOW — shim is pure no-op; engine call has no behavioural side effect today | RESOLVED-WITH-SHIM (Slice 5 §B: runtime SSOT + Layout mirror are now correctly synced; persistence round-trips; the only remaining open piece is the engine-side `Rga.Sidebar.switchTo('tags')` no-op, blocked on editor/*) |
| **StatusBar render + segments** | `Rga.Shell.StatusBar` (`renderer/js/shell/status-bar.js`) — read-only consumer of `Rga.ScriptSession` (scene / page / viewMode), `Rga.ScriptMetrics` (wordCount / currentBlockType — Slice 5 §A), `Rga.TabManager.activeDoc()` (language). The only write is the viewMode click calling `Rga.ViewManager.activate(next)` (documented public API of the SSOT, not state ownership) | Same | None | n/a (resolved) | LOW | RESOLVED (Compatibility Inventory entry #1; Slice 5 §A confirmed read-only-consumer status + introduced ScriptMetrics) |
| **BottomPanel visibility + active tab + persistence** | `Rga.Shell.Layout.studioPanel` (SSOT) + `Rga.BottomPanel` (public mutator API) + `Rga.WorkspaceState` (persistence, Slice 4 §A) | Same — `Rga.BottomPanel` is the legacy public API; persistence moved out to WorkspaceState in Slice 4 §A | `Rga.BottomPanel` (the legacy API) is the documented mutator. Engine plugins `annotations.js` and `revision-flags.js` (off-limits) call `Rga.BottomPanel.switchTo(...)` — preserved by design | Slice 5+ when `Rga.Shell.StudioPanel` is introduced per Compatibility Inventory entry #5 | MEDIUM — engine plugins call the public API; the StudioPanel migration must preserve the `switchTo(tabName)` signature | OPEN — persistence sub-concern RESOLVED in Slice 4 §A |
| **Inspector toggle** | `Rga.Inspector` in `app-shell.js:454` (4-LOC `toggle()` + planned `open()`) | Same | None — the module IS the legacy and only owner; `renderer/js/doc-types/screenplay/plugins/context-menu.js` calls `Rga.Inspector.open()` (off-limits engine consumer) | When inspector gets a real panel implementation (a future "Inspector slice"); the trivial `toggle` lives in a proper inspector module | LOW — 4 LOC, one consumer | OPEN — not blocking; do not move until inspector content lands |
| **CommandPalette** | `Rga.CommandPalette` in `app-shell.js:381` (~190 LOC) | Same | None — singleton owner | Future "command palette slice" should extract this into `renderer/js/shell/command-palette.js`, register commands from each panel via a `Rga.Shell.Commands.register(cmd)` API, and let the palette read the registry instead of being the registry itself | MEDIUM — refactor must preserve the fuzzy-match algorithm + keyboard nav; existing commands re-register at boot | OPEN — extract during "command palette consolidation" slice (TBD) |
| **Modal dialog** | `Rga.Modal` in `app-shell.js:445` (~30 LOC, single `showUnsaved` API) | Same | None | When a second modal surface appears (Discard / Confirm / Pick-One), extract into `renderer/js/shell/modal.js` with a generic `show({title, message, choices}) → Promise` API | LOW — 30 LOC, one consumer (`Rga.FileManager`) | OPEN — defer until second modal needed |
| **Toast notifications** | `Rga.Toast` in `app-shell.js:485` (~55 LOC) | Same | None | Extract into `renderer/js/shell/toast.js` during "shell UI primitives" slice; current shape (`Rga.Toast.show(msg, type, duration)`) is fine — extract as-is | LOW — small, self-contained, no DOM dependency beyond `body` | OPEN — defer; works fine where it is |
| **Resize handles** | `Rga.Resize` in `app-shell.js:64` (~70 LOC, sidebar/inspector/bottom-panel drag handlers) | Same | None — owns drag mechanics + CSS-variable writes for `--sidebar-width` / `--inspector-width` / `--bottom-panel-height` | Extract into `renderer/js/shell/resize.js` alongside any Layout-width persistence work (Slice 4 territory) | LOW — pure DOM event-driven, no state ownership | OPEN — defer to Slice 4 |
| **SceneNotesConnector** (cursor scene → bottom-panel notes textarea) | `Rga.SceneNotesConnector` in `app-shell.js:537` (~115 LOC) | Same | None — single owner of the per-scene notes textarea wiring | Could move into `renderer/js/shell/panels/notes-connector.js` when Bottom Panel migrates to `Rga.Shell.StudioPanel` (Slice 4+) | MEDIUM — listens to `selectionchange` and walks editor DOM; coupling to legacy editor DOM structure means it must follow the BottomPanel migration | OPEN — bundled with the Studio Panel migration |
| **ScriptLanguage** (per-script writing language + direction) | `Rga.ScriptLanguage` in `app-shell.js:644` (~115 LOC) | Same | None | A potential future "Script Settings" slice should pull this into `renderer/js/shell/script-language.js`. Persists to `rga-script-lang` per the ownership matrix §2 | LOW — clean module; LTR/RTL switch + status-bar button binding | OPEN — defer until a "Script Settings" slice opens |

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

---

## 3. Sequencing

The roadmap rows are **independent** — each can be extracted on its
own schedule. The recommended order:

1. **Inspector extraction** (when inspector real content lands).
2. **CommandPalette extraction** (when a `Rga.Shell.Commands` registry
   is wanted for panel-contributed commands).
3. **Modal extraction** (when a second modal surface is needed).
4. **Toast extraction** (low-priority; works fine where it is).
5. **Resize extraction** (bundled with Slice 4 workspace persistence).
6. **SceneNotesConnector extraction** (bundled with the
   `Rga.Shell.StudioPanel` migration, Slice 4+).
7. **ScriptLanguage extraction** (when a "Script Settings" slice opens).

Two rows are **shim-only** and stay open indefinitely until `editor/*`
becomes touchable:

- `Rga.Keyboard` (delegates to KeyboardRegistry)
- `Rga.Sidebar` (no-op shim)

These cost 12 + 5 = **17 LOC** combined. Leaving them in place is
strictly cheaper than negotiating an engine-code change.

---

## 4. Definition of done

`app-shell.js` is "fully extracted" when the file contains only:

- `Rga.Theme` (single-owner, ownership matrix-blessed)
- `Rga.Keyboard` shim (~12 LOC, gated on engine touchability)
- `Rga.Sidebar` shim (~5 LOC, gated on engine touchability)
- one IIFE wrapper

Estimated target line count: **< 100 LOC**. Current line count:
**829 LOC** (down from 1080 pre-Slice 3 §A).

Progress meter: ~25% extracted; ~75% to go across 7 extraction slices.

---

## 5. Cross-references

- Ownership matrix — `docs/design-system/rwanga-ownership-matrix.md`
- Compatibility inventory — `docs/rwanga-shell-compatibility-inventory.md`
- Runtime audit — `docs/design-system/rwanga-runtime-audit.md`
- Drift guards (the source-level audit tests preventing regression) —
  `tests/unit/shell/ownership-drift-guards.test.js`

End of roadmap.
