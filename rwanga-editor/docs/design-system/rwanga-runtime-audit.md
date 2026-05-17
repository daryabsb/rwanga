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

## 0. Field ownership at a glance (Rga.SessionBoundary, Slice 7 §A)

A canonical manifest of which session-side fields belong to which
owner. The runtime module `Rga.SessionBoundary` codifies this; the G8
/ G9 / G10 drift guards enforce it at CI; this table is the
human-readable summary.

| Owner | Module | Semantic | Fields |
|---|---|---|---|
| `Rga.ScriptSession`  | `renderer/js/shell/script-session.js`  | writer-context  | `activeScript`, `currentScene`, `currentPage`, `currentView`, `currentSelection`, `openPanels`, `activePanel` |
| `Rga.ScriptMetrics`  | `renderer/js/shell/script-metrics.js`  | derived-analytics | `wordCount`, `currentBlockType`, `dialogueWords`*, `actionWords`*, `sceneCount`*, `estimatedRuntime`* |
| `Rga.ViewManager`    | `renderer/js/framework/view-manager.js` | view-mode      | `current` (active view id) |
| `Rga.WorkspaceState` | `renderer/js/shell/workspace-state.js` | workspace-persistence | Layout zones — `sidebar`, `studioPanel`, `inspector`, `titleBar`, `statusBar` |

*Reserved-future fields (always null today; computed by a later slice).

**Rule:** every field name has exactly ONE owner. A field appearing
on two snapshots is a duplicate-ownership bug — drift guards G8 / G9
catch it at CI.

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
| **SSOT** | `Rga.Shell.StatusBar` (`renderer/js/shell/status-bar.js`) — owns rendering only. The DATA the bar displays has multiple SSOTs (see Consumers / Event source). Slice 5 §A formalised StatusBar as a strict read-only consumer; the only "write" is the viewMode click which calls the public API on the mode SSOT, not local state. |
| **Consumers** | The bar is a SINK, not a source. It reads from:<br>• `Rga.ScriptSession.get()` — scene, page, viewMode (writer-context fields).<br>• `Rga.ScriptMetrics.get()` — wordCount, currentBlockType (analytics fields; Slice 5 §A migrated these reads off ScriptSession).<br>• `Rga.TabManager.activeDoc().metadata.screenplayProfile.language` — language segment.<br>• Click on the viewMode segment calls `Rga.ViewManager.activate(next)` — writes to the ViewManager SSOT via its public API. |
| **Persistence** | None directly. Persisted state of consumed inputs (active doc, view-mode) is owned by their respective modules. |
| **Event source** | • `Rga.ScriptSession.subscribe(fn)` — full re-render on every snapshot change.<br>• `document.addEventListener('editor.tabActivated', ...)` — language segment refresh on tab switch.<br>• `Rga.ScriptMetrics.subscribe(fn)` is available for analytics-only re-renders; current StatusBar `refresh()` already re-renders everything per ScriptSession event so it doesn't need to subscribe to ScriptMetrics separately. |
| **Open risks** | • Two event sources (ScriptSession + `editor.tabActivated`) means a race could fire two renders for the same tab switch. The `_renderLanguage` path is cheap (one segment) so this is acceptable today.<br>• The viewMode segment cycle list `['flow', 'draft', 'printPreview']` includes `printPreview` which is registered with ViewManager but not in `Rga.ViewMode.MODES`. ViewMode's onChange filter excludes it; that means cycling INTO printPreview leaves ViewMode's `current` stale, but `previous` still gets the right value (V1.1 fix 3).<br>• **G10 drift guard (Slice 7 §B)**: StatusBar's split-source posture (writer-context from ScriptSession + analytics from ScriptMetrics) is enforced — a future contributor reading e.g. `Rga.ScriptSession.get().wordCount` from StatusBar would fail CI with a "wrong owner" message. |

### 1.4 Sidebar

| Field | Value |
|---|---|
| **SSOT** | Split (intentional, Slice 5 §B kept in sync):<br>• `Rga.Shell.Sidebar` (`renderer/js/shell/sidebar.js`) owns the panel REGISTRY and the runtime active panel id (`_currentId`).<br>• `Rga.Shell.Layout.sidebar` (`renderer/js/shell/layout.js`) owns visibility + width + the persisted activePanel mirror.<br>Slice 5 §B added `_syncLayoutMirror(id)` inside `Sidebar.activate` so the Layout mirror is updated on every activate. Pre-Slice-5 this was broken: Layout.sidebar.activePanel was a stale mirror written once at boot. |
| **Consumers** | • `Rga.Shell.ActivityRail` — renders rail buttons, syncs `.rga-shell-rail-item-active` from `Sidebar.current()`.<br>• `Rga.Shell.Sidebar.activate(id)` callers — `Rga.Shell.init`'s persisted/default-panel boot, command palette "Show X Panel" entries, the rail click handler.<br>• `Rga.Shell.Layout.set({sidebar: {visible: ...}})` callers — Cmd-B shortcut (`shell/index.js`), the rail toggle-off click handler.<br>• `WorkspaceState` reads + writes `Layout.sidebar` as part of the workspace blob (Slice 4 §A). |
| **Persistence** | `Layout.sidebar.{visible,width,activePanel}` persisted via `Rga.WorkspaceState` to `rga-workspace-layout` (Slice 4 §A; Slice 5 §B made the activePanel mirror actually track user choices). On boot, `Shell.init` reads the restored `Layout.sidebar.activePanel` and activates that panel (falling back to DEFAULT_PANEL when the restored id isn't registered). |
| **Event source** | • `Rga.Shell.Sidebar.onChange(fn)` — fires on `activate` / `deactivate`.<br>• `Rga.Shell.Layout.subscribe(fn)` — fires on `Layout.set` mutations (including the activePanel mirror writes from `Sidebar._syncLayoutMirror`). |
| **Open risks** | • A contributor could still write `Layout.set({sidebar: {activePanel: 'foo'}})` directly without calling `Sidebar.activate('foo')` — Layout would change but the registry wouldn't run mount/unmount. **G2 drift guard expanded in Slice 5 §B** to restrict `activePanel` writes to layout.js + sidebar.js only; any other writer fails CI with a clear pointer to `Sidebar.activate`.<br>• `Sidebar.deactivate()` does NOT clear `Layout.sidebar.activePanel` — preserves "user's logical choice" across a hide so reopen restores the same panel. Visibility is the separate `sidebar.visible` field. Documented in `sidebar.js`'s deactivate comment. |

### 1.5 BottomPanel / Inspector / StudioPanel (consolidated Slice 9 §A)

| Field | Value |
|---|---|
| **SSOT** | `Rga.Shell.StudioPanel` (`renderer/js/shell/studio-panel.js`) — the consolidated owner of bottom-panel visibility + active tab + notes surface + inspector routing + scene-notes routing. Persisted state lives in `Rga.Shell.Layout.studioPanel.{visible,activeTab,height}` (delegated through StudioPanel). Pre-Slice-9 the responsibilities were split across `Rga.BottomPanel` + `Rga.Inspector` + `Rga.SceneNotesConnector` (the third was dead code — init never wired). |
| **Consumers** | • `Rga.Shell.StudioPanel.{show,hide,toggle,switchTo,activeTab,toggleInspector,openInspector}` — the canonical API.<br>• Legacy shims in `app-shell.js`:<br>&nbsp;&nbsp;− `Rga.BottomPanel.{init,open,switchTo,toggleCollapse}` → delegates to StudioPanel.<br>&nbsp;&nbsp;− `Rga.Inspector.{toggle,open}` → delegates to StudioPanel.<br>• Engine consumers (off-limits, preserved via shims):<br>&nbsp;&nbsp;− `annotations.js:117,154` → `Rga.BottomPanel.switchTo('notes')`<br>&nbsp;&nbsp;− `revision-flags.js:227` → `Rga.BottomPanel.switchTo('flags')`<br>&nbsp;&nbsp;− `context-menu.js:101` → `Rga.Inspector.open()` (Slice 9 §A added the `open()` method; pre-Slice-9 it didn't exist and the engine call was a defensive no-op).<br>• Shell consumers: close button, Ctrl+J, Cmd+`, command palette "Toggle Bottom Panel". |
| **Persistence** | `Rga.WorkspaceState` (Slice 4 §A) — the workspace blob `rga-workspace-layout` includes `studioPanel.{visible,activeTab,height}`. Slice 9 §A made `activeTab` actually get written: pre-Slice-9 the Layout field existed but nothing wrote it, so the active tab was lost on reload; now `StudioPanel.switchTo` writes it. |
| **Event source** | • `Rga.Shell.Layout.subscribe(fn)` — single subscriber in StudioPanel routes `next.studioPanel.visible` → `_syncVisibilityFromLayout` and `next.studioPanel.activeTab` → `_renderActiveTab`. |
| **Open risks** | • The G3 drift guard restricts the `bottom-collapsed` class writer to `studio-panel.js`. G12 (Slice 9 §B) additionally restricts `inspector-hidden` writes to studio-panel.js, and forces the `Rga.BottomPanel` / `Rga.Inspector` definitions in app-shell.js to remain thin delegating shims (counts delegate call sites + forbids direct Layout.set or class writes inside the shim).<br>• `Rga.Shell.StudioPanel._wireSceneNotesConnector` walks editor DOM via `Rga.Cursor.getCurrentBlock` — if a future engine refactor changes scene-header DOM markers (`data-blockType="scene-header"`), this wiring silently degrades. Will be replaced by a proper "current scene" event subscription when the engine exposes one. |

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
| **SSOT** | `Rga.ViewManager` (`renderer/js/framework/view-manager.js`) — owns active view id AND the body-class side-effect. Body classes (`view-draft-active`, `view-print-active`, `view-print-preview-active`) are applied EXCLUSIVELY by `ViewManager.activate`/`deactivate` via the registered controller's `bodyClass` property. **Slice 6 §A** removed the last shell-side writer (the `view-mode.js _activate` fallback) and **§B** added G3 enforcement: any toggle of these classes from a shell-js file fails CI. **`Rga.ViewMode`** (`renderer/js/view-mode.js`) is a user-facing UX layer that **reacts** to ViewManager via `onChange` to keep its own `current`/`previous` in sync. |
| **Consumers** | • `Rga.ViewMode.set(mode)` calls `Rga.ViewManager.activate(mode)` — the canonical write path.<br>• `Rga.Shell.StatusBar` viewMode segment click calls `Rga.ViewManager.activate(next)` directly — documented bypass (cycles into printPreview, which ViewMode doesn't own). Safe because ViewMode subscribes to ViewManager.onChange to stay in sync.<br>• `Rga.PrintPreview` registers its own controller with bodyClass `view-print-preview-active`.<br>• Body classes consumed by CSS to hide chrome in Draft and adjust styles in Print / PrintPreview. |
| **Persistence** | `localStorage['rga-view-mode']` (one of `'flow'`/`'print'`/`'draft'`). Owned by `Rga.ViewMode._persist`. **`printPreview` is intentionally NOT persisted** — it's a transient render mode, not a writing mode; reload from printPreview reverts to the last persisted flow/print/draft (verified by Slice 6 behavioural test). ViewManager itself doesn't persist. |
| **Event source** | • `Rga.ViewManager.onChange(fn)` — fires on activate/deactivate, payload `(newId, prevId)`.<br>• `Rga.ViewMode.onChange(fn)` — fires on `set` and on the registry sync. ViewMode listeners get the post-filter view id (only MODES values). |
| **Open risks** | • The two onChange surfaces (ViewManager vs ViewMode) could fire out of order if a subscriber is registered with both. Current consumers subscribe to only one each — no incidents.<br>• The status-bar bypass means `Rga.ViewMode.previous` for an exit-from-printPreview tracks the LAST flow/draft/print value, not printPreview itself. exitDraft from printPreview would return to that older value rather than to flow. Documented in Slice 2 commit message; consumers don't currently hit this.<br>• **G3 drift guard enforcement (Slice 6 §B):** the three view-*-active body classes have `owner: null` — any shell-js toggle fails CI with "ViewManager is the only legitimate writer". Catches the historical fallback pattern at build time. |

**Migration notes (Slice 6 §A — Runtime Ownership Stab.):**

- `view-mode.js _activate()` previously had an `else` branch that
  directly toggled `view-draft-active` / `view-print-active` on
  document.body as a fallback when ViewManager was absent. The
  fallback was a test-context convenience but it was also the one
  shell-js path that wrote view body classes. Removed in Slice 6 §A;
  if ViewManager is absent the activate is now a silent no-op.
- Test harnesses that exercise view-mode behavior must load
  `framework/view-manager.js` before `view-mode.js`. The Slice 1 +
  Slice 5 + Slice 6 test boots all follow this pattern.

### 1.8 Layout

| Field | Value |
|---|---|
| **SSOT** | `Rga.Shell.Layout` (`renderer/js/shell/layout.js`) — in-memory `_current` map with four zones (`sidebar`, `studioPanel`, `titleBar`, `statusBar`). Per-zone shallow merge on `set()`. |
| **Consumers** | • Subscribers: `Rga.BottomPanel` (Layout → DOM class + localStorage persistence); future Slice 4 workspace persistence will add a single global subscriber that mirrors the full state.<br>• Readers: `Rga.Shell.StatusBar._renderViewMode` (currentView), `Rga.Shell.Sidebar.activate` (sets activePanel mirror), `Rga.Shell.init` (sets default-panel state).<br>• Writers: `Rga.BottomPanel.toggleCollapse/open` (studioPanel.visible), Cmd+B shortcut (sidebar.visible), Cmd+\` shortcut fallback (studioPanel.visible), rail click (sidebar.visible). G2 drift guard enforces the writer whitelist. |
| **Persistence** | `Rga.WorkspaceState` (Slice 4 §A) owns the single key `rga-workspace-layout`. On boot it reads + calls `Rga.Shell.Layout.fromJSON(blob)` to hydrate. It subscribes to Layout afterward and writes `Layout.toJSON()` on every change. No debouncing — Resize commits sizes on drag-end (not mid-drag) so writes are bounded by user actions. |
| **Event source** | `Rga.Shell.Layout.subscribe(fn)` — fires on any `set()` that actually changes a value. Same-value `set()` is a no-op (no notify). This is why Slice 1 needed an explicit `_syncDomFromLayout(initialVisible)` call after init when persisted == default. |
| **Open risks** | • Layout's no-op-on-same-value semantics is correct but caught Slice 1 by surprise. Any new subscriber whose DOM might drift from default should follow the same explicit-sync-on-init pattern.<br>• The fields list (`sidebar`/`studioPanel`/`inspector`/`titleBar`/`statusBar`) is fixed in DEFAULTS but `set()` accepts unknown zones for forward-compat. A typo (`'studio_panel'` vs `'studioPanel'`) won't error — it'll silently store on the wrong field. A future slice should add stricter field validation now that Layout is the single persistence surface.<br>• Layout has no `view` zone. View mode persistence stays on the separate `rga-view-mode` key (owned by Rga.ViewMode); not folded into the workspace blob because it's a per-app preference, not per-workspace UI state. Slice 6 confirmed this division. |

**Migration notes (Slice 6 §A):**

- `Layout` does NOT own view mode. View mode is owned by
  `Rga.ViewManager` (runtime SSOT) + `Rga.ViewMode` (persistence
  layer with its own scoped localStorage key). Adding a `view` zone
  to Layout was considered and rejected — view mode is a per-app
  preference (independent of which workspace/script is open), so
  folding it into `rga-workspace-layout` would conflate two
  lifetimes.

### 1.9 ScriptSession

| Field | Value |
|---|---|
| **SSOT** | `Rga.ScriptSession` (`renderer/js/shell/script-session.js`) — purely derived from engine state (PM editor view + ViewManager + Sidebar); does not own primary state itself. The snapshot it produces is the user-facing summary of writer context. Slice 7 §A LOCKED the snapshot shape to the 7 writer-context fields declared by `Rga.SessionBoundary.ScriptSession.fields`; G8 drift guard enforces. |
| **Field ownership** (per Rga.SessionBoundary, Slice 7 §A) | `activeScript`, `currentScene`, `currentPage`, `currentView`, `currentSelection`, `openPanels`, `activePanel`. **No analytics fields** — those belong to `Rga.ScriptMetrics`. |
| **Consumers** | • `Rga.Shell.StatusBar` reads scene / page / viewMode from here.<br>• `Rga.Shell.TitleBar` (script name + dirty).<br>• `Rga.Shell.SceneNavigator` (current-scene mark).<br>• `Rga.Shell.Outline` (Story Progress; reads writer-context fields only — its statistics come straight from `Rga.Nav.getOutline()`, not from a ScriptSession or ScriptMetrics snapshot).<br>• Future: continuity panel, focus mode, AI context surfaces — all subscribe via `Rga.ScriptSession.subscribe(fn)`. |
| **Persistence** | None — pure derivation. Recomputes on every relevant upstream event. |
| **Event source** | Snapshots are recomputed on:<br>• `editor.tabActivated` document event<br>• `editor.docDirtyChanged` document event<br>• `document.selectionchange` (cursor moved)<br>• `Rga.ViewManager.onChange`<br>• `Rga.Shell.Sidebar.onChange`<br>Recompute is shallow-equality-filtered: identical snapshot → no notify. |
| **Open risks** | • `selectionchange` fires very frequently; if a slow subscriber appears, it could perceptibly lag the cursor. Today all subscribers are cheap DOM updates.<br>• `currentView` (one of the snapshot fields) is sourced from `Rga.ViewManager.current()`. After Slice 6 §A's strict body-class ownership, this field reflects ANY mode ViewManager broadcasts — including printPreview. Consumers that switch on `currentView` should handle the printPreview case.<br>• **G8 drift guard (Slice 7 §B)**: a contributor adding any field to `EMPTY_SNAPSHOT` that isn't in `Rga.SessionBoundary.ScriptSession.fields` fails CI with a clear "wrong owner" pointer. |

**Migration notes (Slice 6 §A + Slice 7 §A):**

- Slice 6 §A confirmed ScriptSession's role as a pure-derivation
  reader of ViewManager (no direct ViewManager writes from here).
- Slice 7 §A **removed** `wordCount` and `currentBlockType` from
  ScriptSession's snapshot. Compatibility Inventory entry #6 is
  RESOLVED. The derivation logic moved into `Rga.ScriptMetrics`
  which now derives independently from the same upstream sources
  (`Rga.TabManager._editorView` + `Rga.Nav.getOutline`).
- The audit explicitly disowns view-mode persistence from
  ScriptSession — it belongs to `Rga.ViewMode._persist`, not here.

### 1.10 ScriptMetrics

| Field | Value |
|---|---|
| **SSOT** | `Rga.ScriptMetrics` (`renderer/js/shell/script-metrics.js`) — introduced in Runtime Ownership Stab. Slice 5 §A as a DELEGATING LAYER, **promoted to a first-class SSOT in Slice 7 §A** with its own independent derivation. Snapshot shape: `{ wordCount, currentBlockType, dialogueWords, actionWords, sceneCount, estimatedRuntime }` — reserved fields default to null (computed by a future slice). Per `Rga.SessionBoundary.ScriptMetrics.fields`. |
| **Field ownership** (per Rga.SessionBoundary, Slice 7 §A) | `wordCount`, `currentBlockType`, `dialogueWords`, `actionWords`, `sceneCount`, `estimatedRuntime`. **No writer-context fields** — those belong to `Rga.ScriptSession`. |
| **Consumers** | • `Rga.Shell.StatusBar` (wordCount + blockType segments — migrated in Slice 5 §A).<br>• Future: continuity panel, focus mode, AI context surfaces that need analytics. |
| **Persistence** | None — pure derivation, same posture as ScriptSession. |
| **Event source** | `Rga.ScriptMetrics.subscribe(fn)` uses `Rga.ScriptSession.subscribe` as the cheap "something upstream changed" trigger but re-derives its own snapshot from `Rga.TabManager._editorView` + `Rga.Nav.getOutline` independently. Applies its own analytics-field equality filter before notifying — ScriptSession's high-frequency cursor / panel-toggle churn does not propagate to ScriptMetrics subscribers unless an analytics field actually changes. |
| **Open risks** | • Reserved fields (`dialogueWords` / `actionWords` / `sceneCount` / `estimatedRuntime`) are present in the snapshot shape but always null. Consumers should treat null as "not yet computed" not "no value".<br>• ScriptMetrics depends on `Rga.ScriptSession.subscribe` as its trigger. If ScriptSession's recompute is shallow-equality-filtered AWAY (no field changed) but the underlying `Nav.getOutline` statistics changed, ScriptMetrics won't see the update. In practice the cursor move that prompted the recompute also flips ScriptSession's `currentSelection.from`, so the chain works. Documented for future debugging.<br>• **G9 drift guard (Slice 7 §B)**: any future contributor adding a non-analytics field to ScriptMetrics' snapshot fails CI with a clear pointer to the correct owner. |

**Migration notes (Slice 7 §A — full independence):**

- Pre-Slice-7, ScriptMetrics was a delegating layer that read
  `Rga.ScriptSession.get().wordCount` and `.currentBlockType`. The
  fields physically lived on ScriptSession's snapshot.
- Slice 7 §A moved the derivation logic
  (`_deriveWordCount`, `_deriveCurrentBlockType`, `BODY_BLOCKS`)
  from script-session.js into script-metrics.js. ScriptMetrics
  now reads `Rga.TabManager._editorView` and `Rga.Nav.getOutline`
  directly, exactly the same upstream sources ScriptSession used.
- The fields were removed from `Rga.ScriptSession.EMPTY_SNAPSHOT`,
  `_recompute()`, `_clone()`, and `_snapshotEquals()`.
- Compatibility Inventory entry #6 conditions (a)+(b) were closed
  in Slice 5 §A; (c)+(d)+(e) closed in Slice 7 §A. Entry RESOLVED.

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
- **Slice 4 workspace persistence — DONE 2026-05-17 (Slice 4 §A).**
  `Rga.WorkspaceState` is the single owner of `rga-workspace-layout`,
  which now subsumes:
  - `studioPanel.visible` (was `rga-shell-studio-panel-visible`,
    migrated in one shot on first boot post-Slice-4)
  - sidebar.{visible,width,activePanel}
  - studioPanel.{height,activeTab}
  - inspector.{visible,width} (new zone introduced by Slice 4)
  - titleBar.{visible} / statusBar.{visible}
  `rga-view-mode`, `rga-theme`, `rga-script-lang`, `rga-session-tabs`
  intentionally stay separate (per-app preferences / per-app session
  state, not per-workspace UI state).
- **The G1–G12 drift guards** are the runtime safety net for this
  audit. If a future contributor violates an audit row's SSOT, the
  guards either fail at CI (G1/G3/G4/G5/G6/G7/G8/G9/G10/G11/G12) or
  emit a console warn at runtime (KeyboardRegistry duplicate
  detection). They cannot catch all drift — semantic regressions
  (e.g. ViewMode.previous tracking the wrong mode after printPreview)
  require regression tests.
- **Slice 8 §A — app-shell.js extraction Stage 2.** Toast / Modal /
  CommandPalette / Resize / ScriptLanguage all moved out of
  `renderer/js/app-shell.js` into their own files under
  `renderer/js/shell/`. None of these are audit-row owners (UI
  primitives). G11 (Slice 8 §B) prevents any of them moving back.
- **Slice 9 §A — StudioPanel consolidation.** `Rga.BottomPanel` +
  `Rga.Inspector` + `Rga.SceneNotesConnector` collapsed into a
  single new owner `Rga.Shell.StudioPanel`
  (`renderer/js/shell/studio-panel.js`). The first two retain thin
  delegating shims in `app-shell.js` because engine plugins call
  them (annotations.js, revision-flags.js, context-menu.js); the
  third was deleted (zero callers — init was never wired). Audit
  row §1.5 was rewritten to reflect the consolidation. G12 (Slice
  9 §B) pins the shim shape and ensures `inspector-hidden` /
  `bottom-collapsed` are only written by StudioPanel.
- **Engine touchability is the last gate.** With Slice 9 §A
  complete, every remaining audit-row owner that lives in
  `app-shell.js` (Keyboard / Sidebar / BottomPanel / Inspector
  shims) is blocked on the same gate: when `editor/*` /
  `doc-types/*` become touchable, the engine consumers can migrate
  to the canonical APIs (`Rga.KeyboardRegistry`, `Rga.Shell.Sidebar`,
  `Rga.Shell.StudioPanel`) and the four shims (~47 LOC total) can
  be deleted. `app-shell.js` would shrink to ~80 LOC — just
  `Rga.Theme`.

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
