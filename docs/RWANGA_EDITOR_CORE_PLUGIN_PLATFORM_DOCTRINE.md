# Rwanga Editor — Core / Plugin / Platform Doctrine

> **Phase 0A — Filmustageation Pre-Implementation Architecture Doctrine.**
> Created: 2026-05-28 · Owner: Rwanga Editor · Status: doctrine only (no implementation).
> Companion docs: `RWANGA_IDE_LAUNCH_CHECKLIST.md` (Phase 1 constitution), `RWANGA_IDE_ALIVE_APP_CHECKLIST.md` (Phase 2 constitution), `rwanga-editor/docs/rwanga-settings/RWANGA_SETTINGS_DESIGN_CONSTITUTION.md` (Settings RC1).

This doctrine defines the architectural boundaries that must exist **before** Filmustageation implementation begins. It is grounded in what the editor is today — not a rewrite. Its job is to keep the screenplay workflow from permanently contaminating the editor kernel as the product expands into other writing domains.

This is not a roadmap. It is a constitution.

---

## 1. Vision & Identity

### 1.1 What Rwanga Editor is

Rwanga Editor is a **modular professional structured-writing engine with domain plugins.** The engine is domain-neutral. Each writing domain (screenplay, novel, research, proposal, production) is a plugin that teaches the engine its rules.

The first specialization is screenplay because the founding product is the Rwanga Preproduction Platform. The first specialization is **not** the total identity.

### 1.2 What Rwanga Editor is NOT

- It is not "a screenplay editor." Screenplay is a doc-type, not the kernel.
- It is not a code editor clone. The Alive App checklist explicitly forbids that feel.
- It is not a cloud document. Files are sovereign on disk; sync is backup, not storage (`project_ide_files_sovereign_principle`).
- It is not gated behind sign-in at runtime. Runtime is local-first; the network is the paid boundary (`project_ide_oss_strategy`).
- It is not a transient text buffer. A script is a session — a living unit with its own brain (`project_script_equals_session`).

### 1.3 Three-layer identity

| Layer | Role | Examples |
|---|---|---|
| **Engine** (Rwanga Editor) | Domain-neutral structured-writing kernel | ProseMirror integration, layout, print, settings, persistence, command system, AI orchestration foundation |
| **Plugins** (doc-types) | Domain specialization that teaches the engine a writing form | Screenplay (today), creative writing, research, proposal, production companion |
| **Platforms** (products) | Ecosystems that embed the editor and add cloud + workflow | Rwanga Preproduction Platform, Creative Writing Platform, Research Platform |

The editor must survive independently from any single plugin and independently from any single platform.

---

## 2. CORE Doctrine

CORE is everything in `rwanga-editor/` that no plugin or platform may own. CORE is permanent ground; plugins build on it, platforms wrap it.

### 2.1 CORE owns permanently

- **Editor kernel.** ProseMirror EditorView lifecycle, document mount, dispatch loop, transaction pipeline. Lives at `renderer/js/editor/`.
- **Document model.** The `Rga.Doc` shape, `.rga` file format, doc metadata envelope, serialization/deserialization, version field. Lives at `renderer/js/doc.js` + `framework/`.
- **Structured writing engine.** The base schema primitives, block/inline contracts, mark-attribute conventions, base-outer-marks, screenplay-normalizer's *generic shape* (when extracted), document-outline, render-model. Lives at `renderer/js/framework/`.
- **Pagination and layout engine.** `layout-profile.js`, `manuscript-geometry.js`, `pagemap-engine.js`, `paper-view.js`, `runtime-profile.js`. Single-resolver page truth (Settings recovery §S8) is a CORE invariant.
- **Print / export architecture.** `print-renderer.js`, `print-preview.js`. Save is `.rga` only; Export is the separate verb that always carries Rwanga branding (`project_ide_save_vs_export`).
- **Workspace shell.** Activity rail, sidebar, status bar, title bar, command palette, modal, toast, layout, responsive shell, tab manager. Lives at `renderer/js/shell/`. Tab kinds (document vs workspace) are CORE doctrine (`project_shell_doctrine_tab_kinds`).
- **Inspector infrastructure.** The panel-host contract, panel registration API, panel-to-doc binding rules. CORE owns the *frame*; plugins provide *contents*.
- **Settings / store architecture.** Registry as SSOT, tier cascade (Built-in → User → Project → Script → Session), `Settings.Store`, applicators, validators, migrations, the immediate-apply doctrine, the no-Save-button rule, the scope-badge identity model. The Settings Constitution (`project_settings_constitution`) is binding on CORE.
- **Command system.** Command palette, keyboard-registry, shortcut resolution, command dispatch. Plugins register; CORE routes.
- **Persistence / session architecture.** `script-session.js`, autosave, recovery, file-manager, session-boundary, workspace-state. The "script = session" principle is CORE.
- **Revision / review foundation.** The annotation-anchor primitive, address-stability rules, revision-flag transport. *Domain meaning* of an annotation belongs to a plugin; *anchoring contract* is CORE.
- **Typography and layout systems.** Font loading, fallback chains, base type scale, RTL / bidi infrastructure, paper-feel CSS layer.
- **AI orchestration foundation.** The provider-router contract, prompt-context boundary, response-shaping protocol, agent-vs-chatbot separation. Implementation of any specific AI feature is plugin-level; the *orchestration spine* is CORE (`project_v2_ai_architecture`).
- **Plugin runtime / hooks.** The doc-type registry (`framework/doc-type-registry.js`), the hook surface plugins extend, the lifecycle of plugin load/unload, the isolation guarantees.
- **Offline-first philosophy.** Every CORE module assumes no network. The network is opt-in capability, never a runtime dependency.
- **Node ownership principles.** Which transactions are allowed on which nodes; the "addressable-clip" contract that timeline + AI will eventually depend on.

### 2.2 CORE must remain neutral about

- Whether a document has scenes, chapters, sections, hypotheses, or clauses.
- Whether a block is `action`, `dialogue`, `paragraph`, `heading`, `citation`, or `clause`.
- Whether a document has page numbering, scene numbering, line numbering, or paragraph numbering.
- Whether typography is courier-12, serif-11, sans-13, or RTL Persian-style.
- Whether an export targets PDF, FDX, DOCX, EPUB, Markdown, or BibTeX.
- Whether AI assistance is "rewrite this dialogue," "tighten this paragraph," or "summarize this section."
- Whether a side panel surfaces characters, citations, props, or stakeholders.

CORE knows that *something* fills each slot. CORE never knows *what* fills it.

### 2.3 Drift signal already present

`renderer/js/framework/screenplay-normalizer.js` violates §2.2: it lives in the supposedly neutral `framework/` directory but its name and behavior are domain-specific. The doctrine flags this as a known impurity that must be either renamed to a neutral primitive (e.g. `framework/document-normalizer.js` with a doc-type-registered normalizer plug) or moved into `doc-types/screenplay/` before plugin v2 begins. This is the canonical example of the contamination this doctrine exists to prevent.

---

## 3. PLUGIN Doctrine

A plugin is a **doc-type**: a folder under `renderer/js/doc-types/<name>/` that teaches the engine a specific writing form. The `doc-types/` directory was deliberately created plural; screenplay is one entry in it, not its owner.

### 3.1 What a plugin owns

- **Schema extensions.** Plugin-specific nodes and marks (e.g. screenplay's `scene_heading`, `action`, `character`, `dialogue`, `parenthetical`, `transition`, `shot`). Registered via the doc-type registry, never patched into base schema.
- **Custom node views.** Plugin-specific node rendering (e.g. `v3-node-views.js`).
- **Commands.** Plugin-specific commands (e.g. `v3-commands.js` — slug-Enter flow, Tab cycle, structural transition picker). Registered with the CORE command system.
- **Keymap.** Plugin-specific shortcuts (e.g. `v3-keymap.js`). CORE resolves conflicts; plugin declares intent.
- **Inspector contents.** What appears inside a CORE-provided inspector slot for this doc-type (e.g. screenplay's characters / locations / props panels).
- **Side panels.** Plugin-specific panels registered into the shell's panel host (e.g. scene-navigator, revisions for screenplay).
- **Exports.** Plugin-specific export targets (FDX for screenplay, EPUB for novel, BibTeX for research). Each plugin export uses CORE's export plumbing; the *target format* is plugin business.
- **Formatting rules.** Plugin-specific paragraph behavior (screenplay's auto-uppercase on slug; novel's smart-quote handling; research's citation-bracket pairing).
- **AI tools.** Plugin-specific AI prompts, surfaces, and result shapes (screenplay's Variations / Modify / Review / Breakdown — currently constrained in v01 per `project_ide_v1_scope`). The CORE orchestration spine is shared; the prompts and UX are per-plugin.
- **Workflow surfaces.** Plugin-specific workspaces (e.g. screenplay's flow / print / draft view trio; research's outline view; proposal's clause-tree view).
- **Toolbar injection.** Plugin-specific format-toolbar entries via a CORE-defined injection point. Plugins do not mutate the toolbar DOM directly.
- **Review tooling.** Plugin-specific review modes (track changes, suggesting, redline). Built on CORE's revision anchoring.
- **Print behavior.** Plugin-specific page chrome (screenplay's MORE/CONT'D markers, novel's running headers, research's footnote area). Built on CORE's pagination engine; never replacing it.

### 3.2 What a plugin is NOT allowed to do

- **Mutate Store directly without going through the applicator pipeline.** All plugin behavior is wired via `Settings.Applicators.register()`; no plugin may set DOM state, document state, or persisted state outside this pipeline.
- **Write to localStorage / disk outside the categorical exemptions enumerated in Settings RC1 §1A.6.** New persistence paths require a registry entry, not a new bypass.
- **Patch the base schema in-place.** Schema is extended via doc-type registration, not by mutation.
- **Reach into another plugin's namespace.** Plugin A may not import or call into plugin B. If two plugins need to share, the shared surface is CORE.
- **Replace CORE modules.** A plugin may *configure* CORE behavior (e.g. choose a paper size); it may not *substitute* the layout engine.
- **Override global keybindings without conflict resolution.** Conflicts go through the CORE keyboard registry.
- **Add "fake interactive" controls** (Settings Constitution). Every plugin-contributed setting is REAL+wired or honestly disabled.
- **Bypass single-resolver page truth.** Any plugin that renders page geometry MUST read via `Rga.LayoutProfile.compose` or `Rga.ManuscriptGeometry.resolve`. The S8 lesson is binding on plugins.
- **Silently override global behavior.** If a plugin changes a global default (e.g. autosave cadence), it must declare the override via a CORE-provided mechanism that is inspectable in Settings.
- **Break document portability.** A document opened with plugin v1 must remain openable with plugin v2 (via migrations), and a `.rga` file's CORE metadata must survive a missing plugin (graceful-degrade read, never a crash).

### 3.3 The plugin runtime contract

CORE provides:
- Doc-type registration API.
- Schema-extension API (additive only).
- Command + keymap registration with conflict resolution.
- Panel + workspace + toolbar injection points.
- Applicator pipeline (`Settings.Applicators.register`).
- Migration registration (per-doc-type, versioned).
- AI orchestration provider with a plugin-scoped prompt context.
- Lifecycle hooks (`onPluginLoad`, `onDocOpen(docType)`, `onDocClose`, `onPluginUnload`).

Plugins consume:
- ProseMirror primitives (via re-export, never as a direct dependency — the indirection is what keeps plugins replaceable).
- CORE's `window.rwanga.*` IO contract (the cross-platform Electron/web bridge — `project_ide_renderer_portable`).
- Settings registry entries (registered by the plugin under its own namespace).

---

## 4. PLATFORM Doctrine

A platform is the **product layer** that wraps the editor + chosen plugins and adds cloud, collaboration, and external workflow. Platforms ship the editor; they do not constitute it.

### 4.1 What a platform is

- **Rwanga Preproduction Platform** — the founding product. Wraps the editor with the screenplay plugin + cloud project storage + collaboration + production workflow + asset / cast / location / budget management.
- **Creative Writing Platform** (future) — wraps the editor with the novel/story plugin + cloud library + community features.
- **Research Platform** (future) — wraps the editor with the research plugin + citation database integration + institutional sync.
- **Proposal / Business Platform** (future) — wraps the editor with the proposal plugin + client/CRM integration + signature workflows.

### 4.2 What a platform owns

- **Cloud storage** of platform-managed projects (the platform decides where, the editor doesn't care).
- **Account / identity / billing.** The signup gate (`project_business_model_v01`) lives at the platform boundary, not in CORE.
- **Collaboration boundaries.** Real-time presence, comment threads, share links, permissions. CORE provides revision anchoring; the platform decides who sees what.
- **External workflow orchestration.** Scheduling, casting, budgeting, scouting, distribution — all the off-script systems that surround a screenplay. CORE never knows these exist.
- **Asset / project relationships.** Linking a script to a project, a project to a production, a production to a calendar. CORE knows about scripts; the platform knows about everything else.
- **Plugin provisioning.** A platform may bundle a curated plugin set (the Preproduction Platform ships the screenplay plugin enabled by default). CORE provides the runtime; the platform decides which plugins to load.
- **Synchronization philosophy.** The platform chooses the sync model (replace, merge, CRDT). CORE files are sovereign; the platform's sync is a wrapper, not a replacement.

### 4.3 Editor / platform relationship

| Concern | Editor (CORE) | Platform |
|---|---|---|
| Open / edit / save `.rga` | ✓ | — |
| Local autosave + recovery | ✓ | — |
| Print / export | ✓ | — |
| AI (constrained, BYO key) | ✓ via plugin | — |
| AI (managed, billed, premium models) | — | ✓ |
| Project / asset linking | — | ✓ |
| Cloud sync | — | ✓ |
| Real-time collaboration | — | ✓ |
| Account + billing | — | ✓ |
| Distribution gate (binary download) | — | ✓ |

### 4.4 Survival rule

The editor **must run with zero platform**. Disconnect the network, log out of everything, uninstall the platform shell — the editor still opens, edits, saves, exports, and runs constrained plugin AI (with the user's own key). This is not optional; it is the OSS Trojan-Horse foundation (`project_ide_oss_strategy`).

A platform that requires the editor to phone home for basic editing is a broken platform, not a feature.

---

## 5. Architectural Laws (Non-Negotiable)

These laws bind CORE, plugins, and platforms equally. Violating them is not a tradeoff; it is regression.

1. **Store is SSOT.** All configuration values flow through `Settings.Store`. The exemptions are categorical and enumerated in Settings RC1 §1A.6 (UI session state + recent/history data). No new persistence path may be introduced without either a registry entry or an explicit categorical declaration.

2. **Settings are constitutional.** Every visible setting is REAL+wired or honestly disabled. PERSISTS_ONLY-fake controls are forbidden. Settings-first wiring is mandatory. Every Settings slice ships a Playwright behavior test that asserts a visible DOM delta, not just that `Store.set` was called. The Settings Constitution (`project_settings_constitution`) is binding.

3. **Shell never owns document truth.** The shell renders. The document is the authority on its content. The shell may not cache document state, may not write to the document outside the dispatch pipeline, may not assume document shape beyond the CORE-defined envelope.

4. **Print truth is separated from flow comfort.** Flow is a continuous drafting surface, never paginated (`project_flow_continuous_doctrine`). Page truth lives exclusively in Print Preview, computed by `Rga.LayoutProfile.compose` and `Rga.ManuscriptGeometry.resolve`. No view may show page seams except Print Preview.

5. **Plugins cannot mutate the editor kernel directly.** Schema is extended via doc-type registration; commands via the command system; behavior via applicators; UI via panel-host injection points. The kernel is read-only to plugins.

6. **No fake interactive controls.** A control that looks active but does nothing damages trust irreparably. If a feature is not yet wired, the control is honestly disabled with `state: 'persists-only'` or `state: 'deferred'` (Settings RC1 §8.1).

7. **Schema migrations must be versioned.** Every doc-type carries a schema version. Every schema change ships a migration. A document opened in plugin v_n must round-trip through plugin v_n+1. The screenplay plugin already enforces this (`doc-types/screenplay/migrations/`); the pattern is mandatory for all future plugins.

8. **Domain logic must stay outside the kernel.** Any code that knows what a scene, citation, clause, chapter, or budget line is must live in a plugin. CORE knows about *blocks*, *marks*, *attrs*, and *transactions*. The current `framework/screenplay-normalizer.js` drift is the worked example of how this law gets broken and must be repaired.

9. **Editor core remains domain-neutral.** No CORE module name may reference a writing domain. No CORE conditional may branch on `doc-type === 'screenplay'`. If CORE needs to differ by doc-type, the difference is dispatched through the doc-type registry, never hard-coded.

10. **Plugins may not silently override global behavior.** If a plugin changes a global, the override is declared, visible in Settings, and traceable in the applicator chain.

11. **Document portability must survive plugin evolution.** A `.rga` file's CORE envelope (metadata, version, doc-type field, basic structure) must be readable even when the originating plugin is missing. The reader degrades gracefully; it does not crash.

12. **Single-resolver page truth.** Already a Settings-recovery invariant; promoted here to CORE law. Any code that renders page geometry MUST consume `Rga.LayoutProfile.compose` or `Rga.ManuscriptGeometry.resolve`. No CSS-variable shortcuts, no parallel computation paths, no plugin re-implementation.

13. **Save vs Export are separate verbs.** Save writes `.rga`. Export emits a foreign format (PDF / DOCX / FDX / TXT / MD / EPUB / …). Export always carries Rwanga branding in the free tier. CORE owns the verb separation; plugins own the foreign formats (`project_ide_save_vs_export`).

14. **Runtime is never sign-in-gated.** The signup gate sits at distribution (binary download) and at network-crossing premium features. Local editing, local plugins, local export, BYO-key plugin AI: all sign-in-free (`project_ide_oss_strategy`).

15. **AI assists, never authors.** AI returns options, critiques, alternatives, breakdowns — never finished prose. Ghost-text autocomplete is explicitly out (`project_ide_creative_sovereignty`). This is a plugin-level rule but binding across all plugins.

16. **One renderer for all platforms.** The renderer runs in Electron desktop AND any future web embed. The `.rga` format must parse server-side (Django) and client-side (renderer). `window.rwanga.*` is the cross-platform IO contract (`project_ide_renderer_portable`).

17. **Cache is inspectable.** The IDE must never silently bloat disk. Every cache (autosave, workspace, prefs, future plugin caches) is listed and clearable from a Cache Management UI (`project_ide_no_silent_disk_bloat`).

18. **The launch checklist is binding.** Rwanga cannot launch while any P0 item in `RWANGA_IDE_LAUNCH_CHECKLIST.md` is FALSE. The Alive App checklist is binding for AI features: no AI may begin before Phase 2 is visually verified. This doctrine does not override either checklist.

---

## 6. First-Generation Plugin Roadmap

Conceptual only. No design, no schema, no implementation specifics.

1. **Screenplay** (today). The founding doc-type. Defines the plugin contract by being the first to inhabit it. Schema-v3 is locked (`project_ide_script_framework_locked`); flow + print + draft views are locked (`project_ide_flow_view_locked`, `project_ide_print_draft_locked`). Purpose: industry-standard screenwriting with production-aware features (scene numbering, breakdown export, revision colors).

2. **Creative Writing** (next). Novel + short-story + serial-fiction doc-type. Chapters instead of scenes. Continuous prose instead of formatted blocks. Manuscript-format export (12pt Courier, 1" margins, double-spaced) as the print profile. Purpose: long-form prose with chapter navigation, character/place/timeline tracking.

3. **Research / Report**. Academic + technical writing doc-type. Citation primitives, footnote and endnote blocks, equation embedding, figure/table captioning, cross-references. Purpose: structured academic output with citation-database integration at the platform layer.

4. **Proposal / Document**. Business writing doc-type. Section/clause/sub-clause tree, signature blocks, variable-substitution placeholders. Purpose: contracts, proposals, briefs with versioned clause libraries (platform-layer concern).

5. **Production Companion** (Preproduction Platform-bundled). Not a writing doc-type but a *companion* plugin that adds production-aware surfaces to an already-loaded screenplay document: shot lists, scheduling annotations, breakdown sheets. Lives at the seam between editor plugin and platform workflow.

Each plugin's purpose is to **teach the engine a writing form**. The engine learns; it does not get rewritten.

---

## 7. Filmustageation Direction

"Filmustageation" names the evolution from a static editor into a **living creative workflow**. Not a feature list — a posture.

### 7.1 From buffer to living script

The script is no longer a flat file. It is a session with its own brain (`project_script_equals_session`). Notes, scenes, tags, revisions, AI conversations all travel *with* the script. The editor's job is to make this feel inevitable, not technical.

### 7.2 Cinematic workspace philosophy

The workspace is a studio, not an IDE chrome (`Alive App` §1). Panels have weight; the script feels important; the toolbar lives where the work is. Visual hierarchy comes from the writing, not from the developer's mental model of widgets.

### 7.3 Production-aware tooling direction

Even at the editor layer, screenplay-as-plugin understands that scenes have weight, props have presence, characters have history, locations have continuity. The editor surfaces this without forcing the writer to think about production. The platform extends it into actual production planning.

### 7.4 Intelligent writing environment direction

AI assists, never authors (Law 15). The intelligence appears as:
- **Variations** — multiple alternatives, never one "answer."
- **Critique** — observations and questions, never rewrites.
- **Breakdown** — structural understanding offered, never imposed.
- **Ask** — conversational lookup of the writer's own material.

The intelligence is constrained in v01 (`project_ide_v1_scope`); the orchestration spine ships in CORE so plugin AI features can mature without re-plumbing.

### 7.5 Future collaboration / review intention

Revision anchoring is in CORE today as a primitive. The future direction is platform-mediated collaboration: comments, suggestions, redlines, version comparison — all anchored to CORE addresses, all surfaced via plugin-specific review modes, all stored and synced at the platform layer. No promises on timing; the foundation must exist before the feature can be designed.

### 7.6 Privacy as a pillar

Your content stays yours until you explicitly add it to a project; even then, with a warning (`project_privacy_principle`). Filmustageation is not a surveillance product. The Trojan Horse works only because trust is real.

---

## 8. Doctrine Summary

- Rwanga Editor is an **engine**, not a screenplay app. Screenplay is the first plugin.
- The architecture already has the right seams: `framework/` (CORE), `doc-types/<name>/` (plugins), `shell/` (CORE chrome), `electron/` (host). The doctrine names these seams and protects them.
- CORE owns: kernel, document model, layout, print, settings, command, persistence, AI orchestration foundation, plugin runtime. CORE is domain-neutral.
- Plugins own: schema extensions, commands, keymaps, inspector contents, side panels, exports, formatting rules, AI prompts, workflow surfaces. Plugins never mutate the kernel directly.
- Platforms own: cloud, collaboration, account, billing, project linking, external workflow. The editor must run independently of any platform.
- 18 architectural laws codify the invariants — Store SSOT, immediate-apply Settings, single-resolver page truth, flow-vs-print separation, save-vs-export separation, runtime never sign-in-gated, AI assists never authors, and others.
- Five first-generation plugin directions are sketched at concept level only.
- Filmustageation is a posture (script-as-session, cinematic workspace, production-aware tooling, constrained AI, platform-mediated collaboration, privacy as pillar), not a feature list.

---

## 9. Architectural Risks Discovered

These are real risks, grounded in the current codebase or current memory. Each is named so future slices can address it; none is fixed here.

1. **`framework/screenplay-normalizer.js` is a domain-named module inside the domain-neutral kernel.** Direct violation of Law 8 and §2.2. Must be either generalized (with the screenplay-specific behavior moved into the screenplay plugin's normalizer plug) or relocated. If left as-is, this becomes the precedent that every future plugin contamination cites.

2. **`doc-types/screenplay/` is the only plugin today.** The plugin runtime contract (§3.3) is asserted by this doctrine but is not yet *enforced* in code. Without a second plugin or an enforcement test, the contract is aspirational, and the screenplay plugin can quietly assume kernel privileges. A neutral skeleton plugin or a contract-test could close this gap.

3. **AI orchestration foundation is named but not yet built.** v01 ships constrained AI features (`project_ide_v1_scope`), but the CORE orchestration spine they need (provider router, prompt-context boundary, plugin-scoped namespaces) is implicit, not codified. If features ship before the spine, the spine will be retrofitted around them — backwards.

4. **`.rga` portability across plugin versions is not yet contract-tested.** Law 11 demands graceful-degrade read when the originating plugin is missing or a version behind. There is no automated check today that a screenplay-v3 file survives being read by a hypothetical screenplay-v4 or by an editor without the screenplay plugin loaded.

5. **Platform boundary is not yet codified in code.** Law 14 and §4.4 demand the editor runs platformless, and currently it does — but only because the platform doesn't exist yet. Without a "no-platform" smoke test, the first Preproduction Platform integration could accidentally embed platform calls into editor paths.

6. **Settings-as-SSOT is established but applicator drift is recent history.** The pre-S8 `--page-margin-*` orphan-applicators and the H8 forensic findings prove the drift risk is real. Phase 3 saturation reduction is the next live exposure; this doctrine reinforces but does not replace the Settings Constitution's enforcement.

7. **Tab kinds doctrine (document vs workspace) is locked but Timeline/Review document-derived case is deferred.** When that case is revisited, it will test §3.1's panel-host contract. Any pre-engineering now would be a violation; the deferral is correct, but the eventual design must respect this doctrine.

8. **Plugin-to-plugin isolation is asserted but un-tested.** §3.2 forbids plugin A importing plugin B. Today there is only plugin A, so the rule is trivially satisfied. The first day plugin B exists, this rule needs enforcement (lint rule, import-graph test, or both).

9. **`window.rwanga.*` IO contract is real but undocumented as a contract.** It works because it works. A formal interface document would let plugins target it confidently and let the web embed implement it without divergence.

10. **CORE module count has grown organically.** `renderer/js/framework/` is healthy but `renderer/js/shell/` has 30+ files and several of them straddle CORE-vs-plugin lines (e.g. `script-metrics.js`, `script-language.js`). A future audit slice could classify each shell module as CORE/screenplay-plugin/host and either repartition or document the dual-tenancy.

---

## 10. Areas Needing Future Designer Involvement

These are decisions designers — not engineers — should own. None is required to start Filmustageation implementation, but each must have a designer answer before the surface they govern is built.

1. **Plugin-switching affordance.** When two doc-types coexist, how does the user choose which to create / open into? The current flow assumes screenplay. Is the chooser a New-File dialog, a startup screen, a templates panel?

2. **Inspector slot anatomy across plugins.** Each plugin contributes inspector contents (§3.1). Designers must define the *frame's* shape — empty state, multi-doc-type empty state, persistent vs context-sensitive panels — so plugins fill consistent slots.

3. **AI surface conventions per plugin.** The constrained v01 surfaces (Variations / Modify / Review / Ask / Breakdown) exist for screenplay. Designers should define the visual conventions for these surfaces *in a doc-type-neutral way* so research's "Critique citation strength" or novel's "Vary this paragraph" inherits the same anatomy.

4. **Cross-plugin command-palette grammar.** Commands from different plugins will eventually share one palette. Designers must define the disambiguation: namespace prefix, icon, color, or context-only visibility.

5. **Platform-mediated collaboration UI conventions.** The collaboration features at the platform layer (comments, redlines, presence indicators) must visually feel native to the editor. Designers define the look; engineering wires.

6. **Status bar contributions from plugins.** Plugins will want status-bar real estate (screenplay wants page count + scene count; research wants citation count). Designers define the allocation rules so the status bar doesn't become a competitive zone.

7. **Print profile conventions across doc-types.** Screenplay has industry-locked print conventions. Novel has manuscript format. Research has journal-style. Each needs designer-defined paper feel — and a shared chrome (Rwanga export branding) that holds the family together.

---

## 11. Areas Needing Future Engineering Investigation

Open engineering questions whose answers will shape Filmustageation. Investigation, not decision — each is non-trivial.

1. **Doc-type registry runtime model.** Today's `framework/doc-type-registry.js` registers one type. The runtime model for multiple loaded doc-types (lazy load? eager? per-document context?) needs design before plugin v2.

2. **Schema-extension API surface.** ProseMirror schemas are immutable once built. The plugin runtime must compose them: investigate whether per-document schema (rebuilt at open) or runtime-extensible schema (preserves identity, harder to do) is the right model.

3. **AI orchestration spine.** Multi-provider router, plugin-scoped prompt contexts, response-shape protocol, agent-vs-chatbot separation — all named in `project_v2_ai_architecture` but unbuilt. The right time to investigate is *before* the second AI feature ships; otherwise the second feature defines the spine accidentally.

4. **`.rga` graceful-degrade reader.** A reader that can open a `.rga` when its originating plugin is missing or one version behind. Investigation: how much of the document is readable as "opaque blocks with text content" without plugin schema? Probably most; needs proving.

5. **Web embed parity.** `window.rwanga.*` works in Electron via preload. The web embed must implement the same surface in a sandboxed iframe + service-worker + IndexedDB combination. Non-trivial; needs prototype before the platform commits to a web embed.

6. **Plugin sandboxing.** A plugin runs in the renderer alongside CORE. What isolation guarantees are realistic? Investigate whether plugins should live in workers / iframes / process-isolated contexts, or whether contract enforcement + lint rules are sufficient for a curated plugin set (today's case).

7. **Migration chain integrity.** Per-plugin migrations exist (`doc-types/screenplay/migrations/`). The integrity of the chain across plugin upgrades — including the failure mode when a migration midway through the chain fails — needs an explicit recovery model.

8. **Plugin uninstall.** What happens to a `.rga` whose plugin is removed? Graceful-degrade read covers viewing; editing is a harder question. Investigate whether plugins are removable at all or only swappable.

9. **CORE-vs-plugin partition audit of `renderer/js/shell/`.** Risk #10 above. An audit pass that classifies each shell module, either repartitions or documents the dual-tenancy, and locks the partition with import-graph tests.

10. **Cross-platform CORE bundle.** The renderer that runs in Electron and the web embed must share its bundle to avoid divergence. Investigate whether the build produces a single CORE bundle consumed by both shells, or two bundles with shared sources and shell-specific glue.

---

# STOP

This is doctrine. No implementation, no slices, no plans are produced here. The next actions belong to whatever live work the user authorizes next — typically the Settings Phase 3 S9.1 wiring slice queued in `SETTINGS_NEXT_SESSION_HANDOFF.md`, which is unrelated to this doctrine and proceeds independently.
