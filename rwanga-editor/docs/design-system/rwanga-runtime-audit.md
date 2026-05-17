# Rwanga — Runtime State Audit

Created: 2026-05-17 (Runtime Ownership Stabilization Slice 3 §C)  
Status: living audit — append rows as new runtime state appears;
update on every slice that crosses a row's ownership lines.

---

## Purpose

This audit complements the [ownership matrix](./rwanga-ownership-matrix.md)
by providing a **per-row deep dive**: for each piece of runtime state
in the renderer it records the SSOT, every known consumer, persistence
behaviour, event source, and open risks. Where the ownership matrix
is the at-a-glance "who owns what", this audit is the "what does it
actually look like in practice".

Use this doc when:

- You're about to touch any of the ten audited rows.
- You're debugging a runtime ownership question ("who recomputes the
  current scene?", "what fires when the theme flips?").
- You're planning a slice that needs to know all consumers before
  changing an API.

Each row's `Open risks` column flags things the audit caught that
aren't yet broken but need watching.

---

## 1. Rows

### 1.1 Keyboard

| Field | Value |
|---|---|
| **SSOT** | `Rga.KeyboardRegistry` (`renderer/js/shell/keyboard-registry.js`). Single document-level keydown listener; bindings stored in an in-memory `Map<combo, entry>`. |
| **Consumers** (registrars) | • `index.html` boot script (Ctrl-Shift-P palette, Ctrl-J bottom panel, Ctrl-Shift-T theme, Ctrl-Shift-I inspector, Ctrl-Shift-V view-mode cycle).<br>• `renderer/js/shell/index.js` — Cmd-Shift-{S,E,O,C,F,R} panel toggles, Cmd-, settings, Cmd-B sidebar toggle, Cmd-` studio panel toggle.<br>• `renderer/js/view-mode.js` — `escape` with `when: () => current === 'draft'`.<br>• `renderer/js/editor/page-setup-dialog.js` (engine, off-limits) — Ctrl-Shift-G; calls via the `Rga.Keyboard.register` shim. |
| **Persistence** | None — bindings live in memory and re-register at boot. |
| **Event source** | `document.keydown` (bubble phase). Single listener attached by `Rga.KeyboardRegistry.init()`. |
| **Open risks** | • `editor/page-setup-dialog.js` is the one off-limits consumer that keeps the `Rga.Keyboard` shim alive. When `editor/*` becomes touchable, the shim can be deleted (~10 LOC).<br>• PM keymap plugins handle Tab/Enter/Mod-Enter/Backspace inside the editor. Anyone trying to register one of those combos via the registry will be silently shadowed by PM. Document this in the registration call's `source` label. |

### 1.2 Theme

| Field | Value |
|---|---|
| **SSOT** | `Rga.Theme` in `renderer/js/app-shell.js`. `current` (in-memory) is the truth; mirrored to `localStorage['rga-theme']` for persistence; mirrored to `<html data-theme="...">` for CSS consumption. |
| **Consumers** | • DOM via the `data-theme` attribute — every themed CSS rule keys off it.<br>• `Rga.Theme.onChange(fn)` subscribers — Slice 2 added the event surface; current production subscribers: none yet; future status-bar swatch / syntax-highlight switch / etc. will subscribe here.<br>• `Rga.Toast.show('Switched to … theme', …)` — Theme.toggle's UX side-effect. |
| **Persistence** | `localStorage['rga-theme']` ("dark" \| "light"). Read on `Rga.Theme.init()`; written in `apply()`. Wrapped in try/catch for private-mode safety. |
| **Event source** | `Rga.Theme.apply()` triggers `_notify()` which dispatches to subscribers. The titlebar button + Ctrl-Shift-T shortcut + the command palette "Toggle Theme" entry are the user-facing triggers; all call `Rga.Theme.toggle()`. |
| **Open risks** | • The G4 source-audit guard enforces sole writer status; any new module attempting to mutate `data-theme` or `rga-theme` fails the guard at CI.<br>• `apply()` force-reflows the body (`display: none → reflow → ''`) to evict cached themed styles. This is intentional but expensive; future consumers shouldn't call `apply()` directly — use `toggle()` or set + dispatch. |

### 1.3 StatusBar

| Field | Value |
|---|---|
| **SSOT** | `Rga.Shell.StatusBar` (`renderer/js/shell/status-bar.js`) — owns rendering only. The DATA the bar displays has multiple SSOTs (see Consumers / Event source). |
| **Consumers** | The bar is a SINK, not a source. It reads from:<br>• `Rga.ScriptSession.get()` — scene, page, blockType, wordCount, viewMode.<br>• `Rga.TabManager.activeDoc().metadata.screenplayProfile.language` — language segment.<br>• Click on the viewMode segment calls `Rga.ViewManager.activate(next)` — write-side; the only writer in the bar. |
| **Persistence** | None directly. Persisted state of consumed inputs (active doc, view-mode) is owned by their respective modules. |
| **Event source** | • `Rga.ScriptSession.subscribe(fn)` — full re-render on every snapshot change.<br>• `document.addEventListener('editor.tabActivated', ...)` — language segment refresh on tab switch. |
| **Open risks** | • Two event sources (ScriptSession + `editor.tabActivated`) means a race could fire two renders for the same tab switch. The `_renderLanguage` path is cheap (one segment) so this is acceptable today.<br>• The viewMode segment cycle list `['flow', 'draft', 'printPreview']` includes `printPreview` which is registered with ViewManager but not in `Rga.ViewMode.MODES`. ViewMode's onChange filter excludes it; that means cycling INTO printPreview leaves ViewMode's `current` stale, but `previous` still gets the right value (V1.1 fix 3). |

### 1.4 Sidebar

| Field | Value |
|---|---|
| **SSOT** | Split (intentional):<br>• `Rga.Shell.Sidebar` (`renderer/js/shell/sidebar.js`) owns the panel REGISTRY and the active panel id.<br>• `Rga.Shell.Layout.sidebar` (`renderer/js/shell/layout.js`) owns visibility + width + activePanel mirror. |
| **Consumers** | • `Rga.Shell.ActivityRail` — renders rail buttons, syncs `.rga-shell-rail-item-active` from `Sidebar.current()`.<br>• `Rga.Shell.Sidebar.activate(id)` callers — `Rga.Shell.init`'s default-panel boot, command palette "Show X Panel" entries, the rail click handler.<br>• `Rga.Shell.Layout.set({sidebar: {visible: ...}})` callers — Cmd-B shortcut (`shell/index.js`), the rail toggle-off click handler. |
| **Persistence** | None today (Slice 4 will persist the active panel id + visibility per the ownership matrix OI-3). |
| **Event source** | • `Rga.Shell.Sidebar.onChange(fn)` — fires on `activate` / `deactivate`.<br>• `Rga.Shell.Layout.subscribe(fn)` — fires on `Layout.set` mutations. |
| **Open risks** | • The split between Sidebar (panel id) and Layout (visibility) means a contributor could write `Layout.set({sidebar: {activePanel: 'foo'}})` without calling `Sidebar.activate('foo')` — the registry wouldn't run mount/unmount and the host would render the wrong content. Document this in the Sidebar module header.<br>• The G2 drift guard restricts who may write `Layout.sidebar.visible` (layout.js, shell/index.js, activity-rail.js) but doesn't yet guard `activePanel` writes. Add when a violator appears. |

### 1.5 BottomPanel

| Field | Value |
|---|---|
| **SSOT** | `Rga.Shell.Layout.studioPanel.visible` (in-memory + persisted). `Rga.BottomPanel` is the public mutator API; the DOM class `bottom-collapsed` is a SIDE EFFECT applied by `Rga.BottomPanel._syncDomFromLayout` from a Layout subscriber. |
| **Consumers** | • `Rga.BottomPanel.toggleCollapse()` / `Rga.BottomPanel.open()` / `Rga.BottomPanel.switchTo(tabName)` — the public mutator surface. Called by: close button (`#btn-close-bottom-panel`); Ctrl+J shortcut (registered in index.html boot); Cmd+\` shortcut (registered in `shell/index.js`); command palette "Toggle Bottom Panel"; engine plugins `annotations.js` + `revision-flags.js` (off-limits) call `switchTo('notes')` / `switchTo('flags')` after annotation/flag actions. |
| **Persistence** | `localStorage['rga-shell-studio-panel-visible']` (`'0'` \| `'1'`). Read on `Rga.BottomPanel.init()`; written by the Layout subscriber on every change. Slice-4 workspace persistence will likely subsume this scoped key. |
| **Event source** | • `Rga.Shell.Layout.subscribe(fn)` — single subscriber routes `next.studioPanel.visible` → `_syncDomFromLayout` + `_writePersistedVisibility`. |
| **Open risks** | • `activeTab` is currently held only on the `Rga.BottomPanel` instance (`this.activeTab = 'scene'`). The ownership matrix says it should migrate to `Layout.studioPanel.activeTab` in Slice 3+ — not done yet. Until then, the active tab is lost across reload (only visibility persists).<br>• The G3 drift guard restricts the `bottom-collapsed` class writer to `app-shell.js` (BottomPanel) but doesn't enforce that nobody mutates `Layout.studioPanel` directly. The G2 guard does cover that direction. |

### 1.6 Scene Navigator

| Field | Value |
|---|---|
| **SSOT** | Split (the documented "separation invariant"):<br>• **Current-scene mark** (cursor-following highlight): sourced from `Rga.ScriptSession.get().currentScene.nodeId`.<br>• **Selected-row mark** (keyboard navigation focus): sourced from the panel's internal `_selectedNodeId` — panel-private, not exposed. |
| **Consumers** | • `_render` reads both SSOTs to apply `.rga-shell-scene-navigator-row-current` and `.rga-shell-scene-navigator-row-selected` per row.<br>• `Rga.Shell.SceneNavigator.scrollToScene(nodeId)` is the public navigation entry: dispatches `setSelection` + PM scrollIntoView + DOM-level `view.nodeDOM(pmPos).scrollIntoView({block:'start'})` + `view.focus()`.<br>• `Rga.Shell.SceneNavigator.focusRow(nodeId)` is the keyboard-only API (sets `_selectedNodeId`, re-renders, without moving the editor cursor). |
| **Persistence** | None (cursor and keyboard focus are session-only state). |
| **Event source** | • `Rga.ScriptSession.subscribe(fn)` — full re-render on every snapshot change (cursor moved → currentScene changed → re-render).<br>• Local `_container.keydown` listener (Arrow/Home/End/Enter/Esc) — drives `_selectedNodeId` updates. (Allowed because it's panel-local, not document-level; the G1 drift guard only targets document.keydown.) |
| **Open risks** | • `_render` calls `_container.innerHTML = ''` on every snapshot change. For 100-scene scripts this is still cheap (Slice 1 §C scale test confirms) but a deep-tree script could grow this. A future virtualisation slice may be needed.<br>• The separation invariant relies on each visual mark being styled distinctly. The Activity Rail Doctrine equivalent (Rule 4) is enforced by guard tests; the Scene Navigator equivalent is enforced by `VS7` in the V1 visual-stab guards. |

### 1.7 ViewManager

| Field | Value |
|---|---|
| **SSOT** | `Rga.ViewManager` (`renderer/js/framework/view-manager.js`) — owns active view id + body-class side-effect. **`Rga.ViewMode`** (`renderer/js/view-mode.js`) is a user-facing UX layer that **reacts** to ViewManager via `onChange` to keep its own `current`/`previous` in sync. |
| **Consumers** | • `Rga.ViewMode.set(mode)` calls `Rga.ViewManager.activate(mode)` — the canonical write path.<br>• `Rga.Shell.StatusBar` viewMode segment click calls `Rga.ViewManager.activate(next)` directly — documented bypass (cycles into printPreview, which ViewMode doesn't own).<br>• `Rga.PrintPreview` registers its own controller with bodyClass `view-print-preview-active` (separate from `print`).<br>• Body classes `view-draft-active` / `view-print-active` consumed by CSS to hide chrome in Draft and adjust styles in Print. |
| **Persistence** | `localStorage['rga-view-mode']` (one of `'flow'`/`'print'`/`'draft'`). Owned by `Rga.ViewMode._persist`. ViewManager itself doesn't persist (it has no concept of "previous session"). |
| **Event source** | • `Rga.ViewManager.onChange(fn)` — fires on activate/deactivate, payload `(newId, prevId)`.<br>• `Rga.ViewMode.onChange(fn)` — fires on `set` and on the registry sync. ViewMode listeners get the post-filter view id (only MODES values). |
| **Open risks** | • The two onChange surfaces (ViewManager vs ViewMode) could fire out of order if a subscriber is registered with both. Current consumers subscribe to only one each — no incidents.<br>• The status-bar bypass means `Rga.ViewMode.previous` for an exit-from-printPreview tracks the LAST flow/draft/print value, not printPreview itself. exitDraft from printPreview would return to that older value rather than to flow. Documented in Slice 2 commit message; consumers don't currently hit this. |

### 1.8 Layout

| Field | Value |
|---|---|
| **SSOT** | `Rga.Shell.Layout` (`renderer/js/shell/layout.js`) — in-memory `_current` map with four zones (`sidebar`, `studioPanel`, `titleBar`, `statusBar`). Per-zone shallow merge on `set()`. |
| **Consumers** | • Subscribers: `Rga.BottomPanel` (Layout → DOM class + localStorage persistence); future Slice 4 workspace persistence will add a single global subscriber that mirrors the full state.<br>• Readers: `Rga.Shell.StatusBar._renderViewMode` (currentView), `Rga.Shell.Sidebar.activate` (sets activePanel mirror), `Rga.Shell.init` (sets default-panel state).<br>• Writers: `Rga.BottomPanel.toggleCollapse/open` (studioPanel.visible), Cmd+B shortcut (sidebar.visible), Cmd+\` shortcut fallback (studioPanel.visible), rail click (sidebar.visible). G2 drift guard enforces the writer whitelist. |
| **Persistence** | `toJSON()` / `fromJSON()` exist but are not wired to localStorage. Slice 4 will wire the full state to a single workspace blob. Today only `studioPanel.visible` is persisted (via the BottomPanel-scoped key). |
| **Event source** | `Rga.Shell.Layout.subscribe(fn)` — fires on any `set()` that actually changes a value. Same-value `set()` is a no-op (no notify). This is why Slice 1 needed an explicit `_syncDomFromLayout(initialVisible)` call after init when persisted == default. |
| **Open risks** | • Layout's no-op-on-same-value semantics is correct but caught Slice 1 by surprise. Any new subscriber whose DOM might drift from default should follow the same explicit-sync-on-init pattern.<br>• The fields list (`sidebar`/`studioPanel`/`titleBar`/`statusBar`) is fixed in DEFAULTS but `set()` accepts unknown zones for forward-compat. A typo (`'studio_panel'` vs `'studioPanel'`) won't error — it'll silently store on the wrong field. Slice-4 workspace persistence should add field validation. |

### 1.9 ScriptSession

| Field | Value |
|---|---|
| **SSOT** | `Rga.ScriptSession` (`renderer/js/shell/script-session.js`) — purely derived from engine state (PM editor view + ViewManager + Sidebar); does not own primary state itself. The snapshot it produces is the user-facing summary of writer context. |
| **Consumers** | • `Rga.Shell.StatusBar` (scene, page, blockType, wordCount, viewMode segments).<br>• `Rga.Shell.TitleBar` (script name + dirty).<br>• `Rga.Shell.SceneNavigator` (current-scene mark).<br>• `Rga.Shell.Outline` (Story Progress).<br>• Future: continuity panel, focus mode, AI context surfaces — all subscribe via the same `Rga.ScriptSession.subscribe(fn)`. |
| **Persistence** | None — pure derivation. Recomputes on every relevant upstream event. |
| **Event source** | Snapshots are recomputed on:<br>• `editor.tabActivated` document event<br>• `editor.docDirtyChanged` document event<br>• `document.selectionchange` (cursor moved)<br>• `Rga.ViewManager.onChange`<br>• `Rga.Shell.Sidebar.onChange`<br>Recompute is shallow-equality-filtered: identical snapshot → no notify. |
| **Open risks** | • `wordCount` and `currentBlockType` are temporarily on this snapshot pending the post-Slice-2-architectural-correction migration to `Rga.ScriptMetrics` (Compatibility Inventory entry #6). Consumers reading those fields from ScriptSession will need to migrate.<br>• `selectionchange` fires very frequently; if a slow subscriber appears, it could perceptibly lag the cursor. Today all subscribers are cheap DOM updates. |

### 1.10 ScriptMetrics

| Field | Value |
|---|---|
| **SSOT** | **NOT YET EXISTS.** Compatibility Inventory entry #6 documents the planned `Rga.ScriptMetrics` module that will own derived analytics (`wordCount`, `currentBlockType`, plus reserved `dialogueWords`, `actionWords`, `sceneCount`, `estimatedRuntime`) as a sibling of `Rga.ScriptSession`. |
| **Consumers** | (after the migration) `Rga.Shell.StatusBar` (wordCount + blockType segments) and `Rga.Shell.Outline` (Story Progress + statistics). Today those consumers read from `Rga.ScriptSession`. |
| **Persistence** | None planned — pure derivation, same posture as ScriptSession. |
| **Event source** | Same upstream events as ScriptSession (cursor / tab / view changes). Possibly a less aggressive recompute filter — wordCount only needs to update when the doc changes, not on every selectionchange. |
| **Open risks** | • Until the module exists, `wordCount` + `currentBlockType` live on the wrong layer (ScriptSession). The compatibility inventory entry #6 tracks this; the visual-stab and ownership tests will need to update when the migration lands.<br>• Naming collision: `Rga.ScriptMetrics` must not clash with anything in the engine's `framework/` or `doc-types/`. Pre-flight grep before opening the implementation slice. |

---

## 2. Cross-cutting risks

These are risks that span multiple rows. They are tracked here so they
don't get duplicated on every row.

- **Off-limits engine code** (`renderer/js/editor/*`, `framework/*`,
  `doc-types/*`) holds several SSOT consumers (page-setup-dialog →
  Rga.Keyboard; tags.js → Rga.Sidebar shim; annotations.js +
  revision-flags.js → Rga.BottomPanel.switchTo; context-menu.js →
  Rga.Inspector.open + own document.keydown capture). Each is a
  documented exception in the relevant row above and is what keeps
  the corresponding shim alive.
- **Slice 4 workspace persistence** will introduce a single
  `Rga.Shell.Layout` → localStorage subscriber that subsumes:
  - `rga-shell-studio-panel-visible` (BottomPanel-scoped today)
  - sidebar.activePanel (currently not persisted)
  - sidebar.width / inspector.width / bottom-panel-height (currently
    written to CSS variables by `Rga.Resize` with no persistence)
  - Possibly `rga-view-mode` (likely stays separate since it's a per-
    app preference, not per-workspace).
- **The G1–G4 drift guards** are the runtime safety net for this
  audit. If a future contributor violates an audit row's SSOT, the
  guards either fail at CI (G1/G3/G4) or emit a console warn at
  runtime (KeyboardRegistry duplicate detection). They cannot catch
  all drift — semantic regressions (e.g. ViewMode.previous tracking
  the wrong mode after printPreview) require regression tests.

---

## 3. Audit refresh protocol

This audit must be refreshed when:

1. A row's SSOT moves to a different module — update the SSOT cell
   and the Consumers list.
2. A new persistence key is added — add to row + the matrix §2.
3. A new subscriber pattern is introduced (e.g. a "ScriptMetrics
   subscribe" surface) — add Event-source bullet.
4. A drift guard catches something at CI — add the violation pattern
   to Open risks so future readers know what the guard is preventing.

The audit is paired with the [extraction roadmap](./rwanga-legacy-extraction-roadmap.md);
when a roadmap row resolves, this audit's corresponding row may need
its `Open risks` cleared.

---

## 4. Cross-references

- Ownership matrix — `docs/design-system/rwanga-ownership-matrix.md`
- Legacy extraction roadmap — `docs/design-system/rwanga-legacy-extraction-roadmap.md`
- Compatibility inventory — `docs/rwanga-shell-compatibility-inventory.md`
- Activity Rail Doctrine — `docs/rwanga-activity-rail-doctrine.md`
- Drift guards (G1–G4) — `tests/unit/shell/ownership-drift-guards.test.js`
- Visual-stab guards (VS*) — `tests/unit/shell/visual-stabilization.test.js`

End of audit.
