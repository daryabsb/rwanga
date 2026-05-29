# Filmustageation — Scenes Sidebar Catalogue — Phase 0 Audit & UX Specification

> **Audit + UX spec only. No implementation, no code changes, no visual invention.**
> Created: 2026-05-28 · HEAD: `84815583` (origin/main in sync).
> Companion docs: `RWANGA_EDITOR_CORE_PLUGIN_PLATFORM_DOCTRINE.md`, `FILMUSTAGEATION_POST_F1A_REVIEW.md`, `FILMUSTAGEATION_PHASE1A_SHELL_AUDIT.md`, `rwanga-editor/docs/Filmustageation/Filmustageation UX Direction.html`.

This is the first **surface-specific** spec produced after Filmustageation Phase 1A's eight ownership-recovery slices. Phase 1A established the seams; this document examines one surface — the Scenes Sidebar Catalogue — through those seams.

The scope is narrow on purpose. The goal is a writer-first scene-navigation surface, not a production breakdown panel and not an admin database list. The screenplay page stays the center of gravity. The sidebar supports orientation and navigation.

---

## 1. Current Scene Sidebar Topology

### 1.1 Module location & ownership

| Concern | Path | Owner today | Doctrine fit |
|---|---|---|---|
| Sidebar frame (registry / host / lifecycle) | `shell/sidebar.js` | CORE | Correct |
| Sidebar mount host (DOM) | `#rga-shell-sidebar-host` in `renderer/index.html` (line 203) | CORE | Correct |
| Activity rail (panel button registration + grouping) | `shell/activity-rail.js` | CORE | Correct (with hard-coded panel ids — see §4.4) |
| Scene Navigator controller | `shell/panels/scene-navigator.js` | **organisationally CORE; conceptually plugin (screenplay)** | Drift — see §4.2 |
| Scene Navigator data source | `framework/nav-index.js` (`Rga.Nav.getIndex`) | CORE folder; **screenplay-shaped contents** | Doctrine violation — Post-F1A review §1.5, audit §6.1 |
| Writer-context layer (`currentScene`) | `shell/script-session.js` | CORE — naming deliberate per `project_script_equals_session` | Correct |
| Scene Navigator CSS | `renderer/css/shell.css` lines 1499–1677 | CORE folder; scoped under `.rga-shell-scene-navigator-*` | Correct in location; contents are screenplay-shaped |
| Unit tests | `tests/unit/shell/scene-navigator.test.js` | Single-file dedicated spec | Mature |
| E2E coverage | `tests/e2e/filmustageation/sidebar-default-per-doctype.spec.js` (F1A.2) | Boot-default assertion only | No standalone Scene-Navigator E2E |

### 1.2 Controller registration (per `scene-navigator.js:37–66`)

```js
const _controller = {
  id: 'sceneNavigator',
  label: 'Scenes',
  icon: 'clapperboard',          // resolved by Rga.Icons.Lucide
  shortcut: 'Cmd-Shift-S',
  available: true,
  mount(container) { ... },
  unmount() { ... }
};
Rga.Shell.Sidebar.registerPanel(_controller);
```

Registration is IIFE at script-load time. After F1A.2, the screenplay doc-type owns the boot default (`doc-types/screenplay/index.js:35 → defaultSidebarPanel: 'sceneNavigator'`); CORE Layout no longer hard-codes it. Rail placement still lives in CORE (`activity-rail.js:29–33`): `top = ['sceneNavigator', 'scriptWorkspace', 'outline', 'search']`. Keyboard shortcut `1` is wired in `shell/index.js:136` `_PANEL_SHORTCUTS`.

### 1.3 DOM structure emitted by `_render()` (per `scene-navigator.js:76–155`)

```
.rga-shell-scene-navigator                   (wrapper div)
└── .rga-shell-scene-navigator-list          (ul, flex column, gap 1px)
    └── .rga-shell-scene-navigator-row       (li, role="button", tabindex="0")
        │   data-scene-node-id="…"           (stable nodeId)
        │   data-scene-number="…"
        ├── .rga-shell-scene-navigator-num         (Courier 10px, right-aligned)
        ├── .rga-shell-scene-navigator-heading     (11px, ellipsised single line)
        ├── .rga-shell-scene-navigator-indicators  (📝 if hasNotes, 🚩 if hasRevisionFlag)
        └── .rga-shell-scene-navigator-page        ("p.N" badge, Courier 10px, pill bg)
```

Row grid: `grid-template-columns: 26px 1fr auto auto` · `min-height: 28px` · `padding: 4px 8px` · `border-radius: 3px` (per `shell.css:1578–1591`).

### 1.4 Two independent state classes (per `scene-navigator.js:118–127` and `shell.css:1638–1677`)

| Class | Source | Visual | Coexists? |
|---|---|---|---|
| `.rga-shell-scene-navigator-row-current` | `Rga.ScriptSession.currentScene.nodeId` (editor cursor location) | Brand-pink left-border `#C2185B`, weight 600, number-cell tinted brand pink | Yes |
| `.rga-shell-scene-navigator-row-selected` | `_selectedNodeId` (keyboard navigation focus) | Soft `--bg-hover` fill + 1px outline ring; page-badge bg shifts | Yes |

These two states are deliberately separate (see `scene-navigator.js:23–32` comment block + `shell.css:1638–1654` SEPARATION INVARIANT block + unit-test assertions in `scene-navigator.test.js:209–245`). A row may carry one, the other, both, or neither.

### 1.5 Data source — `Rga.Nav.getIndex(state)`

The panel's `_render` reads scenes via `Rga.Nav.getIndex(view.state).scenes`. The index shape (per `framework/nav-index.js:19–35`):

```
{
  scenes: [
    { nodeId, sceneNumber, pmPos, pmEndPos,
      headingDisplay,            // composed: "{setting} {locationText} — {time}"
      setting, locationText, time,
      transitionDisplay, transitionPresetType,
      blockCount, hasNotes, hasRevisionFlag }, ...
  ],
  characters: [...],
  tags: { character: [...], prop: [...], ... },  // 9 production keys
  pages: [...],                                   // PageMap-derived
  notes: [...], flags: [...],
  byPos: Map, byId: Map
}
```

The panel uses only: `scenes[]` (full row content) + `pages[]` (for the `p.N` badge via `_pageNumberForScene` walking `pg.sceneIds.indexOf(scene.nodeId)`).

**Stability rules** (per `nav-index.js:36–42`): `nodeId` is stable across edits; `pmPos`, `pmEndPos`, `sceneNumber` are ephemeral and recomputed on every doc change. The navigator stores `nodeId` for navigation (`scrollToScene` resolves via `Rga.Nav.findScene(doc, nodeId)`).

### 1.6 Render lifecycle

| Trigger | Path | Behaviour |
|---|---|---|
| Sidebar activates panel | `Sidebar.activate('sceneNavigator')` → `_controller.mount(_host)` | `_render()` once; subscribes to `ScriptSession`; attaches keydown |
| `Rga.ScriptSession` snapshot changes | `ScriptSession.subscribe(callback)` → `_render()` | Full re-render (innerHTML cleared + rebuilt) |
| Sidebar deactivates panel | `Sidebar.deactivate()` → `_controller.unmount()` | Detaches subscribe + keydown; clears `_selectedNodeId`; nulls `_container` |
| Test boot | `_reset()` | Soft reset; preserves no state |

**Important:** the navigator never directly observes `selectionchange` or PM transactions. It observes only `Rga.ScriptSession`, which itself recomputes on `Rga.ViewManager.onChange` and `Rga.Shell.Sidebar.onChange` (per `script-session.js:100–108`). ScriptSession's own `_recompute` runs on every `selectionchange` indirectly through the engine's status-bar plumbing — but the navigator's contract is "re-render when `ScriptSession.subscribe` fires," which is calm and skipped when the snapshot is equal (`_snapshotEquals`).

Re-render is **full innerHTML clear + rebuild** (`scene-navigator.js:77–98`) — not diff-patched. This is acceptable for current scene counts (sample fixture: 60 scenes; live screenplays typically 40–120). At 200+ scenes this becomes a measurable cost.

### 1.7 Click / selection behaviour

| Action | Effect | Implementation |
|---|---|---|
| Click row | `scrollToScene(nodeId)` — moves editor cursor into scene | `_buildRow` → addEventListener('click') → `Rga.Nav.findScene` → `TextSelection.near` + `dispatch` + `scrollIntoView` + DOM-level `nodeDOM.scrollIntoView({block:'start'})` (V1.1 fix) |
| Arrow Down / Up | Move `_selectedNodeId` only — does NOT move cursor | `_onKeydown` → `_setSelected` → re-render + `row.scrollIntoView({block:'nearest'})` |
| Home / End | Jump selection to first / last | `_onKeydown` |
| Enter | `scrollToScene(_selectedNodeId)` — bridges selected→cursor | `_onKeydown` |
| Escape | Clear selection; blur container | `_onKeydown` |
| `focusRow(nodeId)` (cross-panel API) | Outline panel calls this when its row is clicked | Sets selection without moving cursor |

### 1.8 CSS surface

All Scene Navigator styles are CSS-class-scoped under `.rga-shell-scene-navigator-*` (per `shell.css:1499–1677`). The unified empty-state surface (`.rga-shell-panel-empty-*` at `shell.css:1533–1576`) is shared with other sidebar panels — provided by `Rga.Shell.Sidebar.renderEmpty(container, opts)`. The Recovery Bundle 2 §C block (`shell.css:1679+`) aligns Outline and Workspace panels to the Scene Navigator's rhythm — meaning Scene Navigator is the **anchor pattern** other sidebar panels follow.

### 1.9 Test coverage

| Test file | Concerns covered |
|---|---|
| `tests/unit/shell/scene-navigator.test.js` | Registration · label · shortcut · empty state · per-row anatomy · indicator presence · current-scene mark · scrollToScene happy/sad · click→scroll · ScriptSession-driven re-render · keyboard nav (Arrow / Home / End / Enter / Escape) · `focusRow` API · separation invariant (current ≠ selected) |
| `tests/e2e/filmustageation/sidebar-default-per-doctype.spec.js` | F1A.2 boot resolution: screenplay → `sceneNavigator`. Asserts presence of `.rga-shell-scene-navigator` in `#rga-shell-sidebar-host` |
| Related unit tests touching the panel | `integration.test.js`, `visual-stabilization.test.js`, `v1-1-regressions.test.js`, `keyboard.test.js`, `owned-chrome-A4.1-accelerator-ownership.test.js`, `bundle-1-sidebar-consistency.test.js`, `bundle-2-sidebar-polish.test.js`, `rail-doctrine.test.js`, `activity-rail.test.js`, `layout.test.js` |

The unit-test coverage is mature and dense. There is **no standalone Playwright spec** for Scene Navigator behaviour beyond the F1A.2 boot-default check.

---

## 2. Current UX Behavior

Ground-truth description of what the panel actually does today.

### 2.1 How scenes appear

- A flat scrollable list. No grouping, no folding, no act/sequence partitioning.
- Each row is one scene, one line tall (`min-height: 28px`).
- Four visual columns left-to-right: number · slug · indicators · page badge.
- No row decoration beyond row state (current / selected / hover); no transition glyph, no continuity marker, no duration figure.

### 2.2 What metadata is shown per scene

| Field | Source | Visible? |
|---|---|---|
| Scene number | `scene.sceneNumber` (1-indexed walk order) | Yes — Courier 10px, muted |
| Heading display | `_composeHeadingDisplay(setting, locationText, time)` → `"INT. KITCHEN — NIGHT"` | Yes — 11px, single-line ellipsis |
| Setting alone (INT./EXT./EST.) | `scene.setting` | Embedded in heading; not separately styled |
| Location text alone | `scene.locationText` | Embedded in heading; not separately styled |
| Time alone (DAY/NIGHT/CONTINUOUS/etc.) | `scene.time` | Embedded in heading; not separately styled |
| Transition display | `scene.transitionDisplay` (e.g. "CUT TO:") | **Not shown** |
| Block count | `scene.blockCount` | **Not shown** |
| Has notes | `scene.hasNotes` → 📝 emoji | Yes — leading indicator |
| Has revision flag | `scene.hasRevisionFlag` → 🚩 emoji | Yes — trailing indicator |
| Estimated page | `idx.pages[].sceneIds` lookup | Yes — `p.N` badge or empty |
| Estimated duration (eighths) | Not exposed by `nav-index.js` | **Not available** |
| Tag mentions (characters/props/etc. in this scene) | Available in `idx.tags` but not joined per scene | **Not shown** |

### 2.3 Active scene highlighting

Brand-pink (`#C2185B`) left-border + bolded text + tinted scene-number. The pink is the Rwanga accent, consistent with the editor's other "you are here" cues. The number cell uses the same pink to reinforce the location signal. Width is fixed at 2px so the grid layout doesn't reflow when current shifts.

### 2.4 Scrolling

- The sidebar host (`.rga-shell-sidebar-host`) carries `overflow: auto` (per `shell.css:1487–1491`).
- Keyboard navigation calls `row.scrollIntoView({block: 'nearest'})` on the **selected** row (per `scene-navigator.js:295`).
- The **current** row does NOT auto-scroll into view when the editor cursor moves to a different scene. If the user is typing in scene 47 of a 60-scene script and the navigator is scrolled to show scenes 1–25, the current marker is off-screen. The writer must manually scroll.
- This is the dominant lived UX weakness — see §3 and §5.

### 2.5 Click navigation

Single click → `scrollToScene(nodeId)`. The sequence:
1. Resolve `nodeId` → `pmPos` via `Rga.Nav.findScene`.
2. Build a `TextSelection.near` at `pmPos + 1` (inside the scene's first child).
3. Dispatch a setSelection transaction with `.scrollIntoView()` hint.
4. Fall back to DOM-level `view.nodeDOM(pmPos).scrollIntoView({block:'start'})` because PM's scrollIntoView is a hint that only fires when the cursor would be off-screen — for a navigator jump we always want the scene at viewport top.
5. `view.focus()` — return focus to the editor.

There is no double-click semantic, no right-click context menu, no drag affordance.

### 2.6 Duration / page info

The `p.N` page badge is the only page hint. There is no scene-duration display, no eighths count, no estimated-minutes figure. Per `nav-index.js`, `blockCount` exists but is not surfaced.

### 2.7 Acts / sequences

No act-level partitioning. No sequence-level grouping. The data model (`nav-index.js`) does not track acts or sequences. Scene list is flat.

### 2.8 Empty state

Provided by `Rga.Shell.Sidebar.renderEmpty(host, {title, body})` (unified `.rga-shell-panel-empty` pattern). Current copy: title `"Scenes"`, body `"No scenes yet. Press Enter on the slug line to start one."` The instructional copy references slug-line behaviour — slightly meta but functional.

### 2.9 Collapsed state

The panel itself has no collapsed state; collapse is owned by the sidebar zone (`Rga.Shell.Layout.sidebar.visible` + the activity-rail toggle). When the sidebar is hidden, the panel unmounts entirely.

### 2.10 Search / filter

**None.** No filter input. No fuzzy search across scenes. Users cannot jump to "the scene with the dancer" without scrolling or using the command palette.

### 2.11 Keyboard navigation (per `scene-navigator.js:236–278`)

| Key | Effect |
|---|---|
| ArrowDown | Move selected-row state forward (no cursor move) |
| ArrowUp | Move selected-row state backward (no cursor move) |
| Home | Jump selection to first scene |
| End | Jump selection to last scene |
| Enter | `scrollToScene(_selectedNodeId)` — bridges selected→cursor |
| Escape | Clear selection; blur container |

The container is focusable (`tabindex="0"`). Keyboard nav requires the panel container to have focus — clicking a row gives it focus implicitly; the rail icon does not. There is no Tab-cycle into the panel from the toolbar.

### 2.12 Other affordances

- No drag handles. Scenes cannot be reordered from the navigator.
- No context menu (no delete, no duplicate, no "note this scene").
- No multi-select (no Shift-click, no Ctrl-click).
- No badge for "the scene I most recently visited" beyond the current marker.
- No tag-tint per row (the scene's primary character or location is not surfaced as a color).

---

## 3. UX Direction For Scenes Catalogue

This section defines what the surface should become. It is grounded in `Filmustageation UX Direction.html` §1, §2, §3, §4, §6, §7 plus the post-F1A review §3 and §5.

### 3.1 First principle — writer-first scene navigator

The catalogue's primary identity is **structural navigation during writing**, not production data inventory. UX Direction §2 makes this explicit:

> The sidebar's default view when writing should be the scene navigator — a clean list of scenes with minimal metadata (number, slug, estimated duration). The breakdown categories accordion becomes a separate sidebar view activated from the rail, used during breakdown work, not during writing.

UX Direction §4 names what works today and is the foundation:

> The scene list in the left sidebar (0: PRE-SCENE, 1: INT. EMPTY STUDIO, 2: EXT. DEVASTATED CITY, etc.) is useful navigation. Scene highlighting with color-coded bars for the selected scene works.

The brand-pink current-row bar already implements the "color-coded bars" instinct correctly. The base anatomy is correct; the work is refinement, not replacement.

### 3.2 Emotional posture — Session Awareness layer

UX Direction §1 places the navigator in the "Session Awareness" emotional layer:

> Scene count, position in the script, session continuity markers. Peripheral — you glance, you don't stare.

This is the calibration target. The catalogue should be glanceable, not commanding. The page is the heaviest object in the room; the navigator is ambient orientation.

### 3.3 What should be visible by default

| Element | Treatment |
|---|---|
| Scene number | Always. Monospaced, muted, fixed track. |
| Slug heading | Always. Single line, ellipsis on overflow. Sub-treatment for setting + location vs time (see §3.6). |
| Current-scene marker | Always when applicable. Brand pink. Single source of truth — `ScriptSession.currentScene.nodeId`. |
| Page hint (p.N) | When PageMap data is available. Muted right-aligned chip. |
| Notes indicator | When `hasNotes`. Subtle, single-glyph. |
| Revision-flag indicator | When `hasRevisionFlag`. Subtle, single-glyph. |
| Estimated duration | **Aspirational** — UX Direction calls for it but `nav-index.js` does not expose it. Deferred until a math model exists. |

### 3.4 What should be hidden or secondary

- **Tag mentions per scene** (characters/props/locations counted per scene). UX Direction §4 makes inline tags the screenplay's "intelligence embedded in the page, not extracted from it." The navigator must not become a per-row tag-mention table.
- **Transition labels** (CUT TO: / FADE OUT:). Structurally available but visual clutter at the catalogue level. Belongs in the inspector when a scene is inspected.
- **Block count.** Internal data, no writer value.
- **Notes preview text.** Belongs in the inspector (the Scene Notes panel, post-F1A.5). The catalogue indicates *presence*, not content.

### 3.5 What should appear on hover / selection

- **Hover:** subtle `--bg-hover` background + color brightening (current behaviour) — no chrome additions, no tooltips.
- **Keyboard-selected:** soft fill + outline ring (current behaviour) — distinct from current marker (the SEPARATION INVARIANT must be preserved).
- **No expanding cards on hover.** UX Direction §1: "you glance, you don't stare."

### 3.6 What belongs in the inspector instead

The inspector (post-F1A.3, post-F1A.5) is the contextual-detail surface. Catalogue clicks should make the inspector show scene-level metadata. Per UX Direction §5:

> Cursor in scene → Inspector shows: Scene notes, scene-level metadata (location, time, estimated duration), scene-level AI observations.

So:

- Notes content (not just `hasNotes` indicator) → Inspector Scene Notes panel.
- Tagged entities per scene → Inspector scene-detail panel (does not exist yet).
- Revision history per scene → Inspector revision panel (does not exist yet).
- Scene-level AI observations → Inspector AI panel (does not exist yet; Alive App gate is closed).

The catalogue says **what scenes exist and where you are**. The inspector says **what's inside this one scene**.

### 3.7 What belongs in breakdown mode instead

Per UX Direction §4 and §7:

> The breakdown accordion as the default sidebar content. Category names with counts in parentheses is a database interface pattern. During writing, this data is noise. It should be available — but as a dedicated breakdown view, not as the default writing companion.

Per-category entity lists, counts, "ADD NEW CATEGORY" CMS actions — all of these belong in a future Breakdown sidebar panel that is activated from the rail, not promoted into the Scenes catalogue. This deferred panel is already named in memory (`project_inspector_tag_list_deferred`) and aligns with the rail's middle/unassigned group.

### 3.8 Slug visual treatment direction

The slug today is `"INT. KITCHEN — NIGHT"` collapsed to one line with mid-phrase ellipsis. Per UX Direction §6 (Typography Feeling — "instrument labeling — precise, small, subordinate to the content") and §1 (Page sacred, chrome quiet), the slug should:

- Lead with location text (the strongest navigational signal — writers think "the dancer scene," not "the INT. scene").
- Render setting (INT./EXT./EST.) and time (DAY/NIGHT) as quieter modifiers — smaller, lighter, or behind a separator — without forcing a two-line row.
- Stay single-line and stay calm. No bold capitals, no high-contrast color shifts.

This is a refinement, not a redesign. The current `headingDisplay` composition is acceptable; a quieter sub-treatment is aspirational, not required for v0.

### 3.9 Density direction

The current row at 28px min-height + 4px vertical padding is **already calm**. UX Direction §6 Spacing Philosophy ("Chrome surfaces use tighter spacing because they are utility spaces") supports the current density. There is no immediate case for a "comfortable" vs "compact" toggle. A future Settings preference could expose this, but it is not Phase 0.

### 3.10 Motion direction

Per UX Direction §6 Motion Philosophy: `0.12s ease`, no decorative motion. The current navigator does not animate row appearance/disappearance, which matches direction. The one motion missing is **smooth scroll on auto-scroll-to-current** (see §5 — improvement candidate). Use `scrollIntoView({behavior: 'auto', block: 'nearest'})` (instant) rather than `behavior: 'smooth'` — the writer's cursor moved, the navigator's adjustment is functional confirmation, not theatrical.

### 3.11 Empty-state direction

UX Direction §1: "No 'welcome back' splash screen. No loading sequence. Just: you're here again, where you left off." The current empty-state copy ("No scenes yet. Press Enter on the slug line to start one.") is procedurally helpful but instructional. A quieter direction:

- Title: `"Scenes"` (matches panel identity).
- Body: a single calm sentence describing what the catalogue will show, not how to make it appear. The slug-Enter mechanic is the screenplay plugin's; the catalogue's empty state should be doc-type-neutral in tone.

This is refinement, not a blocker.

---

## 4. Plugin Ownership Boundary

### 4.1 What belongs to CORE sidebar frame

| Surface | Owner |
|---|---|
| Sidebar registry + lifecycle (`registerPanel` / `activate` / `deactivate`) | CORE — `shell/sidebar.js` |
| Sidebar mount host (`#rga-shell-sidebar-host`) | CORE — `renderer/index.html` |
| Unified empty-state surface (`Sidebar.renderEmpty`) | CORE — `shell/sidebar.js:154–189` |
| Activity-rail panel button rendering | CORE — `shell/activity-rail.js` |
| Sidebar visibility coordination with Layout | CORE — `shell/sidebar.js` + `shell/layout.js` |
| Per-doc-type default panel resolution | CORE — F1A.2 contract: walks `Rga.DocTypes.bootDefaultSidebarPanel()` |
| Panel keyboard shortcut routing | CORE — `shell/index.js:_PANEL_SHORTCUTS` (but panel ids are hard-coded — see §4.4) |
| Writer-context layer (`ScriptSession.currentScene`) | CORE — deliberate naming (`project_script_equals_session`) |

### 4.2 What belongs to screenplay (plugin)

Conceptually, the entire Scene Navigator controller is a plugin concern:

| Concern | Should live in |
|---|---|
| Scene-row anatomy (number + slug + indicators + page badge) | `doc-types/screenplay/` |
| The `clapperboard` icon and `'Scenes'` label | `doc-types/screenplay/` |
| `scrollToScene` navigation flow | `doc-types/screenplay/` |
| Keyboard nav semantics (Arrow/Enter/Esc) | `doc-types/screenplay/` |
| `focusRow` cross-panel API (consumed by `shell/panels/outline.js`) | `doc-types/screenplay/` (with the consumer also moving) |
| Per-row data shape (`headingDisplay`, `hasNotes`, `hasRevisionFlag`) | Implicitly screenplay — see §4.4 |

Today the controller lives at `rwanga-editor/renderer/js/shell/panels/scene-navigator.js`. The contract is correct (it registers via `Rga.Shell.Sidebar.registerPanel`); the file location is organisational drift, not a contractual violation.

### 4.3 What still lives incorrectly in shell/

| Surface | Why it's drift | Move risk |
|---|---|---|
| `shell/panels/scene-navigator.js` | Pure screenplay panel under shell/ folder. | LOW (file + index.html script tag + test path) but **HIGH NOISE**: 10+ tests import via `../../../renderer/js/shell/panels/scene-navigator.js`. |
| `shell/panels/outline.js` | Same pattern; 59 screenplay hits. Calls `Rga.Shell.SceneNavigator.focusRow` cross-panel. | Co-located with this discussion; same shape. |
| `shell/panels/characters.js`, `panels/revisions.js` | Placeholder stubs but screenplay-named. | Low. Wait until they become real. |
| `shell/panels/script-workspace.js` | File browser scoped to `.rga/.fountain/.fdx` — screenplay extension list. | Doc-type-neutral browse pattern; the extension list is plugin-owned. |

The audit (`FILMUSTAGEATION_PHASE1A_SHELL_AUDIT.md` §7.3) marks these moves as **deferred — premature without a second doc-type**. The post-F1A review §6 confirms: continuing F1A.* ownership recovery purely is "low leverage without a second doc-type." Phase 0 honours that.

### 4.4 What cannot be moved yet because of `nav-index.js` coupling

`Rga.Nav.getIndex` is the four-consumer screenplay-shaped hub the audit (§6.1) and post-F1A review (§1.5) both flag as the highest-risk un-touched module — 64 hits across `framework/nav-index.js` plus a contract baked into Scene Navigator, Outline, Status Bar segments, and `ScriptSession.currentScene` derivation.

Scene Navigator depends on:
- `idx.scenes[]` shape (`nodeId`, `sceneNumber`, `headingDisplay`, `setting`, `locationText`, `time`, `hasNotes`, `hasRevisionFlag`, `pmPos`, `pmEndPos`).
- `idx.pages[].sceneIds` shape for page-badge lookup.
- `Rga.Nav.findScene(doc, nodeId)` for the click→scroll flow.

Any structural change to the catalogue that requires **new data per scene** (estimated duration in eighths, tag-mention summary per scene, act/sequence grouping, transition continuity tracking) walks into `nav-index.js` repair territory. **Per audit §7.3 and Doctrine Risk #2: do not touch `nav-index.js`** until either a second doc-type or a contract test (Option E from the post-F1A review) pins the neutral interface.

This is the binding architectural constraint on Phase 0 slice candidates.

### 4.5 Activity-rail panel-id coupling

`shell/activity-rail.js:29–33` hard-codes panel ids per rail group: `top = ['sceneNavigator', 'scriptWorkspace', 'outline', 'search']`. Future plugins cannot register into the rail without modifying CORE. Same for `shell/index.js:_PANEL_SHORTCUTS` hard-coded id→shortcut bindings.

This is a known shell drift point. Phase 0 must not touch it — it would deepen ownership entanglement without solving a Scene Navigator UX problem.

### 4.6 What safe plugin-owned improvements are possible now

| Improvement | Plugin-owned? | Touches nav-index? | Touches CORE? |
|---|---|---|---|
| Scroll current row into view when cursor changes scenes | Yes — in `scene-navigator.js` | No | No |
| Refresh empty-state copy | Yes | No | No |
| Replace emoji indicators with Lucide icons | Yes (with `Rga.Icons.Lucide`) | No | No (Lucide is CORE-provided) |
| Section header ("Scenes · 24") | Yes | No (uses `idx.scenes.length`) | No |
| Slug visual sub-treatment (setting/time quieter) | Yes (uses `scene.setting`, `scene.time` already in index) | No | CSS edits only |
| Lightweight filter input | Yes | No | No |
| Plugin relocation (move file to `doc-types/screenplay/`) | Yes | No | Touches index.html script-tag + test paths |
| Act/sequence grouping | **No** — requires nav-index extension | Yes | — DEFERRED |
| Estimated duration column | **No** — requires page-eighths math in nav-index | Yes | — DEFERRED |
| Tag-mention summary per scene | **No** — requires per-scene tag aggregation in nav-index | Yes | — DEFERRED |

The improvement surface that fits the brief's "safe plugin-owned improvements" lives entirely in `scene-navigator.js` + its CSS rules. Anything that needs new per-scene data walks into the nav-index moratorium.

---

## 5. Safe Improvement Candidates

Each candidate names what the slice would do, the files it would touch, its risk class, dependencies, Playwright coverage required, and whether designer input is needed. Order is roughly best-leverage-first.

### S1 — Scroll current row into view when cursor changes scenes

**Purpose.** When `ScriptSession.currentScene.nodeId` changes, scroll the row carrying `.rga-shell-scene-navigator-row-current` into view (DOM-level, not editor cursor). Solves the dominant lived UX weakness from §2.4: the writer types in scene 47 of a 60-scene script and the current marker is off-screen.

**Files likely touched.** `renderer/js/shell/panels/scene-navigator.js` (`_render` — add a single `row.scrollIntoView({block:'nearest'})` after the row carrying the current class is built). No CSS, no nav-index, no index.html.

**Risk.** Low. DOM-only addition to an already-running render path. The selected-row keyboard handler already uses the same pattern (`scene-navigator.js:294–298`).

**Dependencies.** None.

**Playwright coverage required.** New spec: boot the editor; assert sidebar panel mounted; type past the visible-rows threshold; assert current row's bounding rect is within the host's scroll viewport. Existing unit tests need a small extension (already render-asserting) to confirm `scrollIntoView` is called on the current row, not just the selected row.

**Designer input.** None — no visual change.

### S2 — Slug visual sub-treatment

**Purpose.** Render setting/time as quieter modifiers without changing row height. Brings the slug closer to UX Direction §3.8 "instrument labeling" voice while preserving single-line ellipsis.

**Files likely touched.** `scene-navigator.js` row builder (replace single `<span>` with two spans for primary `locationText` + secondary `setting`/`time`), `renderer/css/shell.css` (`.rga-shell-scene-navigator-heading` sub-rules).

**Risk.** Medium. Existing unit tests assert `.rga-shell-scene-navigator-heading.textContent` exact-matches `headingDisplay`. Splitting the span changes test assumptions. Visual fidelity spec required.

**Dependencies.** None — `nav-index.js` already exposes `scene.setting`, `scene.locationText`, `scene.time` separately.

**Playwright coverage required.** New spec asserting both segments render, widths within row constraint, ellipsis behaviour on long locations.

**Designer input.** **Yes** — pixel rhythm, opacity/colour values for the quieter modifier, decision on separator glyph (em-dash today vs middle-dot vs no separator).

### S3 — Lucide icons replace emoji indicators

**Purpose.** Today's 📝🚩 emoji indicators are platform-dependent (font fallback varies macOS / Windows / Linux) and read as debug-noise against UX Direction §6's "instrument labeling" voice. Lucide is already the CORE icon system (rail icons resolved through `Rga.Icons.Lucide`).

**Files likely touched.** `scene-navigator.js` (`_indicator` builder), `renderer/css/shell.css` (`.rga-shell-scene-navigator-indicator` sizing rules for inline SVG).

**Risk.** Low. Cosmetic; Lucide pattern is established.

**Dependencies.** None.

**Playwright coverage required.** Visual fidelity spec asserting the indicators render as `<svg>` not text glyphs.

**Designer input.** **Yes** — Lucide glyph choice (`notebook-pen` vs `sticky-note` vs `square-pen`; `flag` vs `flag-triangle-right`), final sizing.

### S4 — Empty-state copy refresh

**Purpose.** Today's body ("Press Enter on the slug line to start one") is doc-type-aware in a CORE-frame-rendered surface. Quieter, more direction-aligned copy. Optionally add a "Create first scene" action button (`renderEmpty` already supports the `actions` array).

**Files likely touched.** `scene-navigator.js` (`_buildEmpty`).

**Risk.** Low. Single string update; optional action wiring.

**Dependencies.** None.

**Playwright coverage required.** Existing unit test already asserts title + body presence; needs update if action added.

**Designer input.** **Yes** — final copy + whether to include an action.

### S5 — Section header ("Scenes · 24")

**Purpose.** Small panel header showing scene count. Orients without inventory-panel feel. Aligns with Outline panel pattern (`shell.css:1708+` `.rga-shell-outline-section-header`).

**Files likely touched.** `scene-navigator.js` (`_render` builds a header div above the list), `renderer/css/shell.css` (reuse or add header rule).

**Risk.** Low. Additive only.

**Dependencies.** None.

**Playwright coverage required.** Header text presence + count update on doc change.

**Designer input.** **Yes** — header weight, treatment, whether to show counts at all (could feel inventory-like).

### S6 — Lightweight filter input

**Purpose.** Single text input at the panel top; substring filter on `headingDisplay`. Solves "find the dancer scene" without command palette.

**Files likely touched.** `scene-navigator.js` (input element + filter state + render filtering), `renderer/css/shell.css` (input chrome).

**Risk.** Medium. Adds focus-handling complexity (Tab routing, ESC clears filter vs ESC clears selection — needs a precedence rule). Re-render path changes.

**Dependencies.** None (filter is on cached in-memory data).

**Playwright coverage required.** Type filter; assert filtered row count; ESC clears; Tab routes correctly between input and list.

**Designer input.** **Yes** — input chrome, icon, placeholder copy.

### S7 — Plugin relocation: `shell/panels/scene-navigator.js` → `doc-types/screenplay/`

**Purpose.** Align file location with plugin ownership. The controller already registers via the plugin contract; the file location is leftover from pre-F1A territory.

**Files likely touched.** Move the file (renaming to `doc-types/screenplay/sidebar-scene-navigator.js`); update `renderer/index.html` script tag order; update test require paths in 10+ unit tests; update Outline panel's import of `Rga.Shell.SceneNavigator.focusRow` (string ref only — no path change).

**Risk.** Medium. **High noise** — diff hits 10+ test files. No behavioural change. The audit (§7.3) calls this premature.

**Dependencies.** None.

**Playwright coverage required.** Existing F1A.2 spec covers the boot path; no new spec needed.

**Designer input.** None.

**Verdict.** Defer until a second doc-type or contract-test slice (Option E) pins the plugin location contract. Pure cleanup with no UX gain.

### S8 — Estimated duration column

**Purpose.** Surface the per-scene duration UX Direction §3 calls for ("number, slug, estimated duration").

**Files likely touched.** `framework/nav-index.js` (compute per-scene eighths from PageMap), `scene-navigator.js` row, `shell.css`.

**Risk.** **HIGH.** Touches `nav-index.js` — explicitly off-limits per audit §7.3 and Doctrine Risk #2. The math model (eighths-per-scene) needs design.

**Dependencies.** Either nav-index repair (engineering investigation) or a per-scene duration derivation outside nav-index (parallel walk in the panel — possible but architecturally wrong; the index is the canonical place).

**Playwright coverage required.** TBD; not until the data model exists.

**Designer input.** Yes — format ("3 4/8" vs "3⅜" vs "≈3.5 pp"); when to show vs hide.

**Verdict.** **DEFERRED.** Cannot ship in Phase 0.

### S9 — Per-scene tag-mention summary

**Purpose.** Tiny tint or count per row showing which characters/locations appear in the scene.

**Files likely touched.** Same as S8 — requires per-scene aggregation in nav-index, which currently builds `tags[tagType]` flat across the document and `tagSceneAppearances` map but does not project per-scene.

**Risk.** **HIGH.** Same as S8 + risk of becoming an inventory-panel pattern (UX Direction §4 warns against this).

**Verdict.** **DEFERRED.** Architecturally and aesthetically wrong for Phase 0.

### S10 — Act / sequence grouping

**Purpose.** Visual partition by act or by sequence header.

**Files likely touched.** `framework/nav-index.js` (new act/sequence detection), schema (no act node type today), scene-navigator.js renderer.

**Risk.** **VERY HIGH.** Touches schema, nav-index, navigator. Production-scene-numbering deferred feature (memory: `project_production_scene_numbering_deferred`) and acts are not yet first-class concepts.

**Verdict.** **DEFERRED.** Not Phase 0 material.

### Summary table

| # | Slice | Risk | Designer? | Dep on nav-index? | Phase 0 candidate? |
|---|---|---|---|---|---|
| S1 | Scroll-current-into-view | Low | No | No | **Yes** |
| S2 | Slug sub-treatment | Medium | Yes | No | Yes (with designer) |
| S3 | Lucide indicators | Low | Yes | No | Yes (with designer) |
| S4 | Empty-state copy | Low | Yes | No | Yes (with designer) |
| S5 | Section header | Low | Yes | No | Optional |
| S6 | Filter input | Medium | Yes | No | Yes (later) |
| S7 | Plugin relocation | Medium (noisy) | No | No | **Deferred** |
| S8 | Duration column | High | Yes | **Yes** | **Deferred** |
| S9 | Per-scene tags | High | Yes | **Yes** | **Deferred** |
| S10 | Act/sequence | Very high | Yes | **Yes (+ schema)** | **Deferred** |

---

## 6. Recommended First Slice

**Slice SN.1 — Auto-scroll current row into view on scene change.**

### What it does

When `Rga.ScriptSession`'s subscribed callback fires and the new `currentScene.nodeId` differs from the previously rendered current scene, the navigator's `_render` (or a `_renderAndAlign` companion) calls `row.scrollIntoView({behavior:'auto', block:'nearest'})` on the row that received the `.rga-shell-scene-navigator-row-current` class.

### Why this slice first

- **Improves visible UX immediately.** Today's lived problem: writer is in scene 47, navigator shows scenes 1–25, current marker is off-screen, writer must manually scroll to find context. The navigator says "you are here" while pointing nowhere visible. SN.1 makes "here" always visible.
- **Avoids `framework/nav-index.js` surgery.** Pure DOM-level addition in `scene-navigator.js`. The nav-index moratorium (§4.4) is honoured.
- **Avoids massive CSS redesign.** No CSS touched. The row state classes are unchanged. The visual identity is unchanged.
- **Preserves all existing behaviour.** Manual scroll, keyboard nav, click-to-jump, separation invariant — all unaffected.
- **Testable with Playwright.** Boot a fixture with enough scenes to overflow the host, position cursor in a late scene, assert the current row is within the host's visible scroll area (using `getBoundingClientRect` + `clientHeight` math).
- **Small enough to complete safely.** One function modification, one Playwright spec, one or two unit-test additions. No file move, no schema change, no contract change.

### What it does NOT do

- It does NOT auto-focus the panel. Keyboard focus stays where it was (editor in most cases).
- It does NOT change the `selected` state. Keyboard selection is untouched.
- It does NOT animate. UX Direction §6 Motion Philosophy: motion is functional confirmation, not theatre. `behavior:'auto'` (instant) is correct.
- It does NOT scroll-into-view the current row on initial mount when it's already in view — `block:'nearest'` is a no-op when the element is already visible.
- It does NOT touch nav-index, schema, doc-types/screenplay/, index.html, settings-registry, or any other file beyond `scene-navigator.js` and a small CSS check if needed.

### Files touched (estimate)

- `rwanga-editor/renderer/js/shell/panels/scene-navigator.js` — one block inside `_render` (or a small helper invoked after `_render`).
- `rwanga-editor/tests/unit/shell/scene-navigator.test.js` — one or two new tests asserting auto-scroll happens when current changes, doesn't happen when it's unchanged.
- `rwanga-editor/tests/e2e/filmustageation/scene-navigator-autoscroll.spec.js` — new Playwright spec.

### Risk acceptance

- **Risk** of unwanted scroll on every `ScriptSession` snapshot tick. Mitigation: only scroll when the current `nodeId` actually changes between renders (track previous current nodeId; compare; act only on transition).
- **Risk** of fighting with manual user scroll. Mitigation: `block:'nearest'` means we only scroll when the row is **already out of view**. A user who manually scrolled to see scene 5 while typing in scene 47 will see scene 47 scrolled into view on the next current-scene transition — but this is the **intended behaviour** because they were navigating, not deliberately keeping scene 5 visible. (Alternative: gate auto-scroll behind a `Settings` toggle. Out of scope for SN.1 — add in a follow-up if a writer flags the behaviour as intrusive.)

### What unlocks next

Once SN.1 lands, candidate Phase 0 follow-ups in priority order:
- S2 (slug sub-treatment) — first designer-input slice.
- S3 (Lucide indicators) — second designer-input slice; bundleable with S2.
- S4 (empty-state copy) — quick win after S2/S3 ratify a copy/visual voice.
- S5/S6 (header + filter) — later, with designer.

All of S8/S9/S10 stay deferred until the nav-index moratorium lifts — which is Option E (post-F1A review §6) territory, not this surface arc's territory.

---

# Closing Assessment

## 1. Strongest current scene sidebar strength

**The two-state separation invariant — current vs selected — is the catalogue's mature design.** `.rga-shell-scene-navigator-row-current` (brand-pink left-bar tied to editor cursor via `ScriptSession.currentScene.nodeId`) and `.rga-shell-scene-navigator-row-selected` (soft fill + outline tied to keyboard navigation) are two visually distinct states that coexist on the same row without collapsing. The contract is documented in code (`scene-navigator.js:23–32`), enforced by CSS (`shell.css:1638–1654` SEPARATION INVARIANT block), and pinned by 30+ unit tests including explicit non-collapse assertions. UX Direction §4 named the "color-coded bars for the selected scene works" — the implementation matches the direction and is testable, calm, and mature. It is the right anatomy for a writing-first navigator.

## 2. Biggest UX weakness

**No scroll-to-current behaviour when the editor cursor changes scenes.** The brand-pink current-row marker says "you are here," but in a 60-scene screenplay the writer can be typing in scene 47 while the navigator panel shows scenes 1–25. The "you are here" signal points off-screen. The writer either ignores the navigator entirely or manually scrolls to find context — both undermine the calibrated "Session Awareness" emotional layer the UX Direction §1 calls for. The fix is small (a single `scrollIntoView({block:'nearest'})` on the current-row transition) and is the recommended first slice.

## 3. Biggest architectural constraint

**`framework/nav-index.js` is off-limits.** It is the screenplay-shaped four-consumer hub (Scene Navigator, Outline, Status Bar segments, `ScriptSession.currentScene`), 64 hits per the Phase 1A audit, named in both the audit (§6.1 + §7.3) and the post-F1A review (§1.5 + §6) as the highest-risk un-touched module. The Doctrine flags it as Risk #2. Repair requires designing a plugin-registered indexer interface and is engineering investigation, not a slice. Any improvement that needs **new per-scene data** (estimated duration in eighths, per-scene tag-mention summary, act/sequence grouping) walks into this moratorium and must be deferred until either a second doc-type lands or the Option E contract-test prerequisites from the post-F1A review are built. Phase 0 honours the moratorium by selecting only improvements that operate on already-exposed `nav-index` data.

## 4. Safest first implementation slice

**SN.1 — Auto-scroll current row into view on scene change.** Pure DOM-level addition in `scene-navigator.js`. Zero coupling to `nav-index.js`. Zero CSS surgery. Zero changes to the SEPARATION INVARIANT, keyboard nav, click flow, or empty state. Solves the biggest lived UX weakness (§3.2 above). Testable with one Playwright spec and one or two new unit tests. No designer input needed for SN.1 itself.

## 5. Designer input needed or not

**Not for the first slice (SN.1) — but yes for almost every subsequent Phase 0 candidate.** SN.1 changes behaviour, not visuals, and the existing brand-pink current-row treatment is the right anatomy. Beyond SN.1: S2 (slug sub-treatment) needs designer for pixel rhythm and opacity values; S3 (Lucide indicators) needs designer for glyph choice and sizing; S4 (empty-state copy) needs designer for voice; S5 (section header) needs designer to decide whether scene counts feel inventory-like; S6 (filter input) needs designer for input chrome. The recommended progression is: ship SN.1 standalone, then bundle S2 + S3 + S4 into a single designer-collaborated visual-refinement slice once a designer is engaged.

## 6. STOP

This is audit + UX specification only. No implementation has begun. No code has been edited. No new architecture has been invented beyond what is grounded in the post-F1A.7 shell, the doctrine, the Filmustageation UX Direction document, and the Phase 1A audit. The recommended next step is for the user to authorize (or reject, or amend) SN.1 — Auto-scroll current row into view on scene change — as the first surface-improvement slice in the Scenes Sidebar Catalogue arc. That decision belongs to the user, not to this document.
