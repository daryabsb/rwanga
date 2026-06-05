# Semantic Entity Layer — Doctrine LOCK

**Status:** LOCKED doctrine. Supersedes the DRAFT as the binding model for the
semantic entity layer. **Still no implementation** — this file freezes vocabulary,
invariants, and boundaries; the companion S0 brief describes the first slice but
authorizes nothing.
**Date:** 2026-06-05
**Lineage:**
[`SEMANTIC_ENTITY_LAYER_AUDIT.md`](./SEMANTIC_ENTITY_LAYER_AUDIT.md) (ground truth) →
[`SEMANTIC_ENTITY_LAYER_DOCTRINE_DRAFT.md`](./SEMANTIC_ENTITY_LAYER_DOCTRINE_DRAFT.md)
(proposed model) → **this lock** (decisions) →
[`SEMANTIC_ENTITY_LAYER_S0_IMPLEMENTATION_BRIEF.md`](./SEMANTIC_ENTITY_LAYER_S0_IMPLEMENTATION_BRIEF.md)
(first slice).

> The audit's headline holds and is now load-bearing doctrine: **the spine already
> exists.** The mark stores `(tagType, entityId)` — identity by id, never by text
> (`base-outer-marks.js:105`). A tombstone + `resolveEntityId` identity-resolution
> layer already ships for merges (`doc.js:355–447`). We are not building a
> foundation; we are *naming a half-built layer* and closing one gap (text →
> identity at tag time) without disturbing what works.

---

## 1. Decision ledger — confirm / challenge

Every decision the review asked for, ruled. `✅ LOCK` = confirmed as stated.
`◑ LOCK+` = confirmed with a sharpened boundary. `⚠ CHALLENGE` = changed.

### 1. Entity

| Proposed | Ruling |
|---|---|
| Entity id is the permanent spine | **✅ LOCK.** Verified spine: marks, registry, nav-index, merge log all key on `entity.id` (audit §1.3). |
| Entity is type-scoped | **✅ LOCK.** `Character:Nali ≠ Prop:Nali` — separate registry lists (`tags.js:526`, `doc.js:296`). |
| Entity is the future anchor for aliases, mentions, profile, relationships, timeline, AI, MCP | **✅ LOCK.** The id is the single join key for every future system. **Corollary locked:** ids are *never reused, repurposed, or recycled* (Invariant VIII). |

### 2. Alias

| Proposed | Ruling |
|---|---|
| Alias is NOT merge | **✅ LOCK — the load-bearing distinction.** Merge = one identity recorded twice → tombstone a loser, log it. Alias = one identity, many names → no second entity, no tombstone, no merge-log entry. Separate field (`aliases` vs `merged_into`), separate axis. **Never implement alias as "create then merge."** |
| Alias is an alternate surface name for one entity | **✅ LOCK.** Many aliases : one entity. A record *on* the entity, not a separate entity. |
| `He`, `She`, `the teacher`, `the butcher`, `the old man` may all be aliases | **◑ LOCK+ — with a boundary, because two of your own rules collide here.** *Distinctive aliases* (definite descriptions — "the teacher", "the butcher", "the old man") are the target case: they are normally unique within a script and resolve cleanly. *Generic deixis* ("he", "she", "they", "the man") **must not be poured into the stored auto-resolving alias list** — see §2 below. The data layer accepts any string; **doctrine forbids generic pronouns as global aliases.** |
| One alias should resolve to one entity per type | **✅ LOCK, widened.** Uniqueness is over the **union of names ∪ aliases** within a type: a normalized surface string maps to **at most one live entity per type**. (So "Nali" cannot be A's name and B's alias.) This is exactly what makes generic pronouns self-defeating as stored aliases. |
| Collision handling must be explicit | **✅ LOCK.** Policy frozen in §3. Authoring rejects/prompts on collision; the resolver is *defensive* — on any ambiguity it makes **no confident match** and never silently picks one. |

### 3. Mention

| Proposed | Ruling |
|---|---|
| The ProseMirror tag mark remains the mention truth | **✅ LOCK.** The mark *is* the mention (audit §1.7). |
| No separate persisted mention table | **✅ LOCK.** A side table duplicates the doc and goes stale on every keystroke. Aggregates (nav-index, Memory, scene-catalog) are **derived**, never stored. |
| Mention text stays whatever the writer wrote | **✅ LOCK.** Surface form flows from document text; identity flows from `entityId`. |
| Print/export must not replace `He` with `Nali` | **✅ LOCK — Invariant V.** Print/export already strip tag marks (`print-renderer.js` `_markWrapper` → null). The semantic layer is for the writer and the tools, **never the page.** |

### 4. Character Profile

| Proposed | Ruling |
|---|---|
| Future profile belongs on the entity | **✅ LOCK.** Keyed by the same id. |
| May include age, job, hobbies, traits, relationships, rules, limitations, contradictions, arc, notes | **✅ LOCK as illustrative.** The **field set is NOT decided here** — that is its own brainstorm. |
| Reserve the envelope concept; do not implement now | **◑ LOCK+ — reserve the *anchor*, not a literal key.** What we reserve **now** is the agreement that *the entity id is the profile's join key*. **S0 ships no `profile` field.** Each profile field arrives via its own future migration (YAGNI; don't mint an empty envelope that invites premature writes). |

### 5. `.rga` Memory

| Proposed | Ruling |
|---|---|
| Aliases and future profiles must travel with `.rga` | **✅ LOCK.** Additive fields on the entity record inside `tag_registry`; the round-trip already tolerates unknown entity fields (audit §1.4), but they are introduced **via migration** so old files normalize and the version advertises the capability. |
| No competing truth outside `.rga` | **✅ LOCK — strongest principle.** The `.rga` file is the sole memory. No sidecar DB, no external index that could disagree. Consistent with the IDE "files sovereign" doctrine. |

### 6. First safe implementation slice (S0)

`entity.aliases` · merge-fold safety · resolver consults name + aliases ·
v3→v4 migration defaulting aliases · tests · **no UI / no context-menu / no hover /
no Inspector / no Timeline / no AI**.

**✅ LOCK as the scope** — with one correction the audit missed: the v3→v4 step is
**not** just "register `_steps.v3toV4` + bump constants." The migration *dispatcher*
(`index.js` `migrate()`) early-returns on `_isV3` with `LATEST_VERSION = '3.0'`
hardcoded, so a v3→v4 step would never run. The dispatcher itself must grow a
`_isV4` guard, a `v3toV4` branch, and a `LATEST_VERSION` bump. Detailed in the S0
brief. **No other change to S0 scope.**

---

## 2. The one genuine challenge — generic pronouns are not aliases

Your list mixed two kinds of surface name, and your two rules ("`He` may be an
alias" **+** "one alias → one entity per type") cannot both hold for pronouns:

- "The teacher" appears a handful of times and almost always means one person →
  a **distinctive alias** resolves cleanly and durably.
- "He" appears *hundreds* of times for *every* male character. If "He → Nali" is a
  stored global alias, the resolver would claim **every** "He" in the script for
  Nali — including the "He" that means Baban. The moment Baban also wants "He", the
  uniqueness rule rejects it. Pronouns are self-defeating as global aliases **and**
  dangerous if forced in.

**Locked resolution:** the stored alias list + auto-resolver is for **distinctive
aliases only**. Generic deixis ("he/she/they/him/her/the man/the woman/the boy")
resolves — *if ever* — through a **separate, context-scoped mechanism** (per-scene
or per-beat antecedent resolution), which is a later, independent slice and is
**out of the alias spine entirely**. The data field will not reject a pronoun
string, but doctrine and the authoring UX must not write pronouns into it.

This costs S0 nothing: **S0 ships the alias *capability* with no authoring UI**, so
zero aliases are created in production during S0 — the pronoun hazard cannot bite
until an authoring slice exists, by which point this boundary is already law.

---

## 3. Collision policy (locked)

Scope: within a single tag type, over the **union of names ∪ aliases** of **live**
entities (tombstones never participate — they are not a legal listing source,
consumer rule C3 / `liveEntities`).

1. **Uniqueness:** a normalized surface string belongs to **at most one** live
   entity. Normalization = the *existing* `findOrCreateEntity` rule: `String(x).trim()`
   then case-insensitive compare (`tags.js:530,544`). **S0 introduces no new
   normalization scheme** (no punctuation/diacritic folding) — consistency with the
   shipped name-match rule beats cleverness; richer normalization is a separate,
   reviewed decision.
2. **Authoring (future):** adding an alias that already resolves to a *different*
   live entity is **rejected or prompted** — never silently reassigned. (UX of the
   prompt is deferred — §4.)
3. **Resolver (S0):** the two axes resolve in **precedence order** — name first,
   then aliases (clarified during S0 implementation; the prior unified-match
   sketch in the brief was wrong and would have regressed legacy behavior):
   - **Name axis (precedence):** a canonical-name match reuses the **first**
     case-insensitive match — **even when the registry holds historical
     name-duplicates awaiting merge.** Name-duplicates are MERGE territory, not
     an alias collision (Alias ≠ Merge); pre-S0 behavior (first-match reuse) is
     preserved exactly.
   - **Alias axis (fallback, collision-defensive):** consulted only when no name
     matched. Exactly one alias claimant → reuse; **two-or-more → no confident
     match**, never silently picked → fall through to create. In S0 the ≥2 branch
     is unreachable by construction (no authoring ⇒ uniqueness holds), but the
     code is defensive so a hand-edited `.rga` cannot mis-resolve identity.
   - zero matches on either axis → create (today's behavior, unchanged).

---

## 4. Unresolved UX questions (deferred — engineers do NOT invent these)

Per the Settings/Design freeze, these stay open for design review and are **not**
inferred from this lock:

- **Tag-time UX** for "existing / alias-of / new" — audit §5 directions A (cascading
  submenu) / B (picker dialog) / C (tag-then-link).
- **Where alias authoring lives** — tag-time, Inspector, or both.
- **The pronoun/contextual-resolution mechanism** (§2) — its own brainstorm.
- **Hover-to-resolve** ("hover He → Nali") timing — with aliasing or after.
- **Profile field set** + the Inspector character panel (§1.4).
- **Breakdown** counting/dedup rules — greenfield; inherits whatever ships.
- **On merge, does the loser's canonical name become an alias of the survivor?**
  (Plausible — people typed "NALI" too — but it is a *behavior* choice for the
  merge-UX slice, not S0. S0's fold only unions the two `aliases` arrays; it does
  **not** auto-promote `loser.name` to an alias.)

---

## 5. Locked invariants (binding on every future slice)

Carried from the draft, tightened by the rulings above:

- **I. Mark is identity-by-id, never by text.** Never regress.
- **II. One canonical name per entity; aliases are alternates.** Print/Inspector
  show the canonical name as the primary label; search/resolve use name + aliases.
- **III. One reuse-before-create path.** Every tagging surface (context menu,
  toolbar, future recognizers/AI) acquires ids through the *single* resolver that
  consults name **and** aliases over **live** entities. Extend `findOrCreateEntity`;
  never fork it.
- **IV. Marks are the only mention truth.** No persisted mention/range table.
- **V. Identity stays out of clean output.** Print/export render the document's
  words, never the resolved name.
- **VI. Additive memory, versioned.** New entity fields / `.rga` sections arrive by
  migration that defaults them and bumps the version; the merge-fold whitelist
  (`_KNOWN_ENTITY_FIELDS`) grows in lockstep or the field is silently dropped on
  merge.
- **VII. Derived layers resolve, they don't re-key.** nav-index / Memory /
  scene-catalog already key by id; their only alias-era change is to *resolve*
  through alias/merge where they assume a raw id.
- **VIII. The id is forever.** Never reused, repurposed, or recycled.
- **IX. Alias ≠ Merge.** Separate fields, separate axes, separate logs; shared
  id-resolution discipline only.
- **X. Generic pronouns are not stored aliases.** (New — §2.)

---

## STOP

Doctrine is locked; **no code is authorized.** The S0 brief describes the first
slice for review. Implementation begins only on explicit authorization of that
brief. The §4 UX questions remain owned by design review, not engineering.
