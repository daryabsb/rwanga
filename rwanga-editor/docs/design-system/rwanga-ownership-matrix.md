# Rwanga — Ownership Matrix

Created: 2026-05-17 (Runtime Ownership Stabilization Slice 1)  
Status: living document — append entries as new shell surfaces appear;
audit on every slice that crosses ownership lines.

---

## Purpose

This matrix is the **canonical source of truth** for who owns what
piece of mutable runtime state in the Rwanga renderer. Multiple
historical layers (legacy `Rga.*` modules, Slice 1 shell modules,
engine plugins) have coexisted long enough that some concerns
acquired two or three writers without anyone being declared the
owner. The matrix forces an explicit answer for every shell concern
so future contributors can find the right place to write — without
re-investigating from scratch each time.

**Rule:** every row's **Single source of truth (SSOT)** column names
exactly one storage location. If two locations are listed, the row
is broken and must be flagged (see §4).

---

## 1. Matrix

| Concern | Current owner | Future owner | Temporary adapter | Removal slice | Single source of truth |
|---|---|---|---|---|---|
| **Sidebar** (which panel + visible) | `Rga.Shell.Sidebar` (active panel registry + runtime SSOT) + `Rga.Shell.Layout.sidebar` (visibility, width, persisted activePanel mirror — Slice 5 §B made `Sidebar.activate` write this mirror so WorkspaceState persists user choices) | Same — design is intentional; Sidebar owns the registry + active selection, Layout owns geometry/visibility/persisted mirror | Legacy `Rga.Sidebar` reduced to 5-LOC no-op shim (kept only for the engine-side `tags.js:206` call) | Slice when `editor/*` / `doc-types/*` becomes touchable; see Compatibility Inventory entry #2 | `Rga.Shell.Sidebar.current()` for runtime active panel id; `Rga.Shell.Layout.get().sidebar.activePanel` for the persisted mirror (kept in sync by `Sidebar._syncLayoutMirror` post-Slice-5 §B) |
| **BottomPanel** (visibility + active tab) | `Rga.Shell.Layout.studioPanel` is the SSOT; `Rga.BottomPanel` is the public mutator API | Future `Rga.Shell.StudioPanel` (per master plan §7); the legacy `Rga.BottomPanel` retires when that ships | Legacy `Rga.BottomPanel` kept as the public API; all writes converge through it; engine plugins (`annotations.js`, `revision-flags.js`) call `Rga.BottomPanel.switchTo(...)` and continue working | Slice 3 (when `Rga.Shell.StudioPanel` is introduced; Compatibility Inventory entry #5) | `Rga.Shell.Layout.get().studioPanel.visible` for visibility; `Rga.BottomPanel.activeTab` for active tab (planned to migrate to `Layout.studioPanel.activeTab` in Slice 3) |
| **StatusBar** (segment contents + rendering) | `Rga.Shell.StatusBar` (renderer) reads from `Rga.ScriptSession` (writer-context) + `Rga.TabManager.activeDoc()` (language). Visibility flag in `Rga.Shell.Layout.statusBar` (currently always true) | Same — Slice 2 introduced this division and it has held | Legacy `Rga.StatusBar` was retired in Slice 2; no shim remains | RESOLVED (Slice 2, inventory entry #1) | `Rga.ScriptSession.get()` for the writer-context fields the bar displays; `Rga.Shell.Layout.get().statusBar` for visibility |
| **Keyboard** (shortcuts dispatch) | **`Rga.KeyboardRegistry`** is the SSOT (Runtime Ownership Stab. Slice 2 §A). Single document.keydown listener. The legacy `Rga.Keyboard.register` is preserved as a thin shim that delegates to the registry, so engine consumers (notably `renderer/js/editor/page-setup-dialog.js`, off-limits) keep working unchanged. `Rga.Shell._onKeydown` was retired; shell shortcuts now call `Rga.KeyboardRegistry.register(...)` directly with a `source` label for audit | Same — `Rga.KeyboardRegistry` is the long-term home. A future slice may rename the legacy shim or remove it once `editor/page-setup-dialog.js` is touchable | `Rga.Keyboard` legacy shim — delegates `.register()` to the registry. Removable when nothing in `renderer/js/editor/*` calls it (off-limits this slice) | TBD — gated on `editor/*` becoming touchable; minor (~10 LOC) | **`Rga.KeyboardRegistry`** owns the single combo→handler map. Combos are normalised to canonical strings (`cmd+shift+p` / `escape` / `cmd+\``). Last-wins per combo; duplicates emit a `console.warn` for the audit trail (the no-duplicate-bindings guard test asserts zero duplicates at boot) |
| **Theme** (dark / light mode) | `Rga.Theme` — owns active theme + apply + toggle + **`onChange(fn)` event emitter** (Runtime Ownership Stab. Slice 2 §B). Persists to `localStorage['rga-theme']`; init reads it back. Source-audit guard test asserts no other file in `renderer/js/*` writes `data-theme` or `rga-theme` | Same — Theme is intentionally simple. The onChange surface is the extension point for future consumers (status-bar swatch, syntax-highlight switch, etc.) without anyone bypassing the SSOT | None — Theme has been single-owner since inception; Slice 2 added the missing event-emitter capability | n/a | `Rga.Theme.current` (in-memory) is the SSOT; mirrored to `localStorage['rga-theme']` (persistence). Subscribe via `Rga.Theme.onChange(fn) → unsubscribe` |
| **ViewManager** (Flow / Print / PrintPreview / Draft view mode) | `Rga.ViewManager` is the SSOT for active view id + body class side-effect. `Rga.ViewMode` is a user-facing UX layer (persistence + Esc-exits-Draft + previous-mode memory) that **reacts** to ViewManager via `onChange` | Same — Phase 7 correction made this division explicit; status-bar bypass works because ViewMode mirrors ViewManager state | None — the status-bar viewMode segment calling `Rga.ViewManager.activate(next)` directly is the documented bypass; ViewMode catches up via `onChange` (V1.1 fix 3) | n/a (no removal scheduled) | `Rga.ViewManager.current()` (in-memory) is the SSOT; `localStorage['rga-view-mode']` (persistence, owned by `Rga.ViewMode._persist`) |
| **Scene Navigator** (current scene mark + selected row + click-to-navigate) | Two visual marks, two SSOTs:<br>• `Rga.Shell.SceneNavigator.row-current` reflects the editor cursor — sourced from `Rga.ScriptSession.currentScene.nodeId`<br>• `Rga.Shell.SceneNavigator.row-selected` reflects keyboard focus — sourced from the panel's internal `_selectedNodeId` | Same — separation is intentional (the "separation invariant"); a future slice may surface `_selectedNodeId` if other panels need it | None — the separation is the design | n/a (no removal scheduled) | `Rga.ScriptSession.get().currentScene.nodeId` for cursor-following highlight; `Rga.Shell.SceneNavigator._selectedNodeId` (panel-private) for keyboard focus |

---

## 2. Inferred conventions

These conventions emerge from the table; new rows should follow them.

1. **SSOT lives where state is stored, not where the API surface is.**
   `BottomPanel.toggleCollapse` is the API; `Layout.studioPanel.visible`
   is the SSOT. Reading the API for the value is a convenience; writes
   must reach the SSOT.
2. **Public mutators are singular per concern.** Multiple read sites
   are fine; multiple write sites are a bug. The Bottom Panel's
   `toggleCollapse` consolidation in Runtime Ownership Stab. Slice 1
   removed Cmd+\`'s direct Layout.set in favour of routing through
   `Rga.BottomPanel.toggleCollapse`.
3. **Reactor layers are explicit.** When a UX layer reacts to a SSOT
   change (e.g. `Rga.ViewMode` reacting to `ViewManager.onChange`),
   the relationship is documented as `Future owner: Same` plus a note
   in the comment, not as a duplicate ownership.
4. **Persistence is named and scoped.** Each localStorage key is owned
   by exactly one module. Slice 4 (workspace persistence) will
   consolidate them; until then each row that persists names its key.

Current persistence keys:

| Key | Owner | Scope |
|---|---|---|
| `rga-theme` | `Rga.Theme` | dark/light mode |
| `rga-view-mode` | `Rga.ViewMode._persist` | flow/print/draft |
| `rga-script-lang` | `Rga.ScriptLanguage` | per-app script writing language |
| `rga-session-tabs` | `Rga.TabManager._saveSession` | open tabs across reload |
| `rga-workspace-layout` | `Rga.WorkspaceState._save` | full Layout blob — sidebar / studioPanel / inspector / titleBar / statusBar (Slice 4 §A; supersedes the scoped `rga-shell-studio-panel-visible` from Slice 1) |

Canonical per-key reference is now
`docs/design-system/rwanga-storage-ownership.md` (Slice 4 §B), with
the G4–G7 drift guards enforcing the registry at CI time.

---

## 3. Audit protocol

When a slice plan touches state owned by anything in §1, the slice
plan **must**:

1. Identify which row(s) the slice mutates.
2. If a new public mutator is needed, justify why the existing one is
   insufficient — and either extend the existing API or rename it.
3. Update this matrix in the same PR that ships the change.

When a new shell concern is introduced (e.g. Studio Panel arrives
in Slice 3), add a row before the implementation lands. Don't
backfill — the row's existence proves the concern was thought
through.

---

## 4. Open issues

### OI-1 — Keyboard consolidation — **RESOLVED 2026-05-17 (Runtime Ownership Stab. Slice 2 §A)**

**Resolution.** `Rga.KeyboardRegistry` was introduced as the single
keyboard SSOT. All three pre-existing document-level keydown listeners
were migrated into it:

| Listener | Pre-Slice-2 location | Post-Slice-2 destination |
|---|---|---|
| Legacy `Rga.Keyboard` | `app-shell.js:318` — own listener + `_shortcuts` map | Shim — `Rga.Keyboard.register` delegates to `Rga.KeyboardRegistry.register`; `init()` just ensures the registry's listener is attached. The shim exists so off-limits engine consumers (notably `renderer/js/editor/page-setup-dialog.js`) keep working unchanged. |
| Shell `_onKeydown` | `shell/index.js:100` — own listener + combo-string matcher | Each combo registered individually via `Rga.KeyboardRegistry.register(key, opts, handler, source)` with an explicit `source` label. Dead `_comboString` helper removed. |
| `view-mode.js` Escape | `view-mode.js:147` — own listener with `if (current === 'draft')` gate | `Rga.KeyboardRegistry.register('escape', { when: () => current === 'draft' }, ...)` — the gate moves into the registry binding's `when` predicate. |

**Migration notes.**

- Two duplicate registrations were caught and removed during the
  migration: `Ctrl+J` was registered both in the boot `registerShortcuts()`
  and again in `BottomPanel.init`; `Ctrl+B` was registered both via
  `Rga.Keyboard` (boot) and via `Rga.Shell._onKeydown` (`cmd+b`). Both
  pairs called identical handlers, so behaviour is unchanged; the
  ownership matrix is cleaner.
- The registry's last-wins-per-combo policy is paired with a
  `console.warn` the first time a duplicate appears. The visual-stab
  guard `A: no source-level Ctrl+J or Ctrl+B duplicates` enforces this
  at build time.
- `editor/page-setup-dialog.js` (Ctrl+Shift+G) is off-limits this
  slice and continues to call `Rga.Keyboard.register`. The shim
  forwards it to the registry transparently. When `editor/*` is
  touchable, that consumer can migrate to a direct registry call and
  the shim can be deleted (see the matrix's Removal-Slice column).

### OI-2 — Theme — **RESOLVED 2026-05-17 (Runtime Ownership Stab. Slice 2 §B)**

**Resolution.** `Rga.Theme` was already single-owner; the slice added
the missing `onChange(fn) → unsubscribe` event surface so consumers can
react to theme flips without polling `data-theme` or `localStorage`.

**Migration notes.**

- `apply()` now snapshots subscribers before dispatch so an unsubscribe
  during iteration doesn't skip later listeners.
- Same-theme `apply()` is a no-op for subscribers (idempotent).
- Unknown theme strings are rejected (defensive).
- `localStorage` reads/writes wrapped in `try/catch` so private-mode /
  quota errors don't crash boot.
- A source-audit guard test enforces that **only** `renderer/js/app-shell.js`
  writes `data-theme` or `rga-theme`; any future module that tries
  to mutate the theme will fail the guard.

### OI-3 — Layout-wide persistence — **RESOLVED 2026-05-17 (Runtime Ownership Stab. Slice 4 §A)**

**Resolution.** `Rga.WorkspaceState`
(`renderer/js/shell/workspace-state.js`) was introduced as the single
owner of layout persistence. It writes `Rga.Shell.Layout.toJSON()` to
the single localStorage key `rga-workspace-layout` on every Layout
change, and reads it back on boot via `Layout.fromJSON`.

**Migration notes.**

- The Slice-1 scoped key `rga-shell-studio-panel-visible` was migrated
  in one shot: WorkspaceState reads it on first boot, folds the value
  into the workspace blob via `studioPanel.visible`, then
  `localStorage.removeItem`s the scoped key. The legacy key is logged
  in `LEGACY_KEYS` of the drift guards so G6 recognises it as
  known-but-deprecated; G4 fails any future write attempt.
- `Layout.DEFAULTS.studioPanel.visible` flipped false → true to match
  the long-standing UX where a fresh install boots with the bottom
  panel visible. WorkspaceState restores user-explicit closes.
- A new `inspector` zone was added to Layout DEFAULTS (`{visible:true,
  width:280}`) so `Rga.Resize`'s inspector-handle drag has a Layout
  field to commit to.
- `Rga.Resize` now writes drag-end sizes to Layout (`sidebar.width`,
  `inspector.width`, `studioPanel.height`) and subscribes to Layout
  to push values back into the corresponding CSS variables. Drag
  mid-move still writes the CSS variable directly for live feel;
  Layout (and therefore persistence) is committed only on drag-end.
- `Rga.BottomPanel`'s scoped persistence helpers (`_STORAGE_KEY`,
  `_readPersistedVisibility`, `_writePersistedVisibility`) were
  deleted. BottomPanel.init() now only syncs the DOM from Layout
  and subscribes for future changes.

**Acceptance.** Close → reopen → state restored for all four
zones (sidebar visibility + width + activePanel; studioPanel
visibility + height + activeTab; inspector visibility + width;
title bar + status bar visibility). Behavioural tests in
`tests/unit/shell/ownership-stab-slice4.test.js` cover the round
trip via two-session simulation.

*(Renumbered from OI-2 after Slice 2 closed both Keyboard and Theme.)*

### OI-2 — Layout-wide persistence (Slice 4)

`Rga.Shell.Layout.toJSON / fromJSON` exist but are not wired to
localStorage. Slice 4 is supposed to handle workspace persistence
end-to-end. Until then, individual rows that need persist-across-
reload behaviour add their own scoped localStorage keys (see
`rga-shell-studio-panel-visible`). When Slice 4 lands, those scoped
keys should migrate into a single workspace blob.

---

## 5. Cross-references

- Bottom Panel removal plan — Compatibility Inventory entry #5
- Legacy Sidebar shim — Compatibility Inventory entry #2 (BLOCKED)
- StatusBar legacy removal — Compatibility Inventory entry #1 (RESOLVED)
- ScriptSession analytics misplacement → ScriptMetrics — Compatibility
  Inventory entry #6
- Activity Rail icon family / spacing / four-state model —
  `docs/rwanga-activity-rail-doctrine.md` (LOCKED 2026-05-17)
- V1.1 runtime UX fixes that motivated the matrix —
  `docs/rwanga-visual-stabilization-v1-1-open-decisions.md`

End of matrix.
