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
| **BottomPanel visibility + active tab + persistence** | `Rga.Shell.Layout.studioPanel` (SSOT) + `Rga.BottomPanel` (public mutator API) + `Rga.WorkspaceState` (persistence, Slice 4 §A) | Same — `Rga.BottomPanel` is the legacy public API; persistence moved out to WorkspaceState in Slice 4 §A | `Rga.BottomPanel` (the legacy API) is the documented mutator. Engine plugins `annotations.js` and `revision-flags.js` (off-limits) call `Rga.BottomPanel.switchTo(...)` — preserved by design | Slice 5+ when `Rga.Shell.StudioPanel` is introduced per Compatibility Inventory entry #5 | MEDIUM — engine plugins call the public API; the StudioPanel migration must preserve the `switchTo(tabName)` signature | OPEN — persistence sub-concern RESOLVED in Slice 4 §A |
| **Inspector toggle** | `Rga.Inspector` in `app-shell.js:454` (4-LOC `toggle()` + planned `open()`) | Same | None — the module IS the legacy and only owner; `renderer/js/doc-types/screenplay/plugins/context-menu.js` calls `Rga.Inspector.open()` (off-limits engine consumer) | When inspector gets a real panel implementation (a future "Inspector slice"); the trivial `toggle` lives in a proper inspector module | LOW — 4 LOC, one consumer | OPEN — not blocking; do not move until inspector content lands |
| **CommandPalette** | `Rga.CommandPalette` (`renderer/js/shell/command-palette.js`) — extracted in Slice 8 §A. Same public API; backdrop-click handler uses `matches()` instead of `classList.contains` so it passes source audit (b) | Same | None | A future "command palette consolidation" slice may refactor to a `Rga.Shell.Commands.register(cmd)` registry pattern where each panel contributes commands at boot, but the file itself is extracted and well-placed | LOW post-extraction — no engine consumers; existing init-script callers unchanged | RESOLVED (Slice 8 §A) |
| **Modal dialog** | `Rga.Modal` (`renderer/js/shell/modal.js`) — extracted in Slice 8 §A. Same single API (`showUnsaved`) | Same | None | When a second modal surface appears (Discard / Confirm / Pick-One), grow the API to a generic `show({title, message, choices}) → Promise` shape — no file move needed | LOW — single consumer (`Rga.TabManager`); 30 LOC | RESOLVED (Slice 8 §A) |
| **Toast notifications** | `Rga.Toast` (`renderer/js/shell/toast.js`) — extracted in Slice 8 §A. Same `show(msg, type, duration)` API | Same | None | None | LOW — small, self-contained | RESOLVED (Slice 8 §A) |
| **Resize handles** | `Rga.Resize` (`renderer/js/shell/resize.js`) — extracted in Slice 8 §A. Slice 4 §A Layout-commit-on-drag-end + Layout-driven CSS-var sync architecture preserved exactly | Same | None | None | LOW — pure DOM event-driven; the Layout writer surface is already guarded by G2 | RESOLVED (Slice 8 §A) |
| **SceneNotesConnector** (cursor scene → bottom-panel notes textarea) | `Rga.SceneNotesConnector` in `app-shell.js` (~115 LOC) | Same — extraction deferred | None — single owner of the per-scene notes textarea wiring | `renderer/js/shell/panels/notes-connector.js` when Bottom Panel migrates to `Rga.Shell.StudioPanel` (Compatibility Inventory entry #5) | MEDIUM — listens to `selectionchange` and walks editor DOM; coupling to legacy editor DOM structure means it must follow the BottomPanel migration | OPEN — bundled with the Studio Panel migration |
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

---

## 3. Sequencing

Slice 8 §A landed five mechanical extractions at once (Toast, Modal,
CommandPalette, Resize, ScriptLanguage). The remaining work splits
into three buckets:

**Bucket A — bundled with the StudioPanel migration:**

1. **SceneNotesConnector extraction** — moves to
   `renderer/js/shell/panels/notes-connector.js` when the Bottom Panel
   becomes `Rga.Shell.StudioPanel` (Compatibility Inventory entry #5).

**Bucket B — engine consumers; extract behind shims:**

2. **BottomPanel extraction** — engine plugins (`annotations.js`,
   `revision-flags.js`) call `Rga.BottomPanel.switchTo(...)`. Can be
   extracted as a normal IIFE that sets the same global; same
   pattern Slice 8 §A used. Currently bundled with the StudioPanel
   migration.
3. **Inspector extraction** — engine plugin `context-menu.js` calls
   `Rga.Inspector.open()`. Trivial today (4 LOC `toggle()`); extract
   when inspector gets real content. Same global-preservation pattern.

**Bucket C — shim-only, OPEN indefinitely:**

4. `Rga.Keyboard` (12-LOC delegating shim to KeyboardRegistry).
5. `Rga.Sidebar` (5-LOC no-op shim for engine `tags.js`).

Both shims stay until `editor/*` becomes touchable.

**Remaining extraction estimate** (Slice 8 §C):

| Item | LOC in app-shell.js | Removal slice |
|---|---|---|
| SceneNotesConnector | ~110 | Bundled with StudioPanel migration |
| BottomPanel | ~100 | Bundled with StudioPanel migration |
| Inspector | ~5 | Future "Inspector slice" |
| Theme (stays — single-owner SSOT, fine where it is) | ~80 | n/a — RESOLVED, no extraction planned |
| Sidebar shim | 5 | Blocked on editor/* |
| Keyboard shim | 12 | Blocked on editor/* |

Estimated post-StudioPanel-slice app-shell.js: ~100 LOC (just Theme +
two shims). Estimated post-engine-touchability: ~80 LOC (just Theme).

---

## 4. Definition of done

`app-shell.js` is "fully extracted" when the file contains only:

- `Rga.Theme` (single-owner, ownership matrix-blessed)
- `Rga.Keyboard` shim (~12 LOC, gated on engine touchability)
- `Rga.Sidebar` shim (~5 LOC, gated on engine touchability)
- one IIFE wrapper

Estimated target line count: **< 100 LOC**. Current line count:
**397 LOC** (down from 1080 pre-Slice 3 §A; -64% so far).

Progress meter: ~64% extracted; ~36% remaining (almost entirely
SceneNotesConnector + BottomPanel + Inspector, all gated on the
future StudioPanel migration).

Slice 8 §B added the G11 drift guards so future contributors
**cannot re-grow the monolith**: app-shell.js's allowed top-level
modules are now a fixed allow-list; a soft 450-LOC ceiling prevents
stealth growth; an explicit deny-list catches attempted re-insertion
of any extracted/deleted module.

---

## 5. Cross-references

- Ownership matrix — `docs/design-system/rwanga-ownership-matrix.md`
- Compatibility inventory — `docs/rwanga-shell-compatibility-inventory.md`
- Runtime audit — `docs/design-system/rwanga-runtime-audit.md`
- Drift guards (the source-level audit tests preventing regression) —
  `tests/unit/shell/ownership-drift-guards.test.js`

End of roadmap.
