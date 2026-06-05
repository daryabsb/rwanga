# Semantic Entity Layer — S0 Implementation Brief

**Status:** BRIEF for review. **NOT authorized to build.** Describes the smallest
safe slice that makes "He → Nali" durable in `.rga` memory **without changing a
pixel, a mark, or the printed page.**
**Date:** 2026-06-05
**Governing doctrine:**
[`SEMANTIC_ENTITY_LAYER_DOCTRINE_LOCK.md`](./SEMANTIC_ENTITY_LAYER_DOCTRINE_LOCK.md).
**Ground truth:** [`SEMANTIC_ENTITY_LAYER_AUDIT.md`](./SEMANTIC_ENTITY_LAYER_AUDIT.md).

> **S0 in one line:** add `entity.aliases` as additive memory, teach the single
> resolver to consult it, fold it safely on merge, migrate old files to default it
> — all behind tests, with **no user-reachable way to create an alias yet.** S0 is
> *latent capability*, exercised only by tests.

---

## 1. Scope

### In
1. **Data shape** — `entity.aliases: string[]` (optional) on registry records.
2. **Fold safety** — add `'aliases'` to `_KNOWN_ENTITY_FIELDS` and union it on merge.
3. **Resolver** — `findOrCreateEntity` consults `name` **and** `aliases` over **live**
   entities before creating.
4. **Migration** — `v3 → v4` defaulting `aliases: []` on every entity, including the
   dispatcher + constant changes the chain actually requires.
5. **Tests first (TDD red-first).**

### Out (hard non-goals — reject any drift)
No authoring UI · no context-menu change · no toolbar change · no hover · no
Inspector · no Timeline · no Breakdown · no AI · no mark/schema change · no
`profile` field · no new normalization scheme · no pronoun/contextual resolution ·
no print/export change.

---

## 2. Verified touch-points (read from source 2026-06-05)

| # | File | Symbol | Current state | Change |
|---|---|---|---|---|
| A | `renderer/js/doc.js:353` | `_KNOWN_ENTITY_FIELDS` | `['id','name','color','notes','merged_into']` | add `'aliases'` |
| B | `renderer/js/doc.js:368` | `foldEntityMetadata` | folds color/notes; reports unknown, never copies (`aliases` would be **dropped on merge** today) | **union** survivor+loser `aliases` |
| C | `renderer/js/doc.js:308` | `addEntity` | rebuilds fixed shape `{id,name,color,notes}` — **does not spread `attrs`** | initialize `aliases: []` (cleanliness) |
| D | `renderer/js/doc-types/screenplay/plugins/tags.js:529` | `findOrCreateEntity` | matches selection vs live entity `name` only | also match `aliases`; tolerate **missing** `aliases` |
| E | `renderer/js/doc-types/screenplay/migrations/v3-to-v4.js` | *new file* | — | default `aliases: []` per entity; template = `v2-to-v3.js` |
| F | `renderer/js/doc-types/screenplay/migrations/index.js:42` | `migrate()` / `LATEST_VERSION` | early-returns on `_isV3`; `LATEST_VERSION='3.0'` | add `_isV4`, `v3toV4` branch, bump `LATEST_VERSION='4.0'` |
| G | `renderer/js/constants.js:8,11` | version constants | `CURRENT='3.0'`, `SUPPORTED=['1.0','1.1','2.0','3.0']` | `CURRENT='4.0'`, append `'4.0'` to SUPPORTED |

**Two corrections to the audit's S0 sketch (the audit understated both):**

- **(C/D) `addEntity` drops unknown fields** — it constructs a fixed-shape object,
  it does not spread `attrs`. New entities therefore won't carry `aliases` unless C
  is done. So **the resolver (D) MUST treat a missing/undefined `aliases` as `[]`**
  — that tolerance is load-bearing; the `addEntity` init (C) is for consistency only.
- **(F) the migration chain won't run a v3→v4 step by registration alone.**
  `migrate()` does `if (_isV3(version)) return current;` *before* applying any step,
  and `LATEST_VERSION` is hardcoded `'3.0'`. Registering `_steps.v3toV4` + bumping
  `constants.js` is **not enough** — `index.js` must be edited so v3 docs hop to v4
  and v4 is the new terminal version.

---

## 3. Data shape (locked by doctrine §3)

```js
// entity in tag_registry.<type>[]
{ id, name, color, notes, aliases /* string[], optional */ (, merged_into) }
```

- `aliases` is a flat array of surface strings. **No objects, no per-alias metadata
  in S0** (no "source", no "addedBy" — YAGNI; add later via migration if needed).
- Canonical `name` is **not** duplicated into `aliases`.
- Normalization for matching = existing rule only: `String(x).trim()` +
  case-insensitive compare. No diacritic/punctuation folding in S0.

---

## 4. Resolver contract (the heart of S0)

Extend `findOrCreateEntity(doc, tagType, name)` — **do not fork it** (Invariant III):

```
trimmed = trim(name); if empty → null
list = liveEntities(doc, tagType)   // already the lookup domain (tags.js:539)
norm = lowercase(trimmed)

matches = list where  lowercase(e.name) === norm
                 OR   (e.aliases || []).some(a => lowercase(trim(a)) === norm)

matches.length === 1 → return matches[0].id          // reuse (name or alias)
matches.length === 0 → addEntity(...) → return new id // unchanged create path
matches.length  >= 2 → NO confident match            // defensive; see doctrine §3
```

- `(e.aliases || [])` — **the missing-field tolerance is mandatory** (entities born
  via `addEntity` and any pre-migration file may lack the field).
- The `>= 2` branch is unreachable in S0 (no authoring ⇒ uniqueness holds). Decide
  its S0 behavior conservatively: **fall through to create** (matches today's
  no-confident-match outcome) — it must **never silently pick `matches[0]`**. A
  hand-edited `.rga` with a duplicate alias must not be able to corrupt identity.
- Name-vs-alias precedence is moot: doctrine §3 uniqueness is over names ∪ aliases,
  so a normalized string can match at most one live entity.

---

## 5. Merge fold (Invariant VI — or aliases vanish on merge)

In `foldEntityMetadata` (`doc.js:368`), after the notes block, **before** the
unknown-field report:

```js
// aliases — survivor keeps the union of both entities' aliases (case-insensitive
// dedupe). The loser's canonical NAME is NOT auto-promoted to an alias in S0
// (that is a merge-UX decision — doctrine §4).
```

- Union = survivor's aliases ∪ loser's aliases, deduped by the same normalization.
- Adding `'aliases'` to `_KNOWN_ENTITY_FIELDS` (change A) stops it being reported as
  "unknown"; the explicit union (change B) is what actually moves it. **Both are
  required** — the whitelist alone would just stop reporting it while still not
  copying it.

---

## 6. Migration v3 → v4

- **New file** `migrations/v3-to-v4.js`, template = `v2-to-v3.js` (pure JSON→JSON,
  preserves unknown fields, idempotent, registers `Rga.Migrations._steps.v3toV4`).
- Transform: `rga_version → '4.0'`; for each entity in every `tag_registry.<type>`
  list, if `aliases` is absent set `aliases = []`; **everything else preserved**
  (including `merged_into` tombstones — they get `aliases: []` too, harmless).
- **`index.js` (change F):** add `_isV4`; change the terminal guard to
  `if (_isV4(version)) return current;`; add
  `if (_isV3(version) && steps.v3toV4) { current = steps.v3toV4(current); hops++; continue; }`
  ordered **before** the v4 terminal check is reached on the next loop; bump
  `LATEST_VERSION = '4.0'`.
- **`constants.js` (change G):** `CURRENT_RGA_VERSION='4.0'`,
  `SUPPORTED_RGA_VERSIONS=['1.0','1.1','2.0','3.0','4.0']`.
- Load order note: `index.js` must load **after** `v3-to-v4.js` (same constraint as
  the existing steps — see `index.js` header comment).

---

## 7. Test plan (write RED first)

New: `tests/unit/doc-types/screenplay/migrations/v3-to-v4.test.js` and resolver/fold
cases alongside existing `tags`/`doc` unit suites.

1. **Migration default** — v3 doc with entities lacking `aliases` → every entity has
   `aliases: []`; `rga_version === '4.0'`; unknown entity fields preserved.
2. **Migration idempotent** — running v3→v4 twice is stable; existing non-empty
   `aliases` arrays are left untouched.
3. **Chain** — `Rga.Migrations.migrate()` on a v1/v2/v3 doc lands at `'4.0'`
   (proves change F wired the dispatcher, not just registered the step).
4. **Round-trip** — `serialize → deserialize` preserves `aliases` (and migrate
   round-trip survives save/load).
5. **Resolver: alias hit** — entity Nali with `aliases:['the teacher']`; resolving
   `(character,'The Teacher')` returns Nali's id; **no new entity created**.
6. **Resolver: name still wins** — resolving `(character,'Nali')` returns Nali's id
   (regression guard on existing behavior).
7. **Resolver: no match** — resolving unknown text creates exactly one new entity
   (unchanged create path).
8. **Resolver: missing-field tolerance** — entity with **no** `aliases` key resolves
   by name without throwing (proves `(e.aliases||[])`).
9. **Resolver: defensive ambiguity** — hand-built doc where two live entities share
   an alias → resolver does **not** return either id silently (creates, per §4).
10. **Merge fold union** — survivor `['a']` + loser `['b']` → survivor `['a','b']`;
    case-dupes collapse; loser's `name` is **not** added as an alias.
11. **Negative / no-regress** — an entity with `aliases:[]` behaves exactly as
    today everywhere.

---

## 8. Acceptance

- All new tests green; **full unit baseline must hold at 30 fail / 1834** (the known
  pre-existing clusters; **zero new failures**).
- No diff in print/export output, no mark/schema change, no visible UI change.
- `git grep` confirms no second resolver path was introduced (Invariant III).

---

## 9. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Merge silently drops aliases | High (identity loss) | Changes A+B together; test 10 fails red first |
| v3→v4 step never runs (dispatcher early-return) | High (migration is a no-op, undetected) | Change F + test 3 asserts the *chain* reaches `'4.0'`, not just the step in isolation |
| Resolver throws / mis-resolves on missing `aliases` | Med | `(e.aliases||[])`; test 8 |
| Generic pronoun poured into alias list → mass mis-resolution | High (deferred, but latent) | Doctrine §2/§10 forbids it; **S0 ships no authoring**, so unreachable until a UX slice — by then the boundary is law |
| Scope creep into UI/hover/Inspector during "just a small addition" | Med | §1 hard non-goals; reject in review |
| New normalization sneaks in (diacritics/punctuation) | Med | §3 freezes normalization to the existing rule; separate decision |
| Version bump breaks an external `.rga` reader | Low | Additive + `SUPPORTED` widened; round-trip test 4 |

---

## STOP

Brief only. **No code authorized.** Awaiting explicit go-ahead on this scope. If
authorized, build in this order: tests (red) → A/B (fold) → C/D (resolver) → E/F/G
(migration) → green → full-suite baseline check.
