# Rwanga — `.rga` Memory Truth Audit

> **Audit only. No implementation, no schema changes, no commit.**
> Created: 2026-05-29 · HEAD: `5ddaa8b6` (origin/main in sync).
> Grounded against: `renderer/js/doc.js` (`serialize` / `deserialize` / `tagRegistry` / `flagLog` / `runtime`), `renderer/js/doc-types/screenplay/schema-v3.js` (PM node + attr surface), `renderer/js/framework/base-outer-marks.js` (mark attr surface for annotation / tag / revisionFlag), `renderer/js/autosave.js` (background snapshot envelope), `renderer/js/doc-types/screenplay/scene-notes.js` (in-memory store), `renderer/js/framework/runtime-profile.js`, `renderer/js/shell/settings-store.js`, `renderer/js/shell/responsive.js`.

The audit answers what data crosses the disk boundary in `.rga`, what lives only in JS memory and is lost on reload, what the schema reserves but production code never writes (the worst class — looks persisted but isn't), and which gap matters most for production-ready writing.

---

## 1. What currently travels with `.rga`

Every save path (`Rga.Doc.serialize` at `doc.js:158-169`, autosave envelope at `autosave.js:43-50`) emits this top-level JSON:

| Field | Source | Contains |
|---|---|---|
| `rga_version` | `doc.rgaVersion` | Schema/version stamp for migration routing. |
| `document_type` | `doc.documentType` | `'screenplay'` today; future doc-types branch here. |
| `metadata` | `doc.metadata` | `title`, `author`, `created`, `modified`, `version`, `revision_notes`, `language`, `production_type`, `genre`, `logline`. |
| `settings` | `doc.settings` | Per-script settings: `font_size`, `font_family`, `show_scene_numbers`, `page_size`, `pageSetup` (paperSize + margins), `vocabulary` (settings / times / sceneWord), `sceneHeadingStyle`, `units`. |
| `body` | `doc.body.toJSON()` (the ProseMirror document) | The entire writing surface — see §1.1. |
| `tag_registry` | `doc.tagRegistry` | Nine fixed keys: `characters`, `props`, `wardrobe`, `locations`, `sfx`, `vfx`, `vehicles`, `animals`, `custom`. Each is an array of `{ id, name, color, notes }`. |
| `flag_log` | `doc.flagLog` | Append-only revision-flag history log (`addFlagLogEntry`). Entry schema un-documented in code; production usage minimal. |
| `export_settings` | `doc.exportSettings` | `branding`, `letterhead_url`, `include_scene_numbers`, `include_revision_marks`. |
| `runtime` | `doc.runtime` | `last_cursor`, `active_scene_id`, `ui_state`. Persisted but underspecified. |

### 1.1 What `body` (the PM document) persists

Per `schema-v3.js` + `base-outer-marks.js`, every saved node and mark round-trips faithfully because PM's `toJSON` / `nodeFromJSON` walk attrs + content + marks.

**Nodes carrying persisted attrs:**

| Node | Persisted attrs | Notes |
|---|---|---|
| `titleStrip` | `removable` | Whether the strip is dismissable. |
| `heading` | `level` (1–3) | Section heading levels. |
| `scene` | **`id`, `notes`, `revisionFlag`, `metadata`** | id is the stable scene anchor used by everything else (nav-index, navigator, click-to-jump). The other three are **schema-allocated reserved fields** — see §3 for why they matter. |
| `sceneHeading` | `setting`, `time`, `headingStyle` | INT./EXT./EST., DAY/NIGHT/CONTINUOUS, two-line vs one-line layout. |
| `transition` | `presetType` | "CUT TO:", "FADE OUT:" preset id; null for free-form transitions. Text content is inline. |

Action / character / dialogue / parenthetical / shot blocks have no attrs — they're pure content carriers.

**Marks carrying persisted attrs:**

| Mark | Persisted attrs | Notes |
|---|---|---|
| `bold` / `italic` / `underline` / `strikethrough` | (none) | Formatting. |
| `color` / `highlight` / `fontFamily` / `fontSize` | `value` | Direct styling. |
| `link` | `href`, `title` | |
| **`annotation`** (inline notes) | **`id`, `text`, `color`, `createdAt`, `author`, `status`** | The `text` field IS the inline-note content. Persisted complete. |
| **`tag`** (entity references) | **`tagType`, `entityId`** | Links text spans to `tag_registry` entries. |
| **`revisionFlag`** (inline revision marks) | **`id`, `reason`, `color`, `createdAt`, `status`** | Inline revision-flag marks on text spans. |

### 1.2 Autosave parity

`autosave.js` writes `Rga.Doc.serialize(doc)` inside an envelope (`schemaVersion`, `savedAt`, `baseHandle`, `baseDisplayName`, `baseSavedAt`, `rga`) — i.e., autosave snapshots persist **exactly the same fields as manual save**. Any gap below applies equally to autosave.

---

## 2. What is lost on reload

This is the **dangerous list** — values that work in the session but disappear when the writer closes and re-opens.

| Surface | Where it lives | Why it doesn't reach disk | Severity |
|---|---|---|---|
| **Scene-level note textarea** (Inspector Scene Notes + bottom-panel Scene tab) | `Rga.SceneNotes._notes` — a `Object.create(null)` map keyed by `sceneId`. `scene-notes.js:43-45` explicitly: "**In-memory only at v1; future slice may bridge to the screenplay doc-type's .rga serialization.**" | The two surfaces both call `Rga.SceneNotes.set(sceneId, value)`. That writer updates only the JS map and notifies subscribers. It does NOT write to the persisted `scene.attrs.notes` PM attr (which exists in schema). On reload, `_notes` starts empty. | **High** — silent data loss. Writers see a textarea, type into it, save, close, re-open — and the textarea is empty. Surface lies about durability. |
| **`Rga.SceneNotes.currentSceneId` / `.currentSceneName`** | Same module | Derived from cursor / DOM walker; rebuilt on every session. | None — correctly ephemeral (cursor position re-derives this on re-open). |
| **Session-tier settings** | `Rga.Settings.Store` session entries (`settings-store.js:7`: "Session → in-memory only, lost on reload"). | Intentional design. Settings doctrine differentiates Session / Script / Project / User / Built-in tiers. Session tier is deliberately ephemeral. | None — design intent. Writer must not store anything important here. |
| **Responsive auto-collapse state** | `responsive.js:33`: "user expressed a preference, don't fight them. Session-scoped (not persisted)." | Resets each session — also intentional (a writer who collapsed a panel one day may want it back the next). | None — design intent. |
| **`Rga.Framework.RuntimeProfile`** | `runtime-profile.js:33`: "In-memory only — no persistence in this phase. A future phase may add localStorage hydration." | Reserved API for future runtime configuration. Currently has no consumers that need persistence. | Low — no live consumer suffering data loss. |
| **NavigationIndex (`Rga.Nav.getIndex(state)`)** | PM plugin state, rebuilt on every doc change | Cached against PM state by design — derived view, not source of truth. | None — re-derives correctly on reload. |
| **PageMap, scene numbers, character cue counts** | Same as nav-index | Derived from `body`. | None — re-derives. |
| **`Rga.Shell.SceneNavigator._filterText` / `_selectedNodeId` / `_lastCurrentNodeId`** | Module-level state in `scene-navigator.js` | Session-scoped navigator state (transient by SN-Bundle-1 design). | None — design intent. |
| **Tab manager open-tabs list, recently-opened, multi-document context** | Tab state lives in JS memory + per-tab handles | Re-opens depend on the user re-selecting files. There is no "last session restore." | Medium — a writer with three open scripts who closes the app re-opens to whatever default boot does. (Out of scope for `.rga`-truth, but worth flagging.) |

### 2.1 The most consequential single loss

**Scene-level note textarea text.** Every other in-memory loss is either ephemeral by design (session settings, responsive collapse, runtime-profile) or re-derivable (nav-index, page numbers). The scene notes textarea is the only writer-facing surface that *looks* like persistent storage but isn't.

---

## 3. What is schema-allocated but never written (looks persisted but isn't)

This is the **subtle** class. The `.rga` file has slots for these and the parse / serialize round-trip works — but no production code writes them, so they're permanently empty in real `.rga` files. The danger: they advertise capacity the app doesn't deliver.

| Field | Schema location | Status |
|---|---|---|
| **`scene.attrs.notes`** (string, default `''`) | `schema-v3.js:96` | Round-trips via `toDOM` (`data-scene-notes`) + `parseDOM` (`getAttribute('data-scene-notes')`). **No production code writes it.** `Rga.SceneNotes.set` does not. This is the slot the scene-level notes textarea SHOULD write to — and the gap §2 describes. |
| **`scene.attrs.revisionFlag`** (default `null`) | `schema-v3.js:97` | Schema slot for a scene-level revision flag. Nav-index reads `sceneNode.attrs.revisionFlag` to compose `hasRevisionFlag`, but no production code writes it. Inline `revisionFlag` MARKS are written + persisted normally; only the scene-level scalar is dormant. |
| **`scene.attrs.metadata`** (default `null`; intended shape `{ linkedScenes:[], references:[], production:{} }`) | `schema-v3.js:98-102` | Schema comment: "Helpers in later phases populate ... when creating new scene nodes." No phase has done this. Reserved capacity for: scene-to-scene linking (parallel scenes / callbacks), cross-references (this scene cites that scene), and a per-scene production bag (locations, stunts, scheduling). |
| **`doc.flagLog`** | `doc.js:108, 165, 281, 332-334` | Persisted top-level array; `addFlagLogEntry(doc, entry)` is the only writer. Entry schema is implicit — comments don't document it. Whether revision history actually accrues is unclear from a static read. |
| **`runtime.last_cursor` / `runtime.active_scene_id` / `runtime.ui_state`** | `doc.js:80-86` (default), `163, 167` (serialize) | Persisted, but the writers populating these on close (so re-open lands where the writer left off) are not in the audit's scope. Likely sparse. |

These five slots are the "reserved but dormant" surface. A future Inspector, Timeline, AI, or Filmustage system relying on them would discover an empty-but-validly-shaped store — and a writer's expectation that "the app remembered" would silently break.

---

## 4. Which gaps block production-ready script writing

A "production-ready" script-writing experience needs the writer's intentional notes, annotations, tags, and revisions to all survive reload. Ranked from worst to least:

### Gap 4.1 — Scene-level note text (high severity, blocks writers today)

`Rga.SceneNotes._notes` → no disk path. Documented in §2 above. **This is the single largest writer-visible gap in the current build.** The fix is mechanical because the schema slot exists (`scene.attrs.notes`) and nav-index already reads from it (`nav-index.js:199`). Wiring the writer is a small slice (see §6).

### Gap 4.2 — Revision flag log (medium severity, unclear today)

`doc.flagLog` is persisted but the writer paths (`addFlagLogEntry`) and the consumer paths (does anyone READ the log?) are sparse. A writer who uses the revision-flag toolbar button expects to be able to inspect the change history of a draft. Whether that pipeline is complete or partial isn't visible from a static read.

### Gap 4.3 — `runtime.last_cursor` / `runtime.active_scene_id` (low–medium severity, polish)

A writer re-opening a `.rga` likely expects the cursor at the last edit and the navigator scrolled to the last active scene. The `runtime` slot exists; whether anything writes to it on close is the question. Polish-grade, not a blocker for production writing — but a clear UX gap once noticed.

### Non-gaps that look like gaps but aren't

- **Inline annotation notes** — `annotation` mark attrs include `text` + `color` + `status` + `author` + `createdAt`. Persisted complete via PM body. Writers can drop inline notes confidently.
- **Tag marks** — `tagType` + `entityId` persisted; `tag_registry` resolves names + colors. Complete.
- **Inline revision flags** — `revisionFlag` mark attrs include `reason` + `color` + `status` + `id` + `createdAt`. Persisted complete.
- **Scene IDs + ordering** — `scene.attrs.id` is stable across edits; doc order is PM-canonical. Complete.

---

## 5. Which gaps are future Inspector / Timeline / AI / MCP work

These are not blockers for production writing today — they are capacity questions for the deferred systems.

### 5.1 Inspector scene-detail panel (deferred, UX Direction §15)

Needs per-scene data the helper SN-Helper-1 already projects (notes, flags, characters, props, locations, …). All source data is in `.rga` for inline marks; only the **scene-level note textarea** has the persistence gap from §4.1.

### 5.2 Timeline / scene-graph / parallel-scene linking

Needs `scene.attrs.metadata.linkedScenes` (reserved, dormant per §3) and `.references`. A timeline would render scenes as nodes and the metadata.linkedScenes array as edges. **The schema slot is ready; no writer exists; no UI consumer either.**

### 5.3 AI scene analysis / scene context

Needs at minimum:
- A persisted **scene-level summary / synopsis** field. Not in the schema today; `scene.attrs.metadata` is the natural home (`.production` could carry it, or a new sibling field).
- A persisted **per-scene AI conversation history** (if AI is per-scene-scoped). Today no schema field; would require a new top-level `doc.aiContext` array or per-scene metadata extension.
- A persisted **AI permissions** flag per scene (whether AI may read / modify this scene). Memory `project_ide_creative_sovereignty` says AI never authors — but the read-permission question still needs a schema home.

None of these blocks production writing; all are AI-system prerequisites. The Alive App gate (`project_alive_app_checklist`) forbids starting AI work today, so this section is **future-blocked, not slice-ready**.

### 5.4 MCP integrations

MCP would expose `.rga` data over a standardised tool surface. Since the data on disk is the same as the in-memory surface, MCP inherits §1's coverage AND §2's gaps — i.e., MCP would see exactly what `.rga` has, which means it sees nothing of the scene-level notes textarea today. Fixing §4.1 also unblocks MCP read for that field.

### 5.5 Production breakdown mode (deferred, UX Direction §16)

Needs `scene.attrs.metadata.production` (reserved, dormant per §3) for per-scene production data (locations, stunts, scheduling). Schema slot is ready; no writer; no UI.

### 5.6 Per-script user preferences (cursor history, panel state, recently-visited scenes)

Partially in `runtime`, underspecified. A modest persistence design slice could formalise this without schema risk — it's all in a top-level reserved object.

---

## 6. Recommended next implementation slice

**`SN-Helper-2` — Persist scene-level notes through `scene.attrs.notes`.**

### What it does

Bridge `Rga.SceneNotes.set(sceneId, value)` to also write `scene.attrs.notes` on the PM scene node (via a PM transaction with `setNodeMarkup`). Read path: `Rga.SceneNotes.get(sceneId)` falls back to reading from the PM doc when the in-memory map is empty (i.e., on fresh reload, restore the textarea contents from the persisted attr).

### Why this slice

- **Closes the only writer-visible persistence gap** named in §2.1 and §4.1. Everything else is either ephemeral by design or future-system capacity.
- **Schema slot already exists** (`scene.attrs.notes`, `schema-v3.js:96`). No schema change. No migration. No new field name. No `.rga` format change.
- **Nav-index already reads it** (`nav-index.js:199`). No change to how `hasNotes` is composed.
- **`Rga.SceneNotes` already has subscribers** (bottom-panel Scene tab, inspector-scene-notes panel). Same notification path; the write-path just gains a second sink (the PM transaction).
- **Honours the binding moratoria** — no nav-index change, no contamination-triad change (scene.attrs.notes is a `scene` node attr, not part of `Rga.Doc.tagRegistry`), no `Rga.Doc.addEntity` involvement, no `schema.marks.tag` touch.
- **Unblocks the deferred Inspector scene-detail panel** (Reading A from the prior audit) by removing the "this field doesn't survive reload" caveat.
- **Unblocks MCP read** of scene-level notes.
- **Foundation-shaped, not feature-shaped**: like SN-Helper-1, this slice clears the path for downstream consumers (Inspector, AI, Timeline, MCP) without committing to any specific UI surface.

### What it does NOT do

- Does NOT touch `scene.attrs.revisionFlag` (separate slot, separate slice if pursued).
- Does NOT touch `scene.attrs.metadata` (`linkedScenes` / `references` / `production` are bigger design questions — Timeline, breakdown mode, AI).
- Does NOT introduce a new `.rga` field, a new mark, a new migration, or a schema bump.
- Does NOT introduce UI changes — the inspector textarea and bottom-panel Scene tab work the same way; they just gain durability.
- Does NOT speculate about AI / Timeline / Inspector designs — those remain deferred.

### Test surface

- Unit: `Rga.SceneNotes.set` writes the attr; `Rga.SceneNotes.get` reads from PM doc when in-memory map is empty; reload simulation (serialize → deserialize) preserves the textarea content; the existing in-memory cache path stays the same for non-active-tab access.
- Optionally a small Playwright: write into the inspector textarea, close the doc, re-open, verify content survives.

### Why not other candidates

- **Revision flag log (§4.2)**: low writer pressure today; needs an investigation pass first to understand whether `flagLog` is actively used.
- **`runtime.last_cursor` / `.active_scene_id` (§4.3)**: polish-grade; valuable but not the gap that blocks production writing.
- **`scene.attrs.metadata` linkedScenes / references / production (§3, §5.2, §5.5)**: schema slot exists but the surfaces that would CONSUME it (Timeline, breakdown mode) don't. Building writers before consumers gambles on design choices the user hasn't made.
- **AI / MCP fields (§5.3, §5.4)**: gated by Alive App and Platform / MCP infrastructure that doesn't exist yet.

---

# STOP

Audit + recommendation only. No code edited, no schema changed, no commit created. The next decision — whether to authorise `SN-Helper-2 — persist scene-level notes` as the next slice, or defer it for a different priority — belongs to the user.
