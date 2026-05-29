# Filmustageation — Post-F1A Stabilization & Shell Review

> **Review only. No implementation, no slices, no redesign.**
> Created: 2026-05-29 · HEAD: `84815583` (origin/main in sync).
> Companion docs: `RWANGA_EDITOR_CORE_PLUGIN_PLATFORM_DOCTRINE.md`, `FILMUSTAGEATION_PHASE1A_SHELL_AUDIT.md`, `EDITOR_VIEWPORT_PLATFORM_BOUNDARY_CONTRACT.md`, `rwanga-editor/docs/Filmustageation/Filmustageation UX Direction.html`.

Eight ownership-recovery slices have landed in Filmustageation Phase 1A:

| Slice | Subject | HEAD |
|---|---|---|
| F1A.1 | Editor viewport / platform boundary | `c06c9c2e` |
| F1A.2 | Sidebar default per doc-type | `6dc3024e` |
| F1A.3 | Inspector panel host (frame-only) | `9413f19b` |
| F1A.4 | Status-bar contribution API | `118b964f` |
| F1A.5 | Scene Notes inspector migration | `4ea19bd5` |
| F1A.6 | Toolbar contribution API / Scene group | `9ee4c7a6` |
| F1A.6A | Toolbar layout fidelity recovery | `b07c274b` |
| F1A.7 | Tag dropdown plugin ownership | `84815583` |

This document reads the post-F1A.7 shell against the doctrine + UX Direction + Phase 1A audit, then recommends the safest next arc. Findings are grounded in current files and current contamination counts.

---

## 1. Current Shell Ownership Map (post-F1A.7)

### 1.1 CORE-owned

| Concern | Module(s) / location | Notes |
|---|---|---|
| Sidebar frame | `shell/sidebar.js` + `#rga-shell-sidebar-host` | Registry + lifecycle. Frame complete; contents are plugin. |
| Activity rail | `shell/activity-rail.js` + `#activity-bar` | Three-group rail (top/middle/bottom); panel ids still hard-coded. |
| Inspector frame | `shell/inspector.js` + `#inspector-panel` | F1A.3 host. `registerPanel` / `activate` / `deactivate` / `isApplicable` / `onChange`. |
| Status bar frame | `shell/status-bar.js` + `#status-bar` | F1A.4 contribution API. CORE built-ins: `offline`, `wordCount`, `viewMode`, `theme`. |
| Toolbar frame | `shell/toolbar.js` + `#rga-shell-toolbar` + `.rga-shell-toolbar-content-slot` | F1A.6 contribution API (`registerGroup`); F1A.6A slot `display: contents` fix. |
| Toolbar built-ins (neutral) | `format-toolbar.js` + static HTML | Text group (B/I/U/S, color, highlight, link, clear), Writing group (Note, Flag, Undo, Redo), Mode toggle. |
| Title bar | `shell/title-bar.js` + `#rga-shell-titlebar` | Three zones (app / title / actions). Avatar placeholder unwired (Phase 1A audit medium-risk surface). |
| Menu bar | `#rga-shell-menubar` (static HTML) | File / Edit / View / Script / Tags / Tools / Export / Help. **`Script` + `Tags` are screenplay-named.** |
| Tab manager | `shell/tab-manager.js` | Document vs workspace tab kinds (Shell Doctrine). |
| Studio Panel (bottom panel) | `shell/studio-panel.js` + `#bottom-panel` | Three-state model. Hosts five tabs; tabs hard-coded in HTML. |
| Layout SSOT | `shell/layout.js` | Six zones + workspace persistence. |
| Settings (Store, applicators, registry) | `shell/settings-*.js` | Settings Constitution-binding. |
| Command system | `shell/command-palette.js` + `keyboard-registry.js` | Plugin commands route through KR. |
| Script session / metrics / language | `shell/script-session.js` + `script-metrics.js` + `script-language.js` | Naming-is-deliberate per `project_script_equals_session`. Not screenplay-plugin contamination. |
| Editor kernel | `renderer/js/editor/` | ProseMirror mount + dispatch. |
| Editor viewport / platform boundary | `renderer/js/platform.js` | F1A.1. `Rga.Platform.has/invoke/get`. |
| Print / preview / pagination | `framework/print-*.js`, `framework/pagemap-engine.js`, `framework/manuscript-geometry.js` | Single-resolver page truth (S8). Mostly neutral with screenplay terminology in comments. |
| `.rga` document model | `renderer/js/doc.js` | Doc envelope + metadata + `tagRegistry` (see §4 for the contamination). |

### 1.2 Plugin-owned (screenplay) — what F1A migrated

| Concern | File | Slice |
|---|---|---|
| Scene toolbar group (block-type select + Insert Scene) | `doc-types/screenplay/toolbar.js` | F1A.6 |
| Tag toolbar group (9 production categories) | `doc-types/screenplay/toolbar-tag.js` | F1A.7 |
| Status-bar segments: `scene`, `blockType`, `page`, `language` | `doc-types/screenplay/status-bar.js` | F1A.4 |
| Scene Notes shared source | `doc-types/screenplay/scene-notes.js` | F1A.5 |
| Scene Notes inspector panel | `doc-types/screenplay/inspector-scene-notes.js` | F1A.5 |
| Default sidebar panel registration (`defaultSidebarPanel: 'sceneNavigator'`) | `doc-types/screenplay/index.js` | F1A.2 |

### 1.3 Plugin-owned (screenplay) — pre-F1A territory

These were already plugin-located before Phase 1A. F1A did not touch them:

- Schema-v3 (`framework/v3-schema-base.js`, `doc-types/screenplay/plugins/*-schema-extension.js`).
- v3 commands + keymap (`doc-types/screenplay/v3-commands.js`, `v3-keymap.js`).
- v3 node views (`doc-types/screenplay/v3-node-views.js`).
- Screenplay mark plugins: `tags.js`, `annotations.js`, `annotation-notes.js`, `revision-flags.js`, `context-menu.js`.
- Screenplay-specific migrations (`doc-types/screenplay/migrations/`).

### 1.4 Plugin code in CORE folders (organisational drift, not contractual)

These live under `shell/panels/` but are screenplay-shaped. The contract is correct (sidebar host + `registerPanel`), but the file location is misleading:

- `shell/panels/scene-navigator.js` — reads `Rga.Nav.getIndex(view.state).scenes`.
- `shell/panels/outline.js` — sections: Title summary, Story Progress, Scenes, Characters (59 screenplay hits).
- `shell/panels/characters.js` — placeholder (`available: false`).
- `shell/panels/revisions.js` — placeholder, screenplay-industry terminology.
- `shell/panels/script-workspace.js` — `Scripts` category hard-codes `.rga / .fountain / .fdx`.

### 1.5 Remaining screenplay ownership leaks in CORE

Grouped by severity. Numbers updated to post-F1A.7 state.

**Doctrine violation (Law 8 — domain in kernel)**

- `framework/screenplay-normalizer.js` — 32 hits. Domain-named module in supposedly neutral kernel. Doctrine §2.3 already flags it.
- `framework/nav-index.js` — 64 hits. `Rga.Nav.getIndex` returns `{ scenes, characters, pages }`. Four-consumer hub (Scene Navigator, Outline, Status Bar, ScriptSession).
- `framework/document-outline.js` — 40 hits. Outline shape commits to "scenes" + "characters."
- `framework/layout-profile.js` — 21 hits. Pagination composition includes screenplay keep-with-next rules.
- `framework/pagemap-engine.js` — 14 hits. Pagination unit naming is screenplay.
- `framework/render-model.js` — 6 hits.
- `framework/print-renderer.js` — 5 hits (terminology only).
- `framework/manuscript-geometry.js` — 8 hits (mostly comments).
- `framework/doc-type-registry.js` — 8 hits. `detect()` defaults to `'screenplay'` (single-tenancy assumption).
- **Total framework/ screenplay vocabulary: 199 hits across 10 files. Unchanged since the Phase 1A audit.**

**Static HTML carrying plugin payload**

- `renderer/index.html` — 79 screenplay-vocabulary hits. Post-F1A.7 the live offenders are:
  - **Menu bar** — `Script` + `Tags` top-level menus (lines 90–99) are screenplay-named on the CORE menu strip.
  - **Bottom panel tabs** — `Scene · Notes · Flags · Problems · Breakdown` (`data-bp-tab` attrs, lines 296–302). Scene + Breakdown are screenplay-specific.
  - **Bottom panel content** — `data-bp-tab="scene"` body region with `notes-scene-label` + scene-notes textarea (lines 314–328).
  - **Breadcrumb** — `#rga-shell-breadcrumb-scene` + scene heading element (lines 235–243). Screenplay vocabulary on the writer-context layer.
  - **Empty state** — `"Rwanga Script Editor"` label (line ~264). Cosmetic; would change naturally when a second plugin ships.

**Shell-layer DOM coupling to screenplay schema**

- `shell/studio-panel.js`'s `_wireSceneNotesConnector` + the scene-detection walker (`el.dataset.blockType === 'scene-header'` + `el.dataset.sceneId`, line 421) — direct screenplay schema coupling in shell-folder code. **F1A.5 abstracted scene-notes storage behind `Rga.SceneNotes` but the DOM walker that detects which scene the cursor is in still lives in the shell file.** The walker calls `Rga.SceneNotes.setCurrentScene(sceneId, sceneName)` — so the *storage* contract is plugin-clean; the *detection* is not.
- `shell/page-setup-preview.js` (line 84) — direct read of `doc.metadata.screenplayProfile`.
- `shell/panels/scene-navigator.js`, `outline.js` — read `Rga.Nav.getIndex`. Plugin contents in shell folder, with `framework/nav-index.js` as the shared screenplay-shaped indexer.
- `shell/settings-registry.js` — 30 hits. Screenplay-specific Settings entries (industry conventions, MORE/CONT'D, language profile, RTL bits).

### 1.6 Remaining shell assumptions

- **One doc-type at a time.** Doc-type registry registers one. There is no test of "load with no plugin," "load with two plugins," or "switch plugin at runtime."
- **`Rga.Doc.tagRegistry` is screenplay-shaped.** Hard-coded keys: `characters / props / wardrobe / locations / sfx / vfx / vehicles / animals / custom`. The document model itself remembers production vocabulary; F1A.7 moved the dropdown but the data shape behind it is still in CORE doc.js.
- **`schema.marks.tag` exists in CORE schema.** The Tag toolbar contribution and CORE's `Rga.Doc.addEntity` both depend on it. Whether the mark is CORE-neutral or screenplay-shaped is undecided — it works for any string `tagType` but the *concept* of "tagging selection with production-category attrs" is screenplay-flavoured.
- **No plugin sandbox.** Plugins run in the renderer alongside CORE; isolation is contractual, not enforced.
- **`script-session.js` + `script-metrics.js` + `script-language.js`** — naming-is-deliberate per `project_script_equals_session`. **Not** drift; the "script = session" architectural unit is intentional. Keep as-is.

---

## 2. Toolbar Topology Review

### 2.1 Current visible composition

```
Row 3 (#rga-shell-toolbar > .rga-shell-toolbar-inner)
├─ [CORE static]   text-group           B I U S | A▾ ▭ | ↗ | A×
├─ [plugin slot, display: contents]
│  ├─ sep (plugin-inserted leading)
│  ├─ [PLUGIN order 200]  scene-group   block-type▾ | + Scene
│  ├─ sep (plugin-inserted leading)
│  ├─ [PLUGIN order 300]  tag-group     Tag▾
├─ [CORE static]   sep
├─ [CORE static]   writing-group        Note Flag | Undo Redo
├─ [CORE static]   sep
└─ [CORE static]   mode-group           Screenplay
```

### 2.2 Contribution ordering

- Numeric `order` field with insertion-order tie-break (Map iteration).
- Two real consumers today: `scene` at 200, `tag` at 300.
- Reserved bands by convention (not enforced anywhere):
  - 0–199: pre-text groups (none yet).
  - 200–299: structural verbs (scene at 200).
  - 300–399: annotation / tagging (tag at 300).
  - 400+: open.
- The ordering scheme **works for two consumers** but has no documentation, no contract test, no collision rule. A third plugin or a second screenplay verb landing at the wrong order would silently reshuffle the row.

### 2.3 Separator rhythm

- Plugin groups carry a **leading separator** auto-inserted by `_mountGroupNow`.
- The slot wrapper is `display: contents` (F1A.6A), so the leading separator + group element flow as flex siblings of the static text/writing/mode groups in the inner band.
- Static separators between text→slot, slot→writing, writing→mode still live in `index.html`.
- A pre-existing flex-shrink quirk collapses the writing↔mode separator's computed width to 0 under flex pressure. Documented in `toolbar-layout-fidelity.spec.js` as out-of-F1A.6A scope. **Still present.** Not blocking, but cosmetic.

### 2.4 Group semantics

- **CORE**: text formatting (universal), Note/Flag (annotation/revision — both document-neutral), Undo/Redo (edit-history verbs), Mode toggle (currently degenerate — only "Screenplay" visible).
- **PLUGIN (screenplay)**: scene verbs, tag verbs.
- The boundary is honest. The post-F1A.7 CORE writing group is genuinely doc-type-neutral; the screenplay verbs are genuinely in the plugin.

### 2.5 Ownership clarity

- High. The contribution surface is small (`registerGroup` / `unregisterGroup` / `getController` / `setHost` / `_reset`).
- Each consumer file's purpose is single-shot: one group per file.
- Migration comments in `format-toolbar.js` + `index.html` clearly mark the boundary's history (D2 → F1A.6 → F1A.7).

### 2.6 Mounting stability

- Pre-init registrations queue; `setHost` mounts them in order.
- Post-init registrations mount immediately.
- Soft `_reset` (clears DOM + cleanups; preserves registry) lets plugin IIFEs survive boot cycles in tests.
- Mount throws are contained (group div stays as empty placeholder); cleanup throws are contained (removal proceeds).

### 2.7 Does the contribution model scale safely?

**Yes, for at-most ~5 plugin groups in one slot.** Beyond that, three risks accumulate:

1. **Order-band collisions.** No reservation document; future plugins may land at conflicting orders without a guard.
2. **Single slot.** Only one slot exists today (`data-toolbar-slot="content"`). If a future plugin wants groups at the *trailing* end (after Writing, before Mode), it cannot. A second slot or a `position` field would solve it; neither is built.
3. **Intrinsic-height variance.** Tag group's native `<select>` sits ~5px higher than icon-button groups in bbox top-edge — `align-items: center` keeps centers aligned but tops differ. F1A.7 promoted the `toolbar-layout-fidelity.spec.js` invariant from "tops ±1px" to "centers ±2px" to reflect what the CSS actually guarantees. **Documented honestly; future plugins inherit the same property.**

### 2.8 Architectural verdict

Stable for 2–4 plugin groups. Not yet stable for an open-ended ecosystem. The seam is correct; the scaling story is undocumented.

---

## 3. Inspector Reality Review

### 3.1 What exists after F1A.3 + F1A.5

- `shell/inspector.js` — registry, lifecycle, mutual-exclusion, applicability check, on-change events, default-content slot.
- `shell/studio-panel.js` exposes the inspector host (`Rga.Shell.Inspector.setHost`).
- One real consumer: `doc-types/screenplay/inspector-scene-notes.js` — Scene Notes panel reading from `Rga.SceneNotes`.
- Bottom-panel Scene tab is a **secondary view**; the shared source `Rga.SceneNotes` lets either surface write and both stay in sync.

### 3.2 Does the model feel stable?

Mostly. Five honest observations:

1. **`registerPanel` works** — F1A.5 proved it with a real consumer. Re-registration after `_reset` survives test boot cycles.
2. **Mutual exclusion is correct** — one panel active at a time; activation triggers `deactivate()` on the previous panel.
3. **Default-content slot is unused.** F1A.3 declared the slot; F1A.5 didn't wire it. Today the inspector's empty state is still the static "No details to show. Select a tag or a scene heading to inspect it." in `index.html`. This is a half-finished contract.
4. **No selection observer.** The inspector contract assumes panels register themselves based on selection context, but CORE provides no `onSelectionChange` event. F1A.5 sidestepped this by piggy-backing on `Rga.SceneNotes`'s own scene-detection (which itself reads from `studio-panel.js`'s DOM walker). That works for scene-notes; the next consumer (character cards, prop details) will need a real selection-observer.
5. **No "applicable to this doc-type" filter.** A panel registers and is always available. When a second doc-type lands, screenplay's panels should not be activatable on a novel document; that filter doesn't exist.

### 3.3 Remaining DOM-walking dependencies

- `studio-panel.js` `_walkUpForScene` still walks editor DOM for `dataset.blockType === 'scene-header'` + `dataset.sceneId` (line 421). The walker calls into `Rga.SceneNotes.setCurrentScene`, which is plugin-owned — but the **walker itself is shell-folder code with screenplay schema literals in it.** F1A.5 left this as the seam between CORE selection and plugin scene-detection.
- `shell/page-setup-preview.js` reads `doc.metadata.screenplayProfile`.
- The bottom-panel Scene tab + its label + textarea live in static CORE HTML; F1A.5 routes their values through `Rga.SceneNotes` but the DOM is CORE-owned.

### 3.4 Remaining screenplay assumptions in the inspector zone

- The **only registered panel** is screenplay-scene-notes. There is no "default" panel and no panel that fires for non-screenplay docs.
- The inspector body's empty-state HTML still mentions "scene heading" and "tag" — both screenplay vocabulary.
- The bottom-panel Scene tab's textarea is mirrored to the inspector panel; that mirroring is a screenplay-specific construct that future plugins must either inherit or override.

### 3.5 Contextual activation boundaries

Unclear. Today's reality:
- **Activation source A**: `Rga.SceneNotes.setCurrentScene` is the trigger; when a scene becomes "current," the inspector's Scene Notes panel can render meaningful content.
- **Activation source B**: nothing else triggers panel activation.
- There is no rule for *when* to switch panels (e.g., "cursor in scene → scene-notes; cursor inside character mark → character-card"). The choice is hard-coded at panel registration time, not at runtime.

When the second inspector consumer arrives (character / prop / location cards), the contract will need:
- A selection-observer event the inspector subscribes to.
- A "best applicable panel for current selection" resolver.
- A per-session memory of the user's last-chosen panel (per UX Direction §5: "Remember state per session").

### 3.6 Does the inspector contract need adjustment before more consumers arrive?

**Yes — minor adjustments, not rewrites.** Three additions are needed before the second screenplay inspector panel lands:

1. A selection-observer event (CORE) that panels subscribe to.
2. An `isApplicable(context)` resolver that picks one panel from several applicable.
3. A "default content" registration that fills the inspector body when nothing is applicable.

None of these is built today. F1A.5 worked because there is exactly one panel.

---

## 4. Shell Drift Reassessment

Re-running the most consequential contamination assessment against the post-F1A.7 state.

| Surface | Pre-Phase-1A | Post-F1A.7 | Classification |
|---|---|---|---|
| `renderer/index.html` static toolbar (scene group + tag dropdown) | Screenplay HTML in CORE | Both groups plugin-mounted; CORE writing group keeps only Note/Flag/Undo/Redo | **Improved.** |
| `renderer/index.html` menu bar `Script` + `Tags` top-level menus | Screenplay-named menus in CORE | Same | **Unchanged.** Acceptable temp debt; cost of fixing is high (menu wiring touches dozens of commands). |
| `renderer/index.html` bottom-panel `Scene` + `Breakdown` tabs | Hard-coded screenplay tabs | Same | **Unchanged.** |
| `renderer/index.html` breadcrumb `#rga-shell-breadcrumb-scene` | Screenplay vocabulary in writer-context chrome | Same | **Unchanged.** Cosmetic. |
| `renderer/index.html` empty state ("Rwanga Script Editor") | Screenplay branding in CORE empty state | Same | **Unchanged.** Cosmetic. |
| `format-toolbar.js` | Scene group dispatch + Tag handler + applyTagFromSelection lived here | Scene + Tag moved to plugin; only migration-history comments remain | **Improved.** |
| `format-toolbar.js` `writing.note` / `writing.flag` | CORE commands | Same | **Acceptable.** Names contain "writing" but logic is document-neutral (annotation + revision flag — both CORE concerns per Doctrine §2.1). |
| `shell/status-bar.js` direct `screenplayProfile.language` read | Direct schema-coupling | F1A.4 moved the read into `doc-types/screenplay/status-bar.js` | **Improved.** |
| `shell/studio-panel.js` `_wireSceneNotesConnector` + `_walkUpForScene` | Walked editor DOM for `data-blockType=scene-header` | F1A.5 abstracted storage behind `Rga.SceneNotes`; **the DOM walker still lives in studio-panel.js** | **Improved (storage); unchanged (detection).** |
| `shell/page-setup-preview.js` reads `doc.metadata.screenplayProfile` | Direct schema coupling | Same | **Unchanged.** |
| `shell/panels/*` (scene-navigator, outline, characters, revisions, script-workspace) | Screenplay-shaped panels in CORE folder | Same | **Unchanged.** Organisational drift, not contractual violation. |
| `shell/settings-registry.js` screenplay-specific entries (30 hits) | Industry conventions, MORE/CONT'D, language, RTL | Same | **Unchanged.** Settings tier cascade can move these per-doc-type later; not urgent. |
| `framework/nav-index.js` (64 hits) | Hub indexer with `{ scenes, characters, pages }` | Same | **Unchanged.** Highest-risk un-touched module — four consumers depend on the screenplay-shaped contract. |
| `framework/screenplay-normalizer.js` (32 hits) | Domain-named in supposedly neutral kernel | Same | **Unchanged.** Doctrine-flagged. |
| `framework/document-outline.js` (40 hits), `layout-profile.js` (21), `pagemap-engine.js` (14), `render-model.js` (6), `print-*.js` (6), `manuscript-geometry.js` (8), `doc-type-registry.js` (8) | Screenplay vocabulary in `framework/` | Same | **Unchanged.** 199 total `framework/` hits across 10 files. |
| `Rga.Doc.tagRegistry` (`doc.js`) | Hard-coded production keys: `characters / props / wardrobe / locations / sfx / vfx / vehicles / animals / custom` | Same | **Newly exposed.** F1A.7 moved the dropdown but the document data model still hard-codes the same production vocabulary. The plugin now CALLS a CORE primitive (`Rga.Doc.addEntity(doc, tagType, ...)`) whose internal shape is screenplay-named. |
| `Rga.Doc.addEntity` API | CORE function with screenplay-coupled internal registry shape | Same | **Newly exposed.** Same root cause as `tagRegistry`. The function is generic-looking (`(doc, tagType, attrs)`) but writes to a fixed-key registry. |
| `schema.marks.tag` mark in CORE schema | Cross-schema mark, used by `tags.js` (screenplay plugin) and now by `toolbar-tag.js` | Same | **Dangerous.** The mark IS in CORE schema but is conceptually plugin-owned. A second doc-type would either need to register the same mark (plugin-to-plugin schema collision) or reject it (existing screenplay `.rga` files would degrade). |
| `Rga.Inspector.open()` shim called by screenplay `context-menu.js` | Shell→plugin reach | Same | **Acceptable temp debt.** Slice-9 consolidation artifact; the F1A.3 contract is the modern surface; the shim is a backwards-compatibility hook. |
| Activity rail `RAIL_GROUPS` hard-coded panel ids | Cannot accept future-plugin rail entries | Same | **Unchanged.** |
| Tag visual saturation / chrome polish | UX Direction §4/§6 calls for 60–70% saturation | Same | **Unchanged.** Cosmetic; correctly deferred per audit §7.4. |

### Classification summary

- **Improved (4 surfaces):** index.html toolbar payload, format-toolbar.js, status-bar.js, studio-panel.js scene-notes storage.
- **Newly exposed (3 surfaces):** `Rga.Doc.tagRegistry` hard-coded keys, `Rga.Doc.addEntity` registry shape, `schema.marks.tag` mark in CORE schema. **These were latent before; F1A.7 makes them prominent because the plugin now calls them visibly.**
- **Dangerous (1 surface):** `schema.marks.tag` in CORE schema — the plugin-vs-CORE boundary at the schema layer is unresolved.
- **Unchanged (the rest):** framework/ neutrality (199 hits), most index.html static contamination, settings-registry, sidebar panel locations, page-setup-preview, activity-rail panel ids, all cosmetic concerns.
- **Acceptable temp debt:** menu bar Script/Tags labels, Inspector.open shim, settings-registry screenplay entries.

---

## 5. Workflow-State Readiness Reassessment

The UX Direction §7 defines five workflow states (Deep Writing / Navigating / Reviewing / Breakdown / AI Assist). Honest readiness assessment:

| State | What's truly ready | What's still missing | Danger if started now |
|---|---|---|---|
| **Deep Writing** | `Rga.ViewMode.set('draft')` hides chrome; `#draft-mode-footer` exit; sidebar/inspector togglable. | No coordinated mode that simultaneously collapses sidebar + inspector + dims status bar. No proximity detector. The chrome fades per-zone, not as a coherent state. | **Low-medium.** Adding a Mode SSOT now risks creating a sixth Layout zone that competes with the per-zone visibility we already persist. Stable for individual chrome fades; not stable as a single coordinator. |
| **Navigating** | sceneNavigator default; sidebar togglable; outline panel; status bar shows current scene. | No explicit "navigating" mode toggle. Today users manually open panels. | **Low.** This state is mostly emergent; making it explicit is mostly UI. |
| **Reviewing** | Bottom-panel Notes + Flags tabs; `revision-flags.js` plugin; revision colors plumbing partially in framework. | The "Reviews" sidebar panel is a placeholder (`available: false`). No review-markup overlay on the editor. No revision-color view-mode. Comments/redlines do not exist. | **High.** Reviewing depends on collaboration UI conventions that are explicit Platform concerns (UX Direction §8). Starting now invites premature platform-coupling. |
| **Breakdown** | Bottom-panel Breakdown tab (skeleton); tag system (`tags.js`); tag-registry on doc. | No sidebar panel for breakdown categories (UX Direction §4 calls for this as a rail-switched secondary view). Bottom panel's Breakdown tab is a table skeleton. Tag visual saturation reduction not done. | **Medium.** The data model exists (tagRegistry) but the surfaces are placeholders. Building this state forces the `tagRegistry` neutralisation question — see §4 above. |
| **AI Assist** | Nothing. No AI surface in the shell today. AI orchestration spine doesn't exist. | Everything. Constrained v01 AI ships in the IDE (per memory: `project_ide_v1_scope`) but no plumbing in the shell. | **Locked.** The Alive App entry gate is closed (`project_alive_app_checklist`). No AI feature may begin before Phase 2 is visually verified. |

### What foundations are now truly ready

1. **Toolbar contribution API** — proven with two consumers (scene + tag) and a layout-fidelity guard.
2. **Status-bar contribution API** — proven with four screenplay segments + four CORE built-ins.
3. **Inspector host** — proven with one consumer (scene-notes) and a shared-source pattern (`Rga.SceneNotes`).
4. **Sidebar default per doc-type** — proven (F1A.2 walks the doc-type registry's `defaultSidebarPanel`).
5. **Editor viewport / platform boundary** — declared, smoke-tested, zero live consumers (correct for preventive work).

### What is still missing for workflow-state

1. **CORE Mode SSOT.** No `Rga.Shell.Mode` or equivalent. The five states would each need to coordinate sidebar/inspector/toolbar visibility + a tint/section-color — across CORE chrome and plugin-contributed contents.
2. **Selection-observer event.** Inspector consumers beyond scene-notes need it. Workflow-state transitions ("cursor moved from scene to character" → "navigate" mode) would also need it.
3. **Plugin-side mode contributions.** Each plugin would need to declare what each mode means for its doc-type. Today screenplay has no such surface.
4. **Inspector "default" content slot.** F1A.3 declared it; no consumer wires it.
5. **Tag visibility controls.** UX Direction §4 specifies per-category saturation toggling. Requires Settings + ProseMirror decoration coordination. Not built.

### What becomes dangerous if workflow-state work begins immediately

- **The `tagRegistry` + `addEntity` + `marks.tag` triad becomes load-bearing.** Breakdown mode reads from these surfaces, but they are screenplay-shaped CORE primitives. Building Breakdown now commits to the shape before it can be neutralised — and rolling back would require a `.rga` migration.
- **The framework/ neutrality work would block.** A Mode SSOT that coordinates the sidebar's "Breakdown" panel against the bottom panel's Breakdown tab against the inline tag rendering would touch `framework/nav-index.js`, `framework/document-outline.js`, and the schema's `tag` mark — all 64+ refs each. Phase 1A explicitly defers this until a second doc-type or contract test exists.
- **The collaboration assumptions would harden prematurely.** Review mode UX Direction §8 says collaboration is Platform-level. Starting Review now without a Platform integration shapes the editor around assumptions the platform hasn't ratified.

---

## 6. Recommendation for Next Arc

**Recommend option E — Stabilization / testing hardening — with a small slice of option A continuing F1A's ownership work.**

### Reasoning

The Phase 1A audit's order of operations (§7.5) was:
1. Inspector panel-host contract ✓ (F1A.3 done).
2. Editor viewport boundary ✓ (F1A.1 done).
3. Sidebar default per-doc-type ✓ (F1A.2 done).
4. Toolbar contribution API ✓ (F1A.6 + F1A.6A + F1A.7 done).
5. Status bar contribution API ✓ (F1A.4 done).
6. Workflow-state SSOT — **not yet.**
7. `framework/` neutrality pass — **not yet.**

Steps 1–5 are done. Steps 6 and 7 are both cross-cutting and high-risk. Before either, the post-F1A foundation needs to harden:

- **Document the toolbar's order-band reservations.** Two consumers exist; a third would have no contract.
- **Build a minimal "no plugin" smoke test.** Today's `doc-type-registry.detect()` defaults to `'screenplay'`. Doctrine Law 11 (graceful-degrade read) is asserted but not tested.
- **Build a minimal "two plugins" contract test.** A neutral test plugin that registers (sidebar default, status-bar segment, toolbar group, inspector panel) proves the four contribution APIs generalise — without touching screenplay, without inventing a real second plugin.
- **Add an inspector selection-observer scaffold.** Not a full implementation — a stub event that the existing scene-notes panel can subscribe to, validating the contract before the second consumer arrives.

That bundle is **stabilization with one ownership-recovery slice attached** — closing the Phase 1A loop with verifiable invariants instead of relying on a single live consumer for each contribution API.

### Risks of the recommendation

- **Time-cost low; deferral cost low.** Stabilization doesn't ship visible features. If product pressure demands visible progress, this arc looks like a pause.
- **Test-plugin work could leak into "real" plugin design.** Mitigation: explicit "neutral test plugin, no schema, no real behavior" scope.
- **Order-band documentation could over-specify.** Mitigation: write reservations, not laws — leave room.

### Why now

- The Phase 1A audit's order-1–5 work is complete. Continuing into 6 or 7 without a second consumer for each contribution API risks discovering API gaps the slow way.
- Two of F1A's slices (F1A.5, F1A.6) had to update existing tests (F1A.3's inspector-host spec; the D2/D3 owned-chrome assertions). Each was honest; each shows the unit tests around contribution APIs are written around a single consumer. A second consumer (even a synthetic test plugin) would surface API gaps without committing to product features.
- The `tagRegistry` + `addEntity` + `marks.tag` triad **newly exposed by F1A.7** is the next likely tripping hazard. Cleaning it would be a framework/neutrality slice; doing so without test infrastructure to verify graceful-degrade is reckless.

### Why not the alternatives

**A — Continue shell ownership recovery (more F1A.* slices).** Remaining ownership work is either:
- **High-risk** (framework/ neutrality, nav-index repair) — needs option D's investigation first.
- **Cosmetic** (menu bar Script/Tags rename, breadcrumb terminology) — low leverage, premature without a second doc-type.
- **Settings-side** (per-doc-type Settings registry partitioning) — a separate arc (Settings architecture).

Continuing F1A purely would deepen the existing seams without proving they generalise.

**B — Begin workflow-state infrastructure.** §5 above lays out the danger. The five workflow states cut across CORE + plugin + still-missing AI. Building the SSOT now commits the editor to shape decisions that the framework/ neutrality work would need to revisit. **Risk: high. Reversibility: low.**

**C — Pause for visual/design review.** UX Direction §4 (tag saturation reduction), §6 (page warm-dark, contrast zones), §7 (focus-mode fade transitions) all wait for structural seams (per audit §7.4). Doing visual work now would touch surfaces that the framework/ neutrality pass will reshape. **Risk: rework cost.**

**D — Begin framework-neutrality work.** This is the right *eventual* direction but Phase 1A explicitly defers it until a second doc-type or a contract test exists (audit §7.3). Starting now without either is the "high-leverage, high-risk" path the audit warned against. Worth doing later; not yet. **Option E builds the prerequisites for option D.**

**F — Other.** No compelling alternative observed.

---

# Closing Assessment

## 1. Strongest Filmustageation win so far

**The toolbar contribution API has two real consumers and a layout-fidelity guard.** Pre-F1A.6, the toolbar was a wall of static screenplay HTML inside `renderer/index.html`. Post-F1A.7, it is a CORE frame with a documented contribution surface (`registerGroup`), two clean plugin files (`screenplay/toolbar.js` + `screenplay/toolbar-tag.js`), a working soft-reset pattern that survives boot cycles in tests, a `display: contents` fix codified in a regression spec, and a layout-fidelity invariant (`align-items: center` → centers ±2px) that names what the CSS actually guarantees. Three slices (F1A.6, F1A.6A, F1A.7) produced a small, well-named surface — and the pattern is now ready to teach the next slice's author.

## 2. Most dangerous remaining shell debt

**`Rga.Doc.tagRegistry` + `Rga.Doc.addEntity` + `schema.marks.tag`** — the three-piece screenplay contamination in CORE that F1A.7 made visible without fixing. The dropdown moved out of CORE; the data model it writes to did not. A second doc-type today would either crash on opening a screenplay `.rga` (missing `tag` mark) or inherit production vocabulary keys it has no use for. Doctrine Law 11 (graceful-degrade portability) is asserted but not testable — there is no `.rga` reader without the screenplay plugin loaded. This debt is **load-bearing** (every saved screenplay file depends on the shape); cleaning it requires a `.rga` migration + a contract test, neither of which exists.

## 3. Most dangerous premature next step

**Beginning workflow-state infrastructure now.** The five workflow states (Deep Writing / Navigating / Reviewing / Breakdown / AI Assist) coordinate sidebar + inspector + toolbar + status-bar visibility + tag rendering + AI surfaces — all five contribution surfaces that F1A built, plus the AI orchestration spine that doesn't exist, plus the tag system that's load-bearing on the contamination triad above. A Mode SSOT built today would commit the editor to assumptions the framework/ neutrality pass and the Alive App AI work will both need to revisit. The audit named workflow-state as deferred for a reason; that reasoning has only strengthened post-F1A.7.

## 4. Safest next arc

**Stabilization + contract-test hardening, with one targeted ownership slice.** Concretely:
- Document the toolbar contribution API's order-band reservations.
- Add an inspector selection-observer scaffold (event surface only, no consumer).
- Build a "no plugin loaded" smoke test (Doctrine Law 11 enforcement; today's editor crashes without screenplay).
- Build a "neutral test plugin" that exercises all four contribution APIs (sidebar default, status-bar segment, toolbar group, inspector panel) without touching screenplay schema. This is the contract-test pin the framework/ neutrality work needs.

That arc closes the Phase 1A loop cleanly, surfaces API gaps before they are committed to product features, and unblocks the eventual framework/ neutrality work (option D in §6) by proving each contribution surface generalises beyond its single live consumer.

# STOP

This is review + recommendation only. No implementation has started. No code has been edited. No new architecture has been invented beyond what is grounded in the post-F1A.7 shell. The recommended next arc is stabilization + a neutral-test-plugin slice; authorising it (or rejecting it) belongs to the user, not to this document.
