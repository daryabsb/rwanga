# Semantic Entity Layer — Alias UX Reconciliation

**Status:** Reconciliation pass. **No implementation.** Reconciles
`SEMANTIC_ENTITY_LAYER_ALIAS_UX_DIRECTION.md` (designer, 2026-06-05) against current
`main` (`7942263a`, `.rga` v4 / `entity.aliases` shipped).
**Date:** 2026-06-05
**Sources of truth:** `SEMANTIC_ENTITY_LAYER_DOCTRINE_LOCK.md`,
`SEMANTIC_ENTITY_LAYER_S0_IMPLEMENTATION_BRIEF.md`, and the live S0 code.

> **Headline:** the UX *direction* is sound and doctrine-aligned (single verb,
> picker-not-second-verb, derived identity surfaces, pronouns out, Alias ≠ Merge).
> The **grounding is stale**: it is written against a `library/js/tag-system.js`
> architecture and function names that **do not exist** in this codebase, and it
> does not know S0 already shipped the data/migration/resolver layer. Re-ground the
> file map and strip the already-shipped work from S1; the design itself stands.

---

## 1. Drift table

| # | Designer claim | Reality on `main` | Severity | Resolution |
|---|---|---|---|---|
| D1 | Grounded in `library/js/tag-system.js`; functions `_buildTagTypeSubmenu`, `tagSelection`, `_findByNameAndType`, `_createEntity`, `serializeRegistry`, `loadRegistry`, `updateManagerPanel`, `_showInInspector`, `Rga.Color.getTagColor` | **None of these files/symbols exist.** `library/js/tag-system.js` is absent; the named functions are absent from `renderer/`. | **HIGH** | Re-ground to the real file map (§2). Treat §6 as concept, not API. |
| D2 | "No `.rga` migration"; §6.1 "add `aliases:[]`… thread through serialize/load, default `[]` on legacy load" | **Already shipped in S0.** v3→v4 migration defaults `aliases:[]`; `serialize`/`deserialize` round-trip it; `CURRENT_RGA_VERSION='4.0'`. | **MEDIUM (stale)** | "No *new* migration in S1" is TRUE — *because it is already done*, not because aliases skip migration. Do **not** redo persistence. |
| D3 | S1 includes resolver "make alias lookups read `entity.aliases`" (§6.4) and find-or-create (§6.3 no-id path) | **Already shipped in S0.** `findOrCreateEntity` resolves text → entity over name **and** aliases (name-first, alias-fallback, collision-defensive). | **MEDIUM (repeat)** | Strike resolver + find-or-create from S1. S0 owns text→identity. |
| D4 | §6.5 inline marker keyed off `.tag-highlight[data-alias="true"]` | The `tag` mark stores **only** `{tagType, entityId}`; DOM class is `.rga-tag`; there is **no** `data-alias` and adding one = a `schema.marks.tag` change. | **HIGH** | **Derive** alias-ness at render time (mention surface text ≠ entity canonical name **and** ∈ `entity.aliases`) as a decoration on `.rga-tag`. **Never** add a mark attr. Real selector is `.rga-tag`. |
| D5 | Mention carries `data-tag-id`; "resolver follows `mention.tagId → entity`" | Mark attr is `entityId` → DOM `data-entity-id`. mention→entity is **direct** (the id is on the mark); the alias-aware part is **text→entity at tag time** (already S0). | **LOW** | Naming fix; no separate "tagId→entity alias resolver" to build. |
| D6 | "Does not touch `schema.marks.tag`" (§5, §7, STOP) | Correct and binding. | **ALIGNED** | Reinforced — but see D4: the derived marker is the *mechanism that keeps this true*. |
| D7 | Pronouns (He/She/They) out of scope; distinctive aliases only (R3, §0, §7) | Matches DOCTRINE_LOCK §2 + Invariant X. | **ALIGNED** | Keep. The picker must not offer/accept generic pronouns as stored aliases. |
| D8 | Alias ≠ Merge; "reconcile, not merge" is bounded/opt-in/repair (§0, §8A) | Matches DOCTRINE_LOCK Invariant IX. | **ALIGNED** | Keep. **§8A reconcile is future (S2+ repair), NOT S1.** |
| D9 | §6.3 `tagSelection(type, text, entityId?)` "`entity.aliases.push(text)`" | **No alias-append mutation exists.** S0 added fold-union, resolver-read, `addEntity` init — but no `addAlias`. A raw `.push` would bypass dedupe + the §3 uniqueness guard + Alias≠Merge discipline. | **MEDIUM (gap)** | S1 must add a real `Rga.Doc.addAlias(doc, type, entityId, surface)` mutation (dedupe, uniqueness over names ∪ aliases per type, **no tombstone**). |

---

## 2. Real file map (replace the phantom one in §6)

| Designer concept | Real location on `main` |
|---|---|
| Tag-as submenu / `_buildTagTypeSubmenu` | `renderer/js/doc-types/screenplay/plugins/context-menu.js` (Tag submenu ~line 187–236; each type currently → `Rga.Tags.showTagDialog(view, key)`) |
| `tagSelection` / tag-apply | `renderer/js/doc-types/screenplay/plugins/tags.js` — `showTagDialog` → `findOrCreateEntity` → `applyTag` |
| `_findByNameAndType` / `_createEntity` | `tags.js findOrCreateEntity` + `doc.js addEntity` (both shipped) |
| `serializeRegistry` / `loadRegistry` | `doc.js serialize` / `deserialize` (`tag_registry` pass-through; shipped) |
| `updateManagerPanel` (sidebar) | `tags.js renderTagsPanel` (line 285) — *S2 surface* |
| `_showInInspector` | `renderer/js/shell/inspector.js` (frame only today) — *S2 surface* |
| `Rga.Color.getTagColor` | `renderer/js/utils.js getTagColor` |
| mention mark | `renderer/js/framework/base-outer-marks.js` (`{tagType, entityId}`, `.rga-tag`, `data-entity-id`) — **do not touch** |

---

## 3. Corrected S1 scope

**Already shipped in S0 — S1 must NOT redo (D2/D3):**
`entity.aliases` field · serialize/deserialize round-trip · `v3→v4` migration +
`aliases:[]` default · text→entity resolver consulting name **and** aliases.

**S1 builds (net-new: write path + UI + derived render only):**
1. **`Rga.Doc.addAlias(doc, type, entityId, surface)`** — append an alias with
   dedupe + uniqueness over names ∪ aliases within the type (doctrine §3); refuse
   to create a tombstone or second entity (Alias ≠ Merge); reject empty.
2. **Entity Picker submenu** (`context-menu.js`) — each type item becomes a submenu:
   `New {Type} — "{text}"` (focused default) + live entities (name + count) +
   filter past ~7. **Fast path preserved:** exact name match still tags silently.
3. **"Tag as existing entity" wiring** (`tags.js`) — apply the mark with the chosen
   `entityId` (`applyTag`) and, when surface text ≠ canonical name, call `addAlias`.
4. **Derived alias marker + hover tooltip** — a render-time decoration on `.rga-tag`
   (dotted bottom border) when the mention's surface text is a known alias of its
   entity; tooltip `"{Type}: {canonical} · alias"`. **No mark attr; no schema
   change.** Note: hover does not exist today (only a click popup) — the tooltip is
   net-new.
5. **Confirmation toast** — "✓ '{surface}' is now an alias of {canonical}."
6. **Tests (TDD red-first)** — `addAlias` (dedupe/uniqueness/no-tombstone), picker
   build logic, alias write path, derived-marker classification (alias vs canonical),
   negative (exact match → silent fast path, no picker).

**Deferred to S2 (designer agrees):** sidebar `also:` line, Inspector "Also known
as", remove-alias. **Future repair (not a slice yet):** §8A reconcile.

---

## 4. Files S1 will likely touch

- `renderer/js/doc.js` — new `addAlias` mutation (+ export).
- `renderer/js/doc-types/screenplay/plugins/context-menu.js` — Entity Picker submenu.
- `renderer/js/doc-types/screenplay/plugins/tags.js` — tag-as-existing write path; a
  decoration/classifier for derived alias marks (or a small sibling plugin, à la
  `tag-focus-highlight.js`).
- `renderer/css/editor-prosemirror.css` — dotted-underline alias style on `.rga-tag`.
- `tests/unit/...` + `tests/e2e/filmustageation/...` — new coverage.

**Explicitly NOT touched:** `base-outer-marks.js` (`schema.marks.tag`), the
migrations chain, `constants.js`. (No version bump in S1.)

---

## 5. Open questions for design (carry into S1 authorization)

- **Derived-marker cost.** Classifying every `.rga-tag` as canonical-vs-alias means a
  per-mention lookup (surface text vs entity name/aliases). Acceptable as a decoration
  pass? (Likely yes — mirrors `tag-focus-highlight`.)
- **Alias uniqueness collision at pick time.** If the chosen surface text already
  belongs to *another* entity in the type, doctrine §3 says reject/prompt — what does
  the picker show? (Design owns the prompt.)
- **Surface "alias" of the canonical name itself.** Tagging the exact canonical text
  must NOT add it as an alias (it is the name) — confirm the fast path covers this.

---

## STOP

Reconciliation only. No code, no schema, no slice authorized. S1 remains the user's
to authorize against the **corrected** scope above — not the designer's §6 file map.
Do not begin S1, alias UI, Inspector, Timeline, or AI work.
