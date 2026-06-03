# Scoped Registry Merge API Design — Identity Merge Slice B

> **Design only — no code, no source changes performed.**
> Scope: the exact `Rga.Doc` API surface that gives the merge operation controlled registry access, the `.rga` format impact, the moratorium boundary it draws, and the consumer rules that keep tombstones invisible where they must be invisible.
> Authority: `IDENTITY_MERGE_POLICY_AUDIT.md` (approved: hybrid survivor · notes concatenate with attribution · tombstones · top-level merge log · reviewed merge only).
> Evidence: live code at `main` @ `01567327` · `doc.js` flagLog precedent · migration unknown-field contract.
> Date: 2026-06-03 · Designer: Claude (Opus 4.8)

---

## Design principles

1. **The narrowest grant that works.** Every API does one thing, validates everything, and cannot be composed into anything more destructive than what the policy authorizes. No generic `updateEntity` setter — that would be uncontrolled mutation with extra steps.
2. **doc.js owns entity semantics; callers own policy.** Survivor *selection* (the hybrid rule, user choice on ties) happens in the caller/UI. What a fold *means* (color survivor-wins, notes concatenate) is entity-shape knowledge and lives in doc.js, in one place, forever.
3. **Every operation is re-runnable.** The policy audit's crash-state analysis (§6) becomes an API property: calling any of these twice, or crashing between any two, leaves a harmless, resumable state.
4. **Mirror the flagLog precedent exactly.** `flagLog` ↔ `flag_log` + `addFlagLogEntry` is the existing pattern for "a doc-level log that serializes" (doc.js:108/165/281/332-335). `mergeLog` ↔ `merge_log` + `appendMergeLog` copies it line-for-line in spirit.

---

## 1. API Surface

Nine touches total: **3 mutation APIs** (the actual moratorium grant), **3 read APIs** (filtering/resolution support), **3 internal line-level changes** (create/serialize/deserialize).

### 1.1 Mutation APIs

#### `Rga.Doc.markEntityMerged(doc, tagType, loserId, survivorId) → boolean`

Writes the tombstone: `loser.merged_into = survivorId`. Nothing else — no mark contact, no deletion, no survivor mutation.

| Precondition check | Result |
|---|---|
| loser not found in `registry[tagType]` | `false`, no change |
| survivor not found in `registry[tagType]` | `false`, no change |
| `loserId === survivorId` | `false`, no change |
| survivor is itself tombstoned (`merged_into` set) | `false`, no change — **the API never creates chains** |
| loser already merged into the *same* survivor | `true`, no change — **idempotent no-op** (re-runnability) |
| loser already merged into a *different* survivor | `false`, no change — conflict; the caller must surface it to the user, never overwrite |
| all checks pass | sets `loser.merged_into = survivorId`, returns `true` |

#### `Rga.Doc.foldEntityMetadata(doc, tagType, survivorId, loserId) → FoldSummary | null`

Applies the approved §3 metadata rules (policy audit), in doc.js because that is where the entity shape is owned:

| Field | Rule applied |
|---|---|
| `color` | survivor's stays if non-null; else loser's non-null color is copied over |
| `notes` | survivor's stays if loser's are empty; if loser has notes, **append** with attribution separator: `\n--- merged from "<loser.name>" (<loserId>) ---\n<loser notes>` |
| `name` | never touched (survivor's casing stands); loser's name reported in the summary |
| `id` | never touched |
| unknown loser fields | **never copied** (survivor-wins rule for unknown semantics); listed in the summary so the log preserves them |

Returns a `FoldSummary` (this becomes part of the log record — the caller never recomputes what moved):

```
{ loser_name: "Nali",
  color_moved: "#4FC1FF" | null,     // null = nothing moved
  notes_appended: true | false,
  unknown_fields: { ... } | null }   // verbatim copy of unrecognized loser fields
```

| Precondition check | Result |
|---|---|
| survivor or loser not found | `null`, no change |
| **loser already tombstoned** | `null`, no change — prevents double-folding (notes would concatenate twice). This forces the documented call order: fold **before** mark. |
| survivor tombstoned | `null`, no change |

#### `Rga.Doc.appendMergeLog(doc, record) → record | null`

Mirrors `addFlagLogEntry` (doc.js:332-335) with two additions: lazy-initializes `doc.mergeLog`, stamps `merged_at` (ISO timestamp) if absent, and validates the minimal shape.

| Precondition check | Result |
|---|---|
| `record.tag_type` missing, `record.survivor.id` missing, or `record.losers` empty/not-array | `null`, nothing appended — a log that can contain malformed records is not a log |
| valid | pushes to `doc.mergeLog`, returns the completed (stamped) record |

### 1.2 Read APIs (no mutation)

#### `Rga.Doc.isEntityMerged(doc, tagType, entityId) → boolean | null`

`null` = entity not found (Memory's null semantics: "could not derive" ≠ "no"). `true`/`false` otherwise. Encapsulates the field name so no consumer ever spells `merged_into` itself.

#### `Rga.Doc.resolveEntityId(doc, tagType, entityId) → string | null`

Follows the `merged_into` chain to the live entity: not merged → its own id; merged → the survivor's id (chained, with a cycle/depth guard for hand-edited files); chain ends at a missing entity → `null`. This is what makes undo-restored loser marks, stale `references[]` entries, and future Memory Phase 2 lookups display correctly.

#### `Rga.Doc.liveEntities(doc, tagType) → Entity[]`

Fresh array of the non-tombstoned entities in `registry[tagType]` (same object references, consistent with `findEntity`). **This is the only legal suggestion/listing source** for any UI that offers entities to the user (consumer rule C3, §4).

### 1.3 Internal line-level changes (not APIs)

| Location | Change |
|---|---|
| `create()` (doc.js:92-114) | `mergeLog: []` alongside `flagLog: []` |
| `serialize()` (doc.js:157-170) | `merge_log: doc.mergeLog \|\| []` alongside `flag_log` |
| `_buildDocFromParsed()` (doc.js:261-286) | `mergeLog: parsed.merge_log \|\| []` alongside `flagLog` |

### 1.4 The documented call order (for the Slice B2 merge operation)

```
1. PM mark rewrite          (tags.js — one transaction, undoable)
2. Rga.Doc.foldEntityMetadata(doc, tagType, survivorId, loserId)   → summary
3. Rga.Doc.markEntityMerged(doc, tagType, loserId, survivorId)     → true
4. Rga.Doc.appendMergeLog(doc, { tag_type, survivor, losers:[{…, mark_count}], metadata_moved: summary })
5. Rga.Doc.markDirty(doc)
```

Fold-before-mark is enforced by the APIs themselves (fold refuses tombstoned losers). A crash after any step leaves: (1) mark-less inert losers, (2) + enriched survivor, (3) + tombstones, (4) + record — every state harmless, every state resumable by re-running from step 2 (fold no-ops, mark no-ops, log append is the only step needing a duplicate-check by the caller, keyed on survivor+losers+absent log entry).

### 1.5 Explicitly NOT in this surface

- **No `deleteEntity` / compaction API.** Tombstone removal is a separate future grant (policy audit §5).
- **No `updateEntity` generic setter.**
- **No survivor-selection logic.** The hybrid rule and tie-breaking UI live in the caller.
- **No mark operations.** doc.js never touches ProseMirror; that boundary is existing and stays.

---

## 2. `.rga` Format Impact

### 2.1 Two additive fields, version stays 3.0

| Field | Where | Old files | New files in old apps |
|---|---|---|---|
| `merged_into: "<entityId>"` | optional, on individual registry entity objects | absent → not merged | **survives round-trip** — the registry is serialized/deserialized by reference (doc.js:164/280); entity-level fields pass through untouched |
| `merge_log: [ … ]` | optional, top-level (sibling of `flag_log`) | absent → `doc.mergeLog = []` | **dropped on save by pre-Slice-B apps** — `_buildDocFromParsed` only maps known keys. Honest limitation: mixed-version editing loses merge *history*; the safety-critical part (tombstones) survives because it rides inside `tag_registry`. |

**`rga_version` stays `"3.0"`.** Bumping to 3.1 would make every current installation *reject* the file outright (`isAcceptedVersion`: same major, `minor <= current` — doc.js:122-128). Additive-optional fields that old readers ignore and mostly preserve do not justify locking users out of their own scripts. This is the same reasoning as not bumping for `settings.units`.

### 2.2 Log record shape (file format, snake_case per `.rga` convention)

```json
{
  "merged_at": "2026-06-03T14:00:00.000Z",
  "tag_type": "character",
  "survivor": { "id": "ent-nali", "name": "NALI" },
  "losers": [
    { "id": "15201fa6-09cf-4786-a384-3c0bbd973dd8",
      "name": "NALI", "color": null, "notes": "",
      "mark_count": 1 }
  ],
  "metadata_moved": { "color_moved": null, "notes_appended": false, "unknown_fields": null }
}
```

Losers are recorded **in full** (every field they had + how many marks pointed at them) — the log is the recovery path of last resort and the input to future compaction.

### 2.3 Naming: why `merged_into` and not `mergedInto`

The registry passes through serialization by reference — there is no translation layer for entity-level fields, so **one name must serve both the file and the JS runtime**. The `.rga` format convention is snake_case (`tag_registry`, `flag_log`, `production_type`, `revision_notes`), so the field is `merged_into` everywhere. JS code never spells it anyway (consumer rule: use `isEntityMerged`/`liveEntities`).

### 2.4 Migration chain

The migration contract ("unknown fields preserved at every level" — v2-to-v3.js:10,35) means `merge_log` and `merged_into` survive the existing migration path. **Constraint on future migrations**: any v3 → v4 migration must add `merge_log` to its explicit carry list, same as `flag_log`. Noted here so the future migration author finds it.

---

## 3. Moratorium Boundaries

This design IS the scoped moratorium review that the policy audit's D3/D4 called for. What it grants and what it does not:

### Granted (one review, one slice, this list and nothing more)

| File | Change |
|---|---|
| `renderer/js/doc.js` | + `markEntityMerged`, `foldEntityMetadata`, `appendMergeLog`, `isEntityMerged`, `resolveEntityId`, `liveEntities` (≈70 lines) · + 3 internal lines (`create`/`serialize`/`_buildDocFromParsed`) · + 6 export entries |

### Explicitly NOT granted (each would need its own review)

- `addEntity` changes — stays exactly as it is ("dumb", Slice A's contract)
- `removeEntity` changes or any deletion path — compaction is a future grant
- `tagRegistry` shape changes (the 9 plural keys, array-of-objects structure)
- `_registryKey` changes
- tag mark schema changes (`schema-v3.js` — separate moratorium entirely)
- `nav-index.js` changes (separate moratorium entirely)
- Any doc.js change for autocomplete, aliases, normalization, or pronoun work

### The rule this grant establishes (extends Slice A's)

> Slice A: *"Never call `Rga.Doc.addEntity` directly from a tagging surface — identity goes through `Rga.Tags.findOrCreateEntity`."*
>
> Slice B adds: *"Never mutate registry state — entity fields or registry arrays — from plugin code. Every registry mutation goes through a named, validated `Rga.Doc` API. Plugin code reads registry state only through `Rga.Doc` read APIs (`findEntity`, `isEntityMerged`, `resolveEntityId`, `liveEntities`) or the nav-index."*

The two existing direct-read sites in tags.js (`_entityList` at tags.js:127, `refreshTagsPanel` at tags.js:66-69) are grandfathered for *reading* but must adopt the tombstone filter (§4) — they are the reason `liveEntities` exists.

---

## 4. Consumer Rules

Who must see tombstones, who must not, and who cannot tell the difference:

| # | Consumer | Rule | Why |
|---|---|---|---|
| **C1** | **`findOrCreateEntity` (Slice A helper)** | **MUST skip tombstoned entities in its lookup.** | ⚠️ **The critical interaction discovered by this design.** After a merge, the loser tombstone ("NALI") and the survivor ("NALI") *both* match a case-insensitive name lookup. `.find()` returns whichever sits first in array order — tagging "NALI" post-merge could mint new marks pointing at a tombstone. Without this rule, Slice B *re-creates* the exact bug Slice A fixed. Lookup domain = live entities only. |
| **C2** | `showTagDialog` | Inherits C1 automatically (it calls `findOrCreateEntity`). | One source of truth doing its job. |
| **C3** | Future autocomplete / recognizer / Inspector entity lists / mounted tags panel | Suggestion and listing source is **`Rga.Doc.liveEntities()` only** — never raw `doc.tagRegistry`, never `idx.tags`. | Tombstones must never be offered to the user. |
| **C4** | `nav-index` | **Unchanged** (moratorium). It will keep emitting tombstoned entities as zero-mention entries (registry entries are union'd into the index). | Accepted and documented: per-scene lists never show them (zero `sceneAppearances`); only hypothetical all-entities-from-index surfaces would — and rule C3 forbids building those from the index. |
| **C5** | `SceneCatalog` / Navigator per-scene lists | No change needed. | Post-merge, marks point at survivors; tombstones appear in no scene. |
| **C6** | `Memory` Phase 1 | No change. `entity(loserId, idx)` keeps resolving while marks/registry entries exist — that is its honesty contract. | Memory reads what is there. Phase 2 may adopt `resolveEntityId` for chain-resolution — out of scope, noted as a consumer of this API. |
| **C7** | Mark click popup (`showTagInfo`) | Should display the *resolved* entity (via `resolveEntityId`) when a mark points at a tombstone (undo-restored marks). | The one place users could otherwise see a "ghost" name. Slice B2 scope. |
| **C8** | Export / Print / Search / SlugResolver | No rules. | They never read the registry. |

---

## 5. Test Strategy

TDD red-first, real code, no stubs on the path under test — same discipline as Slice A's `registry-identity.test.js`.

### 5.1 New: `tests/unit/registry-merge-api.test.js` (doc.js API suite)

| Group | Tests |
|---|---|
| `markEntityMerged` validation matrix | every row of the §1.1 table — missing loser, missing survivor, self-merge, chain prevention, idempotent re-mark, conflict refusal, success |
| `foldEntityMetadata` rules | color survivor-wins · color moves when survivor null · notes append with attribution · notes untouched when loser empty · double-fold prevention (tombstoned loser → null) · unknown loser fields reported but not copied · survivor name/id never touched |
| `appendMergeLog` | lazy init · timestamp stamping · shape validation rejects malformed records · record returned complete |
| Read APIs | `isEntityMerged` null/true/false · `resolveEntityId` chain following, cycle guard, missing-target null · `liveEntities` filters tombstones, returns fresh array |
| Round-trip | create → merge-mark → serialize → deserialize → `merged_into` and `merge_log` both intact · old file (no merge fields) → `mergeLog: []`, nothing merged · **entity unknown-field round-trip still works** (the Slice A guarantee, now load-bearing) |
| Compat | serialize/deserialize of the playground fixture is **still byte-identical** (no merge fields exist there — proves the APIs change nothing until called) |

### 5.2 Additions: `registry-identity.test.js` (Slice A suite)

| Test | Asserts |
|---|---|
| `findOrCreateEntity` skips tombstones (rule C1) | registry has tombstoned "NALI" (first in array) + live "NALI" → helper returns the **live** entity's id |
| `findOrCreateEntity` creates fresh when only a tombstone matches | registry has *only* a tombstoned "NALI" → helper creates a new live entity (does not resurrect the tombstone) |
| toolbar + dialog post-merge behavior | tag "NALI" via both paths against a merged registry → all new marks point at the survivor |

### 5.3 Not tested here (later slices own these)

- PM mark rewriting (Slice B2 — the merge operation's own suite)
- Review UI (Slice B3)
- Compaction (future grant)
- The fixture stays fragmented — it is the permanent merge-tooling test input, untouched by this slice.

---

## 6. Implementation Slice Boundary

This design authorizes **Slice B1 only**. The ladder:

| Slice | Content | Gate |
|---|---|---|
| **B1** ← this design | doc.js APIs (§1) + format mapping (§2) + the two test suites (§5.1, §5.2) | Authorized when you say "implement B1" |
| **B2** | `Rga.Tags.mergeEntities(view, tagType, survivorId, loserIds)` — PM mark rewrite + the §1.4 call sequence · `findOrCreateEntity` tombstone filter (C1) · `showTagInfo` resolution (C7) | After B1 lands green |
| **B3** | Review UI (candidate list, survivor confirmation, tie-breaking) — **designer involvement required** (Settings Constitution design freeze applies to new UI surfaces) | After B2; needs a designer brief |
| **B4 / future** | Compaction (delete logged+tombstoned+zero-mark entities at document open) | Separate moratorium grant; not designed yet |
| **C / future** | Aliases, normalization beyond case, sceneHeading↔location linking | After B; own design cycle |

**Inside B1, the TDD order:** API validation matrix tests (red) → APIs (green) → round-trip tests (red) → serialize/deserialize lines (green) → Slice A suite additions (red) → C1 filter… **no.** The C1 filter is tags.js code = B2 territory. B1's boundary is doc.js + doc.js tests only; the §5.2 additions land *with B2* (they test tags.js behavior). Corrected: **B1 = doc.js + §5.1 suite. B2 = tags.js + §5.2 additions.** The boundary is the file boundary — one slice, one owned file, one moratorium surface.

---

## Appendix — Evidence Index

- flagLog precedent (the pattern being mirrored): `doc.js:108` (create) · `:165` (serialize) · `:281` (deserialize) · `:332-335` (`addFlagLogEntry`) · consumer `revision-flags.js:383-391`
- Registry pass-through (why `merged_into` needs no format layer): `doc.js:164,280`
- Unknown top-level keys dropped (why `merge_log` needs explicit mapping): `doc.js:261-286`
- Version acceptance logic (why no version bump): `doc.js:122-128` (`isAcceptedVersion`) · `:130-145` (`isNewerThanSupported`)
- Migration unknown-field contract: `migrations/v2-to-v3.js:10,35`
- Direct registry readers (the consumer inventory): `tags.js:66,69,127` · `nav-index.js:469` (pass-by-reference to buildIndex) · `flow-chrome.js:143` (comment only, retired)
- Slice A helper whose lookup domain changes in B2: `tags.js` `findOrCreateEntity` (commit `01567327`)
- Existing exports being extended: `doc.js:363-379`
- Policy authority: `IDENTITY_MERGE_POLICY_AUDIT.md` §3 (fold rules), §5 (D1–D5 decisions), §6 (operation contract)
