# Registry Identity Integrity Audit

> **Investigation only — no code, no fixes, no UI, no follow-up work performed.**
> Scope: how entity identity fragmentation happens, what protects against it (and doesn't), who is harmed, and what the smallest safe fix would be.
> Evidence: live code at `main` @ `5a45e48b` · `playground-the-last-light.rga` · git history · Memory Phase 1 fixture tests.
> Date: 2026-06-02 · Investigator: Claude (Opus 4.8)

---

## Executive verdict

Identity fragmentation is not an edge case — **it is the default behavior of the primary tagging UI.** The toolbar Tag dropdown (the only discoverable tagging surface) creates a brand-new UUID entity on **every single use**, with no lookup, no reuse, no case check, nothing. A writer who tags "NALI" five times produces five NALI entities. The one code path that *does* deduplicate (`showTagDialog`, reachable only via the hidden Ctrl+Shift+T shortcut, characters only) proves the correct logic already exists in the codebase — **on the wrong path.**

A secondary, slower fragmentation source compounds it: the registry lives **outside ProseMirror state**, so undo (Ctrl+Z) reverts tag marks but never registry entries — every undone-then-redone tagging round-trip strands an orphan and mints a fresh duplicate.

One correction to the prior audit: `TAG_INTELLIGENCE_SCENE_LINKING_AUDIT.md` §3 described the toolbar path as having "case-insensitive registry match → reuse or addEntity." **That was wrong** — that logic belongs to `showTagDialog`, not the toolbar. The toolbar has never had it (verified against the pre-F1A.7 CORE version via git).

---

## 1. Current Identity Flow

### 1.1 What "identity" is today

An entity's identity **is its UUID** (`entity.id`). Name is display-only metadata. There is no constraint — not uniqueness, not normalization, not case policy — anywhere in the model:

```js
// doc.js:305-315 — the ONLY constructor. No checks of any kind.
function addEntity(doc, tagType, attrs) {
  const list = _registryList(doc, tagType);
  const entity = {
    id: attrs.id || crypto.randomUUID(),
    name: attrs.name || '',
    color: attrs.color || null,
    notes: attrs.notes || '',
  };
  list.push(entity);            // ← unconditional push
  return entity.id;
}
```

### 1.2 Creation path A — Toolbar Tag dropdown (PRIMARY, visible UI)

`toolbar-tag.js:67-91` (`_applyTagFromSelection`, F1A.7):

```
writer selects text → picks category in <select>
  → text = textBetween(sel).trim()
  → entityId = Rga.Doc.addEntity(doc, tagType, { name: text, color: null })   ← ALWAYS creates
  → addMark(tag { tagType, entityId })
  → markDirty
```

**No lookup. No reuse. Every invocation = one new entity.** Verified in current code (line 80) **and** in the pre-F1A.7 CORE original (`format-toolbar.js`, removed by commit `84815583`) — the git diff shows the old `applyTagFromSelection` was byte-equivalent on this point. The bug was not introduced by the F1A.7 migration; it was faithfully carried over. **The toolbar path has never deduplicated.**

### 1.3 Creation path B — `showTagDialog` (HIDDEN: Ctrl+Shift+T, characters only)

`plugins/tags.js:130-160`:

```
writer selects text → Ctrl+Shift+T
  → list = doc.tagRegistry[_registryKey[tagType]]            ← correct plural key (exported, verified)
  → existing = list.find(e => e.name.toLowerCase() === selectedText.toLowerCase())
  → existing ? REUSE existing.id : addEntity(new UUID)        ← the protection
  → applyTag
```

This is the correct logic. It is reachable only through a keyboard shortcut that is hard-wired to `'character'` (shortcuts.js:34-39), has no menu item, no toolbar presence, and no discoverability.

### 1.4 Creation path C — dead (scene-v2 autocomplete)

The retired ghost-text autocomplete + on-blur "Tag as NALI?" recognizer also reused registry entities (`startsWith` match). Deleted with the v3 redesign. Historical only.

---

## 2. Duplicate Sources (every path, ranked by volume)

| # | Path | Mechanism | Rate |
|---|---|---|---|
| **D1** | **Toolbar tagging — any repeat** | Path A never looks up. Tag "NALI" in scene 2, tag "NALI" again in scene 7 → two entities. | **Every repeated tag of the same thing.** This is the dominant source. |
| **D2** | Toolbar tagging — case/format variants | "NALI" / "Nali" / "nali " — irrelevant under D1 (no comparison happens at all), but guarantees that even a future exact-match check would miss these unless case-folded | Constant |
| **D3** | **Undo orphans → retag duplicates** | `doc.tagRegistry` is a plain JS object **outside PM state**. Undo removes the *mark*; the *entity* stays (orphan). Retagging the same text → new entity (D1). Registry changes are in no history at all — they cannot be undone, ever. | Every undo-retag cycle |
| **D4** | Curated-vs-live split | Hand-curated entries (the fixture's `ent-nali` with color + notes) are bypassed by D1 — live tagging creates parallel UUID twins; the curation (color, notes) silently stops applying to new marks | Whenever curation precedes tagging |
| **D5** | Cross-path split | Path B reuses, Path A doesn't. Tagging NALI via Ctrl+Shift+T then via toolbar → guaranteed pair. | Low (path B is hidden) |
| **D6** | Cross-document paste | Marks carry `entityId`; pasting tagged text into another script leaves a **dangling** entityId (no registry entry in the target). nav-index resolves `name: null`. Re-tagging there → new entity. Not duplication within one doc, but identity loss across docs. | Per paste |
| **D7** | Hand-edited / merged `.rga` files | No dedup on deserialize (doc.js:280 takes `tag_registry` as-is); external tools or merge conflicts can introduce anything | Rare |

**Ground truth (playground fixture, traced to live toolbar use during the scene-v2 era commits `27d4b914`/`7170a175`):**

| Person | Entities | How |
|---|---|---|
| NALI | `ent-nali` (curated) + `15201fa6-…` | D4: curated entry existed; toolbar tagging the scene-2 cue minted a twin |
| BABAN | `ent-baban` (curated) + `47a05ccf-…` ("BABAN") + `e578a64f-…` ("Baban") | D4 + D1: cue tag and action-text tag each minted their own |
| window (prop) | `52617b89-…` lowercase "window" | D1 |

The curated entities — the ones with colors and notes, the user's actual curation work — ended up as **orphans** (zero marks point at them), while all live marks point at the colorless accidental twins. Memory Phase 1's fixture tests assert exactly this.

---

## 3. Existing Safeguards

| Safeguard | Where | Covers | Verdict |
|---|---|---|---|
| Case-insensitive name reuse | `tags.js:showTagDialog` (lines 141-156) | Path B only (Ctrl+Shift+T, characters only) | **Right logic, wrong path.** The primary UI never executes it. |
| `_registryKey` plural-key mapping export | `doc.js:378` | Makes path B's lookup read the correct list | Working (verified — not a silent failure) |
| `findEntity(doc, tagType, id)` | `doc.js:317` | Lookup **by UUID only** — cannot detect name duplicates by design | Not an integrity safeguard |
| Trim | Both paths `.trim()` the selection | Leading/trailing whitespace | Trivial |
| — case normalization at storage | nowhere | — | **Absent** |
| — uniqueness constraint in `addEntity` | nowhere | — | **Absent** (moratorium-protected file) |
| — dedup on load (`deserialize`) | nowhere | — | **Absent** |
| — registry participation in undo history | nowhere (registry is outside PM state) | — | **Absent**, and architecturally non-trivial |
| — aliases / normalized-name field | nowhere in the entity shape | — | **Absent** |

---

## 4. Risk Assessment

### What identity *currently* is vs. what consumers *need* it to be

| Type | Identity today | What intelligence needs |
|---|---|---|
| Character | UUID, minted per tagging gesture | One identity per person in the story (NALI is one person), name-normalized, alias-capable (NALI = "Nali" = later "she") |
| Prop | UUID per gesture | One identity per physical object class ("PHOTOGRAPH") |
| Location | UUID per gesture; **additionally split from sceneHeading text** (heading "BABAN'S BEDROOM" and registry location "BABAN'S BEDROOM" have no link at all) | One identity per place, unified with slug locations |

### Severity

1. **Every downstream answer is wrong and gets wronger.** "Which scenes is NALI in" fragments across N entities; each new tagging action can increase N. This poisons: Memory (`entity()` answers for one shard), future navigator lists (NALI appears N times), breakdowns (cast lists double-count), AI context (N different people named NALI), MCP, server-side parse.
2. **The damage is persisted and compounds.** Duplicates are written into `.rga` and accumulate over a script's lifetime. Merge cost grows with every mark that points at every duplicate.
3. **User curation is silently discarded** (D4) — the entity that carries color/notes is exactly the one new marks don't point to.
4. **The future autocomplete/recognizer is poisoned in advance**: registry-based suggestion (the locked design from scene-v2, and the planned rebuild) would suggest "NALI" N times and link to an arbitrary shard.
5. **Memory Phase 1 makes this visible but cannot fix it** — by design, Memory reads what is there. The fixture tests permanently document the fragmentation as ground truth.

### What is NOT at risk

- Document text is never corrupted (marks are valid; they just point at fragmented identities).
- No data loss — every duplicate is recoverable/mergeable later; marks → entityId links are all intact.
- nav-index/SceneCatalog/Memory don't crash on duplicates; they faithfully report the fragmented reality.

---

## 5. Consumer Impact (who assumes what)

| Consumer | Assumption about identity | Behavior under duplicates |
|---|---|---|
| `tags.js` info popup / `removeTag` / `removeAllMarksForEntity` | Per-UUID operations | Correct per shard; "remove all NALI marks" requires N invocations the user can't know about |
| `tags.js showTagDialog` (path B) | **First** case-insensitive name match is *the* entity | With duplicates present, which shard wins is array-order luck |
| `nav-index` (`_composeTagsAndCharacters`) | One entry per entityId | Faithfully emits N entries for NALI; `cueCount`/`mentionCount`/`sceneAppearances` are each split across shards |
| `SceneCatalog.byScene` | Projects nav-index per scene | Scene lists show the same person as multiple rows |
| **`Memory` (Phase 1)** | `entity()` is per-UUID (honest); `entities()`/`coverage()` list all shards + flag orphans | Reports fragmentation truthfully — its fixture tests encode it as expected output, so **any future merge will require updating those assertions** (by design; they document reality) |
| Future autocomplete / recognizer | Registry is the suggestion source | Suggests duplicates; links new marks to arbitrary shards — **must not be rebuilt before integrity is addressed** |
| Future dedup/merge tooling | Needs to see all shards + all marks per shard | Memory.entities() + entity() already provide exactly this — the read side of the merge is done |
| Export / Print / Editor / Search / SlugResolver | None (don't read the registry) | Unaffected |

---

## 6. Recommended Direction

### Options evaluated

**A — Prevent duplicates only (caller-side reuse-before-create).**
Port the *existing, proven* `showTagDialog` lookup into the toolbar path so both creation paths reuse case-insensitively. Stops the bleeding immediately.
✅ Smallest change; logic already exists in the same plugin; **no moratorium contact** (toolbar-tag.js and tags.js are plugin files; `addEntity` itself stays untouched).
❌ Heals nothing: existing duplicates (in fixtures and in any real script written so far) remain; undo-orphans (D3) still accumulate (orphans are not duplicates, though — they're inert).
❌ Exact/case match only — "DR. HASSAN" vs "DR HASSAN" still splits (acceptable for now; that's alias territory).

**B — Detect + merge duplicates.**
A merge operation: choose a survivor, rewrite all marks pointing at losers (machinery half-exists: `removeAllMarksForEntity` walks marks by entityId; a `remapEntityId` variant is the same walk with `addMark` instead of `removeMark`), delete loser entries.
✅ Heals existing damage; the only way the playground/real scripts get clean.
❌ Requires policy decisions that are the user's, not an engineer's: survivor selection (curated `ent-*` wins? oldest? most marks?), what happens to diverging colors/notes, and whether merge is automatic or reviewed.
❌ Touches more surface: a write operation over the document (mark rewriting) + registry mutation → needs its own slice with its own tests, and arguably a small UI (review-before-merge), which this mission forbids designing.

**C — Canonical registry model.**
Identity = (tagType, normalized name) enforced at the registry boundary; UUID becomes a stable handle, not the identity; `aliases[]` added to the entity shape for variants and future pronoun work.
✅ The durable end state; what screenplay intelligence actually needs.
❌ **Collides with the contamination-triad moratorium head-on** (`Rga.Doc.addEntity` / `tagRegistry` are off-limits) and changes the entity shape (a schema-adjacent change to what `.rga` persists).
❌ Premature until A has stopped the inflow and B has defined merge policy — C is where A and B converge, not where to start.

**D — Other: do nothing until autocomplete rebuild.**
Rejected. The recognizer would be built on poisoned ground and make N grow faster.

### Recommendation

**A → B → C, in that order, as three separately-authorized slices.**

A is this-week-sized and moratorium-clean. B needs the user's merge policy (one short decision session). C is the real model and should be designed when the contamination-triad moratorium is formally reviewed — with A and B's experience informing it. The audit recommends **not** rebuilding autocomplete/recognition until at least A and B have landed.

---

## 7. Smallest Safe Fix

**Slice: "Reuse-before-create in the toolbar tag path" — one function, one plugin file, no moratorium contact.**

`toolbar-tag.js:_applyTagFromSelection` gains the same lookup `showTagDialog` already performs (case-insensitive name match within the tagType's registry list → reuse the existing `entityId`; create only when no match). Ideally both paths call one shared helper inside the plugin (`tags.js` already exposes `Rga.Tags`; the helper belongs there) so the logic can never diverge again.

- **Files**: `toolbar-tag.js` (+ ~8 lines), optionally `plugins/tags.js` (extract shared `_findOrCreateEntity`), one new unit test file or additions to `toolbar-tag.test.js`.
- **Untouched**: `doc.js` (`addEntity` stays dumb — the constraint lives in the callers for now), `nav-index`, schema, marks, `.rga` format, all UI.
- **Test (TDD red first)**: tag "NALI" twice via the toolbar handler → registry has **one** NALI entity, both marks share its id. Tag "Nali" (case variant) → still one. Tag "NALI" as a *prop* → a second entity is correct (type-scoped identity).
- **Explicitly out of scope**: merging existing duplicates (that's B), undo-orphan prevention (registry/PM-state coupling — needs its own design), aliases, normalization beyond case-folding, sceneHeading↔location linking.

**Effect**: D1, D2, D4, D5 stop. D3 keeps producing *orphans* but no longer duplicates (retag finds the survivor). Existing duplicates remain until B.

---

## Appendix — Evidence Index

- Toolbar path (no dedup): `renderer/js/doc-types/screenplay/toolbar-tag.js:67-91` (current) · `git show 84815583 -- renderer/js/format-toolbar.js` (pre-F1A.7 original, also no dedup)
- Protected path: `renderer/js/doc-types/screenplay/plugins/tags.js:130-160` (`showTagDialog`) · shortcut wiring `renderer/js/editor/shortcuts.js:34-39`
- Registry constructor (no constraints): `renderer/js/doc.js:305-315`; exports incl. `_registryKey`: `doc.js:364-379`
- Registry outside PM state / undo: `doc.js:107,164,280` (plain object on the doc model; serialized directly)
- No dedup on load: `doc.js:280`
- Fixture duplicates + their origin commits: `tests/fixtures/playground-the-last-light.rga` · `git log -- tests/fixtures/playground-the-last-light.rga` (`27d4b914`, `7170a175`)
- Fragmentation as executable ground truth: `tests/unit/doc-types/screenplay/memory.test.js` (fixture tests)
- Prior-audit correction: `TAG_INTELLIGENCE_SCENE_LINKING_AUDIT.md` §3 row "Tag creation UI" attributed path B's logic to path A — superseded by §1 of this audit.
