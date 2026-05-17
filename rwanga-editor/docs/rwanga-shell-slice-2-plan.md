# Rwanga Shell — Slice 2 Implementation Plan

**Status:** Plan only. Nothing in this document ships until the plan itself is approved and the implementation phase opens.
**Author:** Rwanga shell — Slice 2 (post-Slice-1 sign-off).
**Date:** 2026-05-16
**Pairs with:** `docs/rwanga-app-shell-master-plan.md`, `docs/rwanga-shell-slice-1-plan.md`, `docs/rwanga-shell-compatibility-inventory.md`.

---

## 0. Status, Scope, Non-Scope

### 0.1 What Slice 2 is

The slice that turns the Slice 1 skeleton into something a writer actually uses. After Slice 2:

- **Scene Navigator is genuinely useful** — keyboard-navigable, current-scene highlight tied to live cursor, per-row page numbers, note/flag indicators visible.
- **Script Workspace is genuinely useful** — categorized view of the active script's folder; clicking a `.rga` opens it in the editor; non-`.rga` assets reveal as external-open placeholders.
- **Outline is genuinely useful** — title, scene count, page count, character appearances, statistics; clicking a scene jumps the editor.
- **Status bar is shell-owned** — the new `Rga.Shell.StatusBar` is the only live status bar. The legacy `Rga.StatusBar` and its hardcoded `#status-bar` children are gone.
- **Legacy `Rga.Sidebar` is gone** — every callsite either migrated to `Rga.Shell.Sidebar.*` or removed. `#sidebar-header` placeholder element removed.
- **Layout persistence is API-ready** — `Rga.Shell.Layout.toJSON()` / `.fromJSON(snap)` exist as a pure in-memory contract; disk wiring is deferred to whichever slice introduces workspace `.rwanga-workspace/` persistence.
- **Compatibility Inventory entries #1, #2, #3, #4 are resolved** (or explicitly BLOCKED with a documented reason per the inventory's §3 update protocol).

### 0.2 What Slice 2 is NOT

Mirrors the directive's "Rules" verbatim plus the natural consequences:

- ❌ No editor engine changes. The locked engine surface from Phase 9 stays untouched.
- ❌ No pagination changes.
- ❌ No print/PrintPreview changes.
- ❌ No Pro features / account / sync / AI surfaces.
- ❌ No command palette (Slice 3).
- ❌ No notifications system (Slice 3).
- ❌ No theme system (Slice 4).
- ❌ No onboarding tour (Slice 4).
- ❌ No Studio Panel takeover (Slice 3 — Compatibility Inventory entry #5 stays open).
- ❌ No layout disk persistence — only the in-memory serialization shape (the disk wiring waits until workspace `.rwanga-workspace/` lands).
- ❌ No drag-to-reorder, color coding, act grouping, or filtering in the Scene Navigator (per master plan §3.7.2 those land in Slice 3+).
- ❌ No asset-to-scene linking in the Script Workspace (master plan §5.3 defers it).
- ❌ No real Search panel, no real Revisions panel, no real Characters panel, no real Settings panel — those stay placeholder.

### 0.3 Why this slice is the right next step

Slice 1 proved the architectural patterns (three-layer ownership, panel registry, single-source state). Slice 2 cashes them in: real consumers populating with real data, legacy coexistence retired. After Slice 2 the writer can open a script and feel the shell working *for* them — not as scaffolding that announces "Coming in v0.2" in five rail positions.

---

## 1. Architectural premise

### 1.1 What changes

- Three placeholder panel modules (`script-workspace.js`, `outline.js`, `scene-navigator.js`) get real implementations replacing their "Coming in v0.2" empty states.
- `Rga.ScriptSession` gains two new derived fields (`wordCount`, `currentBlockType`) so the new status bar can absorb the segments the legacy `Rga.StatusBar` currently shows.
- `Rga.Shell.Layout` gains `toJSON()` + `fromJSON()` — a pure-function serialization contract. No disk wiring.
- `Rga.Shell.StatusBar` gains two segments to match the legacy status bar's word-count + block-type indicators, then takes over the live `#status-bar` element.
- Legacy `Rga.StatusBar`, `Rga.Sidebar`, and the `#sidebar-header` placeholder element are deleted from the codebase.
- The Slice 1 compatibility inventory entries #1, #2, #3, #4 are annotated RESOLVED.

### 1.2 What doesn't change

- All `renderer/js/framework/*` engine modules — untouched.
- All `renderer/js/doc-types/screenplay/*` — untouched.
- `mount.js`, `doc.js`, `tab-manager.js` — untouched.
- `renderer/js/shell/layout.js`, `sidebar.js`, `activity-rail.js`, `script-session.js`, `title-bar.js`, `index.js` from Slice 1 — minimal edits only (Layout gains two methods; ScriptSession gains two fields; nothing in those modules' core behavior changes).
- The Slice 1 panel placeholder pattern, the rail rendering, the title bar format, the keyboard shortcuts — all preserved.
- The Studio Panel (`#bottom-panel`) and its `Rga.BottomPanel` module — untouched (entry #5 stays open).

### 1.3 The boundary rule (carried forward from Slice 1)

> The shell may read from `Rga.*` engine APIs documented in master plan §21.
> The shell **may NOT** mutate `EditorState` directly, reach into PM `view.state.doc` internals beyond what an engine API returns, add plugins to the EditorView, or override engine-owned body classes.

The single navigation-only `view.dispatch` exception (Scene Navigator's `scrollToScene`) stays. Outline's click-to-jump uses the same exception via `Rga.Shell.SceneNavigator.scrollToScene`. The Slice 2 source-audit test extends the existing allowlist by 0 — the Outline does NOT add a new dispatch site; it routes through Scene Navigator.

### 1.4 The writer-facing language rule (carried forward from Slice 1)

> Shell UI / copy / a11y never uses *Document*, *Node*, *Plugin*, *Render*. Translations in Slice 1 plan §1.4.

Slice 2 adds three more banned phrases that the new panels could regress on if not guarded:

| Banned in writer-facing copy | Use instead |
|---|---|
| "Scene 5 of 8" (totals-first) | "Scene: S5" (position-first — already in status bar; new Outline panel must follow) |
| "File explorer" / "File tree" / "Files" | "Script Workspace" / "workspace contents" (already enforced in Slice 1; new Script Workspace panel must continue) |
| "Total scenes: N" | "Scenes: N" (drops the redundant "Total" — clean writer-language) |

The source-audit test in §8 extends to catch these.

---

## 2. State ownership contract updates

### 2.1 `Rga.ScriptSession` snapshot extension

> ⚠️ **POST-IMPLEMENTATION CORRECTION (recorded after Slice 2 sign-off).**
> Slice 2 shipped `wordCount` and `currentBlockType` onto `Rga.ScriptSession`. **That placement was wrong.** Both fields are *derived analytics*, not *writer-context*. The Slice-2 review-round-2 correction split out a new sibling layer — `Rga.ScriptMetrics` — that owns derived analytics; `Rga.ScriptSession` reverts to writer-context only (the seven fields above the "NEW IN SLICE 2" marker below). The canonical ownership ledger lives in the master plan §20. Slice 3 implements the migration. Compatibility Inventory entry #6 tracks the misplacement.
>
> The section as originally written stays below for fidelity to what Slice 2 actually shipped. Future readers should treat it as a record of the misplacement, not as design guidance. The corrected design is:
>
> | Layer | Fields |
> |---|---|
> | `Rga.ScriptSession` (writer-context) | activeScript, currentScene, currentPage, currentView, currentSelection, openPanels, activePanel |
> | `Rga.ScriptMetrics` (derived analytics) — NEW in Slice 3 | wordCount, currentBlockType, future: dialogueWords, actionWords, sceneCount, estimatedRuntime |

Slice 2 adds two derived fields to the writer-context snapshot. Both are **derived** from existing engine state; no new primary ownership is created.

```
{
  activeScript:     { docId, displayName, dirty } | null,
  currentScene:     { nodeId, sceneNumber, headingDisplay } | null,
  currentPage:      { number, total } | null,
  currentView:      'flow' | 'draft' | 'printPreview' | null,
  currentSelection: { from, to, empty } | null,
  openPanels:       [panelId, ...],
  activePanel:      panelId | null,

  // --- NEW IN SLICE 2 ---
  wordCount:        number | null,            // total word count of the active script
  currentBlockType: string | null              // block type at the cursor (action/character/dialogue/...)
}
```

**Derivation rules:**

| New field | Source |
|---|---|
| `wordCount` | `Rga.Nav.getOutline(view.state).statistics.words` — the engine-side Outline statistic already exists; ScriptSession just pulls it. Null if no active doc. |
| `currentBlockType` | From `view.state.selection.$from.parent.type.name` — same kind of cursor walk the existing format-toolbar does. Returns the structural block name (`action`, `character`, `dialogue`, `parenthetical`, `shot`, `transition`, `sceneHeading`, `paragraph`, `heading`). Null when outside any body block. |

**Recompute discipline:** both fields recompute on every existing trigger (`editor.tabActivated`, `selectionchange`, `ViewManager.onChange`). The shallow-equality filter (Slice 1 §3.5) already covers these new fields — `_snapshotEquals` is extended to compare them.

### 2.2 `Rga.Shell.Layout` serialization API

```
Rga.Shell.Layout.toJSON()       → plain object, JSON-serializable
Rga.Shell.Layout.fromJSON(snap) → boolean (true if loaded; false if shape invalid)
```

**`toJSON` shape:** identical to `Layout.get()`'s output (no extra fields). The contract is: `Layout.fromJSON(Layout.toJSON())` is the identity transformation; passing the toJSON output to fromJSON restores exactly the same observable state.

**`fromJSON` semantics:**
- Validates the shape (zone keys exist, field types match). Unknown zones / fields are ignored (forward-compat for fields added in future slices).
- Merges using the existing `set` semantics — partial input is allowed (a snap missing `studioPanel` leaves studio panel state at defaults).
- Returns `false` and logs an error if the input is not a plain object.
- Notifies subscribers exactly once after the full merge (not once per zone).

**Disk wiring:** intentionally out of scope. Slice 2 produces the API + tests prove the round-trip. The actual `<workspace>/.rwanga-workspace/layout.json` read/write lands when workspace persistence arrives (likely Slice 4 alongside session restore).

### 2.3 No new owners

ScriptSession's new fields are still derived (no new primary state). Layout's new methods are pure functions over existing state. The three-layer ownership model from Slice 1 §2.5 stays exactly as it is — three layers, one each: document truth / shell truth / writer-context truth.

---

## 3. Module surface

Same IIFE / `Rga.Shell.*` namespace pattern as Slice 1. Each module test-isolates via `delete require.cache + require()`.

### 3.1 `renderer/js/shell/panels/scene-navigator.js` — extension

The existing module gains:

**New behavior:**
- **Keyboard navigation when the panel has focus:**
  - `ArrowDown` / `ArrowUp` — move row selection within the panel (no editor cursor change).
  - `Home` / `End` — jump to first / last row.
  - `Enter` — activate the highlighted row (calls `scrollToScene`).
  - `Esc` — return focus to the editor (selection visual cleared from the panel).
- The selected-row visual is distinct from the current-scene mark. Selection = "what would Enter activate"; current-scene = "where the editor cursor lives."

**New API exports:**
- `Rga.Shell.SceneNavigator.focusRow(nodeId)` → boolean — programmatically focus a row (used by Outline's click-to-jump).
- `Rga.Shell.SceneNavigator.selectedRowNodeId()` → string|null — the row that has the keyboard selection.

**Unchanged:**
- `scrollToScene(nodeId)` (the navigation-only `view.dispatch` exception).
- `_reset()` (test helper).
- Row content shape (scene number / heading / page / indicators / current-scene mark) — Slice 1 already shipped this.

### 3.2 `renderer/js/shell/panels/script-workspace.js` — full replacement

Slice 1's "Coming in 0.2" placeholder is deleted; the file becomes the real workspace panel.

**Workspace resolution (Slice 2 simplification):**
> "Workspace" = the directory containing the active script's file.
>
> If no script is open, or the active script has no on-disk handle (a new `Untitled.rga`), the workspace is empty and the panel shows: "*Open or save a script to see its workspace.*"

This avoids introducing a real workspace concept in Slice 2 — that arrives with the `.rwanga-workspace/` folder in a later slice.

**File enumeration:**
- Uses existing `window.rwanga.files.*` IPC (Electron preload). Slice 2 adds **one** new IPC method if not already present: `window.rwanga.files.listDirectory(absPath)` → returns an array of `{ name, path, isDirectory, size }`. (If the IPC layer already exposes this, no new method is added.)
- Recurses one level by default. Deep recursion is a future concern.
- Categorizes each file by extension per the master-plan §5.3 default table (Scripts / References / Images & Storyboards / Notes / Locations / Other). Slice 2 collapses "Locations" into the generic categorization — no special metadata read.

**Categories (Slice 2):**

| # | Category | File types |
|---|---|---|
| 1 | **Scripts** | `.rga`, `.fountain`, `.fdx` (only `.rga` opens in-app; others external) |
| 2 | **References** | `.pdf`, `.docx`, `.epub` |
| 3 | **Images & Storyboards** | `.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`, `.gif`, `.heic` |
| 4 | **Audio** | `.mp3`, `.wav`, `.m4a`, `.ogg`, `.flac`, `.aac`, `.aiff`, `.opus`, `.wma` |
| 5 | **Notes** | `.md`, `.txt`, `.rtf` |
| 6 | **Other** | everything else not in the above |

The category order above is the **render order** in the panel — Scripts at the top because the writer's primary work surface; Other at the bottom because least relevant to writing flow; Audio between Images and Notes because it groups with creative/inspirational reference material (soundtrack ideas, ambient sound libraries, voice recordings, interviews) rather than with text working files.

**Audio is first-class** because writers collect it constantly while drafting: soundtrack ideas pulled from streaming services, ambient sound libraries, voice memos / dictated lines, interview recordings, location-scout audio. A workspace surface that hides those under "Other" treats them as second-class. The category gets its own slot from day one.

(Master plan's "Locations" category is deliberately deferred — needs folder-name heuristics or per-file metadata that Slice 2 doesn't have a place to surface.)

**Interactions:**
- Click `.rga` → opens in editor via the existing `Rga.FileManager.openFromHandle` (or equivalent path-based open).
- Click any non-`.rga` → calls `window.rwanga.shell.openPath(absPath)` (the Electron `shell.openPath` exposed via preload — if not present, falls back to a no-op + a small inline "Open externally not supported in this build" tooltip).
- Right-click is out of scope for Slice 2.

**Refresh:**
- Subscribes to `editor.tabActivated`. When the active script changes, the workspace re-enumerates (the workspace folder may be different).
- A manual `Refresh` icon in the panel header rerunds the IPC enumeration.

**State:**
- The panel keeps a small local cache of the last enumerated listing keyed by directory path. Clear on `_reset`.

**Empty / error states:**
- No active script: "Open or save a script to see its workspace."
- Empty directory: "This workspace is empty. Drag in references, images, audio, or notes — or **New Script** (Cmd-N) to begin." (Master plan §17.4 copy, extended.)
- Directory enumeration error: "Could not read this workspace. [Retry]"

### 3.3 `renderer/js/shell/panels/outline.js` — full replacement

Slice 1's placeholder deleted; file becomes the real Outline panel.

**Sections rendered (top to bottom):**

```
┌────────────────────────────────────┐
│ OUTLINE                       ⟳   │
├────────────────────────────────────┤
│ ▼ The Last Light                  │
│   Scenes: 8 · Pages: 12           │
│   3,420 words · 1,320 action ·    │
│   1,980 dialogue                  │
│                                   │
│ ▼ Story Progress                  │
│   Current Scene:   S3 of 8        │
│   Current Page:    5 of 12        │
│                                   │
│   ─── reserved for v0.3+ ───      │
│   Act Progress:    —              │
│   Story Beat:      —              │
│                                   │
│ ▼ Scenes                          │
│   1. INT. ROSE GARDEN — DAWN      │
│   2. EXT. KITCHEN — NIGHT         │
│   …                               │
│                                   │
│ ▼ Characters                      │
│   NALI         (4 scenes)         │
│   ALEX         (8 scenes)         │
└────────────────────────────────────┘
```

**Data sources:**
- Title + statistics + scenes + characters → `Rga.Nav.getOutline(view.state)` (engine API, already exists).
- Story Progress current/total values → `Rga.ScriptSession.get()` (the writer-context layer — single source for "where the writer is right now").

**Section: Story Progress (NEW in Slice 2 review-round-1)**

Purpose: **writer orientation.** "Where am I in this script?" answered at a glance, without leaving the Outline view.

Slice 2 fields (all derived; no new derivation logic — every value pulled from existing engine + ScriptSession state):

| Field | Format | Source | Empty-state |
|---|---|---|---|
| **Current Scene** | `S{N} of {M}` (e.g. `S3 of 8`) | `Rga.ScriptSession.get().currentScene.sceneNumber` + `Rga.Nav.getOutline(state).statistics.sceneCount` | `— of —` when no active script |
| **Current Page** | `{N} of {M}` (e.g. `5 of 12`) | `Rga.ScriptSession.get().currentPage` → `{number, total}` | `— of —` when no active script |
| **Total Scenes** | (implicit in Current Scene `of M`) | same source as above | n/a |
| **Total Pages** | (implicit in Current Page `of M`) | same source as above | n/a |

Reserved placeholders (visible-but-disabled, to communicate intent to the writer that these surfaces are coming — NOT rendered with fake data):

| Field | Slice 2 rendering | Lands in |
|---|---|---|
| **Act Progress** | A single em-dash `—`, muted styling, no tooltip in v0.2 (or a one-line tooltip "Coming in 0.3"). | Slice 3 — when act-break detection / manual act markup arrives |
| **Story Beat Progress** | Same `—` rendering. | Future AI/story-intelligence slice — when beat extraction lands |

**The "no fake progress" rule (locked across all future Story Progress work):**

> The Story Progress section never shows a percentage that isn't a literal count over a literal total.
> It never shows a "you're 23% through your story" derived from word count or scene index.
> It never shows AI-generated story judgment — no "looking strong", no "consider tightening Act 2".
> Every field is a **factual count or position**, sourced from the doc state, or an honest `—` placeholder.

This rule is non-negotiable across the lifetime of Story Progress. Any future slice that wants to add a derived progress field must:
- Derive it from a literal count (e.g. "Act 2 of 3" once acts are explicit).
- Never invent a denominator. ("Scene 15 of ~estimated 30" is forbidden — there is no estimated 30.)
- Never speak in qualitative terms. ("Pacing: brisk" is forbidden.)

If AI-driven story judgment lands in a future slice, it goes in a different panel (e.g. the future Characters panel's voice-consistency surface, or a dedicated Story Intelligence panel), not in Story Progress. Story Progress stays the **factual** orientation surface.

**Other sections (unchanged from the prior version of this plan):**

| Section | Content | Initial expanded state |
|---|---|---|
| Title summary | Script title + `Scenes: N · Pages: N` + word-count breakdown | Expanded |
| **Story Progress** *(NEW)* | Current Scene + Current Page + reserved placeholders | Expanded |
| Scenes | Numbered scene list with heading text | Expanded |
| Characters | Character name + appearance count | Collapsed |

**Rendering rules:**
- Each section is collapsible (clicking the header toggles).
- Scene rows in the Outline are simpler than Scene Navigator rows: just number + heading. No page tag, no indicators (the Scene Navigator owns those — Outline is for surveying, not for navigating within scenes).
- Character rows: name + "(N scenes)" appearance count.
- Statistics in the title summary: word counts only (page count is in the title summary line as `Scenes: N · Pages: N`).
- Story Progress fields are right-aligned (label left, value right) for at-a-glance scanning.

**Interactions:**
- Click a scene row → calls `Rga.Shell.SceneNavigator.focusRow(nodeId)` AND `Rga.Shell.SceneNavigator.scrollToScene(nodeId)`. Switches sidebar to the Scene Navigator panel via `Rga.Shell.Sidebar.activate('sceneNavigator')` so the writer sees both the cursor jump AND the scene highlighted in the navigator.
- Click a character row → Slice 2 leaves this as a no-op with a tooltip "Character filtering arrives with the Characters panel."
- Click the **Current Scene** value in Story Progress → same effect as clicking that scene's row (jump + navigator switch).
- Click the **Current Page** value in Story Progress → tooltip "Go to page… arrives with the command palette." No effect in Slice 2.
- Click any reserved-placeholder field (Act Progress / Story Beat) → no effect; cursor: default.

**Refresh:**
- Subscribes to `Rga.ScriptSession.subscribe`. When `currentScene`, `currentPage`, `wordCount`, or `activeScript` changes, the Outline re-renders the affected sections.
- Story Progress re-renders on every cursor move (since it tracks Current Scene / Current Page live).
- Other sections re-render only on doc structural change (statistics drift when text edits change scene count or word count).
- Manual `⟳` button in the panel header forces a full re-pull.

### 3.4 `renderer/js/shell/status-bar.js` — extension + takeover

Two new segments added to the existing five (per the legacy `Rga.StatusBar`'s surface):

| Segment | Slice 2 format | Source |
|---|---|---|
| `wordCount` | `3,420 words` (formatted with thousands separator; singular "1 word") | `Rga.ScriptSession.get().wordCount` |
| `blockType` | `Action` / `Character` / `Dialogue` / `Parenthetical` / `Shot` / `Transition` / `Scene Heading` (title-cased; `—` when null) | `Rga.ScriptSession.get().currentBlockType` |

These slot into the segment order: `scene · page · blockType · wordCount · viewMode · lang · offline`.

**Takeover steps (executed in commit order — see §13):**

1. Add the two segments to `Rga.Shell.StatusBar._build()` rendering.
2. Update the source-audit conditional in `Rga.Shell.init` to mount the new status bar into the live `#status-bar` element (currently it looks for `#rga-shell-statusbar` which doesn't exist in live HTML — that adapter is entry #4 in the inventory).
3. The legacy `#status-bar` hardcoded children (`#status-words`, `#status-pages`, etc.) get wiped on the new status bar's first `_build()` — that's expected; the legacy `Rga.StatusBar.update()` calls on those IDs become no-ops.
4. Delete the bootstrap call `Rga.StatusBar.init()` from `index.html`.
5. Delete the `Rga.StatusBar` definition from `app-shell.js`.
6. Delete the hardcoded `<span id="status-words">…</span>` etc. children from `#status-bar` in `index.html`.

**No new public API on `Rga.Shell.StatusBar`** — the surface stays `init / refresh / _reset`.

### 3.5 `renderer/js/shell/layout.js` — extension

Two new exported methods:

```
Rga.Shell.Layout.toJSON()         → plain object, JSON-serializable
Rga.Shell.Layout.fromJSON(snap)   → boolean
```

**Implementation discipline:**
- `toJSON` is a structural clone of the internal `_current` state. Same shape as `get()`. Safe to `JSON.stringify` directly.
- `fromJSON` validates the input is a plain object, validates each zone has the expected shape (objects only — primitives in zone slots are rejected), then internally calls `set(snap)` zone-by-zone. Unknown zones in `snap` are ignored.
- Notifications: `fromJSON` fires subscribers once at the end (not per zone). It uses a small internal `_silent` flag to suppress per-zone `set` notifications during load, then emits one final consolidated notification with `(newState, prevStateBeforeFromJSON)`.

**No new external dependencies.** Layout still owns its own state; serialization is just a contract over what it already owns.

### 3.6 Other panel modules — no changes in Slice 2

The 4 remaining placeholder panels (Characters / Search / Revisions / Settings) stay as Slice 1 left them. Their rail slots remain reserved and tooltipped; clicking still shows the "Coming in 0.2" message. They graduate in Slice 3+ per master-plan roadmap.

---

## 4. Compatibility Inventory resolutions

Slice 2 is responsible for resolving inventory entries #1, #2, #3, and #4. Entry #5 stays open (Studio Panel takeover is Slice 3).

For each entry the plan describes:
- **The work** required to remove the coexistence layer.
- **The verification** the shell maintainer applies to confirm the removal condition is met.
- **The contingency** if the verification reveals the entry can't be cleanly removed in Slice 2.

When implementation lands, each resolved entry gets a `RESOLVED` block appended in `docs/rwanga-shell-compatibility-inventory.md` per its §3 update protocol. If an entry can't be resolved, it gets a `BLOCKED` annotation with the documented reason — the inventory's removal condition is not changed silently.

### 4.1 Entry #1 — Legacy `Rga.StatusBar` (resolution plan)

**Work:**
1. Migrate the two segments the legacy status bar uniquely shows (word count + block type) into `Rga.ScriptSession` (§2.1) and `Rga.Shell.StatusBar` (§3.4).
2. Switch the live status-bar container — `Rga.Shell.StatusBar` mounts into `#status-bar` directly (removing the dedicated `#rga-shell-statusbar` adapter).
3. Delete the `Rga.StatusBar.init()` bootstrap call from `index.html`.
4. Delete the `Rga.StatusBar = { … }` module definition from `renderer/js/app-shell.js`.
5. Delete the hardcoded `<span id="status-words">…</span>`, `<span id="status-pages">…</span>`, `<span id="status-scene">…</span>`, `<span id="status-block-type">…</span>`, `<span id="status-units">…</span>`, `<span id="status-theme">…</span>` children from `#status-bar` in `index.html`.

**Verification (must all be true before the inventory entry can be marked RESOLVED):**
- `npm run test:unit` reports zero failures.
- A `grep -r "Rga.StatusBar" renderer/ tests/` returns zero matches.
- A `grep -r "#status-words\|#status-pages\|#status-scene\|#status-block-type\|#status-units\|#status-theme" renderer/ tests/` returns zero matches.
- Manual smoke: open `tests/fixtures/sample-the-last-light.rga`. Status bar shows `Scene: S1 · Page: 1/8 · Action · 3,420 words · Flow · en · Local` (or equivalent for the live fixture).

**Contingency (if a hidden callsite is found):**
- Document the unresolved callsite in a BLOCKED annotation on entry #1.
- Either: migrate the callsite to read from `Rga.ScriptSession` (which exposes equivalent info), or shim a single small wrapper that preserves the legacy call but routes to the new module's API.
- Push the entry's removal slice to Slice 3 if migration would expand Slice 2 scope materially.

### 4.2 Entry #2 — Legacy `Rga.Sidebar` (resolution plan)

**Work:**
1. **Audit phase:** `grep -rn "Rga\.Sidebar" renderer/ docs/` — list every callsite. Categorize each:
   - Bootstrap call (`index.html` line 686 currently) — delete.
   - Click-handler registration (already binds to nothing in Slice 1 — confirm and delete the wiring code).
   - Programmatic invocations (`Rga.Sidebar.switchTo('explorer')`, `Rga.Sidebar.toggleCollapse()`) — migrate to `Rga.Shell.Sidebar.activate(...)` / `Rga.Shell.Layout.set({sidebar: {visible: ...}})`.
2. **Migration phase:** apply the migrations from the audit. Common cases:
   - Menu item "View → Toggle Sidebar" → `Rga.Shell.Layout.set({sidebar: {visible: !current}})`.
   - Menu item "View → Explorer" → `Rga.Shell.Sidebar.activate('scriptWorkspace')` (the master-plan-renamed equivalent — *not* a 1:1 with the legacy 'explorer' panel id since the panel itself is now Script Workspace).
   - Menu item "View → Scenes" → `Rga.Shell.Sidebar.activate('sceneNavigator')`.
3. **Removal phase:**
   - Delete `Rga.Sidebar = { … }` definition from `app-shell.js`.
   - Delete `Rga.Sidebar.init()` bootstrap call from `index.html`.
4. **Cross-reference entry #3:** the `#sidebar-header` placeholder element exists only for the legacy `Rga.Sidebar.switchTo`'s `#sidebar-header-text` write. Once entry #2 is resolved, entry #3 is also unblocked.

**Verification:**
- `grep -r "Rga.Sidebar" renderer/ tests/` returns zero matches (excluding `Rga.Shell.Sidebar`, which is a different symbol).
- `grep -r "Rga\\.Sidebar\\.switchTo\\|Rga\\.Sidebar\\.toggleCollapse" renderer/ docs/ tests/` returns zero matches.
- Manual smoke: every menu item / keyboard shortcut / command that *was* wired to `Rga.Sidebar` now produces the equivalent shell-driven effect.
- `npm run test:unit` reports zero failures.

**Contingency:**
- If a callsite turns out to need behavior the new `Rga.Shell.Sidebar` doesn't yet expose (e.g. "expand sidebar to a specific width"), expose the missing capability on `Rga.Shell.Sidebar` AS PART OF SLICE 2 (it's a small extension, not a redesign). The callsite then migrates.
- If multiple complex consumers turn up: BLOCKED annotation on entry #2, push to Slice 3.

### 4.3 Entry #3 — `#sidebar-header` placeholder element (resolution plan)

**Work:**
1. Confirm `Rga.Sidebar` is gone (entry #2 resolved).
2. Delete the `<div id="sidebar-header">…</div>` element from `index.html`.
3. Delete any CSS rules in `renderer/css/shell.css` (or related) that style `#sidebar-header` / `#sidebar-header-text` / `#sidebar-header-actions`.

**Verification:**
- `grep -r "sidebar-header" renderer/ tests/` returns zero matches.
- Manual smoke: the sidebar header area shows panel content directly (or nothing), no orphan placeholder.

**Contingency:**
- The new shell may want to add its own panel-header surface (panel name + actions). If so, that's a NEW addition, not a preservation of `#sidebar-header`. The element is renamed (e.g. `#rga-shell-panel-header`) and owned by the new shell — entry #3 still resolves because the legacy element is gone.

### 4.4 Entry #4 — Conditional shell-status-bar mount adapter (resolution plan)

**Work:**
1. Remove the `if (shellStatusBar && …)` guard from `Rga.Shell.init` in `renderer/js/shell/index.js`.
2. Replace with an unconditional `Rga.Shell.StatusBar.init(document.getElementById('status-bar'))` — wrapped only in a "container exists" defensive check (which always passes in the live app).

**Verification:**
- The conditional block (lookup for `#rga-shell-statusbar`) is gone from `shell/index.js`.
- `Rga.Shell.StatusBar` mounts into `#status-bar` on every app boot.
- Source-audit test added: `grep -r "#rga-shell-statusbar" renderer/ tests/` returns zero matches (or only in archived/historical docs).

**Contingency:**
- None — this is a pure cleanup once entry #1 is resolved. If entry #1 is BLOCKED, entry #4 stays open too.

### 4.5 Entry #5 — `#bottom-panel` (Studio Panel) shared ownership (NOT resolved in Slice 2)

Stays open per directive ("no Studio Panel takeover yet"). Slice 2 does not touch entry #5. It moves to the unresolved-active section in the inventory and is targeted for Slice 3.

### 4.6 Inventory document updates

After implementation, `docs/rwanga-shell-compatibility-inventory.md` gets:

- Entry #1: `RESOLVED in Slice 2 on YYYY-MM-DD — legacy Rga.StatusBar removed; new shell status bar took over #status-bar; verification: greps clean + manual smoke.`
- Entry #2: `RESOLVED in Slice 2 on YYYY-MM-DD — every callsite of Rga.Sidebar.* migrated to Rga.Shell.* or removed; module definition deleted.`
- Entry #3: `RESOLVED in Slice 2 on YYYY-MM-DD — #sidebar-header element + #sidebar-header-text deleted from index.html after entry #2 cleared its only consumer.`
- Entry #4: `RESOLVED in Slice 2 on YYYY-MM-DD — conditional shell-status-bar mount adapter removed; shell status bar now unconditionally mounts into #status-bar.`
- Entry #5: unchanged, still open.

The four resolved entries move to the bottom of §2 under a `--- Resolved entries ---` divider per the inventory's §3 update protocol.

---

## 5. DOM scaffolding changes

### 5.1 `index.html` — the deletions

| Element/code | Action |
|---|---|
| `#sidebar-header` block (entire `<div>` with header + actions) | DELETE — entry #3 resolution |
| `<span id="status-words">…</span>` and siblings inside `#status-bar` | DELETE — entry #1 resolution |
| Bootstrap line `Rga.Sidebar.init();` | DELETE — entry #2 resolution |
| Bootstrap line `Rga.StatusBar.init();` | DELETE — entry #1 resolution |

### 5.2 `index.html` — the no-changes

| Element | Status |
|---|---|
| `#workspace`, `#activity-bar`, `#sidebar`, `#sidebar-content`, `#rga-shell-sidebar-host` | UNCHANGED — Slice 1 already structured these |
| `#status-bar` (the container itself) | UNCHANGED — Slice 2 fills it from `Rga.Shell.StatusBar` instead of legacy children |
| `#bottom-panel` | UNCHANGED — entry #5 stays open |
| Existing tab bar / editor area / scene toolbox / format toolbar | UNCHANGED |
| `#rga-shell-titlebar` (Slice 1's addition) | UNCHANGED |

### 5.3 `app-shell.js` — the deletions

- The `Rga.Sidebar = { … }` block (entire ~50-line definition).
- The `Rga.StatusBar = { … }` block (entire definition).

(Other parts of `app-shell.js` — `Rga.Resize`, `Rga.Theme`, `Rga.Keyboard`, `Rga.BottomPanel`, etc. — stay untouched.)

---

## 6. CSS strategy

### 6.1 Additions

Slice 2 adds CSS for:
- `.rga-shell-scene-navigator-row-selected` — the keyboard-selection visual (distinct from `.rga-shell-scene-navigator-row-current`).
- `.rga-shell-workspace-*` — Script Workspace structure (category headers, file rows, hover/active states, icons).
- `.rga-shell-outline-*` — Outline structure (section headers, scene rows, character rows, statistics block).
- New status bar segment styles for word count + block type — extend the existing `.rga-shell-status-segment` pattern.

All under the `.rga-shell-*` prefix. Appended to existing `renderer/css/shell.css`.

### 6.2 Deletions

- CSS rules for `#sidebar-header`, `#sidebar-header-text`, `#sidebar-header-actions` (if any) — removed alongside the element.
- CSS rules for the legacy `#status-words`, `#status-pages`, `#status-scene`, `#status-block-type`, `#status-units`, `#status-theme` (if any) — removed alongside the elements.
- CSS rules for `.activity-icon`, `.sidebar-panel`, `.file-tree`, `.tree-item`, `.tag-groups-container`, `.extension-card` (legacy v1 prototype styles — verify with greps before deletion; some may already be unused from Slice 1).

Slice 2's removal commits are paired: code + tests + CSS deletions land together.

### 6.3 Theme readiness (unchanged from Slice 1)

CSS variables under `:root` still scope the shell tokens. No new color values introduced; new component styles reuse existing tokens. Theme system itself is still deferred to Slice 4.

---

## 7. Engine integration touch points

The Slice 1 table in plan §6.1 is extended:

| New shell module / change | Engine API | Purpose |
|---|---|---|
| `panels/script-workspace.js` | `Rga.TabManager.activeDoc().handle` | Resolve workspace folder = `path.dirname(handle)` |
| `panels/script-workspace.js` | `window.rwanga.files.listDirectory(path)` (existing IPC, possibly new method — see §3.2) | Enumerate workspace contents |
| `panels/script-workspace.js` | `window.rwanga.shell.openPath(path)` (existing IPC) | Open non-`.rga` files in OS default app |
| `panels/script-workspace.js` | `Rga.FileManager.openFromHandle(path)` (existing) | Open `.rga` files in editor |
| `panels/outline.js` | `Rga.Nav.getOutline(view.state)` | Render title + scenes + characters + statistics |
| `panels/outline.js` | `Rga.Shell.SceneNavigator.scrollToScene(nodeId)` + `.focusRow(nodeId)` + `Rga.Shell.Sidebar.activate('sceneNavigator')` | Click-to-jump from outline → editor + Scene Navigator |
| `script-session.js` (extension) | `Rga.Nav.getOutline(view.state).statistics.words` | Compute `wordCount` field |
| `script-session.js` (extension) | `view.state.selection.$from.parent.type.name` | Compute `currentBlockType` field |
| `status-bar.js` (extension) | `Rga.ScriptSession.get().wordCount`, `.currentBlockType` | Render two new segments |

**Boundary discipline unchanged.** No new `view.dispatch` exception. No new engine event channel. The two new ScriptSession fields are pure derivations from existing engine APIs.

---

## 8. Test plan

Per Slice 1 plan §8 discipline: tests live in `tests/unit/shell/`, no editor regression tests, full suite stays green after every commit.

### 8.1 New / modified test files

| File | Approx tests | Covers |
|---|---|---|
| `tests/unit/shell/scene-navigator.test.js` (extend) | +6 | Keyboard navigation (Arrow / Home / End / Enter / Esc); selected-row visual distinct from current-scene mark; `focusRow(nodeId)` programmatic API; `selectedRowNodeId()` accessor |
| `tests/unit/shell/script-workspace.test.js` (new) | 14-16 | Workspace resolution from active doc handle; file enumeration via stubbed IPC; categorization by extension across all 6 categories (Scripts / References / Images & Storyboards / **Audio** / Notes / Other); render order matches §3.2; audio file types categorize correctly (`.mp3`, `.wav`, `.m4a`, `.ogg`, `.flac`, `.aac`, `.aiff`, `.opus`, `.wma`); click `.rga` calls `openFromHandle`; click non-`.rga` calls `shell.openPath`; click `.mp3` opens externally (audio is non-`.rga`); empty-state copy mentions audio; refresh re-enumerates; "no active script" empty state |
| `tests/unit/shell/outline.test.js` (new) | 14-16 | Renders title + Story Progress + statistics + scene rows + character rows; section order matches §3.3; collapsible sections; **Story Progress: Current Scene format `S{N} of {M}`; Current Page format `{N} of {M}`; empty-state `— of —` when no active script; Act Progress + Story Beat reserved placeholders render `—`**; statistics format ("3,420 words" — thousands separator + pluralization); click scene row → `SceneNavigator.scrollToScene` + `.focusRow` + `Sidebar.activate('sceneNavigator')`; click Current Scene value in Story Progress jumps the same way; click character is a no-op tooltip; click Act Progress / Story Beat placeholders is a no-op; refresh on `ScriptSession.subscribe` |
| `tests/unit/shell/script-session.test.js` (extend) | +4 | `wordCount` derived from Outline statistics; `currentBlockType` derived from cursor's enclosing block; shallow-eq filter handles new fields; null behavior when no active doc |
| `tests/unit/shell/status-bar.test.js` (extend) | +4 | `wordCount` segment format (`3,420 words` / `1 word` / `0 words`); `blockType` segment format (title-cased / `—`); segment order matches §3.4; recomputes on ScriptSession notification |
| `tests/unit/shell/layout.test.js` (extend) | +6 | `toJSON()` returns same shape as `get()`; `JSON.stringify(toJSON())` round-trips through `fromJSON`; `fromJSON(invalidInput)` returns false; `fromJSON` notifies once at end (not per zone); unknown zones in input are ignored; partial input merges with defaults |
| `tests/unit/shell/source-audit.test.js` (extend) | +7 | Slice 2 audit additions: (g) no shell file references `Rga.StatusBar`; (h) no shell file references `Rga.Sidebar` (the *legacy* one — i.e., not `Rga.Shell.Sidebar`); (i) no shell file uses `#sidebar-header` selectors; (j) no shell file uses the banned writer-facing string "Total scenes:"; (k) no shell file uses position-totals format `Scene N of M` in copy; (l) **no shell file emits a percent sign `%` in the Outline / Story Progress code path (enforces "no fake progress percentages" per §3.3)**; (m) **no shell file emits qualitative-judgment words ("brisk", "tight", "loose", "strong", "weak", "pacing", "looking") in Outline / Story Progress code paths (enforces "no AI-generated story judgment")** |
| `tests/unit/shell/integration.test.js` (extend) | +4 | After init the legacy `#status-words` / `#sidebar-header` selectors return null (proves legacy DOM gone); status bar mounts into `#status-bar` (no `#rga-shell-statusbar` indirection); Outline click routes through SceneNavigator; ScriptSession's new fields populate after init |

Total: ~50–60 new tests. After Slice 2 the shell suite should sit at ~525–530, full suite ~525–530 + 366 engine = ~895.

### 8.2 Legacy-test cleanup

If any tests in the existing suite (engine or otherwise) reference `Rga.StatusBar` or `Rga.Sidebar` (the legacy ones), they're updated to reference the new shell equivalents OR deleted if testing dead behavior. The audit phase of entry #2's resolution (§4.2) catches these.

### 8.3 The full-suite-green rule (unchanged from Slice 1)

After every Slice 2 commit, `npm run test:unit` reports `pass N, fail 0` where N is the running total. Any drop blocks the commit.

---

## 9. Risk register

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | A hidden consumer of `Rga.StatusBar` or `Rga.Sidebar` is found late — entry resolution turns into a multi-callsite migration that bloats Slice 2 | M | Audit-first commits (§13 commits 1 + 6). If the audit finds >2 unexpected callsites, the entry gets a BLOCKED annotation and Slice 2 ships without that resolution. |
| R2 | Word-count derivation in `Rga.ScriptSession` adds noticeable perf cost on every selectionchange | M | `wordCount` derives from `Rga.Nav.getOutline().statistics.words` — already computed by the engine's outline plugin, no new walk. Recomputed lazily; shallow-eq filter prevents notifications when value unchanged. Perf test added to the ScriptSession test file. |
| R3 | Script Workspace enumeration IPC may not exist or may not return the shape Slice 2 assumes | H | First commit of the Script Workspace work is an IPC-shape audit: read `window.rwanga.files.*` definitions. If `listDirectory` is missing, add it as a small preload-side addition (NOT engine; the preload is allowed shell infra). If add isn't trivial, BLOCKED entry — Script Workspace stays placeholder. |
| R4 | Outline click-to-jump triggers a cascade (`scrollToScene` → `focusRow` → `Sidebar.activate`) that double-fires `ScriptSession.subscribe` and re-renders everything multiple times | M | Each of the three calls is idempotent at its layer (Slice 1 proved this for `Sidebar.activate` and `scrollToScene`). The shallow-eq filter in ScriptSession absorbs duplicate fires. A dedicated integration test asserts the panel re-renders once per click. |
| R5 | Scene Navigator keyboard nav conflicts with native scroll behavior (ArrowUp/Down in a focused panel might scroll the editor too) | M | Keydown handler calls `e.preventDefault()` only when the panel is the active focus target AND the key is in the navigation set. Outside the panel, Arrow keys pass through to the editor untouched. Regression test: bare ArrowDown when editor is focused is NOT consumed by the shell — same pattern as the Tab-not-swallowed guard from Slice 1. |
| R6 | Deleting `#sidebar-header` reveals a CSS rule that adjusted sidebar layout — sidebar visually breaks | L | CSS audit commit prior to the deletion. Any rule relying on `#sidebar-header` is replaced or removed before the element goes. |
| R7 | The new status bar's `_build()` call wipes `#status-bar` before Slice 2's legacy `Rga.StatusBar.init` is removed — race condition during the migration | M | Order commits carefully (§13): remove `Rga.StatusBar.init()` bootstrap call BEFORE switching the new status bar to mount into `#status-bar`. Between those commits, the live app shows the new status bar mounting into a not-yet-extant container (no-op). Within one transactional set of commits this is fine. |
| R8 | The Outline panel re-renders on every selectionchange (because ScriptSession's `currentScene` changes on every cursor move) — visible jank when scrolling through a scene | M | Outline `refresh` checks if `currentScene.nodeId` actually changed (not just position-within-scene) before re-rendering. Statistics segment re-renders only when `activeScript.docId` changes. |
| R9 | A non-`.rga` file the Script Workspace tries to open via `shell.openPath` fails silently if the user's OS lacks an associated app | L | Slice 2 wraps the call in try/catch and shows a one-line inline error in the Workspace panel. No toast (notifications system is Slice 3). |
| R10 | `Layout.fromJSON` validation regresses to permissive — accidentally accepts malformed state | L | Tests assert each rejected case explicitly (non-object, primitive in zone slot, etc.). Audit test could be added later that ensures the validation matches a declared schema. |

---

## 10. Acceptance gate verification

Verbatim from the directive, with the verification method per gate.

| Gate | How verified |
|---|---|
| ✓ **compatibility inventory Slice 2 entries resolved or explicitly blocked with reason** | Manual review of `docs/rwanga-shell-compatibility-inventory.md` — entries #1, #2, #3, #4 each have either a `RESOLVED` block (with verification notes) or a `BLOCKED` annotation (with a documented reason); entry #5 is untouched |
| ✓ **legacy `Rga.StatusBar` removed or fully disconnected** | `grep -r "Rga.StatusBar" renderer/ tests/` returns zero; corresponding source-audit test passes |
| ✓ **legacy `Rga.Sidebar` removed or fully disconnected** | `grep -r "Rga.Sidebar" renderer/ tests/` returns zero (excluding `Rga.Shell.Sidebar`); corresponding source-audit test passes |
| ✓ **Scene Navigator is useful** | Manual smoke: open the v3 sample fixture, sidebar shows scene rows with numbers + headings + page tags + indicators; click jumps; Arrow keys navigate; current scene highlights as cursor moves |
| ✓ **Script Workspace is useful** | Manual smoke: open a script from a folder with mixed assets; workspace panel shows files categorized; clicking another `.rga` opens it; clicking a `.pdf` opens the OS default app |
| ✓ **Outline is useful** | Manual smoke: open the v3 sample fixture, outline panel shows title + statistics + scene list + character appearances; clicking a scene jumps the editor and switches to Scene Navigator |
| ✓ **status bar is shell-owned** | Status bar shows the slice-2 format (`Scene: SN · Page: N/M · Block · N words · Flow · lang · Local`); no `#status-words` / `#status-pages` / `#status-scene` IDs exist in the DOM at runtime |
| ✓ **editor still works** | 366 pre-existing engine tests still pass; manual smoke (open `sample-the-last-light.rga`, type a scene, save, reopen) |
| ✓ **all tests green** | `npm run test:unit` reports `pass N, fail 0` where N >= 471 (Slice 1 baseline) + ~50 new shell tests = ~525 |

---

## 11. Out of scope (deferred to Slice 3+)

These are listed so they don't slip into Slice 2 by accident. Each links to its destination slice.

| Item | Lands in |
|---|---|
| Studio Panel takeover (Compatibility Inventory entry #5) | Slice 3 |
| Real Characters panel | Slice 3 |
| Real Search panel | Slice 3 |
| Real Revisions panel | Slice 3 |
| Real Settings panel (in-editor settings tab) | Slice 3 |
| Title-bar avatar identity popover | Slice 3 |
| Command palette (Cmd-K) | Slice 3 |
| Notifications system (toasts + inbox) | Slice 3 |
| Layout disk persistence (`<workspace>/.rwanga-workspace/layout.json` read/write) | Slice 4 (with workspace concept introduction) |
| Workspace concept (explicit `.rwanga-workspace/`, recent-workspaces, multi-script workspaces) | Slice 4 |
| Session restore (`session.json` of `ScriptSession` snapshot) | Slice 4 |
| Theme system (Paper Light / Dark / Studio Dark / High Contrast) | Slice 4 |
| Welcome view + 3-minute onboarding tour | Slice 4 |
| Scene Navigator: drag-reorder, color, act grouping, filters | Slice 3+ (per master-plan §3.7.2) |
| Script Workspace: asset linking, favorites, drag-from-OS | Slice 3+ |
| Outline: word-count drill-down, character click-filter | Slice 3+ |
| Outline → Story Progress: **Act Progress** field — requires act-break detection (auto from structural markers) OR manual act markup. Renders as `—` placeholder until then. | Slice 3 (deferred to align with character / structural intelligence) |
| Outline → Story Progress: **Story Beat Progress** field — requires beat extraction (likely AI-driven). Renders as `—` placeholder until then. Per §3.3 the "no AI story judgment" rule means the surfacing must be factual counts only — likely a labelled beat count from explicit doc markup, not an AI verdict. | Future AI/story-intelligence slice (post-v0.3) |
| Editor splits / multi-group | Slice 5 |

---

## 12. Open questions

Real decisions still to make. Each is a one-paragraph statement; recommendation in **bold**.

1. **Status bar segment order.** Slice 1 plan §3.4 had: `scene · page · viewMode · lang · offline`. Slice 2 inserts two new segments. Where? **Recommendation:** `scene · page · blockType · wordCount · viewMode · lang · offline` — group by "what the writer is doing" (scene, page, block, word count) vs "what the tool is doing" (view, language, sync). The legacy bar showed word count separately; the new bar surfaces it inline because it's writer context.

2. **Outline click → activate Scene Navigator?** When a writer clicks an Outline scene row, should the sidebar switch to the Scene Navigator? **Recommendation: yes.** The Outline is a survey; navigation belongs in the Scene Navigator. Cmd-clicking would be the "stay in Outline" modifier — but that's an opportunistic feature outside Slice 2 scope, so default to switch.

3. **Workspace folder for unsaved scripts.** A new `Untitled.rga` has no on-disk handle, so it has no workspace folder. **Recommendation:** the Script Workspace panel shows the "Open or save a script to see its workspace" empty state. No special unsaved-workspace logic.

4. **`wordCount` for empty scripts.** `0 words` or `—`? **Recommendation:** `0 words` (writer expects a literal count, not a "no data" indicator). Same for word count in the Outline statistics.

5. **`Layout.fromJSON` and the active panel.** If a persisted snapshot says `sidebar.activePanel: 'sceneNavigator'` but the panel isn't registered yet (e.g., loaded before all panel scripts ran), what happens? **Recommendation:** `fromJSON` sets the layout field as-is; the Sidebar's `activate` call (when the bootstrap reaches it) does its own existence check and falls back to the first registered panel if the requested one isn't found. This is the existing behavior; no special-case needed.

6. **Block-type segment when cursor is in a scene heading.** The Scene Heading uses NodeViews (Slice 1 / Phase 4); the cursor's enclosing parent might be the `sceneHeading` node or one of its child contentDOM elements. **Recommendation:** the segment shows `Scene Heading` when `currentBlockType === 'sceneHeading'` AND `—` when the cursor is between scenes (in a non-scene treatment paragraph, etc.). Edge cases caught by tests.

7. **Source-audit for `Rga.Sidebar` callsites.** The audit might find callsites in `docs/` (markdown discussing the legacy module). **Recommendation:** scope the source-audit grep to `renderer/` + `tests/` only — docs reference legacy symbols intentionally for historical clarity.

---

## 13. Implementation order (suggested commit sequence)

12 commits. Each leaves the suite green. Audit-and-decision commits precede their corresponding migration commits so the team has explicit go/no-go points.

| # | Commit | What it adds | Test posture |
|---|---|---|---|
| 1 | `shell: audit Rga.StatusBar + Rga.Sidebar callsites` (no code change — produces a small `AUDIT-NOTES.md` in the slice-2 working directory, deleted before merge) | Inventory of every callsite found. If audit reveals >2 unexpected callsites per entry, this commit ALSO records a BLOCKED annotation draft. | No new tests; existing pass. |
| 2 | `shell: extend Rga.ScriptSession with wordCount + currentBlockType` | `script-session.js` adds two derivations; `script-session.test.js` adds 4 tests; full suite green | +4 tests |
| 3 | `shell: extend Rga.Shell.StatusBar with wordCount + blockType segments` | `status-bar.js` adds two segments; `status-bar.test.js` adds 4 tests | +4 tests |
| 4 | `shell: replace Script Workspace placeholder with real panel` | `panels/script-workspace.js` rewritten; `script-workspace.test.js` new (12–14 tests) | +12–14 tests |
| 5 | `shell: replace Outline placeholder with real panel` | `panels/outline.js` rewritten; `outline.test.js` new (10–12 tests) | +10–12 tests |
| 6 | `shell: extend Scene Navigator with keyboard navigation + focusRow API` | `panels/scene-navigator.js` extended; `scene-navigator.test.js` adds 6 tests | +6 tests |
| 7 | `shell: extend Rga.Shell.Layout with toJSON / fromJSON serialization` | `layout.js` extended; `layout.test.js` adds 6 tests | +6 tests |
| 8 | `shell: status-bar takeover — switch live mount target to #status-bar + remove Rga.StatusBar bootstrap call` | `shell/index.js` drops the `#rga-shell-statusbar` adapter (entry #4 resolution starts); `index.html` removes `Rga.StatusBar.init()` call; legacy hardcoded `#status-words` etc. children deleted from `#status-bar`; manual smoke confirms new bar shows | Integration tests updated; full suite green |
| 9 | `shell: delete Rga.StatusBar module definition` (entry #1 resolution completes) | `app-shell.js` cleanup; `compatibility-inventory.md` updated with RESOLVED for #1 + #4 | Source-audit test (g) passes |
| 10 | `shell: migrate Rga.Sidebar callsites to Rga.Shell.* + delete Rga.Sidebar module + delete #sidebar-header element` (entries #2 + #3 resolution) | Audit-from-commit-1 migrations applied; module deleted; `index.html` edits; CSS cleanups; `compatibility-inventory.md` updated with RESOLVED for #2 + #3 | Source-audit tests (h) + (i) pass |
| 11 | `shell: add source-audit additions (g/h/i/j/k)` | `source-audit.test.js` extended | +5 tests |
| 12 | `shell: Slice 2 integration tests + final sweep` | `integration.test.js` extended; manual smoke; full suite green; inventory cross-references updated | +4 tests |

If a commit lands with broken existing tests, it's reverted on the spot — same single-thread discipline as Slice 1.

**The audit-first ordering (commit 1) is load-bearing.** If commit 1's audit reveals a complex callsite that BLOCKS resolution of entry #2 or #1, the implementer makes the call THEN — not mid-way through commit 9 or 10. Better to discover scope problems before writing the migrations.

---

## 14. Glossary additions

These terms enter the project vocabulary with Slice 2.

| Term | Definition |
|---|---|
| `Rga.ScriptSession.wordCount` | A derived field on the writer-context snapshot. Total word count of the active script, pulled from `Rga.Nav.getOutline(state).statistics.words`. Null when no active doc. Slice 2 addition. |
| `Rga.ScriptSession.currentBlockType` | A derived field on the writer-context snapshot. Block-type name of the structural block the cursor sits inside (`action` / `character` / `dialogue` / etc.). Null when outside any body block. Slice 2 addition. |
| `Rga.Shell.Layout.toJSON()` / `fromJSON(snap)` | Pure serialization contract over `Rga.Shell.Layout`. JSON-serializable shape mirrors `get()`. `fromJSON` validates + merges + notifies once. Disk wiring deferred to the slice that adds workspace persistence. |
| **Scene Navigator selected-row** | The row that has the keyboard-navigation selection. Visually distinct from the current-scene mark (which tracks the editor cursor). Selection = "what would Enter activate"; current-scene = "where the editor cursor lives." |
| **Workspace folder (Slice 2 definition)** | The directory containing the active script's file. Used by the Script Workspace panel for listing. A real workspace concept (explicit `.rwanga-workspace/`) lands in Slice 4. |
| **Audit-first ordering** | The Slice 2 discipline: audit commits (no code change) precede their corresponding migration commits so go/no-go decisions on the audit's findings happen at a deliberate commit boundary. |
| **Audio (Workspace category)** | A first-class Script Workspace category between Images & Storyboards and Notes. Recognized file extensions in Slice 2: `.mp3`, `.wav`, `.m4a`, `.ogg`, `.flac`, `.aac`, `.aiff`, `.opus`, `.wma`. Lives at category position 4 of 6. Rationale: writers collect soundtrack ideas, ambient sound, voice memos, interviews — hiding these under "Other" treats audio as second-class; the category names it explicitly. |
| **Story Progress (Outline section)** | A factual orientation surface in the Outline panel. Slice 2 fields: **Current Scene** (`S{N} of {M}`), **Current Page** (`{N} of {M}`). Reserved-for-future fields: **Act Progress**, **Story Beat Progress** (both render `—` in Slice 2). Governed by the **"no fake progress" rule**: never a derived percentage, never an invented denominator, never AI-generated story judgment. Lives between the title summary and the Scenes list. |
| **"No fake progress" rule** | A locked Outline / Story Progress invariant. (1) No percentages that aren't a literal count over a literal total. (2) No invented denominators — no "Scene 15 of ~estimated 30". (3) No qualitative judgment — no "pacing: brisk", no "looking strong". (4) AI-driven story analysis lives in different panels, never here. The source-audit test enforces this with greps for `%` emission and a small banned-word list in Outline / Story Progress code paths. |

---

## 15. Definition of Done

Slice 2 is done when:

1. The 12 commits from §13 have all landed.
2. All 9 acceptance gates from §10 pass.
3. The Compatibility Inventory document reflects: entries #1, #2, #3, #4 each annotated `RESOLVED` (or `BLOCKED` with a documented reason); entry #5 unchanged.
4. The Slice 2 risk register (§9) has been re-reviewed; no Severity-H or Severity-M risk is open without an entry in the inventory or a follow-up note.
5. A 5-line "What Slice 2 shipped" entry has been added to the project changelog.
6. A Slice 3 planning kickoff note exists, referencing:
   - The deferred items in §11
   - Compatibility Inventory entry #5 (Studio Panel takeover)
   - Any BLOCKED annotations created during Slice 2's resolution attempts

End of Slice 2 plan.
