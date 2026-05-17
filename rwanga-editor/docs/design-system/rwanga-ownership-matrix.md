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
| **Sidebar** (which panel + visible) | `Rga.Shell.Sidebar` (active panel) + `Rga.Shell.Layout.sidebar` (visibility, width) | Same — design is intentional; Sidebar owns the registry + active selection, Layout owns geometry/visibility | Legacy `Rga.Sidebar` reduced to 5-LOC no-op shim (kept only for the engine-side `tags.js:206` call) | Slice 3 (when Characters panel + Breakdown tab subsume the legacy tags concept; see Compatibility Inventory entry #2) | `Rga.Shell.Sidebar.current()` for active panel id; `Rga.Shell.Layout.get().sidebar` for visible/width/activePanel mirror |
| **BottomPanel** (visibility + active tab) | `Rga.Shell.Layout.studioPanel` is the SSOT; `Rga.BottomPanel` is the public mutator API | Future `Rga.Shell.StudioPanel` (per master plan §7); the legacy `Rga.BottomPanel` retires when that ships | Legacy `Rga.BottomPanel` kept as the public API; all writes converge through it; engine plugins (`annotations.js`, `revision-flags.js`) call `Rga.BottomPanel.switchTo(...)` and continue working | Slice 3 (when `Rga.Shell.StudioPanel` is introduced; Compatibility Inventory entry #5) | `Rga.Shell.Layout.get().studioPanel.visible` for visibility; `Rga.BottomPanel.activeTab` for active tab (planned to migrate to `Layout.studioPanel.activeTab` in Slice 3) |
| **StatusBar** (segment contents + rendering) | `Rga.Shell.StatusBar` (renderer) reads from `Rga.ScriptSession` (writer-context) + `Rga.TabManager.activeDoc()` (language). Visibility flag in `Rga.Shell.Layout.statusBar` (currently always true) | Same — Slice 2 introduced this division and it has held | Legacy `Rga.StatusBar` was retired in Slice 2; no shim remains | RESOLVED (Slice 2, inventory entry #1) | `Rga.ScriptSession.get()` for the writer-context fields the bar displays; `Rga.Shell.Layout.get().statusBar` for visibility |
| **Keyboard** (shortcuts dispatch) | TWO listeners coexist: `Rga.Keyboard` (registry-based, on `document.keydown`) + `Rga.Shell.init`'s `_onKeydown` (combo-based, on `document.keydown`). Both run on bubble phase | Single keyboard registry owning all app shortcuts. Likely `Rga.Shell.Keyboard` consolidating both | Both listeners coexist now; each handles its own subset (Rga.Keyboard for app-shell, Shell.init for sidebar/studio toggles) | TBD — currently UN-OWNED for unification; see [open issue](#open-issues) | NONE — this is the matrix's one **inconsistency** today; each registration is the source of truth for its own combo, but there is no central registry. Adding a new shortcut requires picking the right registrar |
| **Theme** (dark / light mode) | `Rga.Theme` (current + apply + toggle). Persists to `localStorage['rga-theme']` | Same — Theme is intentionally simple | None — Theme has been single-owner since inception | n/a (no removal scheduled) | `Rga.Theme.current` (in-memory) mirrored to `localStorage['rga-theme']` (persistence) |
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
| `rga-shell-studio-panel-visible` | `Rga.BottomPanel._writePersistedVisibility` | bottom panel visibility (Ownership Stab. Slice 1) |

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

### OI-1 — Keyboard consolidation

The Keyboard row in §1 is the only entry with `SSOT: NONE`. Two
listeners (`Rga.Keyboard._handle` and `Rga.Shell._onKeydown`) both
attach to `document.keydown` on bubble phase. They handle different
combo sets and don't collide today, but:

- New shortcuts must guess which registrar to use.
- ProseMirror's keymap can shadow either (Ctrl+J shadowing observed
  in some Electron builds — V1.1 fix 6 added Cmd+\` as an alternate).
- No central place lists every registered shortcut for documentation
  or palette generation.

A future "Keyboard consolidation" slice should unify both into a
single `Rga.Shell.Keyboard` with a documented registration API. Until
then, prefer `Rga.Shell._onKeydown` for sidebar-style shortcuts and
`Rga.Keyboard.register` for everything else; document the choice in
the slice plan.

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
