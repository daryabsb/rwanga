# Tag Intelligence / Scene Linking Audit

> **Investigation only — nothing implemented, no schema change, no UI change.**
> Sample inspected: `tests/fixtures/playground-the-last-light.rga` (5 scenes, rga_version 3.0).
> Code inspected: schema-v3, base-outer-marks, nav-index, tags plugin, toolbar-tag, doc.js, scene-notes, settings applicators, git history.
> Date: 2026-06-02 · Investigator: Claude (Opus 4.8)

---

## 1. Executive Summary

The data model is **half-built in exactly the right shape and half-missing in exactly the painful places.**

**What exists and is sound:**
- Tags are **global entities** (`tag_registry`, 9 categories, UUID ids) and occurrences are **inline ProseMirror marks** that point at entities **by `entityId`** — the "tag is global / occurrence is local" principle the mission asks for is *already the architecture*.
- nav-index already derives **entity → scenes** (`sceneAppearances`), per-entity `mentionCount` and `cueCount`, and per-scene `hasNotes` / `hasRevisionFlag`. The Scene Navigator chevron sits on top of this.
- Scene nodes already reserve room for future linking: `scene.attrs.metadata = { linkedScenes: [], references: [], production: {} }` — empty placeholders, never populated.

**What is broken or missing:**
- **Occurrence coverage is honest only for *tagged* text.** In the sample, NALI appears in all 5 scenes but is tagged in only 3; the PHOTOGRAPH prop entity has **zero** tagged occurrences despite the word appearing in 3 scenes. Untagged mentions are invisible to every index.
- **Character identity is fragmenting in practice.** The sample registry holds **6 character entities for 3 characters** (NALI ×2, BABAN ×3, DR. HASSAN ×1) because every re-tagging of a name creates a new UUID instead of reusing the existing entity. Scene 2's cues point at the *duplicates*, not the curated entities.
- **Character cues are not linked to characters.** The `character` block type has **no attrs**; a cue counts toward a character only if its text happens to carry a tag mark. In the sample, scenes 3 and 4 have 6 cues — all untagged, all invisible to `cueCount`.
- **The autocomplete the team remembers existed and is dead.** It was real (ghost-text from registry, scene-v2 era, 2026-05-16), deleted with the v3 redesign. Only an orphaned settings toggle and orphaned CSS remain.
- **Pronouns/referrals: zero support**, and nothing tracks them — but the schema placeholder (`metadata.references`) is the natural future home.

**Bottom line for nested navigator / breakdown / AI:** the *read side* (derived index) can already answer "which **tagged** things are in scene N" — that part is a small derivation away. The *write side* (getting things tagged at all: cue linking, dedup, autocomplete, mention confirmation) is where the real gap is. Building nested navigator lists on today's data would show confidently wrong numbers.

---

## 2. `.rga` Sample Findings

`playground-the-last-light.rga` — top-level keys:
`rga_version (3.0)`, `document_type (screenplay)`, `metadata`, `settings`, `body`, `tag_registry`, `flag_log`, `export_settings`, `runtime`.

### 2.1 Storage map (the mission's table)

| Item | Stored globally? | Stored inside scene? | Stored as inline mark? | Linked by ID? | Linked by text? | Not stored? |
|---|---|---|---|---|---|---|
| **Scenes** | — (body is the document) | Scene **is** the unit: PM `scene` node, attrs `{ id, notes, revisionFlag, metadata }` | — | `attrs.id` (`"scene-001"` … or UUID) | — | — |
| **Notes (scene-level)** | No | **Yes** — `scene.attrs.notes` (prose string; all 5 sample scenes have one) | No | — | — | — |
| **Notes (text-anchored)** | No | Inside scene content | **Yes** — `annotation` mark `{ id, text, color, createdAt, author, status }` | mark `id` (UUID) | Anchored to the marked text range | — |
| **Flags (scene-level)** | No | **Yes** — `scene.attrs.revisionFlag` (all `null` in sample) | No | — | — | — |
| **Flags (text-anchored)** | No | Inside scene content | **Yes** — `revisionFlag` mark `{ id, reason, color, createdAt, status }` | mark `id` | Anchored to text | — |
| **Flag history** | **Yes** — top-level `flag_log[]` (resolved flags: `{ id, flaggedText, color, hint, reason, resolvedAt }`) | No | No | `id` | Keeps a **text copy** (`flaggedText`) but **no scene linkage** | Scene linkage not stored |
| **Tags (entities)** | **Yes** — top-level `tag_registry`: `characters, props, wardrobe, locations, sfx, vfx, vehicles, animals, custom`; entity = `{ id, name, color, notes }` | No | No | `id` (UUID or `ent-*`) | `name` is display only | — |
| **Tag occurrences (tag marks)** | No | Inside scene content | **Yes** — `tag` mark `{ tagType, entityId }` | **`entityId` → registry** (by ID, not text) | The marked text is whatever the writer selected | — |
| **Characters** | **Yes** (registry `characters[]`) | Cues are `character` **blocks** inside scenes — **no attrs, plain text** | Optionally (tag mark on cue text) | Only if tagged | Cue text is just text | Cue→character link **not stored** unless manually tagged |
| **Props** | **Yes** (registry `props[]`) | No | Optionally (tag mark) | Only if tagged | — | Sample: PHOTOGRAPH / TIN BOX entities have **0 tag marks** |
| **Locations** | **Yes** (registry `locations[]`) | **Also per-scene**: `sceneHeading.attrs` (`setting`, location text, `time`) | Optionally | Only if tagged | Heading location text is **not linked** to registry locations | Heading↔registry link not stored |
| **Mentions (untagged name occurrences)** | — | — | — | — | — | **NOT STORED, NOT INDEXED, INVISIBLE** |
| **Tag registry** | **Yes** — top-level | No | No | — | — | — |
| **Tag marks** | No | Within scene content | **Yes** | `entityId` | — | — |

### 2.2 What the sample body actually contains (ground truth)

| Scene | attrs.notes | Tag marks | Character cues | Untagged mentions (invisible to all indexes) |
|---|---|---|---|---|
| 1 | "Open quiet. Mist as a character." | none (only bold/underline/italic) | none | **NALI** in action text |
| 2 | "Hold on hands meeting…" | BABAN cue (dup id `47a05ccf`), NALI cue (dup id `15201fa6`), "Baban" in action (dup id `e578a64f`), **1 annotation mark** ("in months not years…", status resolved) | BABAN ✓tagged, NALI ✓tagged | NALI + BABAN in action; BABAN'S in heading |
| 3 | "The photograph turn…" | NALI (`ent-nali`), DR. HASSAN (`ent-hassan`) in action | DR. HASSAN ✗untagged, NALI ✗untagged | "tin box", "photograph", NALI in action |
| 4 | "The promise…" | **none at all** | BABAN, NALI, BABAN, NALI — **all 4 untagged** | NALI, BABAN, "photograph" in action |
| 5 | "End on motion forward…" | NALI (`ent-nali`) in action | none | "photograph" in action |

### 2.3 The registry duplication problem (visible in the sample)

`tag_registry.characters` has **6 entries for 3 people**:

| id | name | color | origin |
|---|---|---|---|
| `ent-nali` | NALI | #4FC1FF | curated (with notes) |
| `15201fa6-…` | NALI | null | duplicate — created by re-tagging |
| `ent-baban` | BABAN | #FFB86C | curated |
| `47a05ccf-…` | BABAN | null | duplicate |
| `e578a64f-…` | Baban | null | duplicate (different casing) |
| `ent-hassan` | DR. HASSAN | #A8F0A8 | curated |

Scene 2's tagged cues point at the **duplicates**, scene 3/5's tags point at the **curated** entities → the same character's occurrences are split across multiple identities. Any "scenes where NALI appears" query returns a partial answer **even for tagged text**.

(`props` has the same disease: curated `ent-photo`/`ent-tinbox` + a stray lowercase `window` duplicate-style entry.)

---

## 3. Current Code Findings

| Component | File:lines | What it does |
|---|---|---|
| Tag registry CRUD | `renderer/js/doc.js:21-26, 293-319` | `emptyTagRegistry()`, `addEntity`, `findEntity`, `removeEntity`; singular→plural key map; serialized as `tag_registry` (doc.js:164), deserialized at doc.js:280; preserved byte-for-byte by v2→v3 migration |
| Tag mark schema | `renderer/js/framework/base-outer-marks.js:105-125` | `tag` mark, attrs `{tagType, entityId}`, excludes annotation/revisionFlag, renders `span.rga-tag.rga-tag-<type>` |
| Annotation mark | `base-outer-marks.js:68-104` | `{ id, text, color, createdAt, author, status }` — text-anchored notes |
| revisionFlag mark | `base-outer-marks.js:126-157` | `{ id, reason, color, createdAt, status }` |
| Scene node | `renderer/js/doc-types/screenplay/schema-v3.js:89-121` | attrs `{ id, notes, revisionFlag, metadata }`; `metadata` default null, populated by `v3-commands.js:48-66` as `{ linkedScenes: [], references: [], production: {} }` |
| Character block | `schema-v3.js:162-167` | **No attrs.** Pure structural block (`content: 'inline*'`). |
| Tags plugin | `renderer/js/doc-types/screenplay/plugins/tags.js` | Click on tagged text → info popup (entity name, Remove, "View Tags"→nowhere); `applyTag`/`removeTag`/`removeAllMarksForEntity`; panel-refresh targets `#tag-groups-container` which **does not exist in the DOM** |
| Tag creation UI | `renderer/js/doc-types/screenplay/toolbar-tag.js:67-91` | Select text → toolbar dropdown → case-insensitive registry match → reuse or `addEntity` → apply mark. **This is the only tag-creation path.** |
| nav-index | `renderer/js/framework/nav-index.js` | The derived index (next section) |
| Scene notes | `renderer/js/doc-types/screenplay/scene-notes.js` | `Rga.SceneNotes.get/set` — persists to `scene.attrs.notes` via setNodeMarkup |
| Scene Navigator | `renderer/js/shell/panels/scene-navigator.js` | Consumes `idx.scenes[].hasNotes/hasRevisionFlag` (chevron + indicators), `idx.pages` (page badges) |

### Dead / orphaned code (honest list)

| Item | Location | Status |
|---|---|---|
| "Tags" menubar button | `index.html:95` | **Dead** — no handler anywhere |
| Tags sidebar panel | referenced by `plugins/tags.js:63-104` (`#tag-groups-container`) and popup "View Tags" button | **Never mounted** — container doesn't exist; panel CSS exists unused (`components.css:375-456`) |
| Character-cue autocomplete | was `scene-frame-pm.js` (deleted in v3 redesign) | **Dead** — see §6 |
| Autocomplete CSS | `editor-prosemirror.css:1655-1715` (`.rga-autocomplete-ghost`, `.rga-autocomplete-arrow`, `.rga-tag-suggest-popup*`) | **Orphaned** — targets DOM no code creates |
| Autocomplete setting | `settings-registry.js:166-170` + `editor-applicators.js:156-175` | **Stub** — toggle exists (default ON), applicator calls `window.Rga.Autocomplete.setEnabled()` which doesn't exist |
| Per-character tinting | `flow-chrome.js:138-154` | **Retired 2026-05-16** — only strips legacy inline colors |
| Registry `color` field | `tag_registry.*.color` | **Stored but ignored** at render time (CSS per-type colors won) |

---

## 4. Global Tags vs Scene Occurrences

### What nav-index derives today (`nav-index.js:85-310`)

The index walks the doc once per change and produces:

```
scenes[]:     { nodeId, sceneNumber, pmPos, pmEndPos, headingDisplay, setting,
                locationText, time, transitionDisplay, blockCount,
                hasNotes, hasRevisionFlag }
characters[]: { nodeId(=entityId), name, color, cueCount, mentionCount, sceneAppearances[] }
tags{type}[]: { nodeId(=entityId), name, color, mentionCount, sceneAppearances[] }
notes[]:      { id, color, text, status, sceneNodeId, sceneNumber, markedText }   ← annotation marks
flags[]:      { id, color, reason, status, sceneNodeId, sceneNumber, markedText } ← revisionFlag marks
pages[], byPos, byId
```

Key mechanics:
- `hasNotes` = `scene.attrs.notes` non-empty **OR** any annotation mark inside the scene (nav-index.js:121, 199)
- `hasRevisionFlag` = `scene.attrs.revisionFlag` non-null **OR** any revisionFlag mark (nav-index.js:135, 200)
- `sceneAppearances` = scenes containing ≥1 **tag mark** for that entity (nav-index.js:139-146)
- `cueCount` = character blocks whose **first text fragment carries a character tag mark** (nav-index.js:90-102)

### Can the app answer the mission's queries?

| Query | Answer | How / what's missing |
|---|---|---|
| **Which tags appear in Scene 5?** | **YES (tagged only), via inversion** | `tags[type][i].sceneAppearances` is entity→scenes; invert it in one pass. No direct scene→tags map exists, but all data is present. Sample answer for scene 5: NALI (`ent-nali`). Honest caveat: misses everything untagged. |
| **Which scenes mention Nali?** | **PARTIALLY — tagged mentions only, split across duplicate identities** | `ent-nali.sceneAppearances` = [3, 5]; duplicate `15201fa6.sceneAppearances` = [2]. Truth: she appears in **all 5 scenes** (untagged in 1, 4, and partially everywhere). Two problems stack: untagged mentions invisible + identity fragmentation. |
| **Which scenes contain a prop?** | **NO in practice** | Mechanism exists (`tags.prop[].sceneAppearances`) but sample has **zero tagged prop occurrences** → returns nothing although "photograph" is in scenes 3, 4, 5. |
| **Which scenes have note/flag data?** | **YES — fully reliable** | `scenes[].hasNotes/hasRevisionFlag` (both sources) + per-item detail in `notes[]`/`flags[]` with `sceneNodeId`. This is the only query that is complete and honest today. The navigator chevron already uses it. |
| **Which scenes contain a character cue?** | **Structurally derivable, not currently surfaced** | Cue **blocks** are walkable (nav-index visits them) but only tagged-cue counts are kept (`cueCount` per entity, not per scene). A per-scene "has cues / cue texts" list would be a trivial addition to the same walk — but linking cue → character needs the cue to be tagged (scenes 3, 4: six untagged cues = unlinkable today). |
| **Which scenes contain a tagged mention?** | **YES** | Union of all `sceneAppearances` across all types. |

### The principle, evaluated against reality

The mission's principle — *"the tag is global, the occurrence is scene/local; don't duplicate the tag per scene; calculate or store occurrences"* — **is already the implemented architecture**: registry = global identity, marks = local occurrences, nav-index = calculated occurrence map. The architecture is not the problem. **Coverage is the problem**: occurrences only exist where a human manually tagged text, and the only tagging UI is a toolbar dropdown used inconsistently (the sample proves it).

---

## 5. Character Identity Model

| Mission question | Answer |
|---|---|
| Does this exist today? | **Partially.** A Character IS a global entity (`tag_registry.characters[]`: id, name, color, notes). |
| Is it global? | **Yes** — per-document registry, not per-scene. No duplication of entities per scene. ✓ correct shape |
| Is it scene-indexed? | **Yes, derived** — `nav-index.characters[].sceneAppearances` + `cueCount` + `mentionCount`. But only over **tagged** occurrences. |
| Is it tag-based? | **Yes** — identity linkage is exclusively the `tag` mark's `entityId`. |
| Is it cue-based? | **No.** The `character` block has no attrs. A cue is linked to a character *only* if someone tagged its text. Untagged cue = anonymous text. (Sample: 6 of 8 cues untagged.) |
| Is it missing? | The entity exists; what's missing is: **(a)** cue→entity linkage as a first-class fact, **(b)** dedup/merge (6-for-3 problem), **(c)** name normalization (NALI vs Nali vs nali), **(d)** aliases/pronouns (§6 of mission → §9 below), **(e)** "appears in" vs "speaks in" distinction (cueCount approximates "speaks", sceneAppearances approximates "appears", but both undercount). |

**Character → appears / mentioned / speaks (the mission's target model) vs today:**

| Target capability | Today |
|---|---|
| Character → appears in scenes | `sceneAppearances` (tagged only — undercounts) |
| Character → mentioned in scenes | Same array; no distinction between "physically present" and "talked about" |
| Character → speaks in scenes | `cueCount` exists (doc-wide total, not per-scene) and only counts **tagged** cues |
| Character → aliases / pronouns | Nothing |

---

## 6. Autocomplete / Existing Tag Recognition

**The remembered feature was real. It is dead. Here is its complete history.**

| Question | Answer |
|---|---|
| Does it still exist? | **No.** It lived in `renderer/js/doc-types/screenplay/scene-frame-pm.js` (the old "scene-v2" inner-editor architecture). That file was **deleted in the v3 editor redesign**. The feature does not run in today's app. |
| What was it? | Commit `7987d39f` (2026-05-16): *"character-cue autocomplete — ghost-text suggestion from tag registry."* Type **≥2 letters** (not 3 — deliberately, because some names are 3 letters) of an already-registered character name inside a character cue → the remainder appeared as light-gray ghost text → **ArrowRight** confirmed → full name inserted **with the tag mark (entityId from registry) already applied**. Commit `d0c9dcc5` added: a " →" hint glyph, and an **on-blur "Tag as NALI?" popup** when a manually-typed cue exactly matched a registered character but carried no mark. |
| Only characters? | **Yes** — characters only, in character cue blocks only. |
| All tags? | No. Other types were explicitly deferred. |
| Tag-registry based? | **Yes** — pure case-insensitive `startsWith` match against `doc.tagRegistry.characters`. No AI, no doc scanning. |
| Mark based? | The *output* was a mark (it applied `tag {tagType:'character', entityId}` on confirm). The *matching* was registry-based. |
| Broken / dead? | **Dead.** Remnants today: **(1)** orphaned CSS `editor-prosemirror.css:1655-1715` (ghost text, arrow hint, suggest-popup styles — nothing creates these elements); **(2)** orphaned setting `editor.autocomplete` (toggle, default ON, `settings-registry.js:166-170`) whose applicator (`editor-applicators.js:156-175`) sets `data-autocomplete` on `<body>` and calls `window.Rga.Autocomplete.setEnabled()` — an object that no code defines (documented as the "S9.1 stub: engine doesn't exist yet"). |
| Can it be generalized? | **Yes, cleanly.** The design (registry `startsWith` → ghost text → confirm applies mark with `entityId`) generalizes to all 9 tag types with zero schema change. The settings hook (`Rga.Autocomplete.setEnabled`) is already wired and waiting. It must be **rebuilt as a v3 ProseMirror plugin** (the old code targeted the retired per-block inner-editor architecture and cannot be resurrected as-is). The on-blur "Tag as NALI?" recognizer is the more important half to generalize — it is the anti-fragmentation mechanism (it links *manually typed* names to *existing* entities instead of letting them go untagged). |

---

## 7. Scene Navigator Readiness

### Safe to show TODAY (data exists, complete, honest)

| Item | Backing data | Caveat |
|---|---|---|
| Notes presence (chevron) | `scenes[].hasNotes` | Already shipped |
| Flag presence | `scenes[].hasRevisionFlag` | Already shipped |
| **Note detail lines** (text, status, count per scene) | `notes[]` entries carry `sceneNodeId`, `text`, `status`, `markedText` | Straightforward extension of the existing marks zone — data is complete |
| **Flag detail lines** | `flags[]` same shape | Same |
| Search matches | Existing Search-v1 | Already shipped |
| Page numbers | `pages[]` | Already shipped |

### Showable with an honesty label (data exists but undercounts)

| Item | Backing data | Why it needs a label |
|---|---|---|
| **Tagged** characters per scene | invert `tags.character[].sceneAppearances` | Sample: would show NALI in scenes 2,3,5 — she's in all 5. Must be presented as "tagged in this scene", never as "appears in this scene". |
| **Tagged** props/locations/etc per scene | same inversion | Sample: would show zero props anywhere. |

### Must WAIT (data does not exist or would lie)

| Item | What's missing |
|---|---|
| "All characters in scene N" (true appearances) | Untagged-mention detection (name text matching) + cue linking + registry dedup. Without all three, every number is wrong. |
| Cue-derived characters ("who speaks in scene N") | Per-scene cue list + cue→entity linkage (cues are untagged in practice) |
| Character appearance counts / "appears in 5 scenes" | Same as above — today's data undercounts and splits across duplicate identities |
| Pronoun references | Nothing exists (§9) |
| Breakdown categories (props/wardrobe/vehicles per scene for production) | Reliable per-scene occurrence data — the whole point of a breakdown is completeness, which is exactly what today's data lacks |
| Nested tag lists per category (the deferred Inspector feature) | Registry dedup first, otherwise the list shows NALI twice and BABAN three times |

---

## 8. Recommended Data Model Direction

**Option C — Hybrid: global registry (persisted) + derived occurrence map (computed) + persisted manual links only where derivation is impossible.**

| Layer | Persistence | Status |
|---|---|---|
| **Identity** — registry entities (all 9 types) | Persisted in `.rga` (`tag_registry`) | Exists. Needs hygiene: dedup/merge, case-insensitive uniqueness. Later: `aliases[]` field (schema addition — deferred). |
| **Explicit occurrences** — tag marks | Persisted in body (marks) | Exists. Coverage is the gap, not storage. |
| **Derived occurrences** — entity→scenes, scene→entities, cue lists, exact-name text mentions | **Computed (nav-index extension), never persisted** | Partially exists (entity→scenes, tagged only). Missing: the inversion (scene→entities), per-scene cue collection, and exact-name mention scanning ("unconfirmed mentions"). |
| **Non-derivable links** — confirmed pronoun references, alias confirmations, manual "this 'she' is NALI" decisions | Persist when they arrive — natural home is **`scene.attrs.metadata.references[]`**, the placeholder that already exists empty in every scene | Doesn't exist yet; room already reserved. **Do not build now.** |

**Why not A (derived only):** pronoun/alias confirmations and human corrections are not derivable — pure derivation has a ceiling.
**Why not B (persisted occurrences):** occurrences go stale on every edit, bloat the file, and duplicate what the marks already are. The marks **are** the persisted occurrences.

**Confidence tiers for everything downstream (navigator, breakdown, AI):**
1. **Tagged** (explicit mark, entityId) — ground truth
2. **Matched** (exact registry-name found in text/cue, no mark) — derived, "unconfirmed"
3. **Inferred** (pronouns, aliases, AI) — future, always confirmable by the writer

This three-tier vocabulary should appear in every future spec so the UI never presents tier-2/3 data as tier-1 truth.

---

## 9. Pronouns / Referrals (investigation only)

| Question | Answer |
|---|---|
| Any current support? | **None.** No mark type, no attr, no index, no code path knows what "she" refers to. Sample scene 1: "NALI (28) steps out… **She** looks at the house" — invisible. |
| Should this be manual tagging? | As the *first* mechanism, yes — a "reference" link a writer can confirm (tier 3 → tier 1 by confirmation). Manual-only will never reach coverage, but it defines the data shape AI later fills. |
| AI-assisted later? | Yes — this is precisely the v01/v2 AI lane (Breakdown, Ask). AI proposes `{pronoun span} → {entityId}`, writer confirms. Never auto-commit. |
| Scene-local inference? | Correct scope: pronoun resolution is scene-local by nature (antecedent = last named character in the same scene). The data model should record references **per scene**, not globally. |
| Room in the data model? | **Already reserved**: `scene.attrs.metadata.references: []` exists (empty) in every scene. A future reference record (`{ entityId, kind: 'pronoun'|'alias', text, confirmedBy }`) fits there with **no schema change** (the attr is an untyped object). No work needed now beyond *not repurposing that field for something else*. |

---

## 10. Smallest Safe Next Slice

**Slice: "Scene-Occurrence Read API" — pure derivation, read-only, no schema change, no UI change.**

Extend nav-index's existing single walk to also produce:
1. `sceneTags`: the inversion — `{ sceneNodeId → [{ tagType, entityId, name }] }` (data already collected, just not grouped this direction)
2. `sceneCues`: per-scene list of character-cue texts + their entityId when tagged, `null` when not (the walk already visits cue blocks)
3. Expose as `Rga.Nav.tagsForScene(nodeId)` / `Rga.Nav.cuesForScene(nodeId)`

Why this one: it is the foundation every consumer (nested navigator, Inspector tag list, breakdown, AI context) needs; it is testable with plain unit tests against fixtures; it cannot lie *if* its results are labeled "tagged/matched" per §8; and it touches nothing locked.

**Explicitly NOT in this slice** (each needs its own authorization): registry dedup/merge tooling · autocomplete rebuild (v3 plugin) · cue auto-linking · any navigator UI change · exact-name mention scanning (tier 2) · anything AI.

**Suggested order after it:** registry dedup (hygiene gate) → autocomplete/recognizer rebuild (stops new fragmentation) → mention scanning (tier 2) → only then nested navigator UI.

---

## 11. Open Questions (for the user / next brainstorm)

1. **Duplicate merge policy** — when NALI exists 2× (curated `ent-nali` + auto-created UUID), which survives? Proposal: curated wins; marks pointing at the loser are rewritten (`removeAllMarksForEntity` machinery already exists). Needs a decision + a slice.
2. **Case policy** — are "NALI", "Nali", "nali" the same entity? (Toolbar already matches case-insensitively; the registry doesn't enforce it.)
3. **Cue auto-linking** — should a cue whose text exactly matches a registry character be auto-linked (tier 2 → tier 1) retroactively, or only at typing time via the rebuilt recognizer?
4. **sceneHeading ↔ locations registry** — heading location text ("BABAN'S BEDROOM") and `tag_registry.locations` ("BABAN'S BEDROOM") are unlinked twins. Link them, or leave headings as pure text?
5. **Untagged mention display** — when the navigator/Inspector eventually shows per-scene entities, are tier-2 matches shown (greyed, "unconfirmed") or hidden until confirmed?
6. **flag_log scene linkage** — resolved-flag history records `flaggedText` but no scene; is that loss acceptable?
7. **Where do confirmed references persist** — `scene.attrs.metadata.references[]` (recommended, already exists) or a new mark type (more precise anchoring, but schema change)?
8. **Tags sidebar panel** — the panel the "View Tags" button points at was never built (and the Inspector per-category tag list is separately deferred). Does the nested *navigator* list supersede it, or are both wanted?

---

## Appendix — Evidence Index

- Sample registry/flag_log/body walk: this audit §2 (script run against `playground-the-last-light.rga`, 2026-06-02)
- Tag mark schema: `renderer/js/framework/base-outer-marks.js:105-125`
- Annotation / revisionFlag marks: same file, lines 68-104 / 126-157
- Scene node attrs + metadata placeholder: `schema-v3.js:89-121`, `v3-commands.js:48-66`
- nav-index derivation: `renderer/js/framework/nav-index.js:85-310`
- Tag creation (only path): `toolbar-tag.js:67-91`
- Registry CRUD: `doc.js:21-26, 293-319`
- Dead autocomplete: commits `7987d39f`, `d0c9dcc5` (scene-v2, 2026-05-16); deleted file `scene-frame-pm.js`; orphaned CSS `editor-prosemirror.css:1655-1715`; stub setting `settings-registry.js:166-170` + `editor-applicators.js:156-175`
- Dead Tags menu: `index.html:95`; unmounted panel: `plugins/tags.js:63-104`
