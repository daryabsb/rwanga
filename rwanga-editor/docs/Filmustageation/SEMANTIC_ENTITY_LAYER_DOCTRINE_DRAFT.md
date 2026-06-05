# Semantic Entity Layer — Doctrine Draft

**Status:** DRAFT for review. **No implementation.** Definitions and principles
only — no schema, no UI, no AI, no migration is written here.
**Date:** 2026-06-04
**Companion:** [`SEMANTIC_ENTITY_LAYER_AUDIT.md`](./SEMANTIC_ENTITY_LAYER_AUDIT.md)
(the ground truth this doctrine is built on). Read the audit first — every claim
about "what exists today" is sourced there.

> **Purpose.** Stop treating tags as visual labels. Name the layer that turns
> *marked text* into *remembered meaning*: who "He" is, that "the teacher" is the
> same person, that Nali is a 38-year-old teacher who avoids the river. This draft
> fixes the **vocabulary** and the **invariants** so that engineering, when it is
> authorized, builds on a shared model instead of improvising one.

---

## 1. The four nouns (and the one thing that unifies them)

The whole layer is four nouns joined by one spine.

```
            ┌─────────────────────────────────────────────┐
            │                   ENTITY                     │
            │         id (UUID) · type · name              │
            │   ── the stable identity: "Nali" ──          │
            └───────┬───────────────┬─────────────┬────────┘
                    │               │             │
            many    │       one     │      one    │
         ┌──────────▼──┐   ┌────────▼─────┐  ┌────▼─────────┐
         │   ALIASES   │   │   PROFILE    │  │   MENTIONS   │
         │ "He"        │   │ age, job,    │  │ tagged text  │
         │ "the teacher"│  │ rules, arc…  │  │ ranges in    │
         │ → resolve to │  │ (future)     │  │ the document │
         │   the entity │  │              │  │ (= the marks)│
         └──────────────┘  └──────────────┘  └──────────────┘

   THE SPINE = the entity id. It already threads marks, registry,
   nav-index, and merge log. We add names and attributes to an
   existing identity — we do not invent a new identity system.
```

### 1.1 Entity — *exists today*

**Definition.** A single identity within a tag type. One Nali. One "rifle." The
unit of meaning the writer cares about.

- Identified by a stable UUID (`entity.id`).
- **Type-scoped**: `Character:Nali` and `Prop:Nali` are different entities.
- Today holds `{ id, name, color, notes }` (+ optional `merged_into` tombstone).
- The id — not the name — is the identity. Renaming Nali does not change the id;
  every mention follows.

**Doctrine:** the entity is the noun everything else hangs off. Its id is sacred
and append-only in spirit: marks, history, and future systems dereference it, so
it must never be reused or repurposed.

### 1.2 Alias — *new*

**Definition.** An alternate **surface name** that resolves to an entity.
"He" → Nali. "The teacher" → Nali. "The butcher" → Baban. "The old man" → Karim.

- **Cardinality: many aliases : one entity.** An entity has one canonical `name`
  and zero-or-more aliases.
- An alias is a **record on the entity**, *not a separate entity*.
- **An alias is NOT a merge.** (See §2 — this is the load-bearing distinction.)
- An alias is **type-scoped** like the entity, and should resolve to **at most one
  entity per type** (collision handling is a §1.2 design point, not settled here).

**What an alias is for.** So that the *next* time the writer selects "the teacher"
and tags it as a Character, the system can offer/choose Nali instead of minting a
new "the teacher" character — and so that hover/inspect/breakdown/AI all read
"the teacher" as Nali.

**Why it's safe at the mark level.** A mention of an alias is *just a normal mark
over the alias text whose `entityId` is the entity's id*. The audit shows the mark
already supports this (it stores no text, only the id). The alias list exists so
the **lookup** can find the entity from the text; the **mark** needs nothing new.

### 1.3 Mention — *exists today, as marks*

**Definition.** A concrete occurrence: one tagged text range in the document.
"NALI" in scene 3, line 2 is one mention; "He" in scene 4 is another mention of
the same entity (if aliased).

- **The ProseMirror mark IS the mention.** There is no separate mention object,
  and there must not be one persisted (it would duplicate the doc and go stale).
- A mention inherently knows: its **range** (where the mark is), its **type and
  entity** (the mark attrs), and its **surface form** (the doc text under it).
- Aggregates (counts, which scenes) are **derived** from the marks by the
  nav-index / Memory / scene-tag-occurrences — never stored as truth.

**Doctrine:** marks are the single source of mention truth. Identity flows into a
mention through its `entityId`; surface form flows from the document text. Nothing
about a mention is authored or stored outside the mark.

### 1.4 Profile — *future*

**Definition.** The richer description of a character (and, later, other entity
kinds): the data that makes Nali a *character*, not just a label.

Candidate fields (illustrative, **not locked**): `name, aliases, age, gender,
job, traits, hobbies, relationships, rules/limitations ("does not carry weapons",
"avoids the river"), contradictions, emotional arc, story constraints, notes`.

- A profile is an **envelope on the entity**, keyed by the same id.
- It is **additive and optional** — most entities will never have a full profile.
- It is the substrate for the future "this may contradict Nali's profile" warning,
  for the Inspector character panel, and for AI context. None of those are this
  draft's concern beyond **agreeing the id is the anchor now**.

**Doctrine:** design the entity id as the join key for the profile *today*, so the
profile can be bodied later without re-keying anything. Do not design the profile
fields here — that is a separate brainstorm.

### 1.5 The spine

The **entity id** already threads the mark layer, the registry, the nav-index, the
Memory projection, the scene catalog, and the merge log (audit §1.3). Aliases,
profile, relationships, decisions, AI context, and timeline references are all
**id-keyed additions** to an identity that already exists. This is why the layer is
"half-built": the hard part (a stable identity referenced everywhere) is done.

---

## 2. The load-bearing distinction: Alias ≠ Merge

These two operations both end with "marks resolving to one id," so they are easy to
confuse. Confusing them corrupts identity. They are different axes.

| | **Merge** (exists today) | **Alias** (proposed) |
|---|---|---|
| Story situation | The *same* identity got recorded **twice** ("NALI" and "Nali" are two character records) | *One* identity has **many names** ("He", "the teacher" are Nali) |
| Before the op | **Two real entities** | **One entity**; the alias was never its own entity |
| Mechanism | Tombstone the loser (`merged_into`), rewrite its marks to the survivor, fold metadata, log it | Record the alias name on the entity; tag the alias text directly with the entity's id |
| Reversibility | Loser is tombstoned, kept for undo, compacted later | Removing an alias is just editing a name list |
| History | `merge_log` (it's a correction of a mistake) | Not a correction — no merge log entry |
| Data field | `entity.merged_into` | `entity.aliases` |

**Doctrine rules:**
1. **Never implement alias as "create then merge."** Minting a "He" entity and
   merging it into Nali tombstones a character that should never have existed and
   pollutes `merge_log` with non-merges.
2. **`merged_into` and `aliases` are different fields and different axes.** Alias
   resolution must not route through the tombstone chain, and merge resolution must
   not consult aliases.
3. They **share the id-resolution discipline** (one entity id is canonical; UI
   lists show only live entities) but stay separate operations with separate logs.

---

## 3. Invariants the layer must hold

I. **The mark is identity-by-id, never by text.** (Already true; never regress it.)
A mark over "He" with Nali's id is "He means Nali." Surface text is the document's,
not the mark's.

II. **One canonical name per entity; aliases are alternates.** Display and search
use name + aliases; the canonical name is what print/inspector show as the
character's primary label.

III. **One reuse-before-create path.** Every tagging surface (context menu,
toolbar, future recognizers/AI) acquires entity ids through a *single* resolver
that consults name **and** aliases over **live** entities. The single-path
discipline already exists for `findOrCreateEntity`; aliasing extends it, never
forks it.

IV. **Marks are the only mention truth.** No persisted mention/range/occurrence
table. Aggregates are derived.

V. **Identity stays out of clean output.** Print/export render the document's words
("He"), never the resolved canonical name. The semantic layer is for the writer and
the tools, not the page.

VI. **Additive memory, versioned.** New entity fields and new `.rga` sections are
introduced by migrations that default them and bump the version; the merge-fold
whitelist grows with them so nothing is silently dropped on merge.

VII. **Derived layers resolve, they don't re-key.** nav-index / Memory /
scene-catalog already key by id; their only alias-era change is to resolve a mark's
id through alias/merge where they currently assume a raw id — counts and scene sets
then aggregate aliased mentions automatically.

VIII. **The id is forever.** Entity ids are never reused, repurposed, or
hand-recycled — relationships, decisions, AI context, and timeline references will
all dereference them.

---

## 4. What this draft deliberately does NOT decide

Flagged for their own reviews — **not** to be inferred or locked from this draft:

- **Tag-time UX** for choosing existing / alias-of / new (audit §5: directions A/B/C).
- **Profile field set** and the Inspector character panel.
- **Alias collision policy** within a type (can two characters claim "He"?).
- **Hover-to-resolve** timing (with aliasing or after).
- **Breakdown** counting/dedup rules (it is greenfield; it will consume whatever
  identity model ships).
- **AI / contradiction warnings / Timeline** — all downstream of the spine; out of
  scope until the spine is real.

---

## 5. The agreed floor (carried from the audit)

Before any of §4 is designed, the safe first move is **data + one resolver, no UI**
(audit §6, Slice S0): `entity.aliases` as additive memory, folded on merge,
consulted by the single resolver, introduced by a `v3 → v4` migration, TDD-first.
That floor makes "He → Nali" durable in `.rga` without changing a pixel, a mark, or
the printed page — and every richer layer then sits on a settled identity spine.

---

## STOP

Doctrine draft only. No implementation, no schema, no mark change, no UI, no AI, no
Timeline, no Inspector behavior. For review alongside the audit before any slice is
authorized.
