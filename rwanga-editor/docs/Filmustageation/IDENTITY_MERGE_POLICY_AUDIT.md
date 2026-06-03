# Identity Merge Policy Audit — Registry Integrity Slice B

> **Policy design only — no code, no fixes, no migration, no merge tooling performed.**
> Scope: who survives a duplicate-entity merge, what metadata transfers, how marks move, what undo does, and the smallest safe merge operation.
> Evidence: live code at `main` @ `01567327` (post-Slice A) · `playground-the-last-light.rga` mark census · PM history wiring · Memory Phase 1 API.
> Predecessor: `REGISTRY_IDENTITY_INTEGRITY_AUDIT.md` (Slice A spec, §6 Option B). Date: 2026-06-03 · Investigator: Claude (Opus 4.8)

---

## Executive verdict

Three findings reshape the merge problem away from how Option B was originally sketched:

1. **Immediate loser deletion is unsafe in *every* variant.** ProseMirror's undo/redo stores document steps whose mark attrs are never rewritten by history rebasing — so any merge that deletes the loser entity right away can be re-broken by redo (a resurrected mark pointing at a deleted entity). The loser must survive *in some form* until the undo horizon passes. This is not a UI choice; it is forced by how `prosemirror-history` works.

2. **Zero marks does not mean garbage.** The fixture's curated-but-never-tagged entities (PHOTOGRAPH, TIN BOX, all three locations, the car) all have zero marks — exactly like the undo-stranded `window` orphan. Any cleanup heuristic keyed on "no marks" deletes deliberate user curation. Only entities *named* in a merge log may ever be auto-removed.

3. **Tombstoning is format-compatible today.** `serialize`/`deserialize` pass the registry through by reference — entity-level fields beyond `{id, name, color, notes}` survive load/save untouched, with **zero `doc.js` changes**. The "loser becomes a pointer to the survivor" design does not collide with the contamination-triad moratorium at the file-format level; it only needs a decision about *who* writes that field.

The recommended policy is **curated-wins survivor selection with user confirmation on ties, mark-rewrite-first merge, losers tombstoned (never immediately deleted), nothing silently discarded.** §5 lists the five decisions that are yours, not an engineer's.

---

## 1. Duplicate Classes

What "duplicates" actually look like, from the fixture mark census (every class verified in real data):

| # | Class | Fixture example | Marks distribution | Merge difficulty |
|---|---|---|---|---|
| **C1** | **Split identity** — same name, multiple entities, *each* carrying marks | NALI: `ent-nali` (curated, color+notes, **2 marks**, scenes 3+5) + `15201fa6-…` (bare, **1 mark**, scene 2) | Marks on both sides | The core case. Survivor choice is consequential; marks must be rewritten. |
| **C2** | **Curated orphan + live duplicates** — the curated entity has zero marks; bare duplicates carry them all | BABAN: `ent-baban` (curated, **0 marks**) + `47a05ccf-…` ("BABAN", 1 mark) + `e578a64f-…` ("Baban", 1 mark) | All marks on losers | Survivor (curated) gains marks it never had. Multi-loser: 3-way merge. |
| **C3** | **Pure undo-orphan** — one entity, zero marks, no name-twin | prop `52617b89-…` "window" (0 marks, no metadata, no counterpart) | None | **Not a merge candidate.** Deletion candidate only — and indistinguishable from C4 by data alone. |
| **C4** | **Curated, not yet tagged** — deliberate pre-production curation with zero marks | `ent-photo`, `ent-tinbox`, `loc-house`, `loc-bedroom`, `loc-kitchen`, `veh-car` | None | **Must never be touched.** Same data signature as C3; only the user knows the difference. |
| **C5** | **Spelling/abbreviation variants** — same person, names not case-insensitively equal | "DR. HASSAN" vs a hypothetical "DR HASSAN" or "HASSAN" | n/a | **Out of scope for Slice B.** Alias territory (Slice C). No auto-detection is safe. |
| **C6** | **Cross-type same-name** | Character:NALI vs Prop:NALI | n/a | **Never duplicates.** Type-scoped identity locked by Slice A. |

**Merge-candidate detection rule (the only safe one):** same `tagType` + case-insensitive-equal trimmed `name` + 2 or more entities. This finds C1 and C2, cannot touch C3/C4 (they have no name-twin), and deliberately excludes C5/C6.

**Census ground truth (full):**

```
character:ent-nali     "NALI"        marks=2  scenes=[003, 005]   ← curated AND in live use
character:15201fa6-…   "NALI"        marks=1  scenes=[002]        ← C1 loser
character:ent-baban    "BABAN"       marks=0                       ← C2 curated orphan (survivor-to-be)
character:47a05ccf-…   "BABAN"       marks=1  scenes=[002]        ← C2 loser
character:e578a64f-…   "Baban"       marks=1  scenes=[002]        ← C2 loser (case variant)
character:ent-hassan   "DR. HASSAN"  marks=1  scenes=[003]        ← no duplicate; healthy
prop:52617b89-…        "window"      marks=0                       ← C3 pure orphan
prop:ent-photo, ent-tinbox; location:loc-*; vehicle:veh-car — all 0 marks  ← C4 curation, untouchable
```

One correction to the predecessor audit: §2 claimed "the curated entities ended up as orphans while all live marks point at the colorless twins." True for BABAN; **false for NALI** — `ent-nali` carries 2 of the 3 NALI marks. The split-identity class (C1) is real and is the harder case.

---

## 2. Survivor Strategies

The mission's example sharpened: **NALI(A)** curated (color, notes, 2 occurrences) vs **NALI(B)** bare (no metadata, 47 occurrences). Who survives?

| Strategy | Verdict | Why |
|---|---|---|
| **A. Oldest entity wins** | **Not implementable honestly.** | Entities have no creation timestamp — the shape is `{id, name, color, notes}`. Array order is a weak proxy (append order), but merges, hand-edits, and external tools destroy it. A policy keyed on data we don't have is a guess wearing a rule's clothes. |
| **B. Most occurrences wins** | **Rejected — optimizes the wrong thing.** | Occurrence count measures typing volume, not user intent. In the mission's own example, B picks the bare 47-mark entity and orphans the curation (color, notes) — exactly the D4 damage Slice A was built to stop, now performed deliberately by the merge tool. In the fixture's BABAN case, B can't even decide (two losers with 1 mark each) and the curated entity loses with 0. |
| **C. Curated entity wins** | **Right default.** | Curation = the user touched it (non-null `color`, non-empty `notes`, or a hand-authored `ent-*`/`loc-*`/`veh-*` id rather than a UUID). Curation is the only signal of *intent* in the data. NALI → `ent-nali` survives (its 2 marks stay, the loser's 1 mark joins). BABAN → `ent-baban` survives (gains all 3 marks it never had). The survivor also keeps the human-readable id — the id more likely to be referenced by `scene.attrs.metadata.references[]`, future cross-doc links, and hand-written tooling. |
| **D. User-selected winner** | **Right escape hatch, wrong default.** | Always correct, never automatic. As the *only* mechanism it makes bulk cleanup (a script with 30 fragmented characters) miserable. As the tie-breaker it is essential. |
| **E. Hybrid (C + D)** | **✅ Recommended.** | Deterministic rule where the data is unambiguous; the user where it isn't. See decision table below. |

### The hybrid rule

For each duplicate set (same type, same case-folded name):

| Situation | Survivor |
|---|---|
| Exactly one curated entity | The curated one. Automatic. |
| Zero curated entities (all bare UUIDs) | The one with most marks; tie → first in registry order. Automatic — *nothing of value distinguishes them*, so any choice is correct; determinism matters more than the pick. |
| Two or more curated entities | **STOP — user picks.** Both carry intent; an engineer's tiebreak would silently discard one user's work into another's. |

"Curated" (precise definition): `color != null` **or** `notes` non-empty **or** id does not match the UUID pattern. Recorded in the merge log either way, so a wrong automatic pick is recoverable from the log.

---

## 3. Metadata Rules

Per-field rules. The governing principle: **the merge may move data, it may never destroy data.** Anything not kept on the survivor goes into the merge log.

| Field | Rule | Conflict behavior |
|---|---|---|
| `id` | Survivor's id stands. Losers' ids are recorded in the log (and on tombstones, §5). | No conflict possible. |
| `name` | Survivor's casing stands ("NALI" beats "Nali" if the curated entity says "NALI"). | Loser spellings logged. When `aliases[]` exists (Slice C), loser names seed it. |
| `color` | Survivor's color if set; else first non-null loser color (registry order). | Never blend, never overwrite a survivor's set color. Losers' distinct colors logged. |
| `notes` | Survivor's notes if loser notes are empty. If **both** have notes: concatenate, separated by a marked line (`--- merged from "Nali" (15201fa6) ---`). | Prose cannot be auto-merged; concatenation is the only rule that loses nothing. Ugly is acceptable; silent loss is not. The user can edit afterward. |
| `aliases` (future) | Union of all names + existing aliases, case-folded, deduplicated. | None — it's a set. |
| Unknown future fields | **Survivor-wins + log.** A merge tool must never invent semantics for fields it doesn't recognize (it would corrupt whatever a future slice stores there). | Logged verbatim. |

Typed defaults for fields that don't exist yet (so the policy survives schema growth): **scalar → survivor-wins-else-first-non-null · text → concatenate-with-attribution · list → union · unknown → survivor-wins + log.**

---

## 4. Occurrence Rewrite Risks

### How marks would move

The machinery half-exists (predecessor audit §6B was right): `removeAllMarksForEntity` (tags.js:46) already walks `doc.descendants`, matching marks by `entityId`. A merge rewrite is the same walk doing `tr.removeMark(pos, end, oldMark)` + `tr.addMark(pos, end, newMarkWithSurvivorId)` instead of remove-only — accumulated into **one ProseMirror transaction**.

### What is structurally safe (lower risk than it looks)

| Property | Why it's safe |
|---|---|
| **Positions never shift** | Mark steps don't insert or delete content. The walk's collected positions stay valid for the whole transaction — no position-mapping subtleties, the classic source of PM rewrite bugs. |
| **Atomicity** | One transaction = one dispatch = one undo step. Either every mark moves or none does. |
| **Mark coalescing** | If rewritten text sits adjacent to text already marked with the survivor's id, PM merges them into one mark span. Desirable — that's the point. |
| **Cue counting unaffected** | nav-index's `cueCount` reads the mark on the first text child of cue blocks; rewritten marks count for the survivor on the next index build, automatically. |
| **Document text untouched** | Merge never changes a single character of the screenplay. Worst case is wrong *attribution*, never lost *writing*. |

### What is genuinely dangerous

| # | Danger | Severity | Mitigation |
|---|---|---|---|
| **R1** | **Registry mutation is outside the PM transaction.** The mark rewrite (PM) and the registry change (plain JS object) cannot be atomic with each other. A crash between them leaves a half-merged state. | Medium | **Order: marks first, registry second.** If interrupted after marks: losers are mark-less entities still in the registry — inert, harmless, re-runnable. The reverse order (registry first) would leave dangling marks → corruption. Ordering is policy, not preference. |
| **R2** | **Undo restores marks pointing at losers.** Ctrl+Z after merge reverts the mark rewrite (it's a normal history step). If losers were deleted from the registry, the restored marks dangle → nav-index resolves `name: null` → "Unknown" rows in every consumer. | **High** | Losers must still resolve when undo fires → **losers stay in the registry (tombstoned or inert), §5.** With losers present, undo cleanly restores the pre-merge world — correct semantics, zero corruption. |
| **R3** | **Redo can resurrect loser marks even if the merge transaction is excluded from history** (`addToHistory: false`). History rebasing maps stored steps' *positions* through outside changes; it never rewrites mark *attrs* inside stored steps. A redo of pre-merge typing can re-apply text carrying a loser `entityId`. | **High — this is the finding that kills "delete immediately" in all variants** | Same mitigation as R2: the loser id must remain resolvable for as long as the history stack could replay it. There is no transaction flag that avoids this. |
| **R4** | **Closed-document merge.** A doc not open in an editor has its body as serialized JSON (or a PM node without a view). Rewriting marks there is a different code path (JSON walk, no transactions, no undo to worry about — but also no battle-tested machinery). | Medium | Slice B scope: **merge operates on open documents only** (live view). Closed-doc/batch merge is a later slice with its own design. |
| **R5** | **Cross-document dangling ids (D6).** Text pasted into *other* scripts carries loser entityIds this doc's merge can never fix. | Low (pre-existing class, not worsened by merge) | Out of scope. Noted so nobody believes merge solves it. |

### Undo / History — what the policy must guarantee (Required Question 4)

- **Reversible?** Yes — but by *undo semantics*, not by a custom "unmerge" tool. The mark rewrite is a normal history step; Ctrl+Z restores attribution exactly, **provided losers still resolve** (R2/R3). A dedicated unmerge tool is not needed for Slice B; the merge log (below) makes manual recovery possible even after the history horizon.
- **Logged?** Yes — mandatory. Every merge appends a record: when, tagType, survivor `{id, name}`, each loser `{id, name, color, notes, markCount}`, and what metadata moved. The log is what makes deferred cleanup precise (§5) and wrong merges recoverable forever.
- **One-way?** The *registry compaction* (final removal of tombstoned losers) is one-way — but it only ever runs against logged, zero-mark, tombstoned entities at a point where history cannot reference them (document open is the only such point that exists today: a freshly opened document has an empty undo stack).

---

## 5. Recommended Policy

### The policy in one paragraph

Merge candidates are detected by same-type + case-folded-name equality only. The survivor is the curated entity (user picks when zero-or-multiple curated candidates make it ambiguous). The merge rewrites all loser marks to the survivor in one undoable PM transaction, folds metadata by the §3 rules, appends a merge-log record, and **tombstones** the losers (`mergedInto: <survivorId>` written onto the loser's registry entry) rather than deleting them. Tombstoned entities are invisible to suggestion/list surfaces but still resolve ids for undo/redo. Final removal of tombstones happens only at document open (empty undo stack), only for logged losers that still have zero marks.

### Why tombstones and not "inert orphans"

Both keep the loser resolvable (satisfying R2/R3). The difference:

| | Inert orphan (loser stays, unchanged) | Tombstone (`mergedInto` field) |
|---|---|---|
| Format change | None | None in practice — entity-level extra fields **pass through serialize/deserialize today** (registry is referenced as-is; verified in doc.js:164/280) |
| Consumers can tell "merged" from "curated-not-yet-tagged" | ❌ No — both look like zero-mark entities (the C3/C4 confusion) | ✅ Yes — `mergedInto` is explicit |
| nav-index ghost entries (zero-mention rows) | Present until purge | Present until purge, but downstream surfaces can filter on `mergedInto` |
| Future autocomplete | Must cross-check the merge log to avoid suggesting losers | Filters `mergedInto` — one field check |
| Id chain-resolution (Memory Phase 2 could resolve a stale id → survivor) | Needs the log | Trivial: follow the pointer |

Tombstone is strictly better and costs nothing at the format level. **The one open question is who writes the field** (see Decision 3).

### Effects on every future consumer (Required Question 5)

| Consumer | Before merge | After merge (tombstones present) | After compaction |
|---|---|---|---|
| **Memory API** | `entities()` lists all shards; `coverage()` flags zero-mark shards as orphans | `entity(loserId)` still resolves (honest); shards visible but tombstone-marked | `entity(loserId)` → `null` (consumers already handle null — that's the Phase 1 contract); `entities()` clean |
| **SceneCatalog** | Same person = multiple rows across scenes | Per-scene rows unified immediately (marks rewritten); zero-mark tombstones appear in no scene | Clean |
| **Navigator** | NALI appears N times in any per-scene tag list | Once, immediately after merge | Once |
| **Autocomplete** (gated until B lands) | Would suggest N duplicates — the reason it's gated | Suggests only non-tombstoned entities | Clean registry, clean suggestions |
| **AI / MCP / breakdowns** (future) | Cast lists double-count; context fragments | Single identity per person; merge log provides provenance ("these were merged") | Clean |
| **Memory fixture tests** | Encode fragmentation as ground truth (by design) | **Unchanged** — the fixture file itself is not merged by shipping the tool. Whether to clean the *fixture* is a separate decision; recommendation: keep the fragmented fixture as the permanent merge-tool test case and add a second post-merge fixture. | — |

### Decisions that are yours (the policy session agenda)

| # | Decision | Options | Recommendation |
|---|---|---|---|
| **D1** | Survivor rule | A/B/C/D/E from §2 | **E (hybrid)**: curated wins; user picks on 0-or-2+ curated |
| **D2** | Both-have-notes conflict | concatenate / survivor-only / ask every time | **Concatenate with attribution** — never lose prose |
| **D3** | Who writes the tombstone field | (a) new `Rga.Doc` API (`markEntityMerged`) → touches the moratorium file via a formal review · (b) tags.js writes `loser.mergedInto` directly → bypasses doc.js's API, sets a registry-mutation-from-plugins precedent | **(a) with a scoped moratorium review** — the triad moratorium exists to prevent *uncontrolled* registry mutation; a reviewed, single-purpose API is the controlled path. (b) is faster but the precedent is exactly what caused the original fragmentation. |
| **D4** | Where the merge log lives | (a) new top-level `.rga` field (`merge_log`, mirrors `flag_log`) → needs doc.js serialize/deserialize lines (unknown top-level keys are *dropped* today — verified) · (b) inside `doc.runtime.ui_state` (survives round-trip today, zero code) · (c) session-only (lost on close) | **(a)** — the log is document history, not UI state; it must survive in the file. Same scoped moratorium review as D3 (they're one review). (c) is rejected: a log that evaporates can't back deferred compaction. |
| **D5** | Merge is automatic or reviewed | auto-merge all detected candidates on open / reviewed (user sees the candidate list and confirms) | **Reviewed, always** — even with a deterministic survivor rule. Merging is the single most destructive-feeling operation this editor will have; trust is built by showing, not by silence. Auto-merge is never acceptable for C1 splits. |

---

## 6. Smallest Safe Merge Operation

Not the UI. Not the candidate-detection sweep. The minimum operation that one button could call — **`mergeEntities(view, tagType, survivorId, loserIds)`** — and its contract:

```
PRECONDITIONS (all checked, all hard-fail):
  - view is a live EditorView over the open document
  - survivor exists in registry[tagType]; every loser exists; survivor ∉ losers
  - every loser's case-folded name === survivor's case-folded name
    (the operation refuses to be a generic "move marks" tool — it merges
     NAME DUPLICATES only; anything else is Slice C alias work)

STEP 1 — mark rewrite (ONE PM transaction, normal history):
  walk doc.descendants:
    every text node carrying a tag mark with
      mark.attrs.tagType === tagType && mark.attrs.entityId ∈ loserIds
    → tr.removeMark(range, oldMark)
      tr.addMark(range, tag{tagType, entityId: survivorId})
  dispatch(tr)                         ← undoable, atomic, position-stable

STEP 2 — metadata fold (registry, §3 rules):
  survivor.color = survivor.color ?? firstNonNull(losers.color)
  survivor.notes = fold per §3 (concatenate on conflict, attributed)

STEP 3 — tombstone losers (NOT delete):
  each loser entry gains mergedInto: survivorId   [mechanism per Decision D3]

STEP 4 — log:
  append merge record { when, tagType, survivor:{id,name},
                        losers:[{id, name, color, notes, markCount}],
                        metadataMoved:{...} }    [location per Decision D4]

STEP 5 — markDirty(doc)               ← autosave + dirty flag, existing path

ORDERING IS THE SAFETY: marks → metadata → tombstones → log → dirty.
A crash after any step leaves a state that is harmless and re-runnable:
  after 1: losers are mark-less but resolvable (inert)
  after 2: + survivor enriched
  after 3: + losers marked merged
  after 4: + recorded
Nothing in any intermediate state dangles, lies, or loses writing.

EXPLICITLY NOT IN THIS OPERATION:
  - candidate detection (separate read-only function; trivially derivable
    from Memory.entities() — the read side already exists)
  - any UI (review dialog, undo toast)
  - compaction (separate operation, runs at document open, deletes only
    logged+tombstoned+zero-mark entries)
  - closed-document / batch merge
  - alias handling, pronoun handling, "DR. HASSAN"="HASSAN"
```

**Size estimate:** the operation is ~40 lines next to `removeAllMarksForEntity` in tags.js (whose walk it generalizes), plus the doc.js API from D3/D4 (~15 lines), plus its TDD suite. The compaction operation is another ~20 lines + tests. Small — *after* the five decisions in §5 are made. Before them, any implementation would be an engineer inventing user policy.

---

## Appendix — Evidence Index

- Fixture mark census: walk of `tests/fixtures/playground-the-last-light.rga` body counting `tag` marks per `(tagType, entityId)` — results inline in §1 (census script was transient; method: walk PM JSON, count `marks[].type === 'tag'` per entityId, cross-reference against `tag_registry`)
- Mark-walk machinery: `renderer/js/doc-types/screenplay/plugins/tags.js:30-57` (`removeTag`, `removeAllMarksForEntity`)
- Shared identity helper (Slice A): `tags.js` `findOrCreateEntity` · commit `01567327`
- Registry pass-through on load/save (tombstone compatibility): `renderer/js/doc.js:164` (`tag_registry: doc.tagRegistry`) · `doc.js:280` (`tagRegistry: parsed.tag_registry`)
- Unknown top-level `.rga` keys dropped on load (merge-log placement constraint): `doc.js:261-286` (`_buildDocFromParsed` fixed key list)
- PM history wiring: `renderer/js/editor/mount.js:157` (`PM.history()`) · undo/redo keymap `mount.js:140-144`
- History rebasing never rewrites stored mark attrs: `prosemirror-history` (bundled at `renderer/js/editor/bundle.js:11877+`) — mapping adjusts positions only
- nav-index duplicate emission (ghost-row behavior): `renderer/js/framework/nav-index.js:271-311` (`_composeTagsAndCharacters` — registry entries emitted even with zero marks) · `nav-index.js:313-322` (`_resolveEntity` → `name: null` for dangling ids)
- Memory API null semantics + orphan reporting: `renderer/js/doc-types/screenplay/memory.js:38-41, 247-304`
- `removeEntity` (delete machinery that must NOT be called by merge): `doc.js:321-330`
- Predecessor: `REGISTRY_IDENTITY_INTEGRITY_AUDIT.md` §2 (D-classes), §6 (Option B sketch — corrected by §1 of this audit on the NALI orphan claim)
