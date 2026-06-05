# Semantic Entity Layer — Architecture & Design Audit

**Status:** AUDIT + DOCTRINE. **No implementation.** No schema change, no mark
change, no context-menu change, no UI invented here.
**Date:** 2026-06-04
**Companion:** [`SEMANTIC_ENTITY_LAYER_DOCTRINE_DRAFT.md`](./SEMANTIC_ENTITY_LAYER_DOCTRINE_DRAFT.md)
(the future model definitions). This file is the *ground truth of what exists
today* plus the answers to the required audit questions; the doctrine draft is
the *proposed future model*.

> The headline finding: **most of the spine we need already exists.** The tag
> mark is identity-by-id (not by text), and a tombstone/`resolveEntityId`
> identity-resolution layer is already shipped for merges. We are not building a
> new foundation — we are naming a layer that is half-built, and closing one
> specific gap (text → identity at tag time) without disturbing what works.

---

## 0. How this audit was produced

Every claim below was read from the live source, not assumed. Primary files
inspected:

- `renderer/js/framework/base-outer-marks.js` — the `tag` mark definition
- `renderer/js/doc.js` — `.rga` serialize/deserialize + the registry + merge API
- `renderer/js/doc-types/screenplay/plugins/tags.js` — tag apply/lookup/panel/merge/popup
- `renderer/js/doc-types/screenplay/plugins/context-menu.js` — the Tag-as flow
- `renderer/js/doc-types/screenplay/plugins/tag-focus-highlight.js` — entity highlight
- `renderer/js/framework/nav-index.js` — the derived tag index
- `renderer/js/doc-types/screenplay/memory.js` — the read projection
- `renderer/js/doc-types/screenplay/scene-catalog.js` — per-scene entity projection
- `renderer/js/framework/print-renderer.js`, `renderer/js/export/*` — output path
- `renderer/js/doc-types/screenplay/migrations/*`, `renderer/js/constants.js` — versioning
- `renderer/js/shell/inspector.js`, `renderer/index.html` — Inspector & Breakdown surfaces

---

## 1. CURRENT TRUTH — what the system actually is today

### 1.1 The tag mark stores identity, not text

`base-outer-marks.js:105` — the `tag` mark has exactly two attributes:

```js
tag: {
  attrs: { tagType: {}, entityId: {} },
  inclusive: false,
  excludes: 'annotation revisionFlag',
  toDOM(mark) {
    return ['span', {
      class: 'rga-tag rga-tag-' + mark.attrs.tagType,
      'data-tag-type': mark.attrs.tagType,
      'data-entity-id': mark.attrs.entityId
    }, 0];
  }
}
```

**The mark carries NO name and NO color.** It is a pure pointer:
`(tagType, entityId)` laid over a range of document text. The *surface text*
("Nali", "He", "the teacher") is just whatever the document says under the mark.
**This is the single most important fact in the audit:** the mark layer is
*already* an alias-capable design. A mark over the word "He" whose
`entityId` is Nali's id is, mechanically, already "He means Nali." Nothing in
the schema forbids it.

### 1.2 An entity is a registry record, keyed by id, scoped by type

`doc.js:308` — `addEntity` creates:

```js
{ id: attrs.id || crypto.randomUUID(), name, color, notes }
```

stored in `doc.tagRegistry[<plural key>]` (`doc.js:296`):
`characters, props, wardrobe, locations, sfx, vfx, vehicles, animals, custom`.

- Identity is **type-scoped**: `Character:NALI` and `Prop:NALI` are different
  entities (different lists). Stated explicitly in `tags.js:526`.
- The id is a `crypto.randomUUID()`. It is the stable spine — marks reference it,
  the nav-index keys on it, the merge log records it.
- An entity has exactly four authored fields today: `id, name, color, notes`
  (plus an optional `merged_into` tombstone — see §1.5).

### 1.3 Where entity ids live (the full picture)

| Location | Form | File |
|---|---|---|
| On each tagged text range | `mark.attrs.entityId` | `base-outer-marks.js:108` |
| In the registry | `entity.id` | `doc.js:310` |
| Serialized to disk | `tag_registry.<plural>[].id` | `doc.js:165` |
| In the derived index | `tags[type][].nodeId` | `nav-index.js` |
| In the merge log | `merge_log[].survivor.id`, `.losers[].id` | `doc.js:411` |

The mark↔registry link is **only** the id. Name/color are looked up from the
registry at render time (panel, popup) — never read off the mark.

### 1.4 The `.rga` file shape (the document memory)

`doc.js:158` `serialize()` writes:

```js
{
  rga_version, document_type, metadata, settings,
  body,             // ProseMirror doc JSON — the marks (= the mentions) live here
  tag_registry,     // the entities
  flag_log,
  merge_log,        // identity-merge history (survivor/losers/metadata_moved)
  export_settings,
  runtime
}
```

`CURRENT_RGA_VERSION = '3.0'`; `SUPPORTED_RGA_VERSIONS = ['1.0','1.1','2.0','3.0']`
(`constants.js`). Deserialize tolerates and passes through the whole
`tag_registry` object (`doc.js:282`) — **unknown additive fields on an entity
already round-trip** through save/load untouched. This matters for §4.

### 1.5 Identity resolution ALREADY EXISTS (for merges)

This is the second headline finding. `doc.js:355–447` ships a complete,
reviewed identity-resolution spine, built for the duplicate-name *merge* feature:

- `markEntityMerged(doc, type, loserId, survivorId)` — sets `loser.merged_into`
  (a **tombstone**; the loser is never deleted, because undo can resurrect marks
  pointing at it).
- `resolveEntityId(doc, type, entityId)` — follows the `merged_into` chain (with
  a cycle guard) to the live survivor id.
- `liveEntities(doc, type)` — filters out tombstones; **the only legal source for
  any UI list/suggestion** (consumer rule C3).
- `foldEntityMetadata` — moves color/notes from loser to survivor with
  attribution; **gated by a `_KNOWN_ENTITY_FIELDS` whitelist** (`doc.js:353` =
  `['id','name','color','notes','merged_into']`) — unknown fields are *reported,
  never copied*.
- `appendMergeLog` — append-only history in `merge_log`.

Consumers already resolve through this: `showTagInfo` (`tags.js:718`) resolves a
mark's possibly-tombstoned id to the live survivor before showing the name.

### 1.6 The current Tag-as flow creates an entity from the selection text

Two tagging surfaces, **one shared lookup** (`tags.js:529` `findOrCreateEntity`):

1. Context menu → "Tag as ▶ → Character" (`context-menu.js` → `tags.js:555`
   `showTagDialog`). No dialog; the selected text *is* the identifier.
2. Toolbar Tag dropdown → same `findOrCreateEntity`.

`findOrCreateEntity(doc, type, name)`:
- exact, case-insensitive match of the selection against a **live** entity's
  single `name` → reuse that id;
- otherwise `crypto.randomUUID()` + `addEntity`.

**This is the alias gap, in one function.** Tag "He" as Character and there is no
"He" entity → a brand-new entity named "He" is born. "He" and "Nali" are now two
separate characters forever, because the only thing that could have linked them —
a name match — fails, and there is no alias list to consult.

### 1.7 Mentions are the marks; there is no separate mention object

There is **no first-class "mention" record** anywhere. What exists:

- The **marks in `body`** are the mentions — each tagged text range is one
  occurrence, carrying `entityId`.
- `nav-index.js` aggregates them into per-entity `{ nodeId, name, color,
  mentionCount, sceneAppearances }` (+ `cueCount` for characters). **No
  per-occurrence position/range is stored** — only counts and scene-id lists.
- Concrete ranges are **derived on demand** by re-walking the doc:
  `tag-focus-highlight.rangesForEntity` (all ranges for an entityId) and
  `scene-tag-occurrences.forScene` (ranges + snippets within one scene).
- `memory.js` is a **pure projection** over the nav-index (one WeakMap cue cache,
  no persistence). Its own comments reserve `'matched'` and `'inferred'` tiers
  for "future phase" — i.e. alias/inference is anticipated but unbuilt.

**Doctrine consequence:** the mark is the mention truth. We must NOT introduce a
parallel persisted mention table — it would duplicate truth and go stale on every
keystroke.

### 1.8 Hover does not exist; only click and panel-focus

- The editor tag plugin (`tags.js:791`) wires **`handleClickOn` only** → a popup
  ("Character: Nali", *View Tags* / *Remove*). The popup already resolves
  tombstones to the live name.
- The `tag` mark's `toDOM` adds **no `title`, no tooltip, no aria** — there is no
  native hover affordance.
- Panel→editor "focus highlight" (`tag-focus-highlight.js`) lights every range
  for an `entityId` (decoration class `.rga-tag-focus-active`), matched **by
  entityId** — so duplicate-named entities never bleed together, and an aliased
  "He" would light up alongside "Nali" automatically.

The product vision's "hover He and know it means Nali" is **not yet present** —
but it is a small addition on top of the existing id→registry resolution.

### 1.9 Downstream consumers — what's real, what's a shell

| Surface | State today | Reads identity how |
|---|---|---|
| Tags Panel (sidebar) | **Real** | `liveEntities` + nav-index counts, by entityId |
| Scene Navigator tags | **Real** | `scene-tag-occurrences` subtree walk, by entityId |
| Tag info popup | **Real** | registry lookup, resolves tombstones |
| Focus highlight | **Real** | `rangesForEntity` by entityId |
| **Inspector** | **Frame only** | Registers lifecycle; only a Scene-Notes panel exists; **no per-entity/character panel; does not read the registry** |
| **Breakdown** | **Placeholder** | `index.html` has an empty `<table>` + `<!-- Populated from tag registry -->`; **zero JS populates it** |
| **Export / Print** | **Strips tags** | `print-renderer.js` `_markWrapper` returns `null` for `tag` — entity ids do **not** reach PDF/DOCX/TXT/MD; export never reads `tag_registry` |

Two implications:
- The semantic layer is **editor-only** today and *correctly* invisible in clean
  production output. Aliasing must preserve that (the printed page still reads
  "He", not "Nali").
- Breakdown is a greenfield consumer. Whatever identity model we set now is what
  Breakdown will count on. If we ship aliasing wrong, Breakdown inherits the bug.

### 1.10 Versioning is a clean, additive pipeline

`migrations/index.js` runs a registered chain (`_steps.v1toV2`, `_steps.v2toV3`)
keyed off `detectVersion`, bumping `rga_version`. Both existing steps **pass
`tag_registry` through untouched**. Adding an entity field or a new `.rga`
section is a well-trodden path: write `v3-to-v4.js`, register
`Rga.Migrations._steps.v3toV4`, bump `CURRENT_RGA_VERSION`, extend
`SUPPORTED_RGA_VERSIONS`.

---

## 2. ANSWERS TO THE REQUIRED AUDIT QUESTIONS

**1. What does a tag mean today?**
A `tag` mark = a typed pointer `(tagType, entityId)` over a text range. It asserts
"this text is a mention of *this* entity, of *this* category." It carries no name
and no styling of its own.

**2. What does an entity mean today?**
A registry record `{ id, name, color, notes (, merged_into) }` in
`tag_registry[<type>]`, identified by a UUID, scoped to one tag type. It is the
single identity a mark points at. It has exactly one authored name.

**3. Where are entity ids stored?**
On every tagged mark (`mark.attrs.entityId`), as the registry record's `id`, in
the serialized `tag_registry`, as `nodeId` in the nav-index, and in `merge_log`.
See §1.3. The id is the stable spine across all of them.

**4. Does `.rga` currently preserve enough information for aliasing?**
**Structurally, yes — almost for free.** The mark already binds text→identity by
id, so an aliased mention needs no schema change. The *missing data* is a place to
record "Nali is also known as 'He'/'the teacher'." That is one additive field on
the entity record, which the `.rga` round-trip already tolerates (§1.4). So the
*file format* is ready; the *registry record* and the *lookup function* are not.

**5. Can one entity have many aliases today?**
**No.** An entity has a single `name`, and `findOrCreateEntity` matches on that
one string only. There is no alias list.

**6. Can a mention point to an existing entity today?**
**Yes — this already works at the mark level.** `applyTag` writes whatever
`entityId` it is given over the selection (`tags.js:22`). The blocker is purely
that `findOrCreateEntity` will only *choose* an existing id when the selected text
exactly equals that entity's one name. Given the right id, a mention over "He"
already points to Nali.

**7. Can hover show the resolved entity today?**
**Not on hover.** On **click**, yes — `showTagInfo` shows the resolved entity name
(and already resolves tombstones). There is no mouseover behavior and no `title`
on the mark.

**8. What breaks if we add aliases naively?**
- **Conflating alias with merge.** If "alias" is implemented as "create a 'He'
  entity then merge it into Nali," you tombstone a character that *should never
  have existed*, and you pollute `merge_log` with non-merges. Alias ≠ merge: a
  merge collapses *two real identities recorded twice*; an alias is *one identity,
  many names*. They share id-resolution machinery but are different axes and must
  not be routed through the same `merged_into` field.
- **Single-name assumptions everywhere.** `findOrCreateEntity` (lookup),
  `nameTally` duplicate-warning (`tags.js:307`), and the tag-info label all assume
  one name per entity. An `aliases` array means lookup must search aliases,
  duplicate-detection must not false-flag an alias, and ambiguity (two entities
  claiming the alias "He") must be defined away or resolved.
- **Merge fold silently drops aliases.** `_KNOWN_ENTITY_FIELDS` (`doc.js:353`)
  does not include `aliases`/`profile`; on a merge they'd be classified "unknown"
  and **not folded into the survivor** — Nali's aliases would be lost when a
  duplicate Nali is merged in. Adding the field requires updating this whitelist.
- **Persisted mention/range tables.** Tempting and wrong (§1.7). The marks are the
  mentions; a side table goes stale.
- **Leaking identity into print/export.** If a future "show resolved name" feature
  rewrites the printed text to "Nali", clean output breaks. The page must still
  read "He."

**9. What must be designed before engineering?**
- The **alias vs merge** boundary (doctrine — drafted in the companion).
- The **alias data shape** on the entity record and its **uniqueness rule** within
  a type (can two characters both claim "He"? what happens?).
- The **resolution contract**: one function that turns *(type, selected text)* into
  an entity id, consulting name **and** aliases, that every tagging surface uses
  (extend the existing single-path `findOrCreateEntity` discipline).
- The **tag-time UX** for "this selection is an existing entity / an alias of one /
  a new one" — *flagged as needing design review; not locked here.*
- The **`profile` envelope** (where richer character fields live) — named now so
  the id is the agreed anchor, bodied later.

**10. What is the smallest safe first architecture slice?**
A **data + resolution** slice with **no UI, no mark change, no schema change**:
1. Define `entity.aliases` as an additive, optional field (round-trips already).
2. Add `aliases` to `_KNOWN_ENTITY_FIELDS` so merges fold it.
3. Centralize one resolver — `findOrCreateEntity` consults aliases before
   creating — so "the teacher" can resolve to Nali *once an alias exists*.
4. A `v3 → v4` migration that defaults `aliases: []` on every entity (normalizes
   old files + signals the capability), following the established `_steps` pattern.

Everything else — the "Alias of…" tag UX, hover-to-resolve, the character profile
panel, Breakdown dedup, AI/Timeline — builds on this id+alias spine. Detailed in
§5 and the doctrine draft. **Still not to be implemented until the doctrine and the
UX decision in §4 are reviewed.**

---

## 3. PROPOSED FUTURE MODEL (summary — full version in the doctrine draft)

Four nouns, cleanly separated:

- **Entity** — one identity, id-stable, type-scoped (Nali). *Exists today.*
- **Alias** — an alternate surface name that resolves to an entity ("He",
  "the teacher" → Nali). Many aliases : one entity. A **registry record on the
  entity**, *not* a separate entity, *not* a merge. *New.*
- **Mention** — a concrete tagged range in the document. **The mark is the
  mention** (already true). Optionally remembers which surface form it used; that
  is derivable from the doc text, so it need not be stored. *Exists today as marks.*
- **Profile** — the richer character record (age, job, rules, arc, relationships,
  contradictions). A future **envelope on the entity**, keyed by the same id.
  *Future.*

The spine that unifies them is the **entity id**, which is already load-bearing
everywhere. We are adding *names* and *attributes* to an existing identity, not
inventing a new identity system.

---

## 4. `.rga` MEMORY IMPLICATIONS

- **Marks stay the mention truth.** Identity travels as `entityId` on marks (it
  already does). Do **not** persist a separate mention/range table.
- **Registry stays the identity truth.** Aliases and (later) profile are
  **additive fields on the entity record** inside `tag_registry`. The save/load
  round-trip already tolerates them (§1.4), but they should be introduced via a
  `v3 → v4` migration so old files normalize and the version advertises the
  capability.
- **`_KNOWN_ENTITY_FIELDS` must grow** in lockstep, or merges silently drop the
  new fields (§2.8).
- **Derived layers (nav-index, Memory, scene-catalog) need no persistence** — they
  already key by id, so aliased mentions aggregate correctly the moment a mark
  points at the survivor id. Their only required change is to *resolve through
  alias/merge* where they currently assume a raw id.
- **Future sections** (relationships, decisions, AI context, timeline references)
  are additive top-level `.rga` keys or entity-keyed sub-objects, each introduced
  by its own migration. The id is the join key for all of them — fix it now.
- **Output path is unaffected and must stay so**: print/export strip tags today;
  aliasing must not change the printed words.

---

## 5. UI DECISION NEEDED (design review required — NOT locked)

The one genuinely open product decision: **at tag time, how does the writer say
"this selection is Nali (or an alias of Nali), not a new character"?**

Candidate directions (for the design review to weigh — do **not** pick here):

- **A. Cascading submenu** — `Tag as → Character → [Nali | Baban | New… | Alias of ▸]`.
  Fast, but the submenu can grow long and the boundary-safety we just fixed for the
  context menu becomes load-bearing.
- **B. Picker dialog** — tag opens a small "Which character?" chooser
  (existing / new / alias-of), with search. Scales to many entities; one more step.
- **C. Tag-then-link** — keep today's zero-friction "selection = name," and add a
  *post-hoc* "link to existing / mark as alias of…" affordance in the tag popup or
  Inspector. Lowest disruption to the current flow.

Secondary decisions for the same review:
- Is alias management a **tag-time** act, an **Inspector** act, or both?
- **Alias uniqueness within a type**: is "He" allowed to belong to two characters?
  (Recommend: an alias resolves to at most one entity per type; collisions prompt.)
- Does hover-to-resolve (the "hover He → Nali" vision) ship with aliasing or after?

This section exists to **flag** the decision. Per the mission and the project's
Settings/Design doctrine, engineers do not invent this UI.

---

## 6. SAFEST FIRST IMPLEMENTATION SLICE (described, not built)

**Slice S0 — "Identity spine: aliases as data, resolution as one function."**
No visible UI. No mark change. No context-menu change. No schema change. No AI.

Scope (all additive, all behind the existing single-lookup discipline):
1. **Data:** `entity.aliases` optional field on the registry record.
2. **Fold safety:** add `aliases` to `_KNOWN_ENTITY_FIELDS` so merges preserve it.
3. **Resolver:** `findOrCreateEntity` (and any future recognizer) consults
   `name` **and** `aliases` (live entities only) before creating — the same
   "one reuse-before-create path" that already exists, taught one new trick.
4. **Migration:** `v3 → v4` defaulting `aliases: []`, registered on
   `Rga.Migrations._steps.v3toV4`, with `CURRENT_RGA_VERSION`/`SUPPORTED` bumped,
   following `v2-to-v3.js` as the template.
5. **Tests first (TDD):** round-trip (alias survives save/load + migration),
   resolver (alias text → existing id, no new entity), merge fold (survivor keeps
   both entities' aliases), and a negative (no alias → unchanged create behavior).

Why this is the safe floor: it makes "He → Nali" *possible and durable in memory*
without changing a single pixel, a single mark, or the print/export output. Every
richer layer (tag-time UX, hover-resolve, profile panel, Breakdown dedup,
Timeline, AI context) sits cleanly on top of it, and each can be reviewed on its
own. The alias↔merge boundary (the one thing most likely to corrupt identity) is
settled in *data* before any UI can tempt a shortcut.

**This slice is described for review. It is NOT authorized and NOT to be built
until the doctrine draft and the §4 UX decision are reviewed.**

---

## STOP

This is doctrine + audit only. No code was changed. No schema, mark, context-menu
level, UI, AI, Timeline, or Inspector behavior was created. Awaiting review of the
companion doctrine draft and the §4 UI decision before any implementation slice.
