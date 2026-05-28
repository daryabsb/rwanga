# Filmustageation — Phase 1A — Shell Ownership Audit & Implementation Plan

> **Forensic + planning only.** No implementation, no code, no UI redesign.
> Created: 2026-05-28 · Owner: Rwanga Editor · HEAD: `1b359af3` (origin/main in sync).
> Companion docs: `docs/RWANGA_EDITOR_CORE_PLUGIN_PLATFORM_DOCTRINE.md`, `rwanga-editor/docs/Filmustageation/Filmustageation UX Direction.html`, `docs/RWANGA_IDE_ALIVE_APP_CHECKLIST.md`.

This audit reads the current Rwanga editor shell against the Core/Plugin/Platform doctrine and the Filmustageation UX Direction, then proposes a safe incremental recovery path. Every finding cites real files and line patterns.

A note on framing before reading: the UX Direction document was authored against a **Filmustage** screenshot ("Script / Scheduling / Call Sheets / Budgeting / Storyboards" top nav; "CAST (5) / PROPS (8) / SET DRESSING (3) …" breakdown accordion sidebar) as a warning about what Rwanga must not become. **Rwanga's actual shell today is not that shell.** The audit below records what Rwanga's shell *actually* contains and where it drifts toward the Filmustage pattern, not what the UX doc imagines.

---

## 1. Current Shell Topology

### 1.1 DOM zones (grounded in `rwanga-editor/renderer/index.html`)

```
#app
├─ #rga-shell-titlebar               (Row 1 — CORE)
│   ├─ #rga-shell-titlebar-app       "Rwanga" (static)
│   ├─ #rga-shell-titlebar-title     script name + dirty *
│   └─ #rga-shell-titlebar-actions   theme toggle · avatar · min/max/close
├─ #rga-shell-menubar                (Row 2 — CORE)
│   File · Edit · View · Script · Tags · Tools · Export · Help
├─ #rga-shell-toolbar                (Row 3 — CORE chrome, PLUGIN payload)
│   ├─ Text group        B I U S · color · highlight · link · clear
│   ├─ Scene group       block-type select · + Scene
│   ├─ Writing group     Note · Flag · Tag select · Undo · Redo
│   └─ Mode toggle       Screenplay [Text not exposed yet]
├─ #workspace                        (main canvas)
│   ├─ #activity-bar                 rail (CORE)
│   ├─ #sidebar  → #rga-shell-sidebar-host   (CORE frame, PLUGIN contents)
│   ├─ resize-handle[sidebar]
│   ├─ #center-column
│   │   ├─ #editor-area
│   │   │   ├─ #tab-bar              TabManager
│   │   │   ├─ #rga-shell-breadcrumb writer-context location
│   │   │   ├─ #editor-container
│   │   │   │   ├─ #editor-empty-state
│   │   │   │   └─ #tab-content-host #rga-page-row #editor (PM mount)
│   │   ├─ resize-handle[bottom-panel]
│   │   └─ #bottom-panel             "Studio Panel" — Scene · Notes · Flags · Problems · Breakdown
│   ├─ resize-handle[inspector]
│   └─ #inspector-panel              first-class collapsible right rail
└─ #status-bar                       (Row -1 — CORE frame, PLUGIN segments)
```

### 1.2 Shell ownership layers (per `shell/session-boundary.js`)

The shell already declares three explicit ownership layers:
- **Document truth** → ProseMirror `EditorState` (engine)
- **Shell truth** → `Rga.Shell.Layout` (six zones: sidebar, studioPanel, inspector, titleBar, statusBar, toolbar)
- **Writer-context** → `Rga.ScriptSession` (7 fields locked by `SessionBoundary`)
- **Derived analytics** → `Rga.ScriptMetrics` (wordCount, currentBlockType + reserved)
- **Workspace persistence** → `Rga.WorkspaceState` (serialises Layout to disk)

This is mature ownership — Phase 1A inherits it. The Settings Constitution adds a sixth layer (Settings.Store as configuration SSOT).

### 1.3 Sidebar

- Frame owned by `shell/sidebar.js` (`registerPanel` / `activate` / `deactivate`).
- Mount target: `#rga-shell-sidebar-host`.
- Default panel: `sceneNavigator` (`shell/index.js` `DEFAULT_PANEL`).
- Six registered panels today, each IIFE-registers on script load:
  - `sceneNavigator` (real, screenplay)
  - `scriptWorkspace` (real, file-browser scoped to the script's directory)
  - `outline` (real, screenplay)
  - `search` (placeholder, `available: false`)
  - `characters` (placeholder, screenplay vocabulary)
  - `revisions` (placeholder, screenplay convention)
- Settings is registered as a **workspace tab**, not a sidebar panel (`shell/activity-rail.js` line 138-149 short-circuits the `settings` rail click into `Rga.SettingsWorkspace.open`).

### 1.4 Inspector

- Right-panel `#inspector-panel`. First-class collapsible (32px collapsed rail with reopen button; expanded width persisted via `Layout.inspector.width`, default 280).
- Single owner: `Rga.Shell.StudioPanel` (consolidated in Slice 9 from three prior modules — comment block in `studio-panel.js` lines 1-30).
- Body is **not yet contextual**: shows a static empty state ("No details to show. Select a tag or a scene heading to inspect it."). Selection-driven content does not exist.
- `Rga.Inspector.open()` shim exists in app-shell.js (per `studio-panel.js` line 29 comment); used by screenplay plugin's `context-menu.js`.

### 1.5 Toolbar / Action-bar

- **Row 3** (`#rga-shell-toolbar`) is the writer's instrument strip. The HTML hard-codes its groups, controls, and option lists.
- The Row 3 toolbar's contents are **shell-owned** (CSS class `rga-shell-toolbar`, registered via `Rga.KeyboardRegistry` commands like `text.bold`, `scene.insert`, `writing.note`, `writing.flag`).
- Mode toggle (`data-toolbar-mode`) is documented in `index.html` as "Screenplay (default) / Text" but only Screenplay is rendered today; Text is implied but unexposed.

### 1.6 Bottom panel ("Studio Panel")

- `#bottom-panel`. Five tabs hard-coded in HTML: **Scene · Notes · Flags · Problems · Breakdown**.
- Three-state model (open / minimized / closed) owned by `Rga.Shell.StudioPanel`.
- Scene tab carries a `<textarea id="notes-textarea">` driven by `studio-panel.js` `_wireSceneNotesConnector` (walks editor DOM for `data-blockType="scene-header"` + `data-sceneId`).
- Breakdown tab is a `<table>` skeleton; rows populated from "tag registry" at runtime.

### 1.7 Status bar

- `#status-bar`. Built at runtime by `shell/status-bar.js` into three sections:
  - **Left** — `offline` ("Local"), `scene` ("Scene: S{n}").
  - **Center** — `blockType` ("Scene Heading" etc.), `page` ("Page: N/M").
  - **Right** — `wordCount`, `viewMode` select (Flow/Draft/Print/Print Preview), `language`, `theme` (clickable text instrument).
- Reads from `Rga.ScriptSession` (writer-context) and `Rga.ScriptMetrics` (analytics). `language` reads `doc.metadata.screenplayProfile.language` directly — screenplay coupling at the shell layer.

### 1.8 Platform integrations (today)

- **None in the renderer.** Searching `src/templates/` for editor-embed surfaces returns no files. The Rwanga editor is currently Electron-only; the web embed is future work.
- The Django app at `src/` exists but does not embed the editor renderer at any URL today.
- The cross-platform IO contract `window.rwanga.*` (preload in `electron/preload.js`) is the abstraction that a future web shell would have to satisfy.

### 1.9 Chrome hierarchy summary

The shell already has Filmustageation-friendly zones: a thin permanent rail, a frame-only sidebar/inspector, a separate Studio Panel for "deeper detail," a status bar with discrete contributions, and a tab manager that distinguishes document vs workspace tabs. **The bones are right.** What drifts is *what fills* each slot.

---

## 2. Platform Contamination Audit

### 2.1 Today's reality

There is **no platform contamination in the Rwanga shell today.** The UX Direction document describes Filmustage's chrome ("Script / Scheduling / Call Sheets / Budgeting / Storyboards" tabs + "Share / Download / AI Dude / Export" toolbar) as a warning. Rwanga's actual shell carries none of those elements.

What Rwanga's editor shell does carry that resembles platform-style chrome:

| Element | Today | Doctrine fit | Severity |
|---|---|---|---|
| #rga-shell-menubar Row 2 | Native-style File/Edit/View/Script/Tags/Tools/Export/Help | OK — desktop convention; menus are kernel-routed | None |
| #rga-shell-titlebar actions | theme · avatar · min/max/close | Window controls = CORE; theme = OK; **avatar = nascent platform contamination** | Low |
| Row 3 toolbar Tag dropdown | character/prop/wardrobe/location/sfx/vfx/vehicle/animal/custom | Hard-coded production vocabulary in CORE shell HTML | Medium |
| Row 3 toolbar +Scene button | Screenplay-only insert | Plugin verb in CORE shell HTML | Medium |
| Status bar language segment | Reads `metadata.screenplayProfile.language` | CORE reaching into plugin metadata shape | Medium |

The `👤` avatar placeholder in `index.html` line 54 is the closest thing to platform contamination today — it implies an account identity that doesn't exist in the editor's local-first model. It is decorative; no platform action is wired to it. The risk is forward-looking: the moment a "Share" or "Sync" affordance is added next to that avatar, the editor viewport stops being purely local-first and the OSS Trojan-Horse boundary (`project_ide_oss_strategy`) starts leaking.

### 2.2 Future contamination risks (per UX Direction §2)

These are not bugs today; they are pressure points the architecture must resist:

1. **A platform navigation strip above the editor viewport.** If a future Rwanga Preproduction Platform mounts the editor inside a frame whose chrome includes "Script / Scheduling / Call Sheets / Budgeting / Storyboards" tabs, the editor must render inside a bounded viewport that the platform wraps, never penetrates (Doctrine Law 14; UX Direction §2 Observation).
2. **"Share Project" / "Download Synopsis" buttons** appearing in Row 3 toolbar. The toolbar is shell-owned today; the moment a platform-layer action lands there, the boundary is breached.
3. **An always-on "AI Dude" toolbar button.** AI must be invoked, not advertised (Doctrine Law 15; UX Direction §5). A persistent AI button is the canonical violation.
4. **A second top nav above the menu bar** for project-level navigation (project list, asset library, calendar). Same boundary breach pattern.

### 2.3 Severity classification

- **Critical** — None today.
- **Medium** — Production vocabulary hard-coded in shell-owned HTML (the Tag dropdown). Easy to defer to plugin registration; cheap to leave alone until plugin v2.
- **Low** — Avatar placeholder (no behavior wired). Future surface, watch for creep.

The platform-boundary work is mostly **preventive**, not corrective. The editor today is a clean, Electron-only, local-first surface. The Phase 1 risk is letting platform features grow into the editor's viewport during Preproduction Platform integration; the Phase 1 work is to define the boundary before that pressure arrives.

---

## 3. Sidebar Audit

### 3.1 Current responsibilities

Six sidebar panels registered today. Status, ownership, and doctrine fit:

| Panel | File | Status | Doctrine | Notes |
|---|---|---|---|---|
| `sceneNavigator` | `shell/panels/scene-navigator.js` | REAL | **Plugin (screenplay)** in CORE shell folder | Renders scenes; reads `Rga.Nav.getIndex` and `Rga.ScriptSession.currentScene`. Naming + behavior are screenplay-specific. |
| `scriptWorkspace` | `shell/panels/script-workspace.js` | REAL | **Plugin-flavoured CORE** | A directory file-browser scoped to the active script's folder. Categories list hard-codes `.rga / .fountain / .fdx` as the "Scripts" group — screenplay extensions. The browse pattern itself is doc-type-neutral; the extension table is plugin-owned. |
| `outline` | `shell/panels/outline.js` | REAL | **Plugin (screenplay)** in CORE shell folder | Sections: Title summary, Story Progress, Scenes, Characters. Heavily screenplay-shaped. |
| `search` | `shell/panels/search.js` | PLACEHOLDER (`available: false`) | CORE eventually | Empty-state stub; safe. |
| `characters` | `shell/panels/characters.js` | PLACEHOLDER (`available: false`) | **Plugin (screenplay)** | Empty-state stub; the name commits to screenplay. |
| `revisions` | `shell/panels/revisions.js` | PLACEHOLDER (`available: false`) | **Plugin convention** | Empty-state stub; "revisions" is screenplay-industry terminology but the concept is portable. |

### 3.2 Screenplay assumptions in the sidebar

- The sidebar **default** is `sceneNavigator` (`shell/layout.js` DEFAULTS). On a non-screenplay document, this default has no meaning. There is no doc-type-aware default panel resolution.
- The rail's three-group classification (`shell/activity-rail.js` `RAIL_GROUPS`) hard-codes panel ids: `top = [sceneNavigator, scriptWorkspace, outline, search]`, `middle = [characters, revisions]`, `bottom = [settings]`. Future plugins cannot extend this without modifying CORE.
- Panel keyboard shortcuts (`shell/index.js` `_PANEL_SHORTCUTS`) similarly hard-code ids and letters.
- `scene-navigator.js` reads `Rga.Nav.getIndex(view.state).scenes` — `Rga.Nav` is `framework/nav-index.js`, which is screenplay-named (78 hits per `2026-05-28 Grep`).

### 3.3 What the sidebar should hold

Per Doctrine §3.1 and UX Direction §2:

| Posture | Default sidebar contents |
|---|---|
| Writing | **Scene Navigator (or chapter/section navigator for other plugins)** — structural navigation only |
| Breakdown | Breakdown categories accordion — **today not implemented as a sidebar panel** (it lives as a bottom-panel tab + a runtime tag registry) |
| Outline | Outline panel — already exists as a separate panel |
| Search | Search panel — placeholder |
| Settings | Workspace tab, not a sidebar panel — already correctly placed |

The UX Direction worries that **breakdown is the *default* sidebar view**. In Rwanga today it is not — `sceneNavigator` is. The drift the UX Direction warns about does not exist in Rwanga's sidebar yet. If a future "Breakdown" sidebar panel ships, it must be addressable from the rail rather than replacing `sceneNavigator` as default.

### 3.4 Sidebar / plugin / platform boundaries

- **CORE** owns `Rga.Shell.Sidebar` (the registry, host, lifecycle, empty-state helper). Already correct.
- **Plugin** owns the panel *controllers*. Today they live in `shell/panels/` (organisationally CORE) but their *content* is screenplay. The naming + filesystem location are misleading; the *contract* is correct.
- **Platform** owns nothing in the sidebar today. Future platform-level concerns (collaboration presence, shared comments) should appear in the **inspector**, not the sidebar.
- **Inspector** owns: contextual detail for the cursor / selection. Scene Notes (today a bottom-panel tab) is closer to inspector territory than to sidebar territory; the bottom-panel placement is a Slice-9 consolidation artifact, not a deliberate design.

---

## 4. Inspector Readiness Audit

### 4.1 What exists

- The DOM zone (`#inspector-panel`) and the collapsed/expanded states (the 32px rail with chevron toggle).
- A single owner: `Rga.Shell.StudioPanel` (one class manages both bottom-panel and right-rail toggles).
- A public API: `toggleInspector()`, `openInspector()`. The `open()` method was added in Slice 9 to satisfy screenplay's `context-menu.js` plugin call.
- The Layout zone (`Layout.inspector.width`, default 280). Resize handle (`shell/resize.js`).
- Responsive behaviour: the responsive engine decides inspector visibility on screen-size change; full-close is forbidden (resize clamp at 240px).
- Static empty content: "No details to show. Select a tag or a scene heading to inspect it." (`index.html` lines 396-403).

### 4.2 What is missing

- **No contextual rendering.** Nothing currently observes cursor / selection and replaces the inspector body. The empty state never disappears.
- **No panel-host inside the inspector.** There is one body div; there is no equivalent of `Rga.Shell.Sidebar.registerPanel` for inspector contents. A plugin cannot register an "inspector-character-card" or "inspector-scene-detail" today.
- **No selection → inspector binding.** Screenplay's `context-menu.js` calls `Rga.Inspector.open()` to open the panel, but the panel's body remains the static empty state.
- **Bottom-panel Scene Notes is doing inspector's job.** `studio-panel.js` `_wireSceneNotesConnector` listens to `selectionchange` and updates the bottom-panel Scene tab's notes textarea + label. That contextual-by-selection behaviour belongs in the inspector per UX Direction §5; today it is in the bottom panel.

### 4.3 Coupling risks

- `studio-panel.js` walks editor DOM for `data-blockType === 'scene-header'` + `data-sceneId` — direct screenplay schema coupling in shell-folder code.
- The `Rga.SceneManager.scenes` map is queried for notes persistence — `SceneManager` lives in the screenplay plugin (`doc-types/screenplay/plugins/`). Shell→plugin reach.

### 4.4 Readiness verdict

The inspector **frame** is ready. The inspector **content lifecycle** is not. Building "contextual companion" behaviour requires three additions:
1. A selection-observer in the shell that picks up cursor / selection changes (the wire exists in `studio-panel.js` for Scene Notes — generalising it is the seam).
2. An inspector panel-host with a `registerInspectorPanel(controller)` API analogous to the sidebar's.
3. A "default content" registration so plugins declare what the inspector shows when nothing is selected.

None of these is built today. The status quo is: the inspector zone exists, is owned cleanly, and is mostly empty space.

---

## 5. Workflow-State Readiness

The UX Direction defines five workflow states (Deep Writing / Navigating / Reviewing / Breakdown / AI Assist) that should coordinate sidebar visibility, inspector contents, tag visibility, toolbar density, and status bar tint.

### 5.1 What can already evolve toward each state

| State | Today's affordances | Gaps |
|---|---|---|
| **Deep Writing** | `Rga.ViewMode.set('draft')` hides chrome (Esc to exit); `#draft-mode-footer` exists. Sidebar visibility togglable (Cmd-B). Inspector togglable. | No coordinated "deep mode" that dims status bar + collapses both sidebar and inspector together. No proximity detector (e.g., "user has typed N chars without panel interaction"). |
| **Navigating** | sceneNavigator open + sidebar visible covers most of this state. | No explicit mode; user manually opens panels. |
| **Reviewing** | Bottom panel has Notes + Flags tabs; revisions panel is placeholder. | No "review markup overlay" on the editor. |
| **Breakdown** | Bottom panel Breakdown tab exists; tag system is plugin-side (`doc-types/screenplay/plugins/tags.js`). | No sidebar panel for breakdown; no rail switch. |
| **AI Assist** | Nothing. No AI surface exists in the shell today. | This is the constrained-v01 AI work, deferred behind the Alive App gate. |

### 5.2 What is hardcoded

- Toolbar Row 3 mode toggle (`data-toolbar-mode = screenplay | text`) is the closest thing to a workflow-state switch, but it is just a CSS-visibility flag on the toolbar groups.
- Sidebar/inspector/bottom-panel visibility are persisted per-zone in `Layout` but not coordinated by a higher-level state.
- The CSS does not key off any single "writer mode" class on `#app` or `body`; each zone's visibility is independent.

### 5.3 What blocks adaptive chrome

- No state machine. Any "mode" abstraction would need to be a new CORE concept layered above `Layout`.
- The five workflow states cut across CORE (sidebar/inspector/status bar visibility) and PLUGIN (which sidebar panel is active, which Studio-Panel tab is active, whether tags are highlighted).
- The chrome → state mapping is per-plugin (Breakdown mode means something different in screenplay vs novel) but the chrome itself is CORE.

### 5.4 What should remain CORE vs become plugin-owned

- **CORE** — the workflow-state SSOT itself (a sixth `Layout` zone, or a peer `Rga.Shell.Mode`), the mode-change events, the chrome-visibility decisions per mode.
- **PLUGIN** — the *meaning* of each mode for its doc-type (which sidebar panel, which inspector default, which tags get highlighted), and the registration of plugin-specific modes (a research plugin might add a "Citations check" mode).

This work is not safe to begin in Phase 1A. It depends on: (i) inspector content registration, (ii) plugin contribution to sidebar defaults, (iii) the AI surface contract (for AI Assist mode). All three are downstream of foundational Phase 1 work.

---

## 6. Screenplay Contamination Audit

This is the section the doctrine called out as the live risk. Findings are grounded in real files; severity reflects the cost of leaving it vs the cost of repairing it now.

### 6.1 In `renderer/js/framework/` (the supposed neutral kernel)

Grep counts of `screenplay|scene|character|FDX|breakdown` in `framework/`:

| File | Hits | Doctrine status |
|---|---:|---|
| `screenplay-normalizer.js` | 45 | **Violation** — domain-named module, screenplay-specific behavior (Law 8). Already flagged in doctrine §2.3. |
| `nav-index.js` | 78 | **Violation** — `Rga.Nav.getIndex` returns `{ scenes, characters, pages }`. Built-in screenplay vocabulary. |
| `layout-profile.js` | 21 | Partial violation — composes pageSetup neutrally but includes screenplay-specific keep-with-next rules. |
| `document-outline.js` | 40 | Partial violation — outline shape commits to "scenes" + "characters". |
| `pagemap-engine.js` | 14 | Partial violation — pagination is universal but the unit naming is screenplay. |
| `manuscript-geometry.js` | 8 | Mostly neutral (paper math) with screenplay terminology in comments. |
| `render-model.js` | 6 | Partial — terminology only. |
| `doc-type-registry.js` | 5 | Acceptable — the registry's `detect()` defaults to `'screenplay'` (Law 8 boundary case: the *default* is plugin-named, the *mechanism* isn't). |
| `print-renderer.js` / `print-preview.js` | 5 / 1 | Acceptable — terminology only. |

**Top three live violations:**
1. `framework/screenplay-normalizer.js` — already named in doctrine.
2. `framework/nav-index.js` — exports `getIndex`, `getOutline`, `getPageMap`, `findScene`. The "Nav" abstraction is neutral; the *contents* are screenplay. This module powers Scene Navigator, Outline panel, Status Bar scene segment, and ScriptSession's `currentScene` derivation. Surgically refactoring it is high-risk.
3. `framework/doc-type-registry.js`'s `'screenplay'` default in `detect()` — single-tenancy assumption. Cheap to neutralize when a second doc-type lands.

### 6.2 In `renderer/js/shell/`

Grep counts (`screenplay|scene-header|sceneHeading|character|dialogue|breakdown|cast|prop|location|FDX|fountain|treatment|outline|action|parenthetical|transition|shot`): 250 hits across 32 files. The shell is **saturated with screenplay vocabulary**. Detail:

| File | Hits | Risk |
|---|---:|---|
| `panels/outline.js` | 59 | High — entire panel is screenplay-shaped. |
| `settings-registry.js` | 34 | Medium — screenplay-specific settings (industry conventions, MORE/CONT'D). |
| `title-bar.js` | 14 | Low — string mentions only ("script name"). |
| `script-session.js` | 13 | **Naming concern** — "Script" baked into writer-context layer. Memory says "Script = Session" is an architectural unit (`project_script_equals_session`), so this naming is *deliberate*, not drift. Verdict: keep. |
| `settings-store.js` | 12 | Low — settings tier names include `script:`. Same naming-is-deliberate verdict. |
| `script-metrics.js` | 13 | Naming concern (same as above). |
| `panels/scene-navigator.js` | 3 | Naming + content; high domain coupling but correctly plugin-flavoured. |
| `panels/script-workspace.js` | 5 | The `Scripts` file category hard-codes `.rga / .fountain / .fdx`. Reasonable for v1; will need plugin extension when novel ships. |
| `status-bar.js` | 4 | Reads `metadata.screenplayProfile.language` — direct screenplay-metadata coupling at status-bar layer. |
| `studio-panel.js` | 6 | Walks editor DOM for `data-blockType === 'scene-header'` + `data-sceneId`. Cross-layer screenplay coupling. |

### 6.3 In `renderer/index.html`

- Block-type dropdown (lines 137-147): hard-coded screenplay block names (`action`, `character`, `dialogue`, `parenthetical`, `shot`, `transition`, `sceneHeading`).
- Tag dropdown (lines 167-180): hard-coded production vocabulary (`character / prop / wardrobe / location / sfx / vfx / vehicle / animal / custom`).
- `+ Scene` button (line 150): hardcoded screenplay verb.
- Bottom panel tabs (lines 312-318): hard-coded `scene · notes · flags · problems · breakdown`. Scene + Breakdown are screenplay-specific tabs.
- Menu bar (lines 90-99): includes `Script` and `Tags` top-level menus — screenplay vocabulary on the kernel menu strip.

### 6.4 Severity summary

| Severity | Examples |
|---|---|
| **Doctrine violation** (Law 8 / domain in kernel) | `framework/screenplay-normalizer.js`, `framework/nav-index.js`, default `'screenplay'` in `doc-type-registry.js` |
| **Plugin code in shell folder** (organisational drift, not contractual violation) | `shell/panels/scene-navigator.js`, `shell/panels/outline.js`, `shell/panels/characters.js`, `shell/panels/revisions.js`, `shell/page-setup-preview.js` |
| **Hardcoded plugin payload in CORE HTML** | Row 3 toolbar block-type + tag dropdowns, +Scene button, menu bar Script/Tags entries, bottom panel Scene/Breakdown tabs |
| **Cross-layer DOM coupling** | `studio-panel.js` `_wireSceneNotesConnector` walks editor DOM; `status-bar.js` reads `screenplayProfile.language` |
| **Deliberate naming, not drift** | "Script" = writer-context unit (`project_script_equals_session`); `shell/script-session.js`, `shell/script-metrics.js`, `shell/script-language.js` |

Repairing every contamination point in one slice is not safe. The recovery strategy below proposes the order.

---

## 7. Safe Recovery Strategy

### 7.1 Principles

1. **Frame before content.** Establish empty plugin slots (sidebar panel registration, inspector panel-host, status-bar contribution API, toolbar contribution API) *before* moving any existing screenplay code through them. A populated slot is harder to refactor than an empty one.
2. **Boundary before behaviour.** Define the editor-viewport / platform-chrome boundary before any platform integration begins. This is preventive; cost is near-zero today, near-infinite once the Preproduction Platform mounts the editor.
3. **Cosmetic ≠ structural.** The UX Direction asks for tag-saturation reduction, chrome fade, motion polish — all important, but cosmetic. Defer cosmetic slices until structural seams are in place; otherwise the cosmetic work happens twice (once on the current shell, once after the refactor).
4. **Owned-test scope.** Every slice ships with the slice's specific Playwright + unit tests, plus the immediate-neighbour regression suite. Full-suite runs are reserved for foundation / merge moments per `feedback_test_scope_owned_only`.
5. **Never massive shell rewrite.** No slice may simultaneously change ownership, naming, file location, and behaviour. One vector per slice.

### 7.2 Stabilise first

- Settings Phase 3 S9.1 (queued from the prior session in `SETTINGS_NEXT_SESSION_HANDOFF.md`) should run **before** any Filmustageation slice that touches the toolbar, sidebar, or inspector. S9.1 wires 10 PERSISTS_ONLY entries to REAL behavior; finishing the saturation work hardens the shell-applicator contract that future slices will use.
- The Page Setup modal retirement (S7B / S7C) can be folded in at the same time; both are Settings-arc, not Filmustageation-arc.

### 7.3 Do not touch yet

- `framework/nav-index.js` — too many consumers (Scene Navigator, Outline, Status Bar, ScriptSession). Repairing it requires designing a plugin-registered indexer interface first; that is engineering investigation work, not a slice.
- `framework/screenplay-normalizer.js` — same blocker. Move only after a second doc-type or a contract test pins the neutral interface.
- The Row 3 toolbar's hardcoded dropdowns — moving them to plugin registration requires the toolbar contribution API to exist first.
- Anything in `doc-types/screenplay/` — the screenplay plugin's internals are not the audit subject; their boundary with CORE is. Internal screenplay refactors are out of scope.
- The Alive App checklist — its entry gate is closed until Settings completes and visual E2E passes. Filmustageation slices that touch Alive App items are forbidden until the gate opens (`project_alive_app_checklist`).

### 7.4 Can be safely deferred

- Tag visual saturation reduction (UX Direction §4 / §6).
- Status bar tint per-section-color (UX Direction §3).
- Focus-mode fade transitions (UX Direction §7).
- Inline tag mark redesign at 60-70% saturation.
- Comments / collaborative-annotation visual language (platform-layer work; Doctrine §4).
- "Cinematic motion philosophy" polish.

All of these are valuable; none is foundational. They wait for the seams.

### 7.5 Order of operations (Phase 1 high level)

1. **Inspector panel-host contract** (frame for contextual content).
2. **Editor viewport boundary** (declare it; no platform exists to enforce against yet).
3. **Sidebar default per-doc-type** (so the screenplay default doesn't bleed into the future novel plugin).
4. **Toolbar contribution API** (so the Row 3 block-type + tag dropdowns can move out of CORE HTML).
5. **Status bar contribution API** (same shape).
6. **Workflow-state SSOT** (the mode coordinator referenced in §5).
7. **`framework/` neutrality pass** (rename `screenplay-normalizer` → neutral primitive, neutralise `nav-index` contract).

Phase 1 stops well before all of these. The slices below pick the earliest, safest, highest-leverage ones.

---

## 8. Proposed Filmustageation Phase 1 Slices

Each slice is **proposal only**. Implementation does not begin in this audit.

### Slice F1A.0 — Settings Phase 3 prerequisite (already queued)

- **Purpose:** Complete the Settings saturation work (S9.1 / S9.2 / S9.3 + the Phase 4 modal retirement) before Filmustageation slices touch shell-applicator code.
- **Boundaries:** Wiring only; no new chrome.
- **Risks:** None — the plan is already in `SETTINGS_NEXT_SESSION_HANDOFF.md`.
- **Dependencies:** None.
- **Tests:** Each S9.x slice ships its own Playwright behavior spec per the established Settings doctrine.
- **Status:** Not part of Filmustageation; named here as the prerequisite gate.

### Slice F1A.1 — Editor-viewport / platform boundary declaration

- **Purpose:** Codify the DOM contract between the editor viewport (`#app`) and any future platform chrome that mounts the editor. Declare it as `window.rwanga.platform` shape + a never-touch list of selectors (the menu bar, the rail, the status bar). Add a "no-platform smoke" Playwright check that boots the editor and asserts no platform-only globals exist.
- **Boundaries:** Documentation + one smoke test. No DOM changes, no behavior changes.
- **Risks:** Low — preventive; no live consumer. Risk is that the contract is later revised when the actual web embed lands; mitigated by keeping the v1 contract minimal.
- **Dependencies:** None.
- **Tests:** New Playwright smoke (`tests/e2e/platform-boundary/no-platform-globals.spec.js`).
- **Why first:** Cheap to do now; impossible to do retroactively after the platform starts shipping.

### Slice F1A.2 — Sidebar default per-doc-type

- **Purpose:** Move the `sceneNavigator` default out of `shell/layout.js` DEFAULTS and into the screenplay doc-type's registration (`doc-types/screenplay/index.js`). CORE Layout's `sidebar.activePanel` default becomes `null`, and `shell/index.js` resolves the default via the active doc-type's `defaultSidebarPanel` field. Existing screenplay UX is preserved because screenplay still registers `sceneNavigator` as its default.
- **Boundaries:** Two file edits (`shell/layout.js` default, `doc-types/screenplay/index.js` registration). One Playwright spec.
- **Risks:** Medium — `_resolveDefaultPanel` is on every boot path; bad default resolution breaks the cold-start UX. Recovery already includes a panels[0] fallback; this slice should preserve that.
- **Dependencies:** F1A.0 should be complete (Settings saturation done) so applicator changes don't compete with this.
- **Tests:** New Playwright spec asserts that on screenplay-doc boot the default is `sceneNavigator`; new unit test verifies CORE Layout has no doc-type-specific default.
- **Existing coverage:** Sidebar visibility tests + panel-activation tests exist; this slice extends them.

### Slice F1A.3 — Inspector panel-host (frame only, no content)

- **Purpose:** Add `Rga.Shell.Inspector.registerPanel(controller)` parallel to `Rga.Shell.Sidebar.registerPanel`. CORE provides registration, lifecycle (mount / unmount on selection-context change), and a default-content slot. **No actual contextual content is wired in this slice** — the panel host is empty until F1A.5 lands.
- **Boundaries:** New `shell/inspector.js` module + tiny additions to `shell/studio-panel.js` to expose the host. No screenplay plugin changes.
- **Risks:** Medium — adding a new registration surface that nothing uses yet risks an underspecified contract. Mitigation: declare the contract minimally (id, mount, unmount, isApplicable(context)) and let the first plugin consumer (F1A.5) prove the API before extending it.
- **Dependencies:** None.
- **Tests:** Unit tests for the registry; Playwright spec asserts the inspector remains in its current static empty state (no regression).
- **Why before any content:** Same principle as F1A.2 — establish the slot before filling it.

### Slice F1A.4 — Status bar contribution API

- **Purpose:** Add `Rga.Shell.StatusBar.registerSegment(controller)` so plugins contribute status-bar segments rather than the shell hard-coding them. The screenplay plugin then registers `scene`, `blockType`, `page`, `language` segments. Existing rendering is preserved by re-registering through the new API. Removes the `metadata.screenplayProfile.language` direct read from `shell/status-bar.js`.
- **Boundaries:** `shell/status-bar.js` (refactor in place — same DOM, new wiring), one new screenplay-side file. CORE status bar keeps `wordCount`, `offline`, `viewMode`, `theme`; plugin contributes the rest.
- **Risks:** Medium — status bar is constantly observed during writing; visual drift is immediately visible. Mitigation: behavioural Playwright spec asserting the same text appears post-refactor.
- **Dependencies:** None.
- **Tests:** Existing status-bar tests must pass unchanged; new test asserts plugin-contributed segments unregister cleanly when the plugin is unloaded.

### Slice F1A.5 — Inspector default content (Scene Notes migration)

- **Purpose:** Wire one concrete inspector panel — Scene Notes — using the F1A.3 host. The bottom-panel Scene tab's notes textarea remains (familiar UX) but its content now mirrors the inspector's scene-notes panel via a shared store; the inspector is the canonical surface, the bottom-panel tab is a secondary view. Removes `_wireSceneNotesConnector`'s direct DOM walk from `studio-panel.js`.
- **Boundaries:** New `doc-types/screenplay/inspector/scene-notes.js`. Update to `studio-panel.js` removing the inline scene-detection. The bottom-panel `Scene` tab stays — it just reads from the same source.
- **Risks:** High — touches three surfaces (inspector, bottom panel, screenplay DOM coupling). Mitigation: a parallel-path strategy (new path lit; old path keeps working until cut over in a follow-up slice).
- **Dependencies:** F1A.3 (inspector host must exist).
- **Tests:** New Playwright spec asserts (i) cursor in scene → inspector shows notes for that scene, (ii) bottom-panel tab still shows the same notes, (iii) editing in either surface reflects in the other.

### Slice F1A.6 — Toolbar contribution API + Row 3 cleanup (start)

- **Purpose:** Add `Rga.Shell.Toolbar.registerGroup(controller)` so plugins contribute toolbar groups. Move *one* group (the Scene group with block-type select + Insert Scene) into the screenplay plugin as a proof. The Text group + Mode toggle stay CORE. The Writing group (Note / Flag / Tag) is harder because the tag dropdown's options are production-vocabulary; that move waits for F1A.7.
- **Boundaries:** `shell/index.html` (remove the Scene group's HTML), new screenplay-side toolbar registration file, light refactor in `format-toolbar.js` to support runtime injection.
- **Risks:** Medium-high — every writer uses Row 3 constantly. Mitigation: visual + behavioural Playwright specs assert the Scene group renders identically post-refactor.
- **Dependencies:** F1A.0.
- **Tests:** New behavior + fidelity specs; existing format-toolbar tests must pass.

### Slice F1A.7 — Tag system as plugin-registered

- **Purpose:** The tag dropdown in Row 3 (`character / prop / wardrobe / location / sfx / vfx / vehicle / animal / custom`) is production vocabulary. Move it under the screenplay plugin's toolbar registration so future plugins (e.g., research) can register their own tag categories (`citation / footnote / hypothesis / figure`).
- **Boundaries:** Same shape as F1A.6 but for the Writing group + tag dropdown.
- **Risks:** Medium — the tag system has runtime tag-registry coupling; not just a UI move.
- **Dependencies:** F1A.6.
- **Tests:** Tag-apply + tag-removal Playwright specs; tag-saturation visual contract.

### Slice F1A.8 — Command palette promotion (no implementation)

- **Purpose:** Audit the existing `shell/command-palette.js` against the UX Direction's "primary power-user surface" requirement. Document what's already there, what's missing, and what's screenplay-coupled. **No code change; audit output only.**
- **Boundaries:** A short doc; no implementation.
- **Risks:** None.
- **Dependencies:** None.
- **Status:** Optional supporting slice; pulls forward an Alive App-adjacent concern only as planning.

### F1A.9, F1A.10 — Deferred

- **Workflow-state SSOT** (§5) — too cross-cutting; needs inspector content + sidebar plugin defaults + toolbar contributions to all be plugin-driven first. Plan in a later phase.
- **Tag saturation reduction** (UX Direction §4) — cosmetic; waits for the underlying tag-system refactor in F1A.7.
- **Inspector panel migration for character / prop / location** — depends on a stable inspector contract + AI-readiness; not Phase 1.
- **`framework/screenplay-normalizer.js` and `nav-index.js` neutralisation** — high-risk; needs a second doc-type or a strong contract test to pin the neutral interface. Engineering investigation, not a slice.
- **AI surfaces** — locked behind the Alive App entry gate.

---

## Closing Assessment

### 1. Strongest existing shell strengths

- The **ownership-layer architecture is mature.** `Rga.SessionBoundary` declares document / shell / writer-context / analytics / workspace-persistence as discrete owners with named fields. The Settings Constitution adds configuration as a sixth owner. Phase 1 inherits all this; it does not need to build it.
- The **DOM zones are correctly partitioned.** Title bar, menu bar, Row 3 toolbar, activity rail, sidebar, editor host, bottom panel, inspector, status bar — each is a discrete container with a clear owner. The Filmustage SaaS pattern the UX Direction warns about is **not present in Rwanga's shell today**.
- The **`doc-types/` directory is plural by design.** The plugin runtime contract (Doctrine §3.3) maps to real seams that already exist.
- **Inspector is first-class** (32px collapsed rail with explicit reopen, never `display: none`). The frame is ready; only the content lifecycle is missing.
- The **Layout SSOT + WorkspaceState persistence** carries shell zones through reload without bespoke per-zone serialization code.
- **TabManager + Workspaces registry distinguishes document vs workspace tabs** — Settings is the worked example; future workspace tabs (logs, account, updates) follow the same contract.

### 2. Most dangerous architectural drifts

- `framework/screenplay-normalizer.js` and `framework/nav-index.js` — domain-named, domain-shaped modules inside the supposedly neutral kernel. They power Scene Navigator, Outline, Status Bar, and `ScriptSession.currentScene`. Refactoring them is high-leverage and high-risk.
- The Row 3 toolbar in `index.html` carries hard-coded screenplay block names + production-vocabulary tag categories. CORE HTML is owning plugin payload.
- The **`doc-type-registry.js` defaults to `'screenplay'`** — single-tenancy assumption baked into the registry.
- The bottom panel's Scene + Breakdown tabs are hard-coded in `index.html` with screenplay-specific names, but the corresponding sidebar panels are also screenplay-named in CORE folders (`shell/panels/scene-navigator.js`). The mental model "shell-folder = CORE" is misleading; the contracts are correct but the location implies neutrality the code does not enforce.
- The inspector's **content lifecycle is undefined.** The frame exists; nothing fills it. The Scene Notes wiring that lives in the bottom panel is doing the inspector's job from the wrong zone.

### 3. Highest-risk implementation area

`framework/nav-index.js`. It is the most consumed module in the kernel (powers four shell-side features); its shape is screenplay-baked; and its repair requires designing a plugin-registered indexer interface — which is engineering investigation, not a slice. **Phase 1 must not touch it.** Any slice that does is over-scoped.

Second-highest risk: the Row 3 toolbar refactor (F1A.6, F1A.7). Every writer uses Row 3 constantly; any drift is immediately visible. Mitigation by visual + behavioural Playwright fidelity specs is essential.

### 4. Safest first implementation slice

**Slice F1A.1 — Editor-viewport / platform boundary declaration.** No DOM change, no behaviour change, no live consumer to break. Costs effectively nothing today; pays back the entire Preproduction Platform integration cycle. The slice is documentation + one smoke spec.

If the user prefers a slice that **does something visible**, the second-safest is **F1A.2 — Sidebar default per-doc-type.** Touches two files, preserves all observable behavior, and unblocks the eventual second-doc-type seam. Falls behind F1A.0 (Settings Phase 3 S9.1) on the dependency order regardless.

### 5. Deferred areas that should remain untouched for now

- `framework/screenplay-normalizer.js` and `framework/nav-index.js` — until a second doc-type or a contract test exists.
- All Alive-App items — the entry gate is closed.
- All AI surfaces — locked behind the Alive App gate.
- Tag saturation, motion polish, status-bar tint, focus-mode fade — cosmetic; wait for structural seams.
- The screenplay plugin's internals — out of audit scope.
- The `framework/screenplay-normalizer.js` → neutral primitive move — needs the same second-doc-type pin.
- Cross-plugin command-palette grammar — only one plugin exists.
- Workflow-state SSOT — too cross-cutting until the slot-registration work lands.
- The platform's collaboration UI — does not exist yet; designing it now is speculation.

---

# STOP

This is audit + slice proposal only. No implementation has started. No code has been edited. No further planning artifacts (per-slice briefs, contracts, stop-point registers) are produced here — those belong to whichever slice the user authorizes next. The Settings Phase 3 S9.1 work queued in `SETTINGS_NEXT_SESSION_HANDOFF.md` remains the next live arc; Filmustageation slice F1A.1 sits behind it.
