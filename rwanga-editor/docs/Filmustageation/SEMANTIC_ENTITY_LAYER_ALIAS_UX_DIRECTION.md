# Semantic Entity Layer — Alias UX Direction

> **Direction only. No implementation, no schema changes, no slices started.**
> Surface: the writer's path from a *mention* to an *identity*.
> Grounded in: `library/js/tag-system.js` (tag registry, `Tag As` context menu, Inspector), `FILMUSTAGEATION_POST_F1A_REVIEW.md` §4 (the `tagRegistry` / `addEntity` / `schema.marks.tag` triad), the Scene Sidebar Catalogue UX Direction, and the locked Semantic Entity Layer doctrine.
> Date: 2026-06-05

This package designs **one thing**: how a writer creates and understands an alias.

It is **not** Inspector, **not** Timeline, **not** AI, **not** Character Profiles, **not** a merge tool. Those all *read* identity. This designs the one place a writer *writes* it.

---

## 0. The model, in the writer's words

The architecture is already three links long:

```
Mention  →  Entity ID  →  Entity
```

- A **mention** is a `schema.marks.tag` span in the manuscript — it carries `data-tag-id` + `data-tag-type`. It is a *surface form*: the actual words on the page.
- An **entity** is a registry record — `{ id, name, type, occurrences, notes }`. Doctrine adds one field: **`aliases: string[]`**.
- The **resolver** now follows `mention.tagId → entity`, alias-aware.

What is missing is the writer's hand on the middle link. Today `tagSelection('character', 'The Teacher')` *mints a new entity called "The Teacher."* There is no way to say **"The Teacher" means Nali.**

> **One entity. Many names.**
> Nali. The Teacher. The Old Man. The Poet. — one identity, four surface forms.
> The writer writes a name, points it at an identity, and every other surface reads that identity. Forever.

This is **not** a merge. We never create a duplicate entity and then fold it. We tag the mention straight onto the existing entity and remember the surface form. There is nothing to undo, reconcile, or de-duplicate.

---

## 1. Recommended UX — "Tag As, deepened"

**Keep the single verb.** The writer already knows one move: select text → right-click → **Tag "…" as → [Type]**. We do not add an `Alias Of` verb. We deepen the verb that exists.

### 1.1 The mention path (today, unchanged)

> Select `Nali` → right-click → **Tag "Nali" as… → Character**

The first time a distinctive surface form is tagged as a type, it **becomes** the canonical entity, with that text as its name. This is the existing `_findByNameAndType` → `_createEntity` path. Nothing changes. **Naming the thing the first time is creating the entity.**

### 1.2 The alias path (new)

> Select `The Teacher` → right-click → **Tag "The Teacher" as… → Character →**

When the type already has entities **and** the selected text is not an exact match of one of them, the type opens an **Entity Picker** as its submenu:

```
Tag "The Teacher" as ▸
  Character ▸
    ↳  New Character — "The Teacher"        ← default, focused
    ─────────────────────────────
    ⌕ filter…              (appears only past ~7 entities)
    ●  Nali            4
    ●  Baban           7
    ●  Maryam          2
  Prop ▸
  Location ▸
  …
```

- **New Character** → mint a fresh entity (canonical name `"The Teacher"`). The existing fast path.
- **Nali** → tag the mention with **Nali's** entity ID, and push `"The Teacher"` into `Nali.aliases`.

A toast says what just happened, in plain language:

> ✓ **"The Teacher"** is now an alias of **Nali.**

That toast is the entire lesson. The writer never opened a manager, never saw an entity ID, never made a duplicate.

### 1.3 Why the picker, not a second verb

Choosing the **type** already narrows the candidates — a writer aliasing "The Teacher" knows they mean a *character.* So the type submenu is exactly where the candidate list belongs. The picker turns one decision ("what kind of thing is this?") into the place a second decision lives ("is it someone I already named?") — without a new top-level verb and without ever asking the writer to pre-classify *new vs. alias* before they've seen the options.

**Fast path preserved:** if the selected text is an exact match of an existing entity of that type, we tag it straight to that entity silently (today's behaviour). The picker only appears when the surface form is genuinely new and a decision is genuinely required.

---

## 2. How the writer *understands* an alias

Color in this system is **per type**, not per entity (`Rga.Color.getTagColor(type)` — every character is `#4FC1FF`). So color can never tell two characters apart. Identity has to be carried elsewhere, on three escalating surfaces.

### 2.1 On the page — the alias marker

Canonical mentions render as today: type-colored highlight, **solid** bottom border. Alias mentions render in the same type color but with a **dotted** bottom border. Hover names the identity:

> `The Teacher` → **Character: Nali · alias**

The rule a writer internalises in one sitting: **solid = the name I gave them; dotted = another word for someone I already named.** Same color says "character"; the marker and tooltip say *which* character.

### 2.2 In the sidebar — nesting under one entity

The Tag Manager groups entities by type and lists `● name  count`. An entity with aliases shows them on a muted secondary line:

```
Characters
  ●  Nali              4
       also: The Teacher · The Old Man
  ●  Baban             7
       also: The Butcher
```

One entity, one row, its other names tucked beneath it — never a second row that could be mistaken for a second character. (S2 makes the alias line expandable to per-alias occurrence counts; the seed of Character Profiles.)

### 2.3 In the Inspector — "Also known as"

The entity detail panel gains one field below **Name**: **Also known as**, rendering each alias as a removable chip with its own occurrence count. This is the only place an alias is edited after creation — and it is the seed that grows into the Character Profile.

---

## 3. The smallest UI that teaches identity

The picker **is** the teaching surface. At the exact moment the writer tags "The Teacher," seeing `New Character` sitting above `Nali · Baban · Maryam` poses the question — *new person, or someone I've met?* — in situ, with no screen, no manager, no admin. The toast then narrates the answer in one sentence. Discovery escalates only if the writer goes looking: page marker → sidebar line → Inspector field. Nothing is pushed; everything is glanceable.

We **do not** build: an alias manager, a merge dialog, a duplicate-resolution queue, an entity database table, or any admin screen. Filmustageation is writer-first; entity internals stay internal.

---

## 4. Rejected directions

| # | Option | Why rejected |
|---|---|---|
| R1 | **A separate `Alias Of →` verb** beside `Tag As` | Forces the writer to decide *new vs. alias* before seeing candidates; doubles the menu; leaks the entity/alias internal distinction into the writer's vocabulary. |
| R2 | **A dedicated "Manage Aliases" dialog / screen** | A database manager. Violates writer-first doctrine; exposes entity internals; turns identity into administration. |
| R3 | **Auto-alias by fuzzy / AI name matching** ("The Teacher" ≈ "Teacher") | Silent identity decisions are dangerous — identity is always the writer's call. (Pronoun resolution is explicitly future, context-resolution work and out of scope here.) |
| R4 | **Drag one tag onto another to alias** | Invisible, undiscoverable affordance; and it *reads* as a merge — exactly the mental model doctrine forbids. |
| R5 | **An "☑ this is an alias of…" checkbox in the create dialog** | Adds modal friction to the single most frequent action (tagging), to serve the rarer one (aliasing). Inverts the cost. |

---

## 5. Future compatibility

The whole design rests on one discipline: **the alias action writes identity to exactly one place — `entity.aliases` plus the mention's `tagId` — and every other surface only ever *reads* identity by entity ID.** Because no consumer reads surface strings, none of them needs the alias workflow to change when they ship.

| Future surface | What it inherits for free |
|---|---|
| **Character Profiles** | The profile is the Inspector entity view grown up. `aliases` is already a populated field; "Also known as" is already rendered. |
| **Inspector** | Already entity-scoped. Renders `aliases`; no new contract. |
| **Timeline** | Scene presence is computed per entity ID. "The Teacher" in scene 12 already counts as Nali present — no alias-specific code. |
| **AI** | Reads `{ id, canonical, aliases[] }` from the resolver, never raw strings. Understands that four phrases are one character with zero prompt engineering. |
| **MCP** | Exposes the same entity record. Identity travels across the boundary intact. |

Crucially, this design **does not touch `schema.marks.tag`** — the surface the F1A review flags as *dangerous* and *load-bearing* (every saved `.rga` depends on its shape; a second doc-type would collide on it). Aliases are an **additive field on the registry record**, written through the existing `addEntity` path. No new mark, no `.rga` migration for new files, no widening of the contamination triad.

---

## 6. Implementation guidance for engineering

All in `library/js/tag-system.js` (mirror in the v3 `plugins/context-menu.js` / `tags.js` path). **Direction, not code.**

1. **Entity shape** — add `aliases: []` to `_createEntity`; thread it through `serializeRegistry` / `loadRegistry`. Default `[]` on legacy load.
2. **`_buildTagTypeSubmenu`** — each type item, instead of an immediate `action`, becomes a **submenu** (the Entity Picker) *when entities of that type exist and the text isn't an exact match*. First item `New {Type}: "{text}"`; then existing entities (dot + name + count); a filter input past ~7 rows.
3. **`tagSelection(type, text, entityId?)`** — add the optional `entityId`. When present and `text` ≠ `entity.name` (case-insensitive), `entity.aliases.push(text)` (dedupe). When absent, today's find-or-create.
4. **Resolver** — already keyed by `tagId`; make alias lookups read `entity.aliases` so name→entity resolution finds them. No schema change.
5. **Inline render** — `.tag-highlight[data-alias="true"]` → dotted bottom border; tooltip `"{TypeLabel}: {entity.name} · alias"`.
6. **`updateManagerPanel`** — render the `also:` line when `entity.aliases.length`.
7. **Inspector `_showInInspector`** — add the **Also known as** field (removable chips, per-alias counts).
8. **Do not** add a mark, a registry key, or a migration. `tagRegistry` keys are untouched; `aliases` rides on the existing per-entity record.

---

## 7. Risks & open questions

| Risk | Mitigation |
|---|---|
| **Submenu depth** — alias picker is a third right-click level | Filter input past ~7 entities; full keyboard nav; the picker only opens when a decision is actually needed (fast path otherwise). |
| **Accidental alias** (picked the wrong entity) | Undo restores prior state; the toast names the entity so the error is caught immediately; the alias chip in the Inspector is one click to remove. |
| **Per-type color collision** — two characters' aliases look identical inline | By design — color means *type.* Identity lives in the marker, tooltip, and sidebar nesting (§2). Do not introduce per-entity color; it breaks the type-color contract the whole editor relies on. |
| **Pre-existing duplicate entities** — writers already minted "The Teacher" as its own character before this shipped | See §8. A bounded, opt-in *reconcile* affordance — explicitly **not** the alias-creation flow and not a routine verb. |
| **Removing an alias** — what happens to its mentions? | S2: removing an alias detaches its mentions (they revert to plain text) with undo. Never silently re-points or deletes the entity. |
| **Pronoun boundary** | `He / She / They` are **out of scope** — future context-resolution work. This package designs distinctive aliases only (The Teacher, The Butcher, The Old Man). |

---

## 8. Migration path toward Character Profiles

Two things must be true for this to grow into Profiles cleanly.

**A — Reconcile, not merge (bounded, opt-in).** Files written before this shipped may contain two entities that are really one person (a "The Teacher" character minted because there was no alias path). This is the *only* place anything merge-shaped is permitted, and it is framed as **repair, not a feature**: from an entity's Inspector, *"This is actually… → Nali"* re-points that entity's mentions onto Nali and folds its name into `Nali.aliases`. It is **not** in the right-click tagging flow, **not** a routine writer verb, and **not** surfaced as "merge." It exists to clean up the pre-alias past, once, and then recede.

**B — The Inspector entity view is the Profile seed.** "Also known as" (§2.3) is the first Profile field. When Profiles ship, they are the same entity record with more fields (description, relationships, arc) — the alias workflow underneath is unchanged, because it only ever wrote identity.

---

## Recommended slices

**S1 — Create an alias (the whole loop).**
Entity `aliases` field + serialize/load · `Tag As → Type` deepened into the Entity Picker (New vs. existing) · `tagSelection(type, text, entityId?)` writes the alias · resolver alias-aware · inline dotted-underline marker + tooltip · confirmation toast. **No schema change. No `.rga` migration.** This is the complete writer-facing create-an-alias experience.

**S2 — See & manage aliases.**
Sidebar `also:` line (expandable to per-alias counts) · Inspector **Also known as** field (removable chips, per-alias occurrence counts) · remove-alias detaches mentions with undo. This is the discovery + light-management layer, and the direct seed of Character Profiles.

# STOP

This is a design package. No code has been written, no schema touched, no slice authorised. The `schema.marks.tag` surface is deliberately left alone. Authorising S1 (or rejecting it) belongs to the user, not to this document.
