# RGA Memory Layer — Phase 1 Design (Scene Occurrence Foundation)

> **Design only. No code has been written.** This document is the review gate before implementation.
> Grounded in: `TAG_INTELLIGENCE_SCENE_LINKING_AUDIT.md` · Script = Session doctrine (business-model spec §10: *"every script has its own brain"*) · Core/Plugin Platform Doctrine (Laws 11, 16) · nav-index moratorium + contamination-triad moratorium (Scene Sidebar Catalogue Engineering Plan §inherited-constraints).
> Branch: `main` @ `f421b906`, single worktree. Date: 2026-06-02.

---

## 0. Framing — what "memory layer" means here

The doctrine: **.rga is the script's brain, not a file format.** A brain that cannot answer questions about itself is storage, not memory.

Phase 1 builds the **derived memory** — the read-only layer that lets the document answer questions it already implicitly knows the answers to ("who is tagged in scene 3", "which scenes has NALI been tagged in", "who speaks in scene 4"). It does **not** build the accumulated memory (persisted notes, voice memos, AI understanding — the brain that *grows*). That is a later phase with persistence implications; this phase has none.

Consumers are deliberately not the point. Navigator, Inspector, breakdowns, AI context assembly, MCP, and the Django server-side parser are all *future* readers of the same API. None of them is built or modified in this phase.

---

## 1. Correction to the audit (honesty first)

The audit's §10 ("Smallest Safe Next Slice") proposed building `tagsForScene()` / scene→entity inversion as new work. **That was partially wrong: it already exists.**

`Rga.Screenplay.SceneCatalog.byScene(sceneNodeId, idx)` — shipped 2026-05-29 as **SN-Helper-1** (commit `5ddaa8b6`, file `renderer/js/doc-types/screenplay/scene-catalog.js`, unit tests `tests/unit/doc-types/screenplay/scene-catalog.test.js`) — already returns, per scene: title, scene number, **notes[] (full detail), flags[] (full detail), characters[], props[], wardrobe[], locations[], sfx[], vfx[], vehicles[], animals[], custom[]** (the inversion of `sceneAppearances`), and page info.

It has **zero production consumers today** — it is a foundation that was built and then never consumed. Phase 1's job is therefore **smaller than the audit estimated**: adopt SceneCatalog as the core of the memory layer, fill its genuine gaps, and give it a stable memory-oriented contract.

What SceneCatalog does **not** provide (the genuine gaps):

| Gap | Why it can't be projected from the existing index |
|---|---|
| **Per-scene character cues** ("who speaks in scene 4") | nav-index counts tagged cues into a *global* `charCueCount` map — the scene dimension is discarded at walk time. Untagged cues are discarded entirely. SceneCatalog cannot invert data that was never recorded. |
| Per-scene mention **counts** ("NALI ×3 in scene 2") | Only Set-membership (`sceneAppearances`) survives the walk; per-scene counts are discarded. |
| Block context (tag in action vs dialogue vs cue) | Discarded. |
| Entity-centric API ("everything about NALI") | Data exists (`idx.characters[]`, `idx.tags`) but no accessor wraps it. |
| Coverage / honesty metrics | Never computed. |

---

## 2. Investigation answers (the mission's five questions)

### Q1 — What occurrence information already exists during nav-index traversal?

The single `doc.descendants` walk (`nav-index.js:78-252`) maintains, while walking:

| Data | Granularity | Survives into the index? |
|---|---|---|
| `currentScene` (rolling pointer to the scene being walked) | per node visit | implicitly — used to stamp backlinks |
| Scene entries (id, number, pmPos/pmEndPos, heading parts, blockCount, hasNotes, hasRevisionFlag) | per scene | ✅ `idx.scenes[]` |
| Annotation records (id, text, color, status, markedText) + scene backlink | per mark | ✅ `idx.notes[]` with `sceneNodeId` |
| revisionFlag records + scene backlink | per mark | ✅ `idx.flags[]` with `sceneNodeId` |
| `tagSceneAppearances`: entity → Set\<sceneNodeId\> | per entity | ✅ `idx.tags[type][].sceneAppearances` |
| `tagMentionCount`: entity → count | per entity (doc-global) | ✅ `mentionCount` |
| `charCueCount`: entity → count of **tagged** cues | per entity (doc-global) | ✅ `characters[].cueCount` |
| Page ↔ scene mapping | per page | ✅ `idx.pages[].sceneIds` |

### Q2 — What information is currently discarded?

At the moment the walk visits the relevant node, all of the following is **in hand and then dropped**:

1. **The scene a cue belongs to** — `charCueCount.set(id, n+1)` records no scene (nav-index.js:90-102; `currentScene` is in scope and unused there).
2. **Untagged cue text** — a `character` block whose first text has no tag mark contributes nothing (the text "NALI" is read via `_firstTextChild` and discarded).
3. **Per-scene tag-occurrence counts** — only the Set add survives.
4. **Block context** of each tag occurrence (parent block type).
5. **pmPos of each occurrence** (notes/flags keep `markedText`; tags keep nothing positional).
6. **In-scene order** of occurrences.

### Q3 — What additional scene-level structures can be produced with zero additional document storage?

All of the discarded items in Q2, plus:
- Scene→entities inversion (already produced — SceneCatalog)
- Per-scene notes/flags lists (already produced — SceneCatalog)
- Entity-centric bundles (pure projection over `idx.characters` / `idx.tags`)
- Coverage metrics: % of scenes with ≥1 tagged entity, count of cue blocks vs tagged cue blocks, entities with 0 occurrences (registry orphans like PHOTOGRAPH in the playground sample)

**Zero document storage** holds for every one of these: they are functions of the document body + registry, recomputable at any time, never persisted.

### Q4 — What future consumers would use each structure?

| Structure | Future consumers |
|---|---|
| Scene bundle (tags/notes/flags/page per scene) | Navigator nested lists · Inspector per-category list (deferred memory `project_inspector_tag_list_deferred`) · breakdown views · AI scene-context assembly ("what do we know about scene 5") · MCP scene resource (v01.5 Layer 3) · Django server-side parse (Doctrine Law 16) |
| Per-scene cues (tagged + untagged) | "Who speaks here" navigator tier · breakdown (cast-per-scene) · AI dialogue analysis · the future autocomplete/recognizer rebuild (it needs to know which cue texts are unlinked) |
| Entity bundle ("everything about NALI") | Character pages · AI character memory · registry dedup tooling (it needs to see all occurrences of both duplicates before merging) · breakdown |
| Coverage metrics | Registry-hygiene UI · the honesty labels the audit mandates ("tagged in", never "appears in") · AI confidence calibration |

### Q5 — Can the API be created without introducing a second document walk?

**Split answer — this is the design's central trade-off:**

- **Everything already collected** (scene bundles, entity bundles, coverage): **YES** — pure projection over the cached index. Zero walks. SceneCatalog proves the pattern.
- **Cue data** (the genuine gap): **NO**, not without one of:
  - **(a)** Extending nav-index's existing walk to record per-scene cues → zero marginal walks, ~5 lines inside the walk — **but violates the nav-index moratorium.**
  - **(b)** A **lazy, scene-scoped sub-walk on demand**: when `cuesForScene(sceneId)` is first called, walk only that scene's subtree (`doc.nodesBetween(scene.pmPos, scene.pmEndPos)`), memoised against `(doc reference, sceneId)`. Not a document walk — a scene walk, paid only by consumers who ask, never on the typing path. **Honors the moratorium.**

**This design recommends (b) for Phase 1** so the moratorium stays intact and no locked file is touched. (a) remains the better long-term home *if* the user decides to lift the moratorium in a future review — the design keeps the API shape identical under either implementation, so switching later is invisible to consumers.

---

## 3. Existing data flows (before this phase)

```
ProseMirror doc change (typing, etc.)
        │  tr.docChanged
        ▼
nav-index plugin (framework/nav-index.js — FROZEN by moratorium)
   single doc.descendants walk → NavigationIndex
   cached in PM plugin state; selection-only transactions reuse previous state
        │
        │ Rga.Nav.getIndex(view.state)   ← O(1) cached read
        ▼
 ┌──────────────────────────────────────────────────────────┐
 │ Consumers today                                          │
 │  · scene-navigator.js (scenes, hasNotes/hasRevisionFlag, │
 │    pages)                                                │
 │  · Outline / PageMap / decorations (internal)            │
 │  · Rga.Screenplay.SceneCatalog.byScene()  ← EXISTS,      │
 │    unit-tested, ZERO production consumers                │
 └──────────────────────────────────────────────────────────┘
```

The registry (`doc.tagRegistry`) flows into the walk via `_resolveBuildOpts()` → entity names/colors are resolved at index-build time, so the index is self-contained (consumers never touch the registry — contamination triad stays sealed).

---

## 4. Proposed API — `Rga.Screenplay.Memory`

### 4.1 Why not `Rga.Nav.*` (the mission's example naming)

`Rga.Nav` **is** nav-index — framework-owned, doc-type-agnostic, and frozen by the moratorium. The memory API is screenplay-shaped (nine tag types, cues, slugs) and therefore plugin-owned by Platform Doctrine. It belongs under `Rga.Screenplay.*`, exactly where SceneCatalog already lives. The mission's "or better if justified" clause is invoked: **`Rga.Screenplay.Memory`**.

### 4.2 Module relationship (design decision for review)

**Recommended: Option F (facade).** New file `renderer/js/doc-types/screenplay/memory.js` exposing `Rga.Screenplay.Memory`. It *delegates* scene bundles to the existing `SceneCatalog` (untouched, its tests untouched) and adds the new queries. SceneCatalog becomes an internal building block; Memory is the documented stable contract every future consumer imports.

*Alternative (Option G): extend SceneCatalog in place and alias it.* Fewer files, but bakes navigator-era naming ("Catalog") into the permanent memory contract the mission explicitly wants memory-oriented. Review may overrule.

### 4.3 The surface

```js
Rga.Screenplay.Memory = {

  // ----- scene-centric: "what does the script know about this scene?" -----

  // SceneBundle — delegates to SceneCatalog.byScene, then appends `cues`.
  // (sceneId, idx, doc?) → SceneBundle
  //   doc optional: when provided, bundle.cues is populated (lazy scene walk);
  //   when omitted, bundle.cues = null (explicitly "not derived", never []).
  scene(sceneId, idx, doc),

  // Cue[] for one scene — the genuinely new derivation.
  // (sceneId, idx, doc) → [{ text, entityId|null, entityName|null,
  //                          tier: 'tagged'|'untagged', blockIndex }]
  //   tier vocabulary comes from the audit §8 (tagged / matched / inferred);
  //   Phase 1 emits only 'tagged' and 'untagged'. 'matched'/'inferred' are
  //   reserved values for future phases — the shape will not change.
  cuesForScene(sceneId, idx, doc),

  // ----- entity-centric: "what does the script know about NALI?" -----

  // (tagType, entityId, idx) → { entityId, tagType, name, color,
  //                              mentionCount, cueCount|null, sceneIds[] }
  //   Pure projection over idx.tags / idx.characters. cueCount only for
  //   characters (null for other types — honest, not 0).
  entity(tagType, entityId, idx),

  // (idx) → { characters: EntityBundle[], props: [...], ... all 9 types }
  //   The brain's table of contents. Includes registry orphans
  //   (entities with zero occurrences — e.g. PHOTOGRAPH in the sample).
  entities(idx),

  // ----- document-centric: "how much does the script know about itself?" -----

  // (idx, doc?) → { sceneCount, scenesWithTags, scenesWithNotes,
  //                 scenesWithFlags, orphanEntities[],   // registry, 0 occurrences
  //                 cueBlocks|null, taggedCueBlocks|null } // needs doc; null without
  //   The honesty metrics the audit mandates. This is what stops future
  //   UI from presenting tier-1 data as complete truth.
  coverage(idx, doc)
};
```

**Signature convention:** every function takes `idx` explicitly (and `doc` where scene walking is needed). No function resolves `TabManager` / active view internally — the memory layer stays pure and testable, exactly like SceneCatalog. Convenience auto-resolution is a consumer concern (or a one-line helper added when the first real consumer lands — not speculatively now).

**Stability rules** (inherited from nav-index §"Stability rules" and restated as contract):
- `sceneId` / `entityId` — stable across edits; safe to hold.
- Everything else in a returned bundle — a snapshot of the index it was derived from; holding it across doc changes is a consumer bug.
- All returns are freshly allocated; mutating them never reaches back into the index (SceneCatalog's existing guarantee, extended to all Memory functions).

### 4.4 What Phase 1 explicitly does NOT include

| Excluded | Where it goes instead |
|---|---|
| Tier-2 "matched" mentions (untagged name text-scanning) | Future phase; the `tier` field reserves the slot |
| Pronoun/referral anything | Future phase (audit §9); `scene.attrs.metadata.references` placeholder stays untouched |
| Registry dedup/merge | Its own slice (audit §11 Q1) — Memory will *serve* it (entity bundles show both duplicates), not perform it |
| Memoisation infrastructure beyond cue-walk caching | Added when a hot consumer exists, not speculatively |
| Any persistence, any schema change, any UI, any navigator/editor/autocomplete/AI/breakdown work | Out of scope by mission rule |

---

## 5. Ownership boundaries

| Surface | Phase 1 action | Moratorium status |
|---|---|---|
| `framework/nav-index.js` | **Untouched** | nav-index moratorium **honored** |
| `Rga.Doc.tagRegistry` / `addEntity` / `schema.marks.tag` | **Untouched** (Memory never reads the registry directly — only the index's resolved copies) | contamination triad **honored** |
| `doc-types/screenplay/scene-catalog.js` + its tests | **Untouched** (delegated to) | — |
| `doc-types/screenplay/memory.js` | **NEW** — the only new production file | plugin-owned per Platform Doctrine ✅ |
| `tests/unit/doc-types/screenplay/memory.test.js` | **NEW** | — |
| Scene Navigator / Inspector / editor / toolbar | **Untouched** | — |
| `.rga` format / schema-v3 / migrations | **Untouched** | schema LOCKED — honored |

One sentence to keep in the implementation commit message: *"Memory reads the index; it never reads the document's registry and never writes anything."*

---

## 6. Future consumers (who reads this, later)

1. **Scene Navigator nested lists** — gated on design (Reading A/B decision) + the honesty-label rule; consumes `Memory.scene()`.
2. **Inspector per-category tag list** (`project_inspector_tag_list_deferred`) — consumes `Memory.entities()`.
3. **Breakdown views** — consumes `Memory.scene()` + `Memory.coverage()` (and is blocked on tier-2 coverage before it can claim completeness).
4. **AI context assembly (script brain reads)** — "what's in scene 5" / "tell me about NALI" map 1:1 to `Memory.scene()` / `Memory.entity()`. This is the v01 AI lane's data dependency.
5. **MCP resources (v01.5, Layer 3)** — an MCP `scene://` or `entity://` resource is a thin serialization of these bundles.
6. **Django server-side parsing** (Doctrine Law 16) — the same derivation logic, ported; keeping Memory pure (no DOM, no TabManager) is what makes that port mechanical.
7. **Registry dedup tooling** — needs `Memory.entity()` for both duplicates before a merge.
8. **Production scheduling** (far future) — scenes × characters × locations matrices come straight from these bundles.

---

## 7. Performance implications

| Path | Cost added by Phase 1 |
|---|---|
| **Typing / doc changes** (the hot path) | **Zero.** nav-index is untouched; its per-keystroke walk is unchanged. |
| `Memory.scene()` without `doc` | Identical to today's `SceneCatalog.byScene`: O(notes + flags + entities + pages) per call — sub-millisecond on a 60-scene script (measured estimate in SceneCatalog header). |
| `Memory.cuesForScene()` / `scene()` with `doc` | O(size of that one scene) on first call; memoised per `(doc, sceneId)` so repeat calls are O(1). A scene is typically 10–60 blocks — microseconds. Worst case (consumer asks for every scene): equivalent to ~one extra doc walk, **paid only when a consumer asks, never on the typing path.** |
| `Memory.entities()` / `coverage()` | O(total entities) / O(scenes + entities) per call. |
| Memory footprint | Bundles are small copies; the cue memo cache is keyed by doc reference so it self-invalidates when the doc changes (old doc reference → old cache entry becomes unreachable, GC collects). |

If a future consumer renders all-scenes bundles on every index tick (e.g., a nested navigator), memoisation against `idx` identity is the named follow-up — explicitly deferred until that consumer exists.

---

## 8. Test strategy

Two layers, both pure Node/JSDOM unit tests (no Electron, no Playwright — there is no UI):

1. **Synthetic-index tests** (mirror `scene-catalog.test.js` pattern): hand-built `idx` objects covering — empty index, scene not found, entities across multiple types, notes/flags filtering, non-mutation guarantee, freshly-allocated returns, `cues: null` vs `[]` distinction, tier values.

2. **Fixture ground-truth tests** against `playground-the-last-light.rga` (build a real index from the real doc via `Rga.Nav.buildIndex` + the real schema). The audit's findings become executable assertions — these tests *are* the honesty documentation:
   - `Memory.entity('character', 'ent-nali')` → sceneIds = [scene-003, scene-005] (tagged only — NOT all 5)
   - `Memory.entity('character', '15201fa6-…')` → sceneIds = [scene-002] (the duplicate-identity problem, asserted as it is)
   - `Memory.scene('scene-004')` → characters: [] but cues: 4 entries, all `tier: 'untagged'` (the gap made visible)
   - `Memory.entities()` → PHOTOGRAPH present with sceneIds: [] (registry orphan)
   - `Memory.coverage()` → cueBlocks: 8, taggedCueBlocks: 2

Per the owned-tests doctrine: this slice runs its own new tests + `scene-catalog.test.js` + `nav-index` tests (immediate neighbors). Full suite not required for a pure-addition slice.

---

## 9. Migration impact

**None.**
- No `.rga` field added, removed, or reinterpreted → files written before/after Phase 1 are byte-identical in meaning.
- No schema change → no migration step, no version bump.
- No existing module modified → no behavior change for any current consumer.
- Rollback = delete two files.

---

## 10. Decision points for review (answer these to authorize implementation)

| # | Decision | Recommendation |
|---|---|---|
| 1 | **Cue derivation strategy**: (b) lazy scene-scoped walk in Memory (moratorium intact) vs (a) extend nav-index's walk (moratorium lift required) | **(b)** — API shape is identical either way; (a) can be revisited when the moratorium itself is reviewed |
| 2 | **Module shape**: Option F facade (`memory.js` delegating to SceneCatalog) vs Option G (extend SceneCatalog in place) | **F** — memory-oriented contract name, zero churn to shipped code |
| 3 | **Namespace**: `Rga.Screenplay.Memory` vs the mission's `Rga.Nav.*` examples | **`Rga.Screenplay.Memory`** — Nav is frozen framework; memory is plugin-owned screenplay vocabulary |
| 4 | Does `coverage()` belong in Phase 1, or is it scope creep? | Include — it is small, pure, and it operationalizes the audit's honesty mandate; but it is the easiest cut if review wants a smaller slice |
| 5 | Should `Memory.scene()` exist at all, or should consumers call `SceneCatalog.byScene` + `Memory.cuesForScene` separately? | Keep `Memory.scene()` — one entry point for "everything about scene X" is the doctrine's point |

---

## 11. Stop

This document is the deliverable. No code has been written, no files outside this document created, nothing committed. Implementation begins only after this design is reviewed and the §10 decisions are answered.
