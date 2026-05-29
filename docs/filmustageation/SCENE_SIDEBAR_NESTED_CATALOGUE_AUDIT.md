# Filmustageation — Scene Sidebar Nested Catalogue — Correction Audit

> **Audit only. No implementation, no code edits, no schema changes, no nav-index modifications.**
> Created: 2026-05-29 · HEAD: `d086bee6` (origin/main in sync) · Trigger: user-flagged correction after SN-Bundle-1 (`d086bee6`) shipped flat-list improvements rather than a nested Filmustage-style catalogue.
> Inputs read in full: designer UX Direction, engineering plan, Phase 0 spec, post-F1A review.
> Code grounded against: `renderer/js/framework/nav-index.js` (538 lines), `renderer/js/doc.js` (`tagRegistry` + `addEntity`), `renderer/js/doc-types/screenplay/plugins/tags.js` (`applyTag` / `removeTag` + tag-mark contract), `renderer/js/doc-types/screenplay/scene-notes.js` (`Rga.SceneNotes` in-memory store), `renderer/js/doc-types/screenplay/inspector-scene-notes.js` (inspector panel), `renderer/js/shell/panels/scene-navigator.js` (post-SN-Bundle-1 navigator).

This audit responds to the user's correction signal: the Scene Sidebar Catalogue arc (SN.1 → SN.2 → SN-Bundle-1) has shipped four iterations of presentation polish + behaviour on a **flat scene list**. A Filmustage-style sidebar presents scenes as **nested parent rows** whose children are the scene's notes, revisions, characters, props, locations, and other production-tagged entities. The shipped Rwanga sidebar does not yet do this — and a critical, non-obvious finding is that **the designer's UX Direction explicitly routes that nested-entity content OUT of the writing catalogue and INTO the inspector + a deferred breakdown mode.** The data the nested view would need is mostly available today; the UX-direction conflict is the harder gating concern.

The audit answers the brief's six required questions in order, then closes with the requested punch list.

---

## 1. What scene-level data exists today

For each question the brief asked, here is the actual state, grounded in current code.

| Question | Available? | Source | Cost per scene | Notes |
|---|---|---|---|---|
| **Which inline notes (annotations) belong to scene S?** | **Yes, persisted in .rga** | `Rga.Nav.getIndex(state).notes[]`, each entry has `{ id, color, text, status, sceneNodeId, sceneNumber, markedText }`. `nav-index.js:109–122` walks `annotation` marks during the scene walk and links each to the currently-walked scene. | O(N notes) per query; trivially cacheable into `Map<sceneNodeId, Note[]>` once per render. | These are the highlighted-span annotations the writer drops inline with the `Note` toolbar button. Persisted as PM marks in the `.rga` file. |
| **Which scene-level note (free-text textarea) belongs to scene S?** | **Yes BUT in-memory only** | `Rga.SceneNotes.get(sceneId)` returns the inspector textarea's value. `scene-notes.js:42–45` declares "In-memory only at v1; future slice may bridge to the screenplay doc-type's .rga serialization." `nav-index.js:199` also reads `sceneNode.attrs.notes` — a PM scene attribute that is **schema-allocated but currently unwritten** by any production code (only schema migrations touch it). | O(1) | **Persistence gap.** The inspector textarea writes only to `Rga.SceneNotes._notes` in JS memory — it does not write to the scene node's `attrs.notes`. Reloading the `.rga` clears the textarea. This is documented as a known v1 limitation in `scene-notes.js`. |
| **Which inline revision flags belong to scene S?** | **Yes, persisted in .rga** | `Rga.Nav.getIndex(state).flags[]` shape: `{ id, color, reason, status, sceneNodeId, sceneNumber, markedText }`. Built by the same walk that builds `.notes`. | Same as notes. | Persisted as PM `revisionFlag` marks. |
| **Which scene-level revision flag belongs to scene S?** | **Schema-allocated but unwritten in production code** | `sceneNode.attrs.revisionFlag` is read by `nav-index.js:200` to set `hasRevisionFlag`. Production code does not write it today (only schema migrations). | O(1) | Same persistence-gap class as scene-level notes. |
| **Which characters appear in scene S?** | **Yes, persisted in .rga (via tag marks)** | Computed during the nav-index walk: `tagSceneAppearances` (`nav-index.js:71`) tracks `Map<'tagType:entityId', Set<sceneNodeId>>` and is composed onto `idx.characters[i].sceneAppearances: string[]` (line 298, 303). The **inverse projection (scene → characters)** is NOT materialised — it must be derived: `idx.characters.filter(c => c.sceneAppearances.includes(S))`. | O(N entities) per (scene × tagType) per query → cacheable into `Map<sceneNodeId, Character[]>` once per render at total O(E × T). For a typical screenplay with ~50 characters this is sub-millisecond. | The character cue count (`cueCount`) is also pre-computed per character. |
| **Which props / wardrobe / locations / SFX / VFX / vehicles / animals / custom appear in scene S?** | **Yes, persisted in .rga (via tag marks)** | Same shape: `idx.tags[type][i].sceneAppearances` for every `type ∈ TAG_TYPES`. `TAG_TYPES = ['character', 'prop', 'wardrobe', 'location', 'sfx', 'vfx', 'vehicle', 'animal', 'custom']` (`nav-index.js:48`). | Same as characters. | The reverse-projection helper would be a single O(E × T) walk producing `Map<sceneNodeId, Map<tagType, Entity[]>>`. |
| **Page start per scene?** | **Yes** | `idx.pages[].sceneIds` already used by scene-navigator's `_pageNumberForScene` helper. | O(P) per scene → invertible to O(1) via `Map<sceneNodeId, pageNumber>`. | The page badge `p.N` is already shown in the row today. |
| **Scene duration (eighths)?** | **NO — not available** | `nav-index.js` does not compute eighths-per-scene. PageMap is at the page-level, not the scene-level. | Cannot be answered without nav-index repair + a page-eighths math model. | Engineering plan §5 S8 named this as deferred. The Doctrine Risk #2 / nav-index moratorium forbids the repair today. |
| **`blockCount` per scene?** | **Yes, but discouraged** | `idx.scenes[i].blockCount` is on every entry (`nav-index.js:184, 198`). | O(1) | UX Direction §3 Tier-below-the-line forbids exposing blockCount in the row — "internal data, no writer value." Available but should not be displayed. |
| **Transitions (e.g., "CUT TO:") per scene?** | **Yes, but discouraged** | `idx.scenes[i].transitionDisplay` + `.transitionPresetType`. | O(1) | UX Direction §3 routes transitions to inspector, not row chrome. |

**Classification summary (per brief §1 rubric):**

- **Available now (persisted, projectable in <1 ms per scene)**: inline annotations, inline revision flags, characters/props/wardrobe/locations/sfx/vfx/vehicles/animals/custom entities, page-start.
- **Available globally but not per scene by default**: tags-by-scene reverse projection (needs a one-shot helper at render time — exactly the gap the brief §3 names).
- **Inferable but expensive/risky**: nothing — all the data is already in the index.
- **Not available**: scene-level notes persistence (in-memory only, would lose-on-reload), scene-level revision flag persistence (same), scene duration in eighths.
- **Blocked by nav-index/data model moratorium**: scene duration (requires new compute), per-scene tag-mention summaries beyond entity-presence (also possible to derive client-side from existing `mentionCount` × `sceneAppearances` but the writer-value is low), act/sequence partitioning (no act node type today).

---

## 2. What nav-index already exposes (read-only inspection)

`renderer/js/framework/nav-index.js` (538 lines) builds a single `NavigationIndex` per PM state via a PM plugin keyed by `'rga-scene-index'`. Consumers read via `Rga.Nav.getIndex(state)`.

### 2.1 Existing fields on the index

```text
NavigationIndex {
  scenes:     [ { nodeId, sceneNumber, pmPos, pmEndPos,
                  headingDisplay, setting, locationText, time,
                  transitionDisplay, transitionPresetType,
                  blockCount, hasNotes, hasRevisionFlag } ],

  characters: [ { nodeId, name, color, cueCount,
                  mentionCount, sceneAppearances: string[] } ],

  tags: {
    character: Entity[],  prop: Entity[],   wardrobe: Entity[],
    location:  Entity[],  sfx:  Entity[],   vfx:      Entity[],
    vehicle:   Entity[],  animal: Entity[], custom:   Entity[]
  },

  pages:      [ { pageNumber, sceneIds: string[], ... } ],
  notes:      [ { id, color, text, status, sceneNodeId, sceneNumber, markedText } ],
  flags:      [ { id, color, reason, status, sceneNodeId, sceneNumber, markedText } ],
  byPos:      Map<pmPos, sceneNumber>,
  byId:       Map<nodeId, sceneNumber>
}

Entity = { nodeId, name, color, mentionCount, sceneAppearances: string[] }
        // (nodeId here is actually the entityId — confusing field name)
```

### 2.2 Missing fields a nested view would want

The only field a Filmustage-style nested catalogue truly LACKS is the **inverse projection** `Map<sceneNodeId, ByScene>` where:

```text
ByScene = {
  notes:    Note[],
  flags:    Flag[],
  page:     number | null,
  tags: {
    character: Entity[],  prop: Entity[],   wardrobe: Entity[],
    location:  Entity[],  sfx:  Entity[],   vfx:      Entity[],
    vehicle:   Entity[],  animal: Entity[], custom:   Entity[]
  }
}
```

This is **client-side derivable** in a single pass without modifying nav-index. The cost is O(N_notes + N_flags + N_pages + E × T) — for a typical 60-scene screenplay with 50 entities across 9 tagTypes this is comfortably sub-millisecond and easily memoised against `view.state` identity.

### 2.3 Existing consumers (the moratorium-relevant population)

`Rga.Nav.getIndex` is consumed by:

| Consumer | What it reads | Read-only? |
|---|---|---|
| `shell/panels/scene-navigator.js` | `idx.scenes[]`, `idx.pages[].sceneIds` for page hint | Read-only |
| `shell/panels/outline.js` | `idx.scenes`, `idx.characters` for the outline sections | Read-only |
| `doc-types/screenplay/status-bar.js` | `idx` for `scene` + `page` status segments | Read-only |
| `shell/script-session.js` | derives `currentScene` from index + selection | Read-only |
| `framework/document-outline.js` | composes outline-shape from same data | Read-only |
| Plugin state itself | rebuilds on every doc change | Owns the cache |

A **sixth read-only consumer** for the inverse projection would not change any existing surface's expectations — it would only widen the read-surface area. **No mutation, no schema change, no contract change.**

### 2.4 Risk of changing nav-index

The post-F1A review §1.5 (`framework/nav-index.js — 64 hits. Hub indexer with { scenes, characters, pages }`) and the Phase 0 spec §4.4 both place `nav-index.js` under the **highest-risk un-touched** classification — it is the screenplay-shaped four-consumer hub whose neutralisation is engineering investigation, not a slice. The post-F1A review §6 puts contract-test-pin work (Option E) as the prerequisite before any nav-index repair.

**This audit honours that constraint by recommending no modification to nav-index.** Any helper this audit proposes lives outside the framework folder and is a pure-read function.

---

## 3. Tag / entity storage (the contamination triad in detail)

### 3.1 Where entity names live

Entity records (the human-readable names like `JOHN`, `KNIFE`, `ROOFTOP`) live in `doc.tagRegistry` — a fixed-key map of arrays:

```text
doc.tagRegistry = {
  characters: [ { id, name, color, notes } ],   // tagType: 'character'
  props:      [ { id, name, color, notes } ],   // tagType: 'prop'
  wardrobe:   [ ... ],                          // tagType: 'wardrobe'
  locations:  [ ... ],                          // tagType: 'location'
  sfx:        [ ... ],
  vfx:        [ ... ],
  vehicles:   [ ... ],
  animals:    [ ... ],
  custom:     [ ... ]
}
```

Note the **plural-key / singular-tagType mismatch** handled by `Rga.Doc._registryKey` and mirrored in `nav-index.js:REGISTRY_KEY` (`character → characters`, `prop → props`, etc.).

### 3.2 How entity IDs map back to scene ranges

The mapping is **already computed** inside the nav-index walk:

1. `nav-index.js:71` declares `const tagSceneAppearances = new Map();` — keyed `'tagType:entityId' → Set<sceneNodeId>`.
2. `nav-index.js:137–147` adds to it for every `tag`-mark hit during the per-text-node walk: `tagSceneAppearances.get('character:abc').add('scene-1')`.
3. `nav-index.js:298–306` composes it onto each entity entry: `entry.sceneAppearances = Array.from(scenes)`.

So when the navigator wants "characters in scene S", it can do:

```js
idx.tags.character.filter(c => c.sceneAppearances.includes(S))
```

And get an array of `{nodeId (entityId), name, color, mentionCount, sceneAppearances}` records — names and colors already resolved.

### 3.3 Tag marks vs tag registry — two separate persistence layers

A clean nested view has to understand the split:

| Layer | What it stores | Lives in | Persisted? |
|---|---|---|---|
| **Tag mark** | Per-text-span `{tagType, entityId}` mark on PM text | PM document (`scenes/.../action/text` with `tag` mark) | Yes, in `.rga` `body.content` |
| **Tag registry** | `{id, name, color, notes}` entity records | `doc.tagRegistry` (top-level doc field) | Yes, in `.rga` `tag_registry` |

The mark establishes "this span of text refers to entity X of type T"; the registry stores "entity X of type T is named JOHN and has color #4488ff." Both must exist for nav-index to compose `Entity.name` — if either is missing, the entry shows up with `name: null` (line 295).

### 3.4 Can scene-level aggregation be computed without schema changes?

**Yes.** The inverse projection helper is pure read against the existing `idx.tags` shape + `idx.notes` + `idx.flags` + `idx.pages`. No schema change, no mark change, no nav-index change. Cost is O(E × T + N + F + P) per memoisation cycle.

### 3.5 The contamination-triad relevance

The post-F1A review §4 ("Newly exposed") names three contamination surfaces that became prominent after F1A.7 moved the tag dropdown into the plugin:

- `Rga.Doc.tagRegistry` (hard-coded production keys)
- `Rga.Doc.addEntity` (CORE primitive with screenplay-coupled registry shape)
- `schema.marks.tag` (in CORE schema but conceptually plugin-owned)

A nested catalogue that **reads** entity names from `tagRegistry` and groups by `tagType` ('character', 'prop', ...) is a **deeper read consumer** of all three. It does not mutate them, but it surfaces the contamination contractually — every entity row the navigator renders is a window into the screenplay-shaped registry shape.

This is **not a moratorium violation** (the moratorium is about mutating these surfaces), but it does sharpen the eventual neutralisation cost. A second doc-type with a different entity vocabulary would inherit a sidebar UI that knows nine fixed tag types by name.

---

## 4. Feasible nested sidebar shape with available data

A V1 nested catalogue, grounded only in available data and read-only against nav-index, could look like:

```text
▼ 12  INT. HOUSE — NIGHT                      ✎ ⚑  p.3
      ├ Notes (2)
      │  ├ "Watch the eye-line here" — Sara enters
      │  └ "Pickup needed" — over the kitchen counter
      ├ Revisions (1)
      │  └ blue · Page action beat rewritten
      ├ Characters (3)
      │  ├ ● JOHN
      │  ├ ● SARA
      │  └ ● PRIEST
      ├ Props (2)
      │  ├ ● KNIFE
      │  └ ● LETTER
      ├ Locations (1)
      │  └ ● KITCHEN
      └ SFX (1)
         └ ● THUNDER
```

The chevron + indent are scope-able; the colored dot before each entity uses the entity's registry `color`; counts in parentheses come from `length`. Categories with zero entries are omitted (`Characters (0)` is noise — Tier-3 hierarchy from UX Direction §3 says only show what's present).

### 4.1 Per-section feasibility classification (per brief §4 rubric)

| Section | Source data | Classification | Notes |
|---|---|---|---|
| **Scene parent row** (current navigator row) | `idx.scenes[i]` | **Safe now** | Already exists; just needs an expand affordance + ARIA tree semantics. |
| **Notes (count + list)** | `idx.notes.filter(n => n.sceneNodeId === S)` | **Safe with small helper** | Each note has `markedText` for display. Persisted. |
| **Revisions (count + list)** | `idx.flags.filter(f => f.sceneNodeId === S)` | **Safe with small helper** | Each flag has `color` + `reason` + `markedText`. Persisted. |
| **Characters / Props / Wardrobe / Locations / SFX / VFX / Vehicles / Animals / Custom** (per-type child group) | `idx.tags[type].filter(e => e.sceneAppearances.includes(S))` | **Safe with small helper** | Names resolved against `doc.tagRegistry` already; reverse-projection helper is a single O(E × T) walk per render. |
| **Page** | `idx.pages[].sceneIds.indexOf(S) >= 0 → idx.pages[].pageNumber` | **Safe now** | Already rendered as `p.N` badge today; could move to a child row. |
| **Scene-level note (textarea text)** | `Rga.SceneNotes.get(S)` | **Unsafe until persistence is wired** | In-memory only; would silently lose data on reload. Surfacing in a sidebar would mislead writers about durability. |
| **Scene-level revision flag** | `sceneNode.attrs.revisionFlag` (currently never written) | **Unsafe until production code writes the attr** | Schema-allocated but no production writer. The data path doesn't exist yet. |
| **Tag-mention counts per scene** (e.g., "John ×7") | `entity.mentionCount × sceneAppearances` — would need a per-(scene, entity) breakdown | **Inferable but unsafe (writer-value low)** | `mentionCount` is a global per-entity total, not per-(scene, entity). Computing per-scene mention counts requires a second walk or extending the index. UX Direction §3 Tier-below-the-line also forbids counts in chrome. |
| **Scene duration in eighths** | None | **Blocked by nav-index moratorium** | Engineering plan S8. |
| **Act / sequence grouping above scenes** | None | **Blocked by nav-index + schema** | Engineering plan S10. |
| **Dialogue lines / cues per character per scene** | Walkable but expensive (PM doc walk per row) | **Inferable but expensive/risky** | Cue counts exist globally (`character.cueCount`) but not per-(scene, character). Per-scene cue counts require a per-row PM walk — O(B) per row at render time. |

### 4.2 The inverse-projection helper (no code, just the shape)

A new module `renderer/js/doc-types/screenplay/scene-catalog.js` (or similar — exact location is a designer-ratification decision) could expose:

```text
Rga.Screenplay.SceneCatalog.byScene(idx) → Map<sceneNodeId, {
  notes:    Note[],
  flags:    Flag[],
  page:     number | null,
  tags: {
    character: Entity[], prop: Entity[], wardrobe: Entity[],
    location: Entity[],  sfx: Entity[],  vfx: Entity[],
    vehicle: Entity[],   animal: Entity[], custom: Entity[]
  }
}>
```

Memoised against `idx` identity (the PM plugin already gives `idx` a stable reference per PM state). One walk per state change. Pure-read against nav-index, no mutation. Lives in `doc-types/screenplay/` because the tag-type list is screenplay-shaped.

This is the helper option **C** from the brief's §6 recommendation list.

---

## 5. What should remain flat (no nesting)

Per the same data audit + UX Direction discipline:

- **Setting / time-of-day modifiers** (today inside `headingDisplay`) stay inline in the parent row. Not a sub-row. UX Direction §3 Tier-2 places these under the heading, not separate.
- **Page hint `p.N`**. Whether it stays as today's right-aligned chip or moves to a child row is a designer call (UX Direction §3 Tier-3); it does NOT need a nesting layer of its own.
- **`hasNotes` / `hasRevisionFlag` presence marks (SN.2 Lucide)** stay on the parent row as awareness signals, NOT as child placeholders. They are *that there is something*; the child rows would be *what those things are*. The two layers coexist; the marks are not redundant — they tell the user the child section exists.
- **`blockCount`, transition labels, `mentionCount` per entity, character cue counts**. UX Direction §3 below-the-line + Phase 0 §3 — these are inventory texture, not navigation. They stay out of the catalogue entirely (UX Direction §15 routes them to inspector if anywhere).
- **Cross-scene filtering, "all night exteriors," tag-faceted search**. UX Direction §10 + §16 — these are *breakdown queries*, belong in a deferred breakdown mode, NOT in the writing catalogue's nesting layer.
- **Status flags, completion checkboxes, assignment chips, color-by-status**. UX Direction §14 — explicit non-goals for the writing catalogue.
- **In-row entity actions** ("remove this character from scene", "tag X also as Y"). These are entity-management verbs and belong in breakdown mode or right-click context menus, not in expanded child rows.

The point of nesting is **read-only awareness** of what is in each scene. Anything beyond read-only is dashboard creep and must be refused.

---

## 6. The audit's central finding — designer-direction conflict

This is the audit finding the brief did not explicitly ask for but that materially shapes the recommendation. The user's "Filmustage-style nested catalogue" framing **directly contradicts the designer's UX Direction §15 and §16** — and the contradiction was not just implicit, it was named.

### 6.1 What the designer explicitly routed AWAY from the writing catalogue

**UX Direction §15 — "What Belongs in the Inspector Instead":**
> "The catalogue answers 'which scene, and where am I?' The inspector answers 'what's inside *this* scene?' That division is the cleanest test for where a feature goes."
>
> Route to the inspector:
> - Notes content
> - **Tagged entities for the scene — the characters, props, locations, wardrobe, SFX appearing in the selected scene (a future scene-detail inspector panel).**
> - Revision history
> - Scene-level metadata editing
> - Scene-level AI observations
> - Estimated duration

**UX Direction §16 — "What Belongs in Breakdown Mode Instead":**
> "The category accordion from the screenshot — `CAST (5)`, `EXTRAS (1)`, `PROPS (8)`, `SET DRESSING (3)`, `STUNTS (14)`, `SOUND (4)`, etc. This is the literal admin panel; it is production inventory and it is the reason the writing sidebar must default to the *scene catalogue*, not this."

The user's brief calls for nested rows that mirror the Filmustage category accordion (`Characters`, `Props`, `Wardrobe`, etc. as children of each scene) — which is **structurally identical** to the `CAST (5) / PROPS (8) / STUNTS (14)` admin pattern the designer named as the anti-pattern that must NOT colonise the writing sidebar.

### 6.2 Two reconcilable readings of the conflict

**Reading A — the designer is right; the inspector is the surface.** Per UX Direction §15, the right next slice is **not more sidebar work** — it is a Phase 0 for the inspector's deferred scene-detail panel. The sidebar stays flat (which is what UX Direction calls for); the inspector becomes the depth surface. SN-Bundle-1 was on-direction; the perceived gap is in the inspector, which has only one consumer (Scene Notes from F1A.5).

**Reading B — the user overrides the designer.** The user's correction is a deliberate override of UX Direction §15/§16. They want the writing sidebar to absorb the breakdown-mode pattern. This is a legitimate user-side decision but it materially changes the surface's identity (from "session-awareness navigation" to "production inventory + navigation") and contradicts the Doctrine's "writer-first, anti-admin-panel" principle the designer wrote against.

Neither reading is automatically right. The user is the decision-maker; the designer's call is direction, not law. **But shipping nested rows without explicitly resolving this conflict means building against contradictory written direction, which is precisely the failure mode the locked-doctrines memory (`project_settings_constitution`) warns against.**

### 6.3 The conflict also relevant for: where the inspector belongs

If the right answer is Reading A, then the SN-Bundle-1 + SN.1 + SN.2 work is in fact on-direction and the next slice is at a different surface (inspector). This makes the user's "we mistakenly improved the wrong thing" framing partially incorrect — the work was on-direction; the gap is at a sibling surface.

If the right answer is Reading B, the user is correct that the navigator iteration was too shallow, and the right next slice is in the navigator — but it requires explicit re-direction from the designer (or explicit user authorisation to override) before any nested-row code lands.

The audit cannot pick which reading is right. It can only surface that the choice has to be made.

---

## 7. Recommended next implementation path

Per the brief's §6 choice between A / B / C / D / E:

### Recommendation: **D — Pause and redesign with designer**, with **C — build the aggregation helper** as a low-risk parallel step that unblocks both reconciled paths.

### Why D first

1. **The data is largely available** (§1, §3). The blocker is not engineering; it is UX direction.
2. **The UX-direction conflict is real and named** (§6). Shipping nested rows without resolving it puts implementation ahead of design intent — exactly the failure mode the user's slice briefs have consistently guarded against ("NO visual invention beyond designer direction" appears in every implementation brief since SN.2).
3. **Two reconcilable answers exist** (§6.2): inspector-side nesting (designer-on-direction) vs sidebar-side nesting (user-override). They imply different next surfaces, different files, different test scope. Picking one without the designer wastes a slice if they reverse it.
4. **The user's correction signal is itself useful design input** — the user has lived with the flat catalogue and found it insufficient. That feedback should be surfaced to the designer, who can then either ratify Reading B (override §15/§16 explicitly, with new guidance for nested-row anatomy) or rebut it (explain why the inspector is still the right answer).

### Why C as a parallel low-risk step

The inverse projection helper (`SceneCatalog.byScene(idx)`) is needed regardless of which reading wins:

- **Reading A (inspector wins)**: the inspector's scene-detail panel will need exactly the same per-scene tags grouping. The helper unblocks it.
- **Reading B (sidebar nests)**: the helper feeds the navigator's nested-row render.

Building it now as a no-UI prerequisite slice (`SN-Helper-1` — scene-catalog aggregation, with unit tests but no visible change) is purely additive: it touches no existing surface, ships no new chrome, lands under `doc-types/screenplay/`, honours the nav-index moratorium (pure read), and exposes a stable API that both downstream paths can consume. **Risk: very low.** **Designer-blocking: no.**

### Why not the alternatives

- **A — Implement nested V1 now**: directly contradicts UX Direction §15/§16. Even if the data permits it, the doctrine-level conflict means shipping it would introduce a direction-vs-implementation split that costs more to unwind than to surface now. Reject.
- **B — Notes + revisions only (half-step)**: half-honours the conflict. UX Direction §15 routes notes content to inspector too. Doing notes + revisions in the sidebar doesn't dodge the UX-direction conflict — it just makes it smaller. Reject.
- **E — Do not proceed yet, data model not ready**: this is wrong on the data model. The model **is** ready (§1, §3). The gap is direction, not data. Reject (with the caveat that if the designer ratifies Reading B, a later slice may surface a NEW gap in scene-level notes persistence — see §1 row 2 — which would be a small, scoped engineering task, not a moratorium violation).

### What "D + C" looks like in practice

1. **Surface this audit to the user.** Let them decide between Reading A (inspector path) and Reading B (override §15/§16 for the sidebar).
2. **In parallel (or immediately after the decision)**: authorise `SN-Helper-1` — a no-UI slice that introduces `Rga.Screenplay.SceneCatalog.byScene(idx)`, memoised against the nav-index reference, with unit tests covering: every persisted note / flag is correctly attached to its scene; every tag-type's entities are correctly filtered by `sceneAppearances`; entity names are resolved against `tagRegistry`; the page-number lookup is correct; the projection is empty for scenes with no entities (no spurious empty arrays). **No visible UI change; no shell.css edits; no scene-navigator.js edits.**
3. **Once the designer (or user-override) ratifies the surface**: the next slice consumes the helper to render the nested view in the chosen surface (inspector or sidebar). That slice gets its own brief, its own designer-input list, and its own Playwright spec.

This sequence respects the locked phase order (the user's memory `project_settings_to_alive_phase_order` is for Settings → RTL → Alive App; this arc is a side-arc with its own gating) and the slice rhythm the user has been driving since F1A.

---

# Required closing punch list

## 1. What we mistakenly improved instead

We delivered four iterations on a **flat scene-row list** (SN.1 auto-scroll, SN.2 Lucide indicators, SN-Bundle-1 header + empty-state + find/filter), each on-direction per the designer's UX Direction document — but the designer's direction itself **rejected** the nested-row paradigm the user is now asking for. The four iterations refined the writing-first navigator surface; they did not deliver (and were not designed to deliver) Filmustage-style nested production inventory under each scene. The user's correction signal is half-right: the navigator did stay flat; the un-asked question is whether the navigator was supposed to.

## 2. What a Filmustage-style sidebar actually requires

- **A scene parent row** with an expand affordance (chevron), ARIA-tree semantics, and a stable scene identifier.
- **Per-scene child sections** for: inline notes (count + list), inline revision flags (count + list), and one collapsible group per tagType (Characters / Props / Wardrobe / Locations / SFX / VFX / Vehicles / Animals / Custom) showing only types with ≥1 entity.
- **Per-entity child rows** showing entity name + color dot + (optional) per-scene mention count.
- **A page-position child** (or kept inline in the parent row).
- **A reverse projection helper** turning `nav-index`'s entity-keyed `sceneAppearances` into a scene-keyed bundle.
- **A persistence story** for the scene-level note textarea (currently in-memory only — would silently lose data on reload if surfaced as a sidebar count).
- **Designer ratification** that this paradigm is intended for the writing sidebar (which today's UX Direction explicitly forbids) OR a re-routing to the inspector (which UX Direction §15 explicitly calls for).

## 3. Available data today (summary)

**Available, persisted, projectable in <1 ms per scene:**
- inline annotation notes per scene (`idx.notes` + `sceneNodeId`)
- inline revision flags per scene (`idx.flags` + `sceneNodeId`)
- characters / props / wardrobe / locations / sfx / vfx / vehicles / animals / custom **per scene** (`idx.tags[type][i].sceneAppearances`, with entity names resolved against `doc.tagRegistry`)
- page-start per scene (`idx.pages[].sceneIds`)
- `hasNotes` / `hasRevisionFlag` presence flags per scene

**Available globally but needing a reverse projection helper:**
- per-(scene, tagType) entity bundle (the helper from §4.2)

**Available but discouraged by UX Direction:**
- `blockCount`, `transitionDisplay`, `transitionPresetType` (UX Direction §3 Tier-below-the-line)

**Available but currently non-persisting:**
- scene-level note textarea text (`Rga.SceneNotes._notes` — in-memory only at v1)
- scene-level `attrs.revisionFlag` (schema-allocated, never written by production code)

**Not available; blocked by nav-index moratorium:**
- scene duration in eighths
- per-(scene, entity) mention count
- act / sequence grouping

## 4. Biggest data gap

**Scene-level notes persistence**, not the tag-aggregation helper.

If the chosen path (Reading A or B) wants to surface a "Notes" child count per scene, two data sources collide:
1. The **persisted** inline annotation marks (already in `.rga`, already in `idx.notes`).
2. The **non-persisted** scene-level textarea text (`Rga.SceneNotes._notes`, lives only in JS memory; gone on reload).

Today's `nav-index.js:199` reads `sceneNode.attrs.notes` to set `hasNotes` — that attr exists in the schema but **production code never writes it**. The inspector textarea writes only to the in-memory store. The two surfaces silently disagree.

A nested catalogue must either:
- Show only inline-annotation counts (safe; persisted; doesn't claim more than it can keep).
- Wire `Rga.SceneNotes.set` to also write to `sceneNode.attrs.notes` (or persist `_notes` to a future `.rga` field) — a separate small-but-real slice with its own brief.

The brief named "biggest data gap" — this is it. Not the tags. Not the eighths. The **scene-level note persistence gap** between the inspector textarea and the .rga file. Every other gap is either downstream of nav-index (and gated by Risk #2) or already solved by existing read paths.

## 5. Recommended next implementation path

**D — Pause and redesign with designer**, with **C — `SN-Helper-1` aggregation helper** as a parallel low-risk preparatory step that unblocks both reconciled outcomes.

- **D**: surface this audit to the user; let them choose Reading A (inspector becomes the depth surface, sidebar stays flat) or Reading B (sidebar nests, with explicit override of UX Direction §15/§16). If Reading A, the next slice is a Phase 0 for the inspector's scene-detail panel — not more navigator work. If Reading B, the next slice needs a designer-collaborated row anatomy + collapse/expand + indentation + color-dot rules before any nested-render code lands.
- **C**: regardless of A/B, authorise `SN-Helper-1` — a no-UI slice introducing `Rga.Screenplay.SceneCatalog.byScene(idx)` memoised against the nav-index reference. Unit-tested, zero-visible-change, blast-radius limited to a new file in `doc-types/screenplay/`. Honours nav-index moratorium (pure read). Unblocks both outcomes.

A and B from the brief's list are rejected because they ship visible UI against unresolved UX direction. E from the brief's list is rejected because it misdescribes the gap (the data model is ready; the direction is not).

## 6. STOP

This is an audit + recommendation only. No code has been edited, no nav-index modified, no schema touched, no fake nested items invented, no commit created. The audit document has been written but not committed (per the brief's "Create" directive without a commit instruction). The next decision — between Reading A and Reading B, and whether to authorise the `SN-Helper-1` preparatory slice — belongs to the user, not to this document.
