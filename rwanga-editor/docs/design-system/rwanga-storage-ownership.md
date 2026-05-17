# Rwanga — Storage Ownership

Created: 2026-05-17 (Runtime Ownership Stabilization Slice 4 §B)  
Status: living document — every new localStorage key must land here
in the same PR that introduces it; the G4–G7 drift guards in
`tests/unit/shell/ownership-drift-guards.test.js` enforce the registry
at CI time.

---

## Purpose

This doc is the canonical list of every `localStorage` key the
renderer touches, along with the single module that owns it. A "key"
here means a string passed to any `localStorage.setItem`,
`localStorage.getItem`, or `localStorage.removeItem` call in
`renderer/js/` (excluding the off-limits paths `editor/`,
`framework/`, `doc-types/`).

**Rule:** every key in §1 has **exactly one** writer module. Multiple
read sites are fine; multiple write sites are a bug. The G5 drift
guard enforces this at CI.

When a slice introduces a new key, the slice plan must:

1. Pick a single owner module (named in the slice plan).
2. Add a row to §1 with all six columns filled.
3. Add a row to the runtime-audit's §1 Persistence row.
4. Add the key to `STORAGE_OWNERS` in
   `tests/unit/shell/ownership-drift-guards.test.js`.

When a slice retires a key, move its row to §2 (legacy keys) with
migration metadata and update the drift guards' `LEGACY_KEYS` table.

---

## 1. Active keys (one owner each)

| Storage key | Owner | Consumers | Lifetime | Restore path | Migration notes |
|---|---|---|---|---|---|
| `rga-theme` | `Rga.Theme` in `renderer/js/app-shell.js` | DOM (via the `data-theme` attribute on `<html>`); `Rga.Theme.onChange(fn)` subscribers (currently none in production; future status-bar swatch / syntax-highlight switch / etc.). | Per-app preference; survives reloads forever. | `Rga.Theme.init()` reads on boot; falls back to `'dark'` if unset. | Single owner since Phase 0; G4 source-audit guard enforces sole writer. No migration history. |
| `rga-view-mode` | `Rga.ViewMode` in `renderer/js/view-mode.js` (`_persist` helper) | `Rga.ViewMode.get()` (status bar mode segment, status-bar viewMode cycle, command palette "View as …" entries, `Rga.ViewManager` consumers via the ViewMode→ViewManager sync) | Per-app preference (which view mode you last used). | `Rga.ViewMode._load()` reads on init; defaults to `'flow'`. | Single owner since the Phase 7 ViewManager correction. |
| `rga-script-lang` | `Rga.ScriptLanguage` in `renderer/js/app-shell.js` (`init` + `apply`) | DOM (editor element `dir` + `font-family`); `Rga.ScriptLanguage.current`. | Per-app preference (which writing language the editor surface uses). | `Rga.ScriptLanguage.init()` reads on boot; defaults to `'en'`. | Per-app, not per-script. The per-script language is part of the doc metadata (`metadata.screenplayProfile.language`) and is owned by the document, not localStorage. |
| `rga-session-tabs` | `Rga.TabManager` in `renderer/js/tab-manager.js` (`_saveSession`) | `Rga.TabManager.bootSession()` reads on boot to restore the previous session's open tabs; no other reader. | Per-app session state; survives reloads but ephemeral relative to user intent. | `Rga.TabManager.bootSession()` reads + dispatches IPC reads via `window.rwanga.files.read`. Falls back to a fresh `Untitled.rga` if no session or all reads fail. | Single owner since session-restore landed (pre-Slice-1). G4 read-side guard restricts reads to `tab-manager.js` only. |
| `rga-workspace-layout` | `Rga.WorkspaceState` in `renderer/js/shell/workspace-state.js` (`_save`) | `Rga.Shell.Layout` is the in-memory consumer (hydrated via `Layout.fromJSON` on boot). Downstream readers of Layout (`Rga.BottomPanel`, `Rga.Resize`, `Rga.Shell.Sidebar`, `Rga.Shell.StatusBar`, future Studio Panel) consume the rehydrated values. | Per-workspace UI state; survives reloads. | `Rga.WorkspaceState.init()` reads on boot, calls `Rga.Shell.Layout.fromJSON(blob)`. Falls back to legacy migration (see §2) then to Layout DEFAULTS. | New in Slice 4 §A. The legacy `rga-shell-studio-panel-visible` value is one-shot-migrated into this blob on first boot after the slice ships. |

---

## 2. Legacy keys (read-only during migration; never re-written)

| Key | Migrated to | Migration slice | Migration shape |
|---|---|---|---|
| `rga-shell-studio-panel-visible` | `rga-workspace-layout` (specifically `studioPanel.visible`) | Runtime Ownership Stab. Slice 4 §A | `Rga.WorkspaceState._readLegacy()` reads the scoped key (`'1'`/`'0'`/`'true'`/`'false'`), converts to a `studioPanel.visible` boolean, folds into the workspace blob via deep-merge, then `localStorage.removeItem(...)`s the scoped key. One-shot per install. |

Legacy keys must not appear in the `STORAGE_OWNERS` registry. They
live in `LEGACY_KEYS` so the G6 guard knows they're "known-but-
deprecated" rather than "truly unknown". Writing to a legacy key
fails G4 with a clear migration-pointer message.

---

## 3. Audit protocol

A storage-key change must touch four places **in the same PR**:

1. The owner module (the only place that calls `setItem(key, …)`).
2. This doc (§1 row for new keys, §2 row for retiring keys).
3. The runtime audit
   (`docs/design-system/rwanga-runtime-audit.md`) — every row that
   names a persistence key must agree with this doc.
4. The drift guards' `STORAGE_OWNERS` / `LEGACY_KEYS` registries in
   `tests/unit/shell/ownership-drift-guards.test.js`.

If any of the four is missed, the G4 / G5 / G6 / G7 guards will fail
at CI with a precise message pointing at the missing piece.

---

## 4. Slice 4 §C drift guards (CI enforcement)

The four guards that enforce this doc at build time:

| Guard | What it asserts |
|---|---|
| **G4** | Every `localStorage.setItem('<key>', ...)` call's `<key>` is in `STORAGE_OWNERS`, and the calling module is in the key's `writers` list. Writes to `LEGACY_KEYS` fail with a "migrated to X in slice Y" message. |
| **G5** | Every key in `STORAGE_OWNERS` declares exactly one writer (the registry itself cannot quietly fan out). |
| **G6** | Every key touched by a `localStorage.{get,set,remove}Item` call is either in `STORAGE_OWNERS` or in `LEGACY_KEYS`. Unregistered keys fail with an "add it to the storage-ownership doc" message. |
| **G7** | Every owned key has a corresponding restore path: the declared `restoreIn` module contains the key literal AND at least one `localStorage.getItem(...)` call. |

Plus the existing G4 read-side restriction (`rga-session-tabs` and
`rga-workspace-layout` reads must come from their owners).

---

## 5. Cross-references

- Ownership matrix — `docs/design-system/rwanga-ownership-matrix.md`
  §2 Persistence keys index.
- Runtime audit — `docs/design-system/rwanga-runtime-audit.md`
  per-row Persistence fields.
- Legacy extraction roadmap —
  `docs/design-system/rwanga-legacy-extraction-roadmap.md`.
- Drift guards — `tests/unit/shell/ownership-drift-guards.test.js`.

End of doc.
