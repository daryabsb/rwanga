# Rwanga Structured Screenplay Editor Reset Plan
**Date:** 2026-05-16
**Status:** Design plan only. No implementation in scope.
**Companion docs:** `state-inventory-2026-05-16.md` (what we have), `paginator-architecture-report-2026-05-16.md` (paginator-specific history).

---

## 0. Directive recap

- Keep structured scenes; do NOT degrade to plain-text Fountain.
- Remove nested-PM-editor-per-block as the canonical model.
- Move to a single canonical ProseMirror document with real screenplay nodes.
- Scene frame UI is presentation chrome, NOT a separate editor instance.
- Pagination uses the PageMap layout engine, NOT live DOM measurement.

---

## 1. Current architecture summary

### What it is today

The current model uses a `sceneFrame` *atom* node in the outer ProseMirror doc. Each atom carries a JSON snapshot of its scene contents in `attrs.innerDoc`:

```
outer doc
└── body
    ├── titleStrip
    ├── paragraph (treatment)
    ├── sceneFrame (atom, attrs.innerDoc = { content: [sceneLine, action, ...] })
    ├── paragraph (spacer)
    └── sceneFrame (another)
```

Each `sceneFrame` is rendered by a NodeView (`scene-frame-pm.js`) that:
- Renders chrome (SCENE N label, slug picker form controls, transition picker).
- Eagerly mounts a separate `ProseMirror.EditorView` per scene block (action / character / dialogue / etc.).
- Bridges every inner-editor transaction back to the outer doc via `_dispatchInner` → `setNodeMarkup(pos, null, { innerDoc: rebuilt })`.

For a 5-scene playground, ~25–30 inner ProseMirror editors are live simultaneously, each with its own state, history, plugins, dispatch loop, and DOM subtree.

### Why this model fails

**Pagination.** The PageMap layout engine (pure-function, 192 tests passing) computes correct break positions from screenplay structure. But the renderer must place break decorations in the *outer* PM doc, where each `sceneFrame` is an opaque atom. The editor surface is one tall `.rga-page` column with inserted spacers — visually it reads as "one expanding sheet with dividers", not as paged paper. Adding text reflows the column; backspace shrinks it. The user's words: *"it feels fake; the page is not treated as fixed heights."* The problem is not measurement vs structure (the engine got that right). The problem is that the **rendering surface itself is not paged**.

**Cross-block selection.** Each block is its own EditorView with its own selection. The user cannot drag-select from a character cue down into the next dialogue block. Copying a multi-block range is impossible. Selection state lives in N separate stores instead of one.

**Format-toolbar discoverability.** The format toolbar dispatches to whichever editor owns focus via a `_lastSceneBlock` cache. This works but is fragile — every focus event has to be reasoned about. Bold/italic shortcuts inside the inner editor are wired through inner keymaps that mirror but can drift from the outer.

**Performance.** Eager mount of N editors × M scenes is unbounded. At 80–100-scene feature scale, hundreds of EditorView instances live in memory; each carries plugins, history, listeners. Viewport-scoped mount/unmount was the planned mitigation; it's not built and adds its own complexity layer.

**Long-term maintenance.** Data flows through three layers in series: inner editor PM state → `_dispatchInner` rebuild → outer `setNodeMarkup` transaction → file serialization. Each layer needs its own loop guard, race-condition handling, and propagation rule. Bugs hide in the seams — concrete recent example: the read-path mark-loss bug (2026-05-16) where `_extractBlocks` stripped marks when remounting on file open, and the FIRST keystroke after reopen overwrote the saved-but-not-loaded marks. The fault was real but invisible until live testing; pure unit tests on each layer couldn't catch it because the bug lived in the layer interface.

**Schema honesty.** `attrs.innerDoc` is JSON stuffed inside a PM atom's attrs. It is not part of the outer PM schema. PM doesn't validate it, PM doesn't apply transactions to it, PM doesn't track positions inside it. It's a string-like blob that happens to be a tree. Real PM operations (cross-doc find/replace, AI text manipulation, structural transforms) can't reach it.

---

## 2. Target architecture

### One canonical ProseMirror document

The outer schema absorbs the screenplay structure. There is no more `attrs.innerDoc`. Every screenplay block is a real PM node inside the same doc.

### Schema (proposed)

```
doc
└── body (content: outerBlock*)
    ├── titleStrip?                            (existing)
    ├── treatmentParagraph                     (existing paragraph)
    ├── treatmentHeading                       (existing heading)
    └── scene                                  (NEW — group: outerBlock)
        ├── sceneHeading                       (NEW — required, exactly one, first child)
        └── (action | character | dialogue |
              parenthetical | shot | transition)+   (NEW — sceneBody group, one or more)
```

**`scene` node:**
- group: `outerBlock`
- content: `sceneHeading sceneBody+`
- attrs:
  - `id: string` (stable per scene)
  - `number: number | null` (display index; can be derived but stored for stability)
  - `notes: string` (scene-level notes — what `attrs.innerDoc.attrs.notes` is today)
  - `revisionFlag: object | null` (scene-level revision flag — what `attrs.innerDoc.attrs.revisionFlag` is today)
  - `metadata: object` (reserved for AI / breakdown / cross-language pairing)
- defining: true (so PM treats it as a content-owning structural unit when copying)

**`sceneHeading` node** (the slug — INT. KAREN BEDROOM — DAY):
- content: `text*` (the location text)
- attrs:
  - `setting: string` (e.g., `"INT."`, default `"INT."`)
  - `time: string` (e.g., `"DAY"`, default `"DAY"`)
  - `headingStyle: 'twoLine' | 'inline' | null` (mirrors `doc.settings.sceneHeadingStyle`)
- isolating: true (selection / drag boundaries)
- selectable: false (you don't select the slug as an object; you edit its text)

**`action` node** (descriptive prose):
- group: `sceneBody`
- content: `inline*`
- attrs: none

**`character` node** (CHARACTER CUE):
- group: `sceneBody`
- content: `inline*`
- attrs: none (the bold-uppercase-centered style comes from CSS on the node class)

**`dialogue` node** (spoken line):
- group: `sceneBody`
- content: `inline*`
- attrs: none

**`parenthetical` node** ((quietly)):
- group: `sceneBody`
- content: `inline*`
- attrs: none

**`shot` node** (CLOSE ON HAND):
- group: `sceneBody`
- content: `inline*`
- attrs: none

**`transition` node** (CUT TO: / FADE OUT):
- group: `sceneBody`
- content: `text*`
- attrs:
  - `transitionType: 'CUT' | 'MIX' | 'FADE IN' | 'FADE OUT' | 'DISSOLVE' | 'MATCH CUT' | 'SMASH CUT' | 'JUMP CUT' | string` (default `'CUT'`)
- selectable: true (it's a structural element you can target as a whole)

### Marks (unchanged)

All 12 marks from `framework/base-outer-marks.js` continue to work on `inline` content (`text` + marks). Bold, italic, underline, strikethrough, color, highlight, link, fontFamily, fontSize, annotation, tag, revisionFlag. Their excludes / parseDOM / toDOM rules are unchanged.

The marks operate on the SAME inline content the inner editors used to render — the difference is they now live in the outer doc's positional space, so cross-block find/replace, AI text manipulation, structural transforms, and unified selection all become trivial.

### Why this is honest PM

Every screenplay structure is a real PM node. The outer doc's schema enforces that scenes have exactly one heading + at least one body block. Cross-block selection is the native PM behaviour. Save/load is `doc.toJSON()` / `schema.nodeFromJSON()` with no custom propagation layer. The pagination layer reads a real PM doc tree.

### What it is NOT

- NOT a Fountain plain-text model. Block types are first-class node types.
- NOT a degradation of structure. Every screenplay rule the editor enforces today (Tab cycle, Enter flow, slug pickers, transition picker, marks-in-blocks) still works, but as commands on a single PM doc instead of N parallel ones.
- NOT a removal of NodeViews. NodeViews persist for chrome and for `scene` / `sceneHeading` / `transition` where form-control affordances are wanted. The key difference: NodeViews have `contentDOM` (a child element PM owns); they no longer instantiate separate EditorViews.

---

## 3. Scene visual design contract

The target visual must match the existing v2 playground rendering (the screenshot Darya shared): a chromed "SCENE N" header, a segmented slug row (`INT. ▼` `KAREN BEDROOM` `DAY ▼`), the body blocks with their typography (centered character cues, indented dialogue, etc.), and a transition picker at the bottom.

### How the schema renders to that visual

**`scene` node — NodeView with `contentDOM`:**

```
NodeView.dom = <div class="rga-scene-frame">
                 ├── <div class="rga-scene-num">SCENE 2</div>     ← chrome (computed from node.attrs.number)
                 ├── <div class="rga-scene-contentdom">          ← PM owns this subtree
                 │     └── (sceneHeading + sceneBody+ rendered by PM)
                 │   </div>
                 └── (optional gutter / drag-handle / remove-button chrome)
               </div>
```

PM renders sceneHeading + body blocks into `contentDOM`. The NodeView only renders the surrounding chrome. PM owns selection, cursor, transactions for everything inside `contentDOM`. No separate EditorView.

**`sceneHeading` node — NodeView with `contentDOM`:**

```
NodeView.dom = <div class="rga-scene-heading-row">
                 ├── <select class="rga-slug-setting-picker">    ← form control, updates attrs.setting
                 ├── <span> — </span>
                 ├── <select class="rga-slug-time-picker">       ← form control, updates attrs.time
                 ├── <span> / </span>
                 └── <span class="rga-slug-location-contentdom"> ← PM owns this — the location text node lives here
                       (text rendered by PM)
                     </span>
               </div>
```

The pickers are pure chrome that fire `setNodeMarkup` on attrs.setting / attrs.time when the user picks a new value. The location text is real PM text content inside `contentDOM` — typed normally, supports marks (you could bold a location word if you wanted to).

**`transition` node — NodeView with `contentDOM` OR plain rendering:**

Two options for the transition picker UX:
- **Option A (matches v2 visual):** NodeView with a `<select>` picker that mutates `attrs.transitionType`; the picker's text is the rendered value. No editable contentDOM (or hidden one for the transition text).
- **Option B (simpler):** Render as plain text via `toDOM`, with input rules / commands that recognize known transition keywords and apply them. Less GUI; relies on muscle memory and autocomplete.

**Recommendation: Option A** — preserves the current pickier UX and locked-state visual.

**`action`, `character`, `dialogue`, `parenthetical`, `shot` — NO NodeView, plain `toDOM`:**

These are rendered by PM's default flow from `toDOM`. The CSS class on each (`.rga-block-action`, `.rga-block-character`, etc.) drives the typography rules already in `editor-prosemirror.css`. PM cursor, selection, marks all work natively. No NodeView complexity.

### Editable content vs chrome (the contract)

| Element | Owned by | User can edit |
|---|---|---|
| "SCENE N" label | NodeView (chrome) | No — derived from `scene.attrs.number` |
| Drag handle / remove button | NodeView (chrome) | Click-action only, not editable |
| Setting picker dropdown | NodeView (chrome) | Pick option → updates `sceneHeading.attrs.setting` |
| Time picker dropdown | NodeView (chrome) | Pick option → updates `sceneHeading.attrs.time` |
| Location text | PM (contentDOM) | Yes — normal text editing |
| Em-dash, slash separators in slug | NodeView (decorative span) | No |
| Transition picker | NodeView (chrome) | Pick option → updates `transition.attrs.transitionType` |
| Action / Character / Dialogue / Parenthetical / Shot text | PM (default rendering, no NodeView) | Yes — fully editable, marks apply, cross-block selection works |

### Selection and focus

- Tab in a block → custom keymap on the *single* outer EditorView calls a `cycleBlockType(direction)` command that maps the focused block's `nodeType` to the next type in the cycle (action→character, etc.) via `setBlockType(state.schema.nodes[nextType])`.
- Enter in a block → custom command splits the current block and inserts a new block of `ENTER_NEXT[currentType]`.
- Enter on an empty trailing block at the end of a scene → spawns a new `scene` node after the current one.
- Mod-Enter anywhere → spawns a new `scene` after the focused-scene's range.
- Backspace at start of empty block → joins with previous (PM `joinBackward` plus rules for cross-scene cases).
- Cross-block selection works because PM has one selection across the whole doc.

### NodeView discipline

NodeViews exist only for: `scene`, `sceneHeading`, `transition`. Everything else uses default PM rendering via `toDOM`. **Total NodeView count is bounded by the number of scenes**, not by the number of blocks. For a 100-scene script: 100 scene NodeViews + 100 sceneHeading NodeViews + 100 transition NodeViews = 300 lightweight NodeViews (each renders pure DOM, owns no PM editor). Compare to today's ~25 inner editors for a 5-scene script (so ~500 for 100 scenes — and each inner editor has full state/plugins/history).

---

## 4. Pagination architecture

### NormalizedBlock[] from the new schema

The existing `layout/normalizer.js` walks the OUTER doc + every sceneFrame's `attrs.innerDoc` JSON to produce a flat block list. **With the new schema, the normalizer walks a single PM doc tree directly.** No JSON tree to dig into; PM's `doc.descendants` or a recursive walk over `body` children gives us everything in order.

Block-type-to-NormalizedBlock mapping is the same as today (the existing normalizer's `_OUTER_TYPE_MAP` + `_INNER_TYPE_MAP` collapse into a single `NODE_TYPE_MAP`). Scene-level metadata (notes / revisionFlag) attaches to the sceneHeading's NormalizedBlock or each block in the scene as `metadata.sceneNotes` / `metadata.sceneRevisionFlag`.

### PageMap engine — unchanged

`layout/engine.js` already operates on NormalizedBlock[] + LayoutProfile and produces a PageMap. It does not care where the blocks came from. **Zero changes to the engine for the schema migration.** The 36 layout-layer tests (wrap + normalizer + engine) keep passing; normalizer tests gain new fixtures for the new schema shape.

### Flow view — page markers as decorations

Flow view is the continuous writing surface — one tall scrolling column. Page boundaries are shown as **subtle visual markers** (the current `.rga-page-break` desk-strip element is fine), placed as `Decoration.widget` entries at the PageMap-determined PM positions. **Real flow space**, no overlays, no masking. The user sees thin dividers as they write and knows roughly where pages fall, but the column is continuous — that's the writing experience.

### Print view — REAL PAGES (not one tall fake page)

**The critical change.** Print view is no longer a single column with break-widget dividers. It is **N visually distinct paper-sheet containers**, one per `pageMap.pages` entry. Each sheet has the paper background, the shadow, the fixed paper width and height per `pageSetup`, and contains the blocks PageMap assigned to that page.

This delivers what the user actually meant by "real pages":
- Each sheet has a fixed height (e.g., 11" = 1056px for Letter). It does NOT resize as you type — instead, when content overflows, the paginator recomputes and the block is reassigned to a different sheet.
- Adding text doesn't make a sheet taller; it pushes content to the next sheet.
- Backspacing doesn't shrink a sheet; it may pull content back from the next sheet but the sheet itself stays at paper height.
- There is real whitespace at the bottom of pages that aren't full — same as paper.
- Page numbers, running headers (title), and other paper conventions render cleanly because each sheet has its own header/footer areas.

### Why Print should NOT be one tall fake page

The single-column-with-dividers approach (current V3) fundamentally cannot satisfy "fixed page height" because the column IS the content; its height is the sum of the content. Adding text grows the column; the dividers move. The page boundary feels like a divider in a continuous document, not a transition between separate physical pages — exactly the user's complaint.

The only way to make pages feel paged is to have separate page containers, each of fixed size, where overflow triggers pagination rather than vertical expansion.

### How Print view editing works

Two viable shapes; pick one in Phase 7:

**Shape A — Print is read-only preview.** Editing happens in Flow view; switching to Print renders a fresh paginated preview from the current doc + PageMap. No edits in Print. Pro: simple, robust. Con: writers used to typing in WYSIWYG paper view won't have it.

**Shape B — Print supports light editing.** Each page shell renders a slice of the PM doc; user types into a sheet, PM dispatches normally, paginator recomputes, content reflows across sheets. Pro: full WYSIWYG. Con: requires PM to render its document into multiple non-contiguous DOM containers, which is a custom rendering layer (PM doesn't support multi-mount of the same doc out of the box).

**Recommendation:** start with Shape A (Phase 7). Re-evaluate Shape B as a Phase 9+ enhancement once the structural reset is settled.

### Editing keeps happening in Flow

Flow view remains the canonical editing surface for both shapes. Print view is the paginated rendering. Pagination IS the same data (PageMap) used by future PDF export.

---

## 5. Migration strategy

### What needs to migrate

Existing `.rga` v2.0 files have:

```js
{
  rga_version: "2.0",
  body: {
    type: "doc",
    content: [
      { type: "titleStrip", ... },
      { type: "body", content: [
        { type: "paragraph", content: [...] },           // treatment
        { type: "sceneFrame", attrs: {
            id, number, headingStyle,
            innerDoc: {                                  // JSON snapshot
              type: "doc",
              attrs: { notes: "", revisionFlag: null },
              content: [
                { type: "sceneLine", attrs: { setting, time }, content: [{type:"text", text:LOCATION}] },
                { type: "action", content: [{type:"text", text:"..."}] },
                { type: "character", content: [{type:"text", text:"NALI", marks:[{type:"tag", attrs:{tagType:"character", entityId:"ent-nali"}}]}] },
                { type: "dialogue", content: [...] },
                { type: "parenthetical", content: [...] },
                { type: "transition", content: [{type:"text", text:"CUT"}] }
              ]
            }
        }},
        { type: "paragraph" },                           // spacer
        { type: "sceneFrame", ... }
      ]}
    ]
  }
}
```

### What it becomes (v3.0)

```js
{
  rga_version: "3.0",
  body: {
    type: "doc",
    content: [
      { type: "titleStrip", ... },
      { type: "body", content: [
        { type: "paragraph", content: [...] },           // treatment unchanged
        { type: "scene", attrs: {
            id, number,
            notes: "" (from old innerDoc.attrs.notes),
            revisionFlag: null (from old innerDoc.attrs.revisionFlag),
            metadata: {}
          },
          content: [
            { type: "sceneHeading",
              attrs: { setting: "INT.", time: "DAY", headingStyle: null },
              content: [{ type: "text", text: "KAREN BEDROOM" }]
            },
            { type: "action", content: [{type:"text", text:"..."}] },
            { type: "character", content: [{type:"text", text:"NALI", marks:[{type:"tag", attrs:{...}}]}] },
            { type: "dialogue", content: [...] },
            { type: "parenthetical", content: [...] },
            { type: "transition", attrs: { transitionType: "CUT" }, content: [] }
          ]
        },
        // The old spacer `paragraph` is dropped — scenes are first-class siblings
        // in the new schema; no need for explicit spacers (CSS handles inter-scene margin).
        { type: "scene", ... }
      ]}
    ]
  }
}
```

### Per-field migration table

| v2.0 source | v3.0 destination | Notes |
|---|---|---|
| `sceneFrame.attrs.id` | `scene.attrs.id` | direct |
| `sceneFrame.attrs.number` | `scene.attrs.number` | direct |
| `sceneFrame.attrs.headingStyle` | `sceneHeading.attrs.headingStyle` | moved into the heading |
| `sceneFrame.attrs.innerDoc.attrs.notes` | `scene.attrs.notes` | direct |
| `sceneFrame.attrs.innerDoc.attrs.revisionFlag` | `scene.attrs.revisionFlag` | direct |
| `sceneFrame.attrs.innerDoc.content[0]` (sceneLine) | `scene.content[0]` (sceneHeading) | attrs.setting / attrs.time carry over; text content (location) carries over |
| `sceneFrame.attrs.innerDoc.content[1..N-1]` (blocks) | `scene.content[1..N-1]` | type names stay the same (action, character, dialogue, parenthetical, shot); content + marks carry over byte-for-byte |
| `sceneFrame.attrs.innerDoc.content[N]` (transition) | `scene.content[last]` (transition) | text content → `attrs.transitionType` (e.g., text "CUT" → `attrs.transitionType: "CUT"`) |
| `paragraph` (empty, between scenes) | DROP | Inter-scene spacing handled by CSS in the new schema |
| Marks on text nodes (`annotation`, `tag`, `revisionFlag`, etc.) | unchanged | Stay attached to text nodes; mark specs are identical between v2.0 and v3.0 |
| `doc.metadata`, `doc.settings`, `doc.tagRegistry`, `doc.flagLog`, `doc.exportSettings`, `doc.runtime` | unchanged | Doc-level fields stay the same; only `rga_version` bumps to `"3.0"` |

### Migration code shape (no implementation)

A pure function `Rga.Doc.migrateV2toV3(parsed) → parsed` that operates on the raw JSON before `schema.nodeFromJSON` is called. Lives in `doc.js` next to the existing `_migrateScenesToFrames`. Triggered by `if (parsed.rga_version === "2.0") migrate`.

### Legacy reader

For at least one shipped version, keep the v2.0 reader alongside the new one:
- If file is `rga_version: "1.x"` → migrate to 2.0 (existing path) → migrate to 3.0 → load.
- If file is `rga_version: "2.0"` → migrate to 3.0 → load.
- If file is `rga_version: "3.0"` → load directly.

Save always writes v3.0. So once a file is opened + saved in the new editor, it converts. Older editors can't read v3.0 files (intentional one-way migration).

### Test fixtures

- `tests/fixtures/v3.0-sample.rga` — hand-authored.
- `tests/fixtures/v2.0-to-v3.0-migrated.rga` — output of running migration on `v2.0-sample.rga`; snapshot-tested.
- Round-trip test: `v2.0-sample.rga` → load (migrate) → save → re-load → assert equal-ignoring-rga-version to the snapshot.
- Round-trip test: `v3.0-sample.rga` → load → save → re-load → byte-identical.

---

## 6. Risk analysis

### Schema migration risks

- **Risk:** Migration drops or mangles fields on edge-case scenes (empty scenes, missing transitions, scenes with no body blocks).
  **Mitigation:** Phase 0 forensic audit catalogues every shape variant present in existing fixtures + the playground. Round-trip tests cover each.

- **Risk:** Marks attached to text nodes (annotation, tag, revisionFlag) somehow change format between v2 and v3.
  **Mitigation:** Mark specs are byte-identical between versions. Tests assert marks survive the migration unchanged.

- **Risk:** A user's playground file (uncommitted, on their machine) becomes unreadable mid-migration.
  **Mitigation:** Migration runs read-only on load; write happens only on explicit save. File on disk stays v2.0 until the user saves. Plus: legacy reader keeps reading v2.0 indefinitely as a fallback.

### NodeView scene chrome risks

- **Risk:** NodeView with `contentDOM` is more complex than atom NodeView. Specific edge cases — selection straddling the contentDOM boundary, focus transitions between chrome controls and contentDOM, paste events landing in the wrong DOM — can produce surprising behaviour.
  **Mitigation:** PM's official docs cover this pattern extensively; the API is well-trodden (Notion-style block editors, Outline, Tiptap's wrapping nodes all use it). Test cross-block selection + paste + drag-drop on the new schema before declaring Phase 4 done.

- **Risk:** Picker `<select>` elements inside the NodeView steal focus from the inner editable area in ways that interfere with typing flow.
  **Mitigation:** Same pattern is already used in the current v1 placeholder + v2 NodeView and works; carry that focus discipline over.

### Print preview rendering risks

- **Risk:** Building a real multi-page renderer (Shape A or B) is non-trivial and may have visual glitches at first.
  **Mitigation:** Shape A (read-only preview) is significantly simpler than Shape B. Ship A first; defer B.

- **Risk:** Shape A's "switch to Print regenerates" path may feel slow on long scripts.
  **Mitigation:** PageMap engine is fast (pure-function, single-pass over normalized blocks). Re-rendering N page shells is one DOM construction per page; cheap at 100s of scenes. Profile if it becomes noticeable.

### Performance risks

- **Risk:** A single PM doc with hundreds of blocks may be slower to render than the current per-scene-editor model.
  **Mitigation:** PM is highly optimized for large docs (Notion, Atlas, Quartz, others use single docs with thousands of nodes). The current per-scene-editor model has its OWN scaling concern (eager mount of N editors), arguably worse. Measure both at 100-scene scale and decide.

- **Risk:** NodeView count grows linearly with scenes (1 scene + 1 sceneHeading + 1 transition NodeView each). At 100 scenes that's 300 NodeViews.
  **Mitigation:** These are lightweight DOM wrappers, not EditorViews. No PM state, no plugins, no history per NodeView. Roughly 10-100x cheaper than today's per-block editors.

### Data-loss risks

- **Risk:** The migration drops a field nobody noticed was there.
  **Mitigation:** Forensic audit (Phase 0) is the safety net. Run migration on every `.rga` file in the repo (samples + playground + every fixture) and assert no information is lost.

- **Risk:** A user opens v2.0, saves as v3.0, then needs to open in an older Rwanga build that doesn't know v3.0.
  **Mitigation:** Document the version-bump as one-way. Provide a downgrade script or "Export as v2.0" command if anyone actually needs it (probably nobody will).

### Feature-loss risks

- **Risk:** A feature that works today via the nested-editor model has no equivalent in the single-doc model.
  **Audit during Phase 0.** Candidate features to verify:
  - Character-cue autocomplete (currently a per-inner-editor plugin) → re-implement as a single plugin scoped to focused character blocks
  - Right-click context menu → still works on a single doc
  - All 12 marks → still work
  - Tag-suggest popup on blur → re-attach to character block blur
  - Cross-view undo fallback → no longer needed (one history)
  - Scene-toolbox block-type dropdown → much simpler (one PM command)
  - Notes / Flags panels → simpler scan (no innerDoc JSON walk needed)

---

## 7. Phased implementation plan

Each phase has a clear deliverable + acceptance criterion. Phases land one at a time. No mass rewrite.

### Phase 0 — Forensic audit and exact schema proposal

**Goal:** Lock the new schema with zero hand-waving.

**Deliverables:**
- Inventory of every `.rga` shape present in repo (every fixture + sample + playground): JSON of every distinct sceneFrame variant, every distinct innerDoc shape, every distinct block-content pattern.
- Document each edge case (empty innerDoc, missing transition, scenes with only an action, etc.) and how the new schema represents it.
- Lock the exact JSON shape for each new node type (schema spec + example JSON).
- List every feature in the current editor that operates on the nested model; for each, document the single-doc equivalent.

**Acceptance:** Schema spec is final, feature-equivalence matrix is complete, no open "what about X" questions.

### Phase 1 — New schema behind a feature flag

**Goal:** Build the schema additions; nothing renders or migrates yet.

**Deliverables:**
- New schema spec exposed via `Rga.Framework.screenplayV3Schema` (or similar) — defines scene, sceneHeading, action, character, dialogue, parenthetical, shot, transition nodes per the Phase 0 spec.
- Loaded behind `metadata.useSchemaV3` flag (mirrors the existing `useV2SceneFrame` pattern).
- Existing schema continues to work unchanged for everything else.
- Unit tests: schema constructs, can build empty doc, can build a hand-authored 1-scene doc, marks attach correctly.

**Acceptance:** New schema loads in tests without breaking existing 192 tests; no UI change in app.

### Phase 2 — Migrate one fixture

**Goal:** Prove migration round-trips.

**Deliverables:**
- `Rga.Doc.migrateV2toV3(parsed) → parsed` pure function.
- `tests/fixtures/v3.0-sample.rga` (hand-authored or generated from playground via the migration function).
- Round-trip tests: load v2.0 → migrate → schema.nodeFromJSON → toJSON → assert deep-equal to expected v3.0 shape.
- Per-field assertions: marks preserved, scene-level notes preserved, transition preserved, sceneHeading attrs preserved.

**Acceptance:** Playground file migrates without data loss; round-trip stable.

### Phase 3 — Render screenshot-equivalent scene frame

**Goal:** A scene in the new schema renders visually identically to the current v2 NodeView output.

**Deliverables:**
- NodeView for `scene` (chrome + contentDOM).
- NodeView for `sceneHeading` (picker chrome + location contentDOM).
- NodeView for `transition` (picker chrome).
- CSS adjustments (mostly reuse existing `.rga-scene-frame-placeholder` styles, renamed if needed for clarity).
- Renders behind the `useSchemaV3` flag; switching the flag flips a doc from v2 NodeView to v3 schema.

**Acceptance:** Open the migrated playground file in the editor (with flag on) → renders pixel-equivalently to the current v2 view. Hand off to user for visual confirmation.

### Phase 4 — Editing + keymaps

**Goal:** All current screenplay editing rules work on the new schema, using ONE PM editor.

**Deliverables:**
- Single outer-editor keymap (no per-block keymaps):
  - Tab / Shift-Tab → `cycleBlockType` command that maps the focused block's nodeType to the next/prev in FORWARD_TAB / BACKWARD_TAB.
  - Enter → `enterFlow` command that splits the current block and inserts the next type per ENTER_NEXT.
  - Enter on empty trailing block in a scene → `spawnNextScene` command.
  - Mod-Enter → `spawnNextScene` from anywhere.
  - Backspace at start of empty block → `joinBackward` plus rules for first-block-in-scene cases.
- All four toolbar mark buttons (B / I / U / S) dispatch on the single editor.
- Right-click context menu fires from the single editor (one plugin instance, not per-block).
- Cross-block selection works.
- Character-cue autocomplete plugin reattaches to the single editor, scoped to `character` block nodes.
- Tag-suggest-on-blur reattaches to the single editor, scoped to `character` block nodes.

**Acceptance:**
- Click in a dialogue block, hold Shift, click in the next action block → both highlighted as one selection. Press Backspace → both deleted as one operation.
- Tab in an action block → becomes character. Tab again → dialogue. Etc.
- Enter in a character block creates a dialogue block, cursor moves there.
- All 12 marks apply correctly via toolbar + keyboard shortcuts.

### Phase 5 — Notes / tags / flags compatibility

**Goal:** Notes panel, Flags panel, Tag breakdown all work against the new schema with simpler code.

**Deliverables:**
- `annotation-notes.js` refresh: walks the single PM doc (no innerDoc JSON walk needed) for annotation marks. Significantly less code.
- `revision-flags.js` refresh: same simplification.
- `tags.js` operations: tag mark attached to inline content works natively.
- Scene-level notes (`scene.attrs.notes`) and scene-level revision flag (`scene.attrs.revisionFlag`) — UI to view/edit these in the scene inspector (could be Phase 5 or deferred).
- Auto-tag-on-blur popup re-attaches to character block blur events.

**Acceptance:** Open the migrated playground, every annotation / flag / tag visible in v2 still appears in the panels; click-to-navigate, resolve/restore/remove, accept/dismiss all work.

### Phase 6 — PageMap integration

**Goal:** Pagination engine consumes the new schema.

**Deliverables:**
- `layout/normalizer.js` updated: walks the new schema (one doc, no innerDoc JSON). Code becomes meaningfully simpler.
- `layout/engine.js`: NO change (it's already schema-agnostic — operates on NormalizedBlock[]).
- `layout/profiles.js`: NO change.
- `paginator-renderer.js` (Flow view markers): NO functional change; it consumes the PageMap and emits decorations as today.
- New tests: normalizer fixture for the new schema; round-trip via engine → PageMap matches expected.

**Acceptance:** Open the migrated playground → Flow view shows the same page markers (or better-aligned ones) as today. Total page count matches expectations from line-budget math.

### Phase 7 — Print view real page shells

**Goal:** Print view renders as N fixed-size paper sheets, not one tall column.

**Deliverables:**
- New `print-view-renderer.js` (or similar) that, when Print view is active, renders the doc into N `<div class="rga-page-sheet">` containers, one per `pageMap.pages[]`.
- Each sheet is fixed `width × height` per `pageSetup`, with paper background, shadow, header/footer space.
- Sheet N renders the blocks assigned to page N by the PageMap (HTML cloned from the editor's render OR re-rendered from the doc — pick during Phase 7 design).
- Recompute + re-render on doc change (debounced).
- Shape A (read-only preview) for v1 — Print is a preview; editing happens in Flow.

**Acceptance:**
- Open migrated playground → switch to Print view → see real paper sheets with fixed heights.
- Type text in Flow → switch to Print → see content reflowed across sheets at expected boundaries.
- Backspace text in Flow → switch to Print → sheet count adjusts; sheet heights do NOT change.
- The user's complaint ("on adding new text it resizes and on backspace it shrinks") cannot happen because each sheet has a fixed height in CSS.

### Phase 8 — Legacy cleanup

**Goal:** Remove the old nested-editor model.

**Deliverables:**
- Archive `scene-frame-placeholder.js`, `scene-frame-pm.js`, `scene-frame-node-view.js`, `inner-schema.js`, `inner-keymap.js`, `inner-scene-line-node-view.js`, `inner-zone-key-plugin.js` to `archived/`.
- Remove `sceneFrame` atom from the outer schema (no longer registered).
- Remove `metadata.useV2SceneFrame` flag (no longer meaningful).
- Remove `metadata.useSchemaV3` flag (v3 is now the only schema).
- Bump `CURRENT_RGA_VERSION` to `"3.0"`; mark `SUPPORTED_RGA_VERSIONS` as `["1.0","1.1","2.0","3.0"]` (read all, write 3.0).
- Update README + architecture docs.
- Delete tests that target the archived code; keep migration tests (they're the safety net).

**Acceptance:** Build runs, tests pass, app boots, every fixture loads and renders correctly. No reference to `sceneFrame` atom or `attrs.innerDoc` remains in active code paths.

---

## 8. Acceptance gates

Final-state criteria. The reset is COMPLETE when every gate below passes.

| # | Gate | How verified |
|---|---|---|
| 1 | **One editor only.** No per-block EditorView instances. | Code audit: `new PM.EditorView(...)` appears exactly once in the codebase (the outer mount). |
| 2 | **No inner EditorView per block.** | Code audit + runtime: `Rga.Editor.instances()` returns 1 at all times. |
| 3 | **Cross-block selection works.** | Manual test: drag-select from a character cue across into the next dialogue block → selection highlights both → Backspace deletes both → Ctrl+C copies both. |
| 4 | **Save / load round-trip works.** | Test: open every fixture (sample, playground, migrated v2.0, fresh v3.0) → save → re-load → assert byte-equal. |
| 5 | **Existing playground migrates without data loss.** | Test: run `migrateV2toV3` on `playground-the-last-light.rga` → schema validates → every annotation, tag, revisionFlag, transition, sceneHeading, scene number, note present in output → manual visual confirm in editor. |
| 6 | **Scene still visually matches the screenshot.** | Manual: open migrated playground → screenshot scene 2 → visually compare to the original screenshot Darya shared 2026-05-16. Diff is "no perceivable difference" or "improvement". |
| 7 | **Pagination uses PageMap.** | Code audit: `paginator-renderer.js` calls `layout.normalize(view.state.doc)` and `layout.computePageMap(blocks, profile)`. No `getBoundingClientRect` calls anywhere in the active paginator codepath. |
| 8 | **Print view displays fixed page shells.** | Manual: open migrated playground in Print view → inspect DOM: N separate `<div class="rga-page-sheet">` elements, each with explicit `height: <paperHeight>` CSS, content distributed per PageMap. Type text in Flow → switch to Print → sheet heights don't change, content reflows across sheets. |
| 9 | **100-scene synthetic script remains usable.** | Generate (programmatically) a 100-scene `.rga` file; load in the editor; verify: load completes in under 2s, scroll is smooth, typing in any block is responsive, Flow view + Print view both render, pagination produces a sensible page count. |
| 10 | **Marks (notes / flags / tags) survive end-to-end.** | Test: add note → save → re-load → note appears in panel + on-text highlight → resolve note → save → re-load → resolved state intact. Same for flags and tags. |

---

## End of plan

This document is the design spec. No code lands until Phase 0 is complete and the schema is locked. Each subsequent phase produces a verifiable deliverable; Darya stops the plan at any phase that doesn't satisfy.

Companion documents:
- `state-inventory-2026-05-16.md` — what we have today.
- `paginator-architecture-report-2026-05-16.md` — pagination history + consultant input that drove this reset.

Last commit at time of writing: `d1c5f915` (fix: seed empty action block on freshly spawned scenes). 192/192 unit tests pass on the current architecture.
