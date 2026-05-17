# Rwanga Shell — Slice 1 Implementation Plan

**Status:** Plan only. Nothing in this document ships until the plan itself is approved and the implementation phase opens.
**Author:** Rwanga shell — Slice 1 (post-master-plan Round 1)
**Date:** 2026-05-16
**Pairs with:** `docs/rwanga-app-shell-master-plan.md` (the design source of truth)

---

## 0. Status, Scope, Non-Scope

### 0.1 What Slice 1 is

The **minimum professional shell foundation**. After Slice 1, the application has:

- Visible window zones (title bar, activity rail, sidebar, editor area, Studio Panel, status bar).
- A working activity rail with all 7 v0.1 panel slots registered.
- A sidebar host that can switch between registered panels.
- A live status bar with five segments reading engine state.
- A shell-owned state object (`Rga.Shell.Layout`) that is the single source of truth for shell layout.
- The editor engine works **identically** to its pre-Slice-1 behavior — same mount path, same plugins, same view modes.

### 0.2 What Slice 1 is NOT

Mirrors the directive's "Rules" verbatim, plus the natural consequences:

- ❌ No editor engine redesign.
- ❌ No pagination changes.
- ❌ No PrintPreview changes.
- ❌ No Pro features (no AI surfaces, no sync, no account).
- ❌ No account implementation (title-bar avatar is a placeholder; the popover spec from master plan §3.6 is Slice 3+).
- ❌ No PDF / export.
- ❌ No real panel content beyond the two placeholders specified (Scenes + Script Workspace). The other five panels are visible in the rail but show a "Coming in v0.2" empty state.
- ❌ No layout persistence to disk — `Rga.Shell.Layout` is in-memory only this slice. Persistence is Slice 2.
- ❌ No command palette (Slice 3).
- ❌ No notifications system (Slice 3).
- ❌ No themes — Slice 1 ships against the current single CSS, with shell selectors prefixed `.rga-shell-*` so a theme system can swap them later.
- ❌ No welcome view, no onboarding tour.

### 0.3 Why this slice is the right starting point

It establishes **patterns** the rest of the shell will follow:
- Shell state lives in a `Rga.Shell.*` namespace, never in DOM attributes.
- Panels register themselves via a `Rga.Shell.Sidebar.registerPanel(id, controller)` call — the same shape `Rga.ViewManager.register` already uses, so future Slice authors recognize it.
- The shell reads engine state via documented `Rga.*` APIs only — never reaches into PM internals.
- Tests cover state ownership + transitions, not rendered pixels — same posture as the engine test suite.

Once these patterns are alive in the repo, Slice 2 (real panel content + persistence) and Slice 3 (palette + notifications) become straightforward incremental additions.

---

## 1. Architectural premise

### 1.1 What changes

- New `renderer/js/shell/` directory with the shell modules (see §3).
- New `renderer/css/shell.css` with shell selectors only (prefixed `.rga-shell-*`).
- `renderer/index.html`: structural zones are added or wired up; existing element IDs are preserved.
- The app bootstrap (currently at the bottom of `index.html`) gets one additional line: `Rga.Shell.init()` before `Rga.TabManager.init()`.

### 1.2 What doesn't change

- `renderer/js/editor/*` — untouched.
- `renderer/js/doc.js`, `renderer/js/doc-types/screenplay/*` — untouched.
- `renderer/js/framework/*` — untouched. (Slice 1 consumes these APIs, doesn't extend them.)
- `renderer/css/editor-prosemirror.css` — untouched. Shell CSS lives in its own file with no overlapping selectors.
- All 366 existing tests — green, no edits.

### 1.3 The boundary rule

> The shell may read from `Rga.*` APIs documented in master plan §21.
> The shell **may NOT**:
> - Mutate `EditorState` directly.
> - Reach into PM `view.state.doc` internals beyond what an engine API returns.
> - Add plugins to the EditorView.
> - Override engine-owned body classes (those go through `Rga.ViewManager`).

A future Slice-N audit will grep the shell layer for forbidden patterns and fail the build if violations creep in. Slice 1 sets the precedent; we earn the trust right away.

### 1.4 The writer-facing language rule

> **The shell never speaks in engine terminology.** No user-facing string, tooltip, menu, ARIA label, or visible copy may contain the words *Document*, *Node*, *Plugin*, or *Render*. The translation table is non-negotiable:

| Engine term (internal only) | Writer-facing word (shell UI / copy / a11y) |
|---|---|
| Document | **Script** |
| Node / block node | **Scene** (for scene-level), **Block** (for block-level) |
| Plugin | **Tool** |
| Render / RenderModel / PrintRenderer | **View** |
| EditorView / mount | **Editor** (or just the active surface) |
| ProseMirror | (never spoken in UI; never abbreviated as "PM" either) |
| Deserialize / serialize | **Open** / **Save** |
| nodeId / pmPos | (never surfaced; addressing is by scene number or scene heading) |

Engine source files keep the precise vocabulary (`Rga.RenderModel`, `Rga.Nav.getIndex(state).scenes[i].pmPos` — these are correct *inside* the engine). The boundary is strict: the moment a string becomes user-readable, it switches to the writer-facing word.

**Examples of correct/incorrect copy:**

| ✘ Incorrect | ✓ Correct |
|---|---|
| "Document has unsaved changes" | "Script has unsaved changes" |
| "Node missing required attribute" | "Scene 3 is missing its heading" |
| "Render error" | "Preview view could not be built" |
| "Plugin loaded" | "Tool ready" |
| "Open Document" | "Open Script" |
| "Tab-bar shows open documents" | "Tab bar shows open scripts" |

The source-audit test in §8 will grep shell source for any of the four banned engine terms in string contexts (`'Document'`, `'Node'`, `'Plugin'`, `'Render'`) and fail the build on a hit, modulo a small allowlist for unavoidable engine-API names like `Rga.RenderModel` (where the symbol is part of the engine contract, not user copy).

---

## 2. State Ownership Contract

This is the most important section. Slice 1 introduces shell state ownership for the first time; the pattern set here governs every future shell slice.

### 2.1 The new shell state container

`Rga.Shell.Layout` is the single source of truth for shell-zone state.

**Shape (slice-1 minimum):**
```
{
  sidebar: {
    visible:       boolean,    // true on first boot
    width:         number,     // px; default 280
    activePanel:   string      // panel id, e.g. 'scenes'
  },
  studioPanel: {
    visible:       boolean,    // false on first boot
    height:        number,     // px; default 200
    activeTab:     string|null // tab id; null = no tab active
  },
  titleBar: {
    visible:       boolean     // true; reserved for fullscreen / distraction modes
  },
  statusBar: {
    visible:       boolean     // true
  }
}
```

**Future fields** (Slice 2+, not in slice 1): editor group layout, sidebar position (L/R), studioPanel position (bottom/right), per-panel pinned state.

### 2.2 API surface (public)

```
Rga.Shell.Layout.get()                   → readonly copy of current state
Rga.Shell.Layout.set(partial)            → merge; notifies subscribers
Rga.Shell.Layout.subscribe(fn)           → returns unsubscribe()
Rga.Shell.Layout._reset()                → test helper; restores defaults
```

**Merge semantics:** `set({sidebar: {visible: false}})` updates `sidebar.visible` and leaves `sidebar.width` + `sidebar.activePanel` untouched. (Same shape rule as `Rga.RuntimeProfile.set` from Phase 8 correction.)

**Subscriber invocation:** synchronous, after the state has been merged. Subscribers receive `(newState, prevState)`.

**Persistence:** **none in Slice 1.** Hot state only. When Slice 2 adds workspace `.rwanga-workspace/layout.json`, it will read on init + write on `set` — no API change needed.

### 2.3 The "no DOM-owned shell state" rule

The shell may write to `element.classList`, `element.style`, `element.textContent`, and `element.dataset.*` **as render output**. It may **not** read from any of those as source of truth.

Concrete corollaries:
- "Is the sidebar visible?" → `Rga.Shell.Layout.get().sidebar.visible`. Never `document.getElementById('sidebar').classList.contains('hidden')`.
- "Which panel is active?" → `Rga.Shell.Layout.get().sidebar.activePanel`. Never `document.querySelector('.rail-item.active').dataset.panelId`.
- "Is the studio panel open?" → `.get().studioPanel.visible`. Never DOM probe.

The audit test in §8 will grep the shell layer for `classList.contains(` / `dataset.` reads-as-source-of-truth patterns and fail if found.

### 2.4 No direct editor-engine mutation

The shell does **not** call `view.dispatch(...)` directly in Slice 1, with the single navigation-only exception declared in §3.7.1 (the Scene Navigator's scroll-to-scene click handler dispatches a selection-only transaction — no doc mutation). It does call `view.state.doc.descendants(...)` and read-only accessors. If a future slice needs to mutate the doc (e.g. drag-to-reorder scenes in the Scene Navigator) it goes through documented engine commands (`Rga.DocTypes.screenplay.v3Commands.*`) — never raw transactions.

(For Slice 1 the panels are placeholders, so this rule has no work to do — but the pattern is set.)

### 2.5 The three-layer ownership model — and where `Rga.ScriptSession` sits

> **Post-Slice-2 architectural correction (recorded here for fidelity):** what Slice 1 established as a three-layer model is, after the Slice-2 review-round correction, a **four-layer model**. A new sibling of `Rga.ScriptSession` — `Rga.ScriptMetrics` — owns *derived analytics* (wordCount, currentBlockType, plus reserved fields for sceneCount / dialogueWords / actionWords / estimatedRuntime). `ScriptSession` retains only the seven *writer-context* fields below. The canonical four-layer ledger lives in the master plan §20; this section preserves the original Slice-1 three-layer framing for historical fidelity. Slice 3 implements the migration; Compatibility Inventory entry #6 tracks the misplacement.

Slice 1 establishes a clean three-layer ownership model. **Every piece of state in the shell era belongs to exactly one of these three layers.** No layer reads source-of-truth from another layer's territory; data flows upward (lower layers feed higher layers) and consumers read from the highest layer that exposes what they need.

| Layer | Owner | What it owns | Persistence |
|---|---|---|---|
| **Document truth** | The PM `EditorState` (engine-owned) | Doc content, selections, marks, history. Engine APIs (`Rga.Nav.*`, `Rga.RuntimeProfile`, `Rga.ViewManager`, etc.) read from here. | `.rga` files |
| **Shell truth** | `Rga.Shell.Layout` | Window-chrome state — sidebar visibility/width/active-panel, Studio Panel visibility/height/active-tab, title-bar visibility, status-bar visibility. Slice 1 in-memory; Slice 2 adds workspace JSON persistence. | Workspace `layout.json` (Slice 2) |
| **Writer-context truth** | **`Rga.ScriptSession`** *(NEW in Slice 1)* | The single aggregated snapshot of "where is the writer right now?" — active script, current scene, current page, current view mode, current selection, open + active sidebar panels. Purely **derived** from the other two layers; never owns primary state itself. | Workspace `session.json` (Slice 4 — session restore) |

**Why `Rga.ScriptSession` exists as its own named layer:**

Before this layer, several shell components would have each computed the same things independently — the Scene Navigator's "which scene is the cursor in?", the Status Bar's "which page am I on?", the Title Bar's "is the active script dirty?". Three separate cursor-walks, three separate `tabActivated` listeners, three independent sources of subtle bugs.

With `Rga.ScriptSession` as a first-class layer:
- Derivation happens **once**, in one module.
- Every consumer subscribes to one source.
- Future features (continuity tools, focus mode, AI context, session restore) plug into the same surface without re-deriving anything.

**Shape of the writer-context snapshot:**

```
{
  activeScript:    { docId, displayName, dirty } | null,
  currentScene:    { nodeId, sceneNumber, headingDisplay } | null,
  currentPage:     { number, total } | null,
  currentView:     'flow' | 'draft' | 'printPreview' | null,
  currentSelection:{ from, to, empty } | null,
  openPanels:      [panelId, ...],          // mirror of which panels exist in the sidebar registry
  activePanel:     panelId | null            // shorthand for Rga.Shell.Sidebar.current()
}
```

Every field above is **derived** from the document or shell layers. `Rga.ScriptSession` recomputes its snapshot whenever any upstream input changes — and notifies subscribers.

**Consumers in Slice 1:**
- Scene Navigator (`currentScene` for the current-scene mark)
- Status Bar (`currentScene`, `currentPage`, `currentView`)
- Title Bar (`activeScript` for "Rwanga • {name} *")

**Consumers locked in for future slices:**
- Continuity tools (Slice 3+) — react to `currentScene` changes; check next/prev for continuity violations.
- Focus mode (Slice 5+) — read `currentScene` to know what to focus on.
- AI context (Slice 3+) — read `activeScript + currentScene + currentSelection` to build prompts.
- Session restore (Slice 4) — serialize the snapshot on close; rehydrate on launch.

**The "no duplicate ownership" rule:**

`Rga.ScriptSession` does **not** own; it **aggregates**. The PM doc still owns the cursor. `Rga.ViewManager` still owns the active view mode. `Rga.Shell.Layout` still owns sidebar visibility. `Rga.ScriptSession` reads from each, never writes back. If a consumer needs to *change* something (e.g. switch view mode), it calls the original owner's API (`Rga.ViewManager.activate('draft')`) — not a setter on ScriptSession.

The full API surface is documented in §3.5. The implementation lives in `renderer/js/shell/script-session.js`. The test contract is in §8.

---

## 3. Module Surface

**Convention:** Each module is an IIFE that exposes its surface under `Rga.Shell.*`. Each test stub references the module via `delete require.cache + require()` for isolation. Same pattern as the engine layer.

### 3.1 `renderer/js/shell/layout.js` → `Rga.Shell.Layout`

The state container described in §2. Approximately 50-80 LOC.

**Exposed:**
- `Rga.Shell.Layout.get()`
- `Rga.Shell.Layout.set(partial)`
- `Rga.Shell.Layout.subscribe(fn)`
- `Rga.Shell.Layout._reset()` (test-only)
- `Rga.Shell.Layout._DEFAULTS` (test-only constant)

**Dependencies:** none. Loads before everything else in the shell namespace.

### 3.2 `renderer/js/shell/sidebar.js` → `Rga.Shell.Sidebar`

Sidebar host. Manages the registered panels, mounts/unmounts them mutually-exclusively, syncs to `Rga.Shell.Layout.sidebar.activePanel`.

**Panel controller contract:**
```
{
  id:           string,         // unique; matches rail registration
  label:        string,         // human-readable, used by rail tooltip + a11y
  icon:         string,         // emoji or HTML — slice 1 uses emoji placeholders
  shortcut?:    string,         // 'Cmd-Shift-S' etc., for the keyboard layer
  available:    boolean,        // false = "Coming in v0.2" empty state
  mount(container)              // called when panel becomes active
  unmount()                     // called when panel becomes inactive
}
```

**Exposed:**
- `Rga.Shell.Sidebar.registerPanel(controller)` → boolean
- `Rga.Shell.Sidebar.activate(id)` → boolean
- `Rga.Shell.Sidebar.deactivate()` → void
- `Rga.Shell.Sidebar.current()` → id | null
- `Rga.Shell.Sidebar.registered()` → string[] (ordered by registration)
- `Rga.Shell.Sidebar.onChange(fn)` → unsubscribe()
- `Rga.Shell.Sidebar._reset()` (test-only)

**Mutual exclusion semantics:** identical to `Rga.ViewManager`. Activating B deactivates A first; re-activating the current id calls `mount(container)` again without unmount (so panels can re-render against new engine state).

**Why this is its own module, not piggy-backed on `Rga.ViewManager`:**
ViewManager is for view modes (Flow / Draft / PrintPreview — mutually exclusive renderings of the editor). Sidebar panels are a different exclusion scope (which sidebar tab is showing). They could share a code pattern but they're conceptually distinct. Keeping them separate matches the master plan's "one way to do anything" principle (§2.3): a sidebar panel registration never accidentally toggles a view mode.

### 3.3 `renderer/js/shell/activity-rail.js` → `Rga.Shell.ActivityRail`

Renders the 48px left-edge column of rail items. Each rail item is one registered sidebar panel. Clicking a rail item:
- If it's not active → calls `Sidebar.activate(id)` AND `Layout.set({sidebar: {visible: true}})`.
- If it IS active → calls `Sidebar.deactivate()` AND `Layout.set({sidebar: {visible: false}})` (toggle-off).

The rail subscribes to `Sidebar.onChange` to keep its visual active-state in sync.

**Exposed:**
- `Rga.Shell.ActivityRail.init(container)` → boolean
- `Rga.Shell.ActivityRail.refresh()` → void (re-renders from registry)

No public state — rail state is derived from `Sidebar.current()` + `Layout.get().sidebar.visible`.

**Rendering rule:** rail items render in registration order. The 7 v0.1 panels (Scenes / Script Workspace / Outline / Characters / Search / Revisions / Settings) register in `shell/index.js` in master-plan §4.1 order. Settings is the only "bottom-pinned" item — CSS handles that via flex; the rail module itself has no concept of pinning in Slice 1.

### 3.4 `renderer/js/shell/status-bar.js` → `Rga.Shell.StatusBar`

Renders the bottom 22px strip. Five segments (master plan §8.1, §8.2):

| Segment | Slice 1 format & behavior |
|---|---|
| `scene` | **Format:** `Scene: S12` — where `S12` is the current scene's sceneNumber prefixed with `S`. **Source:** `Rga.ScriptSession.get().currentScene.sceneNumber`. If `currentScene` is null → `Scene: —`. |
| `page` | **Format:** `Page: 12/87` — current page / total pages. **Source:** `Rga.ScriptSession.get().currentPage` → `{number, total}`. If null → `Page: —/—`. |
| `viewMode` | `Flow` / `Draft` / `Print Preview` — **Source:** `Rga.ScriptSession.get().currentView`. Click → calls `Rga.ViewManager.activate(nextMode)` (the owner of view-mode state). |
| `language` | `en` / `ku` / `ar` — reads `Rga.TabManager.activeDoc().metadata.screenplayProfile.language` (language is per-script settings, not in the writer-context snapshot). If no active script → `—`. |
| `offlineIndicator` | Slice 1: hard-coded `Local`. (Sync state arrives in Slice 3.) |

**Refresh trigger:** the status bar subscribes to `Rga.ScriptSession.subscribe(fn)` on `init`. Every segment except `language` and `offlineIndicator` updates on every snapshot notification. `language` updates on `editor.tabActivated` (separate listener — language is per-script, not writer-context).

Rationale: the status bar reads from **one** source (ScriptSession) instead of subscribing independently to `ViewManager`, cursor selection, and `tabActivated`. ScriptSession owns the change-fanout — the status bar just renders.

**Rationale for the Scene/Page format:** Writers care about *current position*, not totals-without-position. "Scene 5 of 8" tells the writer how many scenes exist; "Scene: S5 / Page: 12/87" tells the writer where they are *and* the scope of the work — the position-first reading dominates because that's the answer the writer actually needs while typing.

**Click-targets on these segments:**
- Click `Scene: S12` → opens the Scene Navigator and highlights that row.
- Click `Page: 12/87` → opens a small "Go to page…" prompt (Slice 2 wires the actual prompt; Slice 1 click is a no-op tooltip "Coming in 0.2").

**Exposed:**
- `Rga.Shell.StatusBar.init(container)` → boolean
- `Rga.Shell.StatusBar.refresh()` → void (manually re-pulls all segments)

**Refresh triggers (Slice 1):**
- `Rga.ViewManager.onChange` → repaint viewMode segment
- A repaint on `editor.tabActivated` document event → repaints all engine-derived segments
- A passive periodic refresh **is NOT used** — calm-by-default; we listen to actual events
- For Slice 1, edits in the document don't repaint sceneCount / pageCount in real time. That's fine — those segments update on tab activation, view mode change, and explicit `refresh()`. Live-update wiring (subscribing to the nav-index plugin output via a small bridge) is Slice 2.

### 3.5 `renderer/js/shell/script-session.js` → `Rga.ScriptSession`

The writer-context aggregator declared in §2.5. Reads from the document layer (PM doc + engine APIs) and the shell layer (`Rga.Shell.Layout` + `Rga.Shell.Sidebar`); exposes one snapshot + one subscription channel; never writes back.

**Exposed:**
- `Rga.ScriptSession.get()` → snapshot (shallow copy of the shape in §2.5)
- `Rga.ScriptSession.subscribe(fn)` → returns `unsubscribe()`
- `Rga.ScriptSession.init()` → wires the upstream listeners; idempotent
- `Rga.ScriptSession._reset()` (test-only) — drops subscribers + clears computed snapshot

**Upstream inputs (listeners ScriptSession wires on `init`):**

| Input | Source | Triggers recompute of |
|---|---|---|
| `editor.tabActivated` event | (existing) `document.dispatchEvent` from TabManager | `activeScript`, then everything else |
| `selectionchange` DOM event | filtered to PM selections on the active editor | `currentScene`, `currentPage`, `currentSelection` |
| `Rga.ViewManager.onChange` | engine | `currentView` |
| `Rga.Shell.Sidebar.onChange` | shell | `openPanels`, `activePanel` |
| `Rga.Shell.Layout.subscribe` | shell — fires when chrome state changes | (no-op for now; reserved for future fields like layout-aware writer context) |

**Recompute discipline:**
- A single internal `_recompute()` builds the new snapshot.
- Computed shallow-equal against the previous snapshot. If shallow-equal → no notification (calm by default).
- If not equal → swap stored snapshot, notify all subscribers synchronously with `(newSnapshot, prevSnapshot)`.

**Derivation rules per field:**

| Field | Derivation |
|---|---|
| `activeScript` | `Rga.TabManager.activeDoc()` → `{ docId, displayName, dirty }`. `null` if no doc. |
| `currentScene` | Walk `Rga.Nav.getIndex(view.state).scenes` for the first scene whose `[pmPos, pmEndPos)` contains `view.state.selection.from`. Returns `{ nodeId, sceneNumber, headingDisplay }` or `null`. |
| `currentPage` | Find the page in `Rga.Nav.getPageMap(view.state)` whose `blocks[]` contains the index of `currentScene`'s first body block (lookup by scene `nodeId` against `pagesToIndexEntries[].sceneIds`). Returns `{ number, total }` or `null`. |
| `currentView` | `Rga.ViewManager.current()`. |
| `currentSelection` | `{ from, to, empty }` from `view.state.selection`. |
| `openPanels` | `Rga.Shell.Sidebar.registered()`. |
| `activePanel` | `Rga.Shell.Sidebar.current()`. |

**Boundary discipline (the no-mutation rule applied to ScriptSession):**
- `ScriptSession` makes zero `view.dispatch` calls. It reads `view.state` only.
- `ScriptSession` does NOT set body classes, does NOT mutate `Rga.Shell.Layout` (it reads it).
- When a consumer needs to *change* writer context (e.g. switch view), they call the original owner's API. ScriptSession provides no setters.

**File size:** target ~120–150 LOC including the derivation helpers.

**Dependencies:** assumes `Rga.TabManager`, `Rga.ViewManager`, `Rga.Nav`, `Rga.Shell.Layout`, `Rga.Shell.Sidebar` exist at `init()` time. (Bootstrap order in §3.6 + §7 ensures this.)

### 3.6 `renderer/js/shell/index.js` → `Rga.Shell.init`

Bootstrap. Called once by the existing init code at the bottom of `index.html`.

**What it does:**
1. Initializes the Layout state container (already done by IIFE; no-op).
2. Calls `Rga.ScriptSession.init()` — wires the writer-context aggregator's upstream listeners.
3. Registers the 7 panel controllers (Scene Navigator, Script Workspace, Outline, Characters, Search, Revisions, Settings).
4. Calls `ActivityRail.init(railContainer)`.
5. Calls `StatusBar.init(statusBarContainer)`.
6. Calls `TitleBar.init(titlebarContainer)`.
7. Wires keyboard shortcuts (`Cmd-Shift-S` toggles the Scene Navigator, etc. — full list in §6.3).
8. Activates the default panel (Scene Navigator) and shows the sidebar.
9. Returns `true` on success, `false` if any container is missing.

**Order matters:** `Rga.Shell.init()` must run AFTER all panel modules have IIFE-registered themselves with `Sidebar.registerPanel`. The IIFE pattern handles this naturally — every panel module's IIFE runs at script tag evaluation, so by the time `index.html`'s bootstrap calls `Rga.Shell.init()`, the registry is populated. `ScriptSession.init()` runs early so panels that consume its snapshot get a populated session by their first mount.

### 3.7 Panel modules

Slice 1 ships 7 panel modules, each ~30-50 LOC. Two have real (placeholder-but-meaningful) content; five are "Coming in v0.2" empty states.

**Common pattern (illustrative — no code in this plan):**
Each panel module is an IIFE that, on load:
1. Builds its controller object (id, label, icon, shortcut, available, mount, unmount).
2. Calls `Rga.Shell.Sidebar.registerPanel(controller)`.

**Per-panel slice-1 content:**

| File | id | Slice-1 mount content |
|---|---|---|
| `panels/scene-navigator.js` | `sceneNavigator` | The **Scene Navigator** (see §3.7.1 for the full Slice 1 row contract). Reads `currentScene` from `Rga.ScriptSession` (the writer-context layer) for the current-scene mark; reads `Rga.Nav.getIndex(view.state).scenes` for row data. Click row → scrolls the editor to that scene. No drag-reorder, no filtering, no act grouping, no color — those are deferred per §3.7.1. |
| `panels/script-workspace.js` | `scriptWorkspace` | The **Script Workspace** (writer's home; never call this a "file browser" — see §3.7.3). Workspace assets grouped by category (master plan §5.3). Single click on a `.rga` → opens it in the editor (via existing `Rga.FileManager.openFromHandle` or equivalent). No asset linking, no favorites — those are Slice 2. |
| `panels/outline.js` | `outline` | Renders the empty-state copy from master plan §17.4: "No outline yet. The Outline panel arrives in v0.2." |
| `panels/characters.js` | `characters` | Empty-state: "Characters panel arrives in 0.2. For now, see the Breakdown tab in the Studio Panel for tag-driven character listings." |
| `panels/search.js` | `search` | Empty-state: "Cross-script search arrives in 0.2. For now, find-in-script is on the editor's right-click menu." |
| `panels/revisions.js` | `revisions` | Empty-state: "Version history is coming in 0.2. For now, your scripts are auto-saved every 30 seconds — see Storage in Settings for autosaves." |
| `panels/settings.js` | `settings` | A minimal "Settings" placeholder that opens in the sidebar; full Settings tab in the editor area is Slice 2+. For Slice 1, this shows a one-line "Settings UI arrives in 0.2. Edit `~/.rwanga/settings.json` directly to customize." |

Each "coming soon" panel's `mount` is a 5-line container population. The point is that the rail slot is **alive** — clicking shows the panel; the panel announces what it will become.

### 3.7.1 Scene Navigator — slice 1 contract (canonical internal name)

**The panel is NOT a list.** Internally and in all design / engineering discussion this surface is the **Scene Navigator** — a name that reflects its real role: scene **orchestration**, not enumeration. The rail tooltip and UI label may use the short word "Scenes" for compactness, but the panel's canonical name is Scene Navigator and the source file / class / state key all carry that name (`panels/scene-navigator.js`, `.rga-shell-scene-navigator`, `sidebar.activePanel === 'sceneNavigator'`).

**Why this matters:** Future shell slices add scene-orchestration intelligence on top of this panel — page jumps, scene relationships, continuity checks, story-intelligence overlays. Naming it "list" or "Scenes panel" anchors the design at the wrong layer of abstraction. The right mental model from day one is *orchestration surface*, not *items rendered in rows*.

**Per-row content (Slice 1):**

Each row is a single line with these visible elements in order:

| Element | Source | Notes |
|---|---|---|
| **Scene number** | `scenes[i].sceneNumber` | Derived; not stored. Right-padded to align across the column. |
| **Scene heading** | `scenes[i].headingDisplay` | The composed `setting · location · time` string. Truncated with ellipsis if the row is narrower than the heading. |
| **Estimated page** | derived from `Rga.Nav.getPageMap(state)` — the page number whose `blocks` contains this scene's first block index | A small muted right-aligned `p.12` tag. |
| **Note indicator** | `scenes[i].hasNotes === true` | Small 📝 glyph (or themed equivalent), right-aligned in an indicator group. |
| **Flag indicator** | `scenes[i].hasRevisionFlag === true` | Small 🚩 glyph, right-aligned in the same group. |
| **Current-scene mark** | derived: the scene containing the editor's current cursor position | A subtle left-edge accent bar or background tint on the active row. |

**Visual sketch (purely indicative — themes own actual styling):**

```
┌─ Scene Navigator ──────────────────────┐
│   1   INT. ROSE GARDEN — DAWN    p.1   │
│   2   EXT. KITCHEN — NIGHT        p.3   │
│ ▎ 3   INT. CAR — CONTINUOUS  📝🚩 p.5  │  ← current scene + has note + has flag
│   4   EXT. STREET — DAY           p.7   │
│   5   INT. ROOM — NIGHT      📝   p.9   │
│   …                                     │
└─────────────────────────────────────────┘
```

**Interactions (Slice 1):**
- **Click row** → scrolls the editor to that scene's `pmFrom` and places the cursor at the start of the scene heading. (This is the single allowed `view.dispatch` exception per §1.3 — selection-only, no doc mutation.)
- **Keyboard arrows when sidebar has focus** → moves the highlight; Enter activates.
- **No drag-to-reorder** in Slice 1.
- **No right-click context menu** in Slice 1.

**Current-scene tracking:** The Scene Navigator does NOT compute the enclosing scene itself. It subscribes to `Rga.ScriptSession.subscribe(fn)` and reads `snapshot.currentScene.nodeId` from each notification. The "current-scene mark" reflects this. (Derivation of "which scene contains the cursor?" lives in `Rga.ScriptSession` per §3.5 — the writer-context layer is the single source for this answer; the Scene Navigator is a consumer.)

### 3.7.2 Scene Navigator — mandatory future source

The Scene Navigator is **the** scene-orchestration surface for the entire shell, present and future. Other shell components that need to talk about, jump to, or reason over scenes consume the Scene Navigator's selection state and emit interactions through it — they do not duplicate the orchestration logic.

This is locked-in scope across slices:

| Future capability | Owned by Scene Navigator |
|---|---|
| Scene orchestration (drag-reorder, collapse groups, act grouping) | ✓ |
| Page jumps from anywhere in the shell (status bar "go to page", command palette `:N`) | ✓ — palette/status-bar route through Scene Navigator's navigation API, never re-implement scroll-to-scene |
| Scene relationships (linked scenes, callbacks, A/B story threads) | ✓ |
| Continuity surfacing ("NALI's hair color changes between scene 4 and scene 9") | ✓ — surfaced as row-level continuity indicators |
| Story-intelligence overlays (act structure markers, pacing heatmap, conflict density) | ✓ — each is a togglable layer over the same row structure |
| Filtering by character (clicked from the Characters panel) | ✓ — Characters panel calls `Rga.Shell.SceneNavigator.filterBy({ character: id })` |
| Filtering by tag | ✓ |
| Scene color coding | ✓ |
| Per-scene quick-edit (rename heading inline) | ✓ |

This is not a "wishlist." It is a commitment that Slice 1's Scene Navigator panel structure must be extensible enough to grow into all of these without re-architecting. The Slice 1 panel is the seed; each future slice adds a layer.

**Implication for Slice 1:** The Scene Navigator's slice-1 module exposes a navigation entry point even though Slice 1 itself doesn't have many callers. Future slices route through it; this is how we avoid Slice-2-onwards duplication.

**Per-panel API (Slice 1, on `Rga.Shell.SceneNavigator`):**
- `scrollToScene(nodeId)` → boolean — jumps the editor to that scene; returns false if nodeId not found.
- `_reset()` — test helper.

**Where `currentSceneNodeId` / `onChange` live:** these are NOT on Scene Navigator. They are properties of the writer-context layer:
- "Which scene is the cursor in?" → `Rga.ScriptSession.get().currentScene` (or `null`).
- "Notify me when the writer's context changes" → `Rga.ScriptSession.subscribe(fn)`.

The Scene Navigator subscribes to the same source as everyone else (Status Bar, Title Bar, future tools). Single derivation, multiple consumers. Future-slice Scene Navigator features grow as additional methods on the `Rga.Shell.SceneNavigator` namespace — but the "where is the cursor right now?" answer always comes from `Rga.ScriptSession`.

### 3.7.3 Script Workspace — never "file browser"

**The Script Workspace is NOT a "file browser."** The phrase does not appear in any UI string, comment, doc, or code identifier. The writer's workspace is a curated production surface (master plan §5.3) — calling it a file browser anchors it at the wrong concept-level. Acceptable phrasings:

- ✓ "Your Script Workspace"
- ✓ "Workspace contents"
- ✓ "Open the Script Workspace"
- ✓ "Workspace assets"
- ✘ "File browser"
- ✘ "File tree"
- ✘ "File explorer"
- ✘ "Files panel"

The source-audit test in §8 greps the shell layer for those four banned phrases.

Slice 1's Script Workspace shows a categorized view of the workspace assets per master plan §5.3 (Scripts / References / Images & Storyboards / Notes / Locations / Other). The categories are derived from file type, not folder structure (and that derivation logic is the one substantive piece of Slice 1 Workspace work — everything else is rendering).

### 3.7 `renderer/css/shell.css`

New file. All selectors prefixed `.rga-shell-*` to avoid conflict with editor styles.

**Sections (slice 1):**
- Window-zone layout (CSS grid for title-bar / workspace / status-bar)
- Activity rail (vertical flex, 48px width, hover + active states)
- Sidebar (resizable via CSS, hidden state with width:0)
- Editor area (just a wrapper; doesn't restyle the editor itself)
- Studio Panel (collapsible, no real content yet — just chrome)
- Status bar (horizontal flex, 22px height)

**No theme tokens yet.** Slice 1 hard-codes acceptable defaults. Theme tokens land when Slice 4 introduces the theme system. The shell CSS is structured so the eventual token swap is a search-and-replace on color values.

---

## 4. DOM Scaffolding

### 4.1 Current state of `index.html`

Per Phase 8 audit + Phase 9 cleanup, `index.html` already has these structural elements (mostly empty placeholders):
- `#menu-bar` (current menu surface)
- `#activity-bar` (empty placeholder — Slice 1 fills this)
- `#sidebar` (empty placeholder — Slice 1 fills this)
- `#tab-bar`, `#tab-new` (tab-manager owns these)
- `#editor-container`, `#editor` (mount target — Slice 1 does not touch)
- `#bottom-panel` (empty placeholder — Slice 1 wraps as Studio Panel)
- `#inspector-panel` (legacy; Slice 1 ignores)
- `#status-bar` (empty placeholder — Slice 1 fills this)
- `#workspace` (the row container)
- `#no-document-overlay` (legacy; Slice 1 ignores)

### 4.2 What Slice 1 adds

Inside `#activity-bar` (empty in slice 0): the rail rendering builds 7 `<button class="rga-shell-rail-item" data-panel-id="...">` elements at init time.

Inside `#sidebar`: a single `<div class="rga-shell-sidebar-host" id="rga-shell-sidebar-host">` that panels mount their content into via the controller's `mount(container)` call.

Inside `#status-bar`: five `<span class="rga-shell-status-segment" data-segment="...">` elements with their initial text.

A new top-level element for the title bar: inserted as the first child of `<body>`, above the existing `#workspace`. Slice 1 content:

```
<header id="rga-shell-titlebar" class="rga-shell-titlebar">
  <div class="rga-shell-titlebar-title">
    Rwanga
    <span class="rga-shell-titlebar-sep">•</span>
    <span class="rga-shell-titlebar-script-name">The Last Light</span>
    <span class="rga-shell-titlebar-dirty" aria-label="Unsaved changes">*</span>
  </div>
  <div class="rga-shell-titlebar-spacer"></div>
  <div class="rga-shell-titlebar-avatar-placeholder" aria-hidden="true">👤</div>
</header>
```

**Title-text behavior (Slice 1):**

| Active script state | Rendered title text |
|---|---|
| No script open | `Rwanga` (no separator, no script name, no dirty mark) |
| Script open, clean | `Rwanga • The Last Light` |
| Script open, dirty (unsaved changes) | `Rwanga • The Last Light *` (asterisk visible) |
| Untitled script, never saved | `Rwanga • Untitled.rga *` (dirty by definition until first save) |

**Data source:** `Rga.ScriptSession.get().activeScript` — the writer-context layer exposes `{ docId, displayName, dirty }`. Title Bar subscribes to `Rga.ScriptSession.subscribe(fn)` on init and re-renders on each notification whose `activeScript` field differs from the previous snapshot's `activeScript` (shallow-equal check inside the title bar's update handler — ScriptSession's snapshot-equality already filters most no-op notifications).

ScriptSession's upstream listener for `activeScript` is `editor.tabActivated`. The dirty bit is recomputed each time ScriptSession recomputes — which means the title bar's `*` indicator updates without needing any new event channel.

If `dirty` updates prove to lag (the existing engine doesn't fire `tabActivated` on every dirty-bit flip), Slice 1 may add **one** thin event — `document.dispatchEvent(new CustomEvent('editor.docDirtyChanged'))` from `Rga.Doc.markDirty` / `Rga.Doc.clearDirty` — that ScriptSession's listener set picks up. That's the only new shell-adjacent engine event allowed in Slice 1, and it lives on the engine side (in `doc.js`) because it's a notification of doc-state mutation, not shell mutation.

**Window-title sync (OS chrome):** on Electron desktop, `document.title` also updates to the same string so the OS window title bar matches. On the web build (Slice 5+), `document.title` drives the browser tab title.

**Avatar placeholder:** A static `👤` glyph with `aria-hidden="true"` (it's decorative in Slice 1; no popover, no click handler). Slice 3 wires it to the identity popover per master-plan §3.6.

The Studio Panel wrapper: `#bottom-panel` (existing) gets a class addition `rga-shell-studio-panel` and a header strip showing the studio-panel tabs (Scene · Notes · Flags · Problems · Breakdown). Tab contents in Slice 1 are empty `<div>` shells; existing engine-installed panel content (annotations / flags from the cross-schema plugins) continues to render inside as it does today.

### 4.3 What Slice 1 does NOT add

- No new top-level container restructure.
- No CSS Grid migration if the current layout uses Flex (or vice versa) — slice 1 honors what's there.
- No removal of `#menu-bar` (the existing menu stays; integration with the new title bar happens in Slice 2 along with menu-bar redesign).
- No removal of `#inspector-panel` (legacy element ignored, not deleted; the cleanup risks regressing some path we haven't audited).

---

## 5. CSS Strategy

### 5.1 Isolation

All Slice 1 styles live in `renderer/css/shell.css` with selectors prefixed `.rga-shell-*`. No conflicts with `editor-prosemirror.css` because the editor's selectors are `.ProseMirror`, `.rga-scene-v3`, `.rga-page-sheet`, etc. — no overlap.

### 5.2 Inclusion

`renderer/index.html` gets one new `<link rel="stylesheet" href="css/shell.css">` near the top of `<head>`, after `editor-prosemirror.css`. Order: shell loads second so it can layer reliably above editor defaults if any selector overlap ever creeps in.

### 5.3 Theme readiness

Color values are hard-coded as CSS custom properties scoped to `:root`:
```
:root {
  --rga-shell-bg-primary:   /* ... */;
  --rga-shell-bg-secondary: /* ... */;
  --rga-shell-text-primary: /* ... */;
  --rga-shell-text-muted:   /* ... */;
  --rga-shell-border:       /* ... */;
  --rga-shell-accent:       /* ... */;
}
```

When the theme system arrives (master plan §14), these custom properties become the token resolution layer. Slice 1's hard-coded values are placeholder Paper-Light-aligned.

### 5.4 Reduced motion

Slice 1 honors the user's reduced-motion preference via `@media (prefers-reduced-motion: reduce)` blocks. Panel switches and sidebar collapses cross-fade in 80ms by default, instant under reduced-motion.

---

## 6. Engine Integration Touch Points

The shell reads engine state. It does NOT mutate it. Every read uses a documented API from master plan §21.

### 6.1 Read-only access patterns

**ScriptSession (the writer-context layer, §3.5) is the only shell module that subscribes broadly to engine state.** Other shell modules read from ScriptSession.

| Shell module | Engine API | Purpose |
|---|---|---|
| `script-session.js` | `Rga.TabManager.activeDoc()` + `editor.tabActivated` event | `activeScript` field — script identity + dirty bit. |
| `script-session.js` | `Rga.Nav.getIndex(view.state).scenes` + `view.state.selection` + `selectionchange` DOM event | `currentScene` field — cursor → enclosing scene walk. |
| `script-session.js` | `Rga.Nav.getPageMap(view.state)` + scene-to-page lookup | `currentPage` field. |
| `script-session.js` | `Rga.ViewManager.current()` + `Rga.ViewManager.onChange` | `currentView` field. |
| `script-session.js` | `view.state.selection` (read-only) | `currentSelection` field. |
| `script-session.js` | `Rga.Shell.Sidebar.registered()` + `.current()` + `.onChange` | `openPanels` / `activePanel` fields. |
| `panels/scene-navigator.js` | `Rga.Nav.getIndex(view.state).scenes` + `Rga.Nav.getPageMap(view.state)` | Build rows + per-row estimated page tag. |
| `panels/scene-navigator.js` | `Rga.ScriptSession.subscribe` → `snapshot.currentScene.nodeId` | Drives the current-scene mark — no independent derivation. |
| `panels/scene-navigator.js` | `view.dispatch(view.state.tr.setSelection(...))` | Scroll-to-scene on click. (Technically a dispatch, but for selection only — no doc mutation. **The single exception** to the "no dispatch" rule, and only because it's purely navigational.) |
| `status-bar.js` | `Rga.ScriptSession.subscribe` → snapshot fields | All four engine-derived segments (scene / page / view / language). No direct engine subscriptions for derived state. |
| `status-bar.js` | `Rga.TabManager.activeDoc().metadata.screenplayProfile.language` + `editor.tabActivated` | Language segment (per-script setting, not in writer-context snapshot). |
| `status-bar.js` | `Rga.ViewManager.activate(nextMode)` | Click-to-cycle view mode. |
| `titlebar.js` (within `shell/index.js`) | `Rga.ScriptSession.subscribe` → `snapshot.activeScript` | Title text + dirty asterisk. |
| `panels/script-workspace.js` | `Rga.FileManager.openFromHandle` (existing) | Open `.rga` on click. |
| `panels/script-workspace.js` | OS file enumeration via `window.rwanga.files.*` (existing IPC) | Workspace asset listing. |

### 6.2 Event subscriptions

Slice 1 subscribes to these existing `document.dispatchEvent` channels (no new events introduced):
- `editor.tabActivated` → status bar refreshes all engine-derived segments; active sidebar panel calls its mount again (re-render against new doc).
- `editor.annotationAdded/Removed/Resolved/Restored` (existing) → no Slice 1 use; left intact for the Notes tab in the Studio Panel (which is engine-owned, not shell-owned).

No new event channels are created in Slice 1.

### 6.3 Keyboard shortcuts

Slice 1 wires these via the shell's keyboard layer (a small `document.addEventListener('keydown')` registered in `Rga.Shell.init`):

| Combo | Action |
|---|---|
| `Cmd-Shift-S` | Toggle Scene Navigator (activate or deactivate via Sidebar) |
| `Cmd-Shift-E` | Toggle Script Workspace |
| `Cmd-Shift-O` | Toggle Outline (placeholder panel still toggles) |
| `Cmd-Shift-C` | Toggle Characters |
| `Cmd-Shift-F` | Toggle Search |
| `Cmd-Shift-R` | Toggle Revisions |
| `Cmd-,` | Toggle Settings |
| `Cmd-B` | Toggle sidebar visibility (regardless of active panel) |
| `Cmd-J` | Toggle Studio Panel visibility |

**Conflict-avoidance discipline:** every binding uses `Cmd-Shift-X` or `Cmd-X` with a non-engine modifier combination. Engine keymap bindings (Tab, Shift-Tab, Enter, Mod-Enter, Backspace inside the editor) are bare keys — they cannot collide with `Cmd-` prefixed shell shortcuts.

The shell's keydown handler runs at the document level. PM's keymap plugins run on the editor's DOM and stopImmediatePropagation when they handle a key. So:
- Inside the editor: PM keymap wins first; shell handler only fires for keys PM doesn't bind (every `Cmd-Shift-X` listed above).
- Outside the editor (sidebar / status bar / focus on nothing): shell handler fires directly.

**Cmd-Z / Cmd-Y are NOT bound by the shell.** The engine owns undo/redo via its history plugin.

---

## 7. Boot Order

The `index.html` bootstrap script (current state — runs after all module IIFEs) gets one line added in this order:

```
1. (existing) Rga.ViewMode.init()
2. (existing) Rga.FormatToolbar.init()
3. NEW       Rga.Shell.init()           ← inserted here
4. (existing) Rga.TabManager.init()
5. (existing) Rga.TabManager.bootSession()
```

Why between ViewMode and TabManager:
- `Rga.ViewMode.init` registers controllers with `Rga.ViewManager` — must come first because `Rga.Shell.StatusBar` reads `ViewManager.current()` at init.
- `Rga.Shell.init` builds the DOM zones — must come before TabManager because TabManager's `init` looks for `#editor` to mount into, and that element must exist (we don't move it; we only add siblings).
- `Rga.TabManager.bootSession` reopens saved tabs — fires `editor.tabActivated` events the status bar listens for.

All of these IIFE-register at script load. `Rga.Shell.init()` is the explicit boot step that builds DOM and wires events.

---

## 8. Test Plan

Per directive: layout state tests, rail selection tests, sidebar host tests, **no editor engine regression tests** (existing 366 stay green; verifying that IS the regression test).

### 8.1 New test files

| File | Approx tests | Covers |
|---|---|---|
| `tests/unit/shell/layout.test.js` | 8-10 | `Rga.Shell.Layout` API + merge + subscribe + reset |
| `tests/unit/shell/sidebar.test.js` | 10-12 | `Rga.Shell.Sidebar` registration + mutual exclusion + mount/unmount + reactivation |
| `tests/unit/shell/activity-rail.test.js` | 6-8 | Rail renders registered panels in order; click activates; visual active-state syncs with Sidebar.current() |
| `tests/unit/shell/script-session.test.js` | 10-12 | `Rga.ScriptSession` snapshot shape; recompute on each upstream input (tabActivated / selectionchange / viewManager.onChange / sidebar.onChange); shallow-equality filters no-op notifications; no setters / no engine mutations; `_reset` clears subscribers |
| `tests/unit/shell/scene-navigator.test.js` | 8-10 | Row contract (scene number / heading / estimated page / note + flag indicators / current-scene mark); `scrollToScene` API; current-scene mark sourced from `Rga.ScriptSession`; no independent cursor walk |
| `tests/unit/shell/status-bar.test.js` | 8-10 | Each segment reads from `Rga.ScriptSession` (not engine directly); Scene segment format `Scene: SN`; Page segment format `Page: N/M`; refresh on session notification; viewMode click calls `Rga.ViewManager.activate` |
| `tests/unit/shell/titlebar.test.js` | 4-6 | Title text format per state matrix (§4.2); sourced from `Rga.ScriptSession.activeScript`; dirty asterisk appears/disappears; `document.title` mirrors |
| `tests/unit/shell/integration.test.js` | 4-6 | End-to-end: Rga.Shell.init builds zones, registers panels, default panel is the Scene Navigator; clicking a rail item activates the corresponding panel; ScriptSession is initialized before panels mount |
| `tests/unit/shell/source-audit.test.js` | 6 | Greps the shell source for forbidden patterns: (a) `view.dispatch(` calls outside the documented Scene-Navigator exception; (b) `.classList.contains(` reads-as-source-of-truth; (c) raw `view.state.doc` mutations; (d) banned writer-facing strings `'Document'`/`'Node'`/`'Plugin'`/`'Render'` per §1.4; (e) banned phrases `'file browser'`/`'file tree'`/`'file explorer'`/`'Files panel'` per §3.7.3; (f) the literal `"Scenes panel"` phrase outside docs |

Total: ~66-72 new shell tests. Brings suite to ~432-438 (was 366).

### 8.2 Concrete test names (representative, not exhaustive)

**layout.test.js**
- `Layout.get() returns the default state on first read`
- `Layout.get() returns a SHALLOW COPY — mutations don't affect internal state`
- `Layout.set({sidebar: {visible: false}}) merges; other sidebar fields preserved`
- `Layout.set with deeply-merged path only touches specified leaves`
- `Layout.set(null) / set(undefined) is a safe no-op`
- `Layout.subscribe(fn) fires synchronously after set`
- `Layout.subscribe returns unsubscribe; unsubscribe stops further notifications`
- `Layout._reset() restores defaults`

**sidebar.test.js**
- `registerPanel({id, mount, unmount}) accepts a valid controller`
- `registerPanel rejects duplicate id`
- `activate(id) calls panel.mount with the sidebar host container`
- `activate(B) when A is current calls A.unmount then B.mount`
- `activate(id) when id is current re-calls mount without unmount`
- `deactivate() calls current panel's unmount and clears current()`
- `current() returns null on first boot`
- `onChange fires (newId, prevId) on every activate / deactivate`
- `registered() returns ids in registration order`
- `_reset() clears registry`

**activity-rail.test.js**
- `init builds one button per registered panel in registration order`
- `each button has data-panel-id matching its panel.id`
- `each button has an aria-label from panel.label`
- `clicking an inactive button calls Sidebar.activate(id) + Layout.set sidebar.visible=true`
- `clicking the active button calls Sidebar.deactivate + Layout.set sidebar.visible=false (toggle off)`
- `rail's visual .active state syncs after Sidebar.onChange fires`

**scene-navigator.test.js**
- `each row renders sceneNumber + headingDisplay + estimated page + indicators in the documented order`
- `rows with hasNotes=true show the note indicator`
- `rows with hasRevisionFlag=true show the flag indicator`
- `the row containing the cursor's enclosing scene gets the current-scene mark`
- `scrollToScene(nodeId) dispatches a selection-only transaction targeting that scene's pmFrom`
- `scrollToScene(nodeId) returns false on unknown nodeId without throwing`
- `currentSceneNodeId() returns the nodeId of the scene whose [pmPos, pmEndPos) contains the cursor`
- `currentSceneNodeId() returns null when the cursor is outside any scene`
- `onChange fires (currentNodeId, prevNodeId) on selection-change events that cross scene boundaries`
- `onChange does NOT fire on selection-change events that stay within the same scene`

**status-bar.test.js**
- `init creates 5 segment elements with their initial text`
- `viewMode segment text reflects Rga.ViewManager.current()`
- `viewMode segment updates when Rga.ViewManager.onChange fires`
- `scene segment renders "Scene: S{N}" where N is the current scene's sceneNumber`
- `scene segment renders "Scene: —" when no script is open`
- `page segment renders "Page: {N}/{M}" where M is pageMap.length and N is the current page`
- `page segment renders "Page: —/—" when no script is open`
- `language segment shows the active script's screenplayProfile.language`
- `offlineIndicator is hard-coded 'Local' in Slice 1`
- `selection-change events refresh the scene + page segments without touching the others`
- `editor.tabActivated event triggers refresh of all engine-derived segments`

**titlebar.test.js**
- `title text is "Rwanga" when no script is open`
- `title text is "Rwanga • {displayName}" when a clean script is active`
- `title text is "Rwanga • {displayName} *" when the active script is dirty`
- `dirty asterisk disappears after Rga.Doc.clearDirty + editor.tabActivated`
- `document.title mirrors the in-app title bar text`
- `avatar placeholder element is present with aria-hidden="true" and no click handler in Slice 1`

**integration.test.js**
- `Rga.Shell.init returns true when all required containers are present`
- `Rga.Shell.init returns false when #activity-bar is missing`
- `after init, 7 rail buttons are present in master-plan §4.1 order`
- `after init, the Scene Navigator is the active panel and sidebar.visible is true`
- `clicking the Outline rail button activates the (placeholder) Outline panel`
- `pressing Cmd-Shift-S toggles the Scene Navigator`

**source-audit.test.js**
- `no shell file contains view.dispatch( outside the navigation-only allowlist`
- `no shell file reads .classList.contains( as source of truth (greps for "if (.*classList.contains")`
- `no shell file mutates view.state.doc directly (greps for ".state.doc.replaceWith(" etc.)`

### 8.3 The 366-existing-tests rule

After every Slice 1 commit, the full unit suite must report 366 passing pre-existing tests plus N new shell tests, with zero failures. Any drop below 366 pre-existing pass count blocks the slice.

### 8.4 What the test plan does NOT include

- No visual regression tests (no screenshot diffing).
- No e2e tests (Playwright integration is a separate concern).
- No performance benchmarks (Slice 1 has no perf-critical paths).
- No accessibility audit tests (those run as a manual gate before v0.1 ships, not per slice).

---

## 9. Risk Register

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | Shell CSS bleeds into editor CSS | M | Strict `.rga-shell-*` prefix; CSS-audit test that greps shell.css for non-prefixed selectors. |
| R2 | `#editor` element accidentally re-parented or restyled, breaking `Rga.Editor.mount` | H | DOM scaffolding adds siblings only; an integration test asserts `document.getElementById('editor')` exists and matches the pre-shell selector list. |
| R3 | Shell keydown handler swallows engine keys (Tab in particular) | H | Shell keydown only listens for `Cmd-/Cmd-Shift-` combos; verified by audit test. Tab + Enter + Mod-Enter never enter the shell handler. |
| R4 | Status bar reads engine state during keystroke, causing perf hit | M | Status bar only refreshes on events listed in §6.2; no `requestAnimationFrame` polling. |
| R5 | `Rga.Shell.Layout` becomes a god-state catch-all in later slices | L (now), M (later) | This plan defines the shape strictly; Slice 2 plan must justify each field added. |
| R6 | Panel controllers leak DOM references across (un)mount cycles | M | Sidebar test asserts that after `unmount`, the container has been cleared (`container.children.length === 0`). |
| R7 | The two real panels (Scenes, Script Workspace) drift in scope into Slice 2 work | M | This plan explicitly bounds Slice 1 content: Scenes = read-only list, no drag/reorder/filter; Workspace = read-only tree, no asset linking/favorites. Drift gets caught at PR review. |
| R8 | The existing `#bottom-panel` element has structure the engine plugins depend on, and adding a Studio Panel wrapper breaks them | M | Audit: `revision-flags.js` and `annotation-notes.js` look up specific element IDs (`#annotation-notes-list`, `#revision-flags-list`). Slice 1 preserves those IDs verbatim. |
| R9 | RTL layouts not honored from day one → expensive retrofit later | M | Slice 1 CSS uses logical properties (`inline-start`, `inline-end`) and tests the rail on `dir="rtl"` body once. Not a heavy lift if done now. |
| R10 | Test boot for shell tests becomes a 200-line copy-paste of paths | M | Extract a `tests/unit/shell/_shell-boot.js` helper that handles the common boot (jsdom + Rga stubs + script loads). |

---

## 10. Acceptance Gate Verification

Verbatim from the directive, with the verification method per gate.

| Gate | How verified |
|---|---|
| ✓ **app boots** | Manual smoke + `tests/unit/shell/integration.test.js: Rga.Shell.init returns true...` |
| ✓ **editor remains usable** | 366 pre-existing tests still pass + manual smoke (open `sample-the-last-light.rga`, type, save) |
| ✓ **shell zones visible** | Integration test asserts existence of `#rga-shell-titlebar`, `#activity-bar` (with children), `#rga-shell-sidebar-host`, `#editor`, `.rga-shell-studio-panel`, `#status-bar` (with children) |
| ✓ **rail switches sidebar panels** | `activity-rail.test.js: clicking the Outline rail button activates the (placeholder) Outline panel` + manual smoke |
| ✓ **no DOM-owned source of truth** | `source-audit.test.js: no shell file reads .classList.contains( as source of truth` |
| ✓ **keyboard shortcuts not broken** | A specific test fires Tab inside the editor and asserts the engine's cycleBlockType handler ran (i.e., the shell didn't swallow Tab). Verification at the test level — no e2e needed. |
| ✓ **all tests green** | `npm run test:unit` reports `pass N, fail 0` where N >= 366 + new shell tests count |

A Slice 1 PR cannot land until all seven gates pass.

---

## 11. Out of Scope (Deferred — explicit list)

These are listed so they don't slip into Slice 1 by accident. Each links to its destination slice.

| Item | Lands in |
|---|---|
| Layout persistence to `.rwanga-workspace/layout.json` | Slice 2 |
| Scene Navigator depth (drag-reorder, collapse groups, scene color, act grouping, filters, inline heading edit) — per §3.7.2 the panel itself is shipped in Slice 1; each capability is a separate layer added on top in later slices | Slice 2+ (per-capability) |
| Real Script Workspace (with asset linking, favorites, category toggling) | Slice 2 |
| Real Outline panel (statistics + character-appearance list) | Slice 2 |
| Real Characters panel | Slice 2 |
| Real Search panel | Slice 2 |
| Real Revisions panel | Slice 2 |
| Settings tab in editor area (UI mode + JSON mode) | Slice 2 |
| Title-bar avatar identity popover (sign-in, sync, cache management) | Slice 3 |
| Command palette (Cmd-K) | Slice 3 |
| Notifications system (toasts + inbox) | Slice 3 |
| Theme system (Paper Light / Paper Dark / etc.) | Slice 4 |
| Welcome view + onboarding tour | Slice 4 |
| Editor splits / multi-group | Slice 5 |
| Live updating of status bar sceneCount / pageCount on every doc change | Slice 2 (small bridge from nav-index plugin into a shell event) |

---

## 12. Open Questions

Concrete decisions that need a call before implementation starts. Each is one paragraph; recommendation in **bold**.

1. **Default sidebar visibility on first boot.** Open with Scenes active, or hidden? Master plan §22 OQ4 recommends open. **Recommendation: open.** Reason: a writer launching for the first time immediately sees the Scene Navigator — the screenplay-first surface gets shown without instruction.

2. **Settings panel placement.** Master plan §4.1 puts Settings at the bottom of the rail (spacer-pushed). Slice 1: implement that with CSS flex, or implement as a regular rail item now and defer the bottom-pinning to Slice 2? **Recommendation: implement bottom-pinning now.** It's one extra CSS rule and avoids a visible re-layout in Slice 2.

3. **Rail icons.** Emoji placeholders (📋📁🌳👥🔍📜⚙️) vs. SVG icons from day one? **Recommendation: emoji placeholders in Slice 1.** They render natively, work in every theme, and the design system for real icons is a separate exercise that shouldn't gate the shell skeleton.

4. **Title bar content.** ~~Slice 1 says "title bar placeholder." Show what — just app name? App name + dirty-state script name?~~ **DECIDED (Review Round 2):** Mandatory format `Rwanga • {script name}` with dirty indicator (`*`). Full spec in §4.2. Drives both the in-app title bar and `document.title` for OS window chrome.

5. **What does `Cmd-J` toggle in Slice 1?** The Studio Panel exists as chrome but has no real new content (the engine-installed `#annotation-notes-list` etc. continue to render inside). Does `Cmd-J` toggle the wrapper visible/hidden? **Recommendation: yes** — wrapper toggle works even with placeholder content, and the binding is now muscle-memory-correct for Slice 2 when real tabs land.

6. **Workspace context in Slice 1.** The Script Workspace placeholder needs *some* notion of "current workspace folder" to list files. The existing TabManager has per-tab handles but no workspace concept. Options: (a) treat the OS folder of the currently-open script as the workspace, (b) ship Workspace concept first as part of Slice 1, (c) hard-code an "Open Folder…" affordance that sets a session-scoped workspace path. **Recommendation: (a) for Slice 1** — implicit workspace = folder of the open script. Slice 2 introduces explicit workspaces with `.rwanga-workspace/`.

7. **What happens when no script is open?** Slice 1 status bar segments show "—". The Scenes / Workspace panels show their empty states. The editor area shows whatever the existing "no document overlay" already shows (`#no-document-overlay`). **Recommendation: no change to the no-document state in Slice 1.** The Welcome view is Slice 4.

---

## 13. Implementation Order (suggested commit sequence)

A reasonable PR-level sequence. Each commit leaves the suite green. Eight commits, end-to-end:

| # | Commit | What it adds | Test posture |
|---|---|---|---|
| 1 | `shell: add Rga.Shell.Layout state container` | `renderer/js/shell/layout.js` + `tests/unit/shell/layout.test.js` | New tests pass; existing 366 still pass. No DOM impact. |
| 2 | `shell: add Rga.Shell.Sidebar registry + host` | `renderer/js/shell/sidebar.js` + `tests/unit/shell/sidebar.test.js` | New tests pass; existing pass. No DOM impact yet (sidebar host element added in commit 4). |
| 3 | `shell: add Rga.Shell.ActivityRail` | `renderer/js/shell/activity-rail.js` + `tests/unit/shell/activity-rail.test.js` | Tests use jsdom-mounted rail; existing pass. |
| 4 | `shell: scaffold DOM zones (titlebar + workspace zones) in index.html + base shell.css` | `index.html` edits (including the `#rga-shell-titlebar` insertion) + `renderer/css/shell.css` (zones only — no rail/sidebar fill yet) | Manual smoke: app boots, editor still works. |
| 5 | `shell: add Rga.ScriptSession writer-context aggregator` | `renderer/js/shell/script-session.js` + `tests/unit/shell/script-session.test.js` | ScriptSession tests pass: snapshot shape, upstream listeners, shallow-eq filter, no engine mutation. Existing tests pass. |
| 6 | `shell: add Rga.Shell.SceneNavigator panel + scrollToScene API` | `renderer/js/shell/panels/scene-navigator.js` + `tests/unit/shell/scene-navigator.test.js` | Scene Navigator tests pass; current-scene mark is driven by ScriptSession (no independent walk). Existing pass. |
| 7 | `shell: register the 6 placeholder panels (Script Workspace + Outline + Characters + Search + Revisions + Settings)` | `renderer/js/shell/panels/*.js` (six small files; each registers via the IIFE pattern) | Sidebar registry tests confirm all 7 panels are registered in §4.1 order. |
| 8 | `shell: add Rga.Shell.init bootstrap + activate Scene Navigator by default` | `renderer/js/shell/index.js` + one-line addition to `index.html` bootstrap + `tests/unit/shell/integration.test.js` first version | Integration test passes: 7 rail buttons present, Scene Navigator is the active panel after init, ScriptSession.init was called before panel mount. |
| 9 | `shell: add Rga.Shell.StatusBar with 5 segments (Scene/Page/View/Lang/Local)` | `renderer/js/shell/status-bar.js` + `tests/unit/shell/status-bar.test.js` | Status bar reads from ScriptSession with new Scene/Page format; existing pass. |
| 10 | `shell: add Rga.Shell.TitleBar with "Rwanga • {script name} *" format` | titlebar logic in `shell/index.js` + `tests/unit/shell/titlebar.test.js` | Titlebar reads from ScriptSession; `document.title` mirroring verified. |
| 11 | `shell: wire Cmd-Shift-X panel toggle shortcuts` | keyboard layer in `shell/index.js` + a Tab-not-swallowed test | Tab-passthrough test passes; existing pass. |
| 12 | `shell: add source-audit tests (the 6 checks per §8.1)` | `tests/unit/shell/source-audit.test.js` | All 6 audit checks pass; all 7 acceptance gates verified end-to-end. |

If a commit lands with broken existing tests, it's reverted on the spot — the slice is not "go land everything then fix." This is the same single-thread discipline that landed the engine phases.

(The plan-version-1 sequence was 11 commits; the addition of the `Rga.ScriptSession` ownership layer per §2.5 + §3.5 inserts commit 5, growing the sequence to 12.)

---

## 14. Glossary Additions

These terms enter the project vocabulary with Slice 1. Add them to master plan §24 when they ship.

| Term | Definition |
|---|---|
| `Rga.Shell.Layout` | **Shell-truth** ownership layer. Single in-memory container for shell-zone state (sidebar/studio panel/title bar/status bar visibility + dimensions + active panel/tab). Slice 1 in-memory only; Slice 2 adds workspace JSON persistence. One of the three ownership layers per §2.5. |
| `Rga.ScriptSession` | **Writer-context-truth** ownership layer. The aggregated snapshot of "where is the writer right now?" — activeScript / currentScene / currentPage / currentView / currentSelection / openPanels / activePanel. Derived from PM doc + Layout + ViewManager + Sidebar; never owns primary state. One subscribe channel for all consumers. Consumers in Slice 1: Scene Navigator, Status Bar, Title Bar. Locked in for: continuity tools, focus mode, AI context, session restore. See §2.5 + §3.5. |
| `Rga.Shell.Sidebar` | The registry + host for sidebar panels. Mutually exclusive (one active at a time). Identical lifecycle pattern to `Rga.ViewManager`. |
| `Rga.Shell.ActivityRail` | The 48px left-edge column of panel buttons. Renders from the Sidebar's panel registry; clicks toggle panels via Sidebar.activate / deactivate. |
| `Rga.Shell.SceneNavigator` | The canonical scene-orchestration surface — never a "list." Owns row rendering and the `scrollToScene` navigation API that every other shell component routes through (per §3.7.2). Current-scene tracking is delegated to `Rga.ScriptSession.currentScene` — the writer-context layer. |
| `Rga.Shell.StatusBar` | The 22px bottom strip with five segments. Read-only over engine state. Scene/Page segments use position-first format (`Scene: S12`, `Page: 12/87`). |
| `Rga.Shell.TitleBar` | The top strip rendering `Rwanga • {script name} *`. Mirrors to `document.title` for OS chrome. |
| `Rga.Shell.init()` | The one-line bootstrap call that builds shell DOM and wires events. Idempotent; safe to call once per app boot. |
| **Sidebar host** | The `<div id="rga-shell-sidebar-host">` inside the sidebar that panel `mount(container)` paints into. Cleared on every panel switch. |
| **Panel controller** | A `{ id, label, icon, shortcut?, available, mount, unmount }` object a panel module registers via `Sidebar.registerPanel`. |
| **Scene Navigator** | The canonical internal name for the panel formerly drafted as "Scenes Panel." A scene-orchestration surface (page jumps, scene relationships, continuity, future story intelligence), not an enumerated list. UI label may abbreviate to "Scenes" on the rail for compactness; design / code / state keys use "Scene Navigator" / `sceneNavigator`. |
| **Script Workspace** | The canonical name for the writer's workspace-asset panel. Never called a "file browser" / "file tree" / "file explorer" / "Files panel" anywhere in shell source or copy (§3.7.3). |
| **Writer-facing language rule** | Shell UI / copy / a11y never use the engine words *Document*, *Node*, *Plugin*, *Render*. Translations in §1.4. Enforced by a source-audit test. |

---

## 15. Definition of Done

Slice 1 is done when:

1. The 8 commits from §13 have all landed.
2. All 7 acceptance gates from §10 pass.
3. The risk register (§9) has been re-reviewed; no R-rated risk is open.
4. A 5-line "What Slice 1 shipped" entry has been added to the project changelog.
5. A "Slice 2 planning kickoff" follow-up issue / note exists, referencing the deferred items from §11.

End of Slice 1 plan.
