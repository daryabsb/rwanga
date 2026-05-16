# Rwanga — Phase 0 Final Schema Contract
**Date:** 2026-05-16 (revised after design-owner pre-implementation corrections)
**Status:** Pending sign-off. Implementation may begin against this contract once Darya signs off.
**Source of truth for current `.rga` shape:** `tests/fixtures/sample-the-last-light.rga` (v2.0).
**Companion docs:** `state-inventory-2026-05-16.md`, `architecture-reset-plan-2026-05-16.md`.

This revision incorporates 9 design-owner corrections delivered after the first contract draft:
1. `sceneHeading` is a content-bearing node (location lives in inline content, not attrs).
2. `transition` is NOT an atom; carries inline content with a `presetType` attr.
3. Parenthetical text includes its own parens (`"(barely a whisper)"`) — no CSS auto-wrapping.
4. NavigationIndex entries carry stable `nodeId`s (positions are ephemeral).
5. New derived `DocumentOutline` structure for explorer / analytics / AI / export.
6. `metadata.language` replaced by structured `metadata.screenplayProfile`.
7. Print and Editor renderers share a `RenderModel` to prevent drift.
8. `scene.attrs.metadata` has explicit shape for future scene composition.
9. New acceptance gate: 100-scene file + insert scene 50.5 must not destabilize anything.

---

## §1 Current `.rga` reality (forensic, from `sample-the-last-light.rga`)

### Top-level file shape (v2.0)

```
rga_version:      "2.0"
document_type:    "screenplay"
metadata:         { title, author, created, modified, version, revision_notes, language, production_type, genre, logline }
settings:         { theme, font_size, font_family, show_scene_numbers, page_size, pageSetup, vocabulary, sceneHeadingStyle }
                  // older files lack `units`; newer ones include it. No `useV2SceneFrame` in this sample.
body:             PM Node tree (see below)
tag_registry:     { characters[], props[], wardrobe[], locations[], sfx[], vfx[], vehicles[], animals[], custom[] }
flag_log:         []
export_settings:  { branding, letterhead_url, include_scene_numbers, include_revision_marks }
runtime:          { last_cursor, active_scene_id, ui_state }
```

### `settings` observed

- `paperSize: "Letter"` with margins `{ top: 1, right: 1, bottom: 1, left: 1.5 }`
- `vocabulary.settings: ["INT.", "EXT.", "INT./EXT.", "EXT./INT."]`
- `vocabulary.times: ["DAY", "NIGHT", "CONTINUOUS", "DUSK", "DAWN"]`
- `vocabulary.sceneWord: "SCENE"`
- `sceneHeadingStyle: "twoLine"` (per `doc.js` defaults; not stored explicitly in this sample)
- `font_family: "Courier Prime"`, `font_size: 12`

### `tag_registry.characters` observed

```js
{ id: "ent-nali",   name: "NALI",       color: "#4FC1FF", notes: "Protagonist. Carries the film." }
{ id: "ent-baban",  name: "BABAN",      color: "#FFB86C", notes: "Grandmother. The reason we are here." }
{ id: "ent-hassan", name: "DR. HASSAN", color: "#A8F0A8", notes: "Family doctor. Witness." }
```

Other categories (`props`, `wardrobe`, `locations`, `sfx`, `vfx`, `vehicles`, `animals`, `custom`) are empty arrays but follow the same shape.

### `body` actual structure

```
doc
├── titleStrip { attrs.removable: true, content: [text "The Last Light"] }
└── body
    ├── heading { attrs.level: 2, content: [text "Logline"] }
    ├── paragraph { content: [text "On the morning of her grandmother's death, …"] }
    ├── heading { attrs.level: 2, content: [text "Characters"] }
    ├── paragraph { content: [text "NALI — 28, …"] }
    ├── paragraph { content: [text "BABAN — 84, …"] }
    ├── paragraph { content: [text "DR. HASSAN — 60s, …"] }
    ├── paragraph {}                        # empty spacer
    ├── sceneFrame (scene-001, number 1)
    ├── paragraph {}                        # empty spacer
    ├── sceneFrame (scene-002, number 2)
    ├── paragraph {}
    ├── sceneFrame (scene-003, number 3)
    ├── paragraph {}
    ├── sceneFrame (scene-004, number 4)
    ├── paragraph {}
    ├── sceneFrame (scene-005, number 5)
    └── paragraph {}
```

### `sceneFrame` actual structure

Every scene's outer attrs: `{ id: "scene-NNN", number: 1..5, headingStyle: null, innerDoc: {…} }`.
`innerDoc.attrs`: `{ notes: "<scene-level note text>", revisionFlag: null }`. Every scene has notes; no scene in this sample has a revisionFlag.
`innerDoc.content` ordering: **always `sceneLine` first, always `transition` last**, body blocks in between.

### Inner block-type variations observed

| Block type | Count | Attrs | Content shape |
|---|---|---|---|
| `sceneLine` | 5 (one per scene) | `{ setting, time }` | one text node containing the location |
| `action` | 19 | none | inline (text + occasional `tag` marks) |
| `character` | 9 | none | single text node, uppercase character name |
| `parenthetical` | 3 | none | **single text node WITHOUT parens** — raw text only (e.g., `"barely a whisper"`, not `"(barely a whisper)"`) |
| `dialogue` | 8 | none | single text node, normal-case spoken line |
| `shot` | 1 | none | single text node, uppercase (`"TAIL LIGHTS RECEDE"`) |
| `transition` | 5 (one per scene) | none | single text node with the transition keyword (CUT / DISSOLVE / FADE OUT) |

### `setting × time` combinations observed
- `EXT. + DAWN` (scene 1), `INT. + DAY` (scenes 2, 3), `INT. + DUSK` (scene 4), `EXT. + NIGHT` (scene 5)

### Transition values observed
- `CUT` (×3), `DISSOLVE` (×1), `FADE OUT` (×1)

### Marks observed
Six `tag` marks total, all `tagType: "character"`:
- 4× `entityId: "ent-nali"`, 1× `"ent-baban"`, 1× `"ent-hassan"`
- No `annotation`, `revisionFlag`, `bold`, `italic`, `color`, `highlight`, or `link` marks in this sample — but the schema supports all 12 and migration must round-trip them all.

### Edge cases / facts to honour

- **Multi-text-node blocks** — scene 1's action block 2 has 3 text nodes (plain + tag-marked NALI + plain). Scene 2's action block 1 has 4 text nodes. Realistic. Marks survive byte-for-byte.
- **Empty paragraph spacers** between scenes are a v2 convention; v3 drops them (CSS handles inter-scene margin).
- **Parenthetical text in v2 is stored WITHOUT parens** (e.g., `"barely a whisper"`). v3 stores WITH parens — migration WRAPs the text (per correction 3).
- **runtime.active_scene_id** = `"scene-001"` — session state, survives save/reopen.
- **No scene in this sample has a revisionFlag** but migration must preserve it where present.
- **innerDoc.attrs.notes is always present** (string, may be empty).
- **headingStyle: null** on every sample scene.
- **`paragraph` blocks at the body root** are treatment content (Logline, Characters list).

### Metadata facts observed
- `metadata.language: "en"` is a flat string (correction 6 will replace with structured `screenplayProfile`).
- `metadata.production_type: "short"`.
- `metadata.revision_notes: ""`.
- `metadata.created` and `metadata.modified` are ISO 8601 strings.

---

## §2 Final v3 schema

A single canonical PM doc. All screenplay structure is real PM nodes; no more `sceneFrame` atom and no more `attrs.innerDoc` JSON.

### Node tree

```
doc                                  (content: 'titleStrip? body')
└── body                             (content: '(heading | paragraph | scene)+')
    ├── titleStrip?
    └── (heading | paragraph | scene)+

scene                                (content: 'sceneHeading sceneBody+', group: outerBlock)
├── sceneHeading                     (required, exactly one, first child)
└── (action | character | dialogue
     | parenthetical | shot
     | transition)+                  (group: sceneBody)
```

### Node specs

#### `doc`
- `content: 'titleStrip? body'`
- attrs: none

#### `titleStrip`
- `content: 'inline*'`
- attrs: `{ removable: { default: true } }`
- toDOM: `<div class="rga-title-strip" data-removable="…">`
- Unchanged from current.

#### `body`
- `content: '(heading | paragraph | scene)+'`
- attrs: none
- toDOM: `<div class="rga-body">`

#### `heading` (treatment heading; node-type name `heading` preserved)
- `content: 'inline*'`
- attrs: `{ level: { default: 1 } }` (1, 2, 3)
- group: `outerBlock`
- toDOM: `<h{level}>`

#### `paragraph` (treatment paragraph; node-type name `paragraph` preserved)
- `content: 'inline*'`
- attrs: none
- group: `outerBlock`
- toDOM: `<p>`

#### `scene` (NEW)
- `content: 'sceneHeading sceneBody+'`
- attrs:
  - `id: { default: null }` — stable scene identifier (e.g., `"scene-001"`). REQUIRED on save; assigned at creation. **The only piece of identity stored; scene number is derived (correction A from the architecture-reset plan).**
  - `notes: { default: "" }` — scene-level note text. Kept on scene per correction B (no separate sceneRegistry yet).
  - `revisionFlag: { default: null }` — scene-level revision-flag object or null.
  - `metadata: { default: { linkedScenes: [], references: [], production: {} } }` — structured, per correction 8. See §2.1 below for shape.
- defining: true
- group: `outerBlock`
- selectable: true
- toDOM: `<div class="rga-scene" data-scene-id="…">` (NodeView per §3 — toDOM is the parseDOM fallback)
- parseDOM: `[{ tag: 'div.rga-scene', getAttrs(dom) { … } }]`

#### `sceneHeading` (REVISED per correction 1 — content-bearing, NOT a leaf)
- `content: 'inline*'` — **the location text lives in content (with marks support, inline tags, etc.)**, NOT in attrs.
- attrs:
  - `setting: { default: "INT." }` — one of `vocabulary.settings` or a custom string.
  - `time: { default: "DAY" }` — one of `vocabulary.times` or a custom string.
  - `headingStyle: { default: null }` — `"twoLine" | "inline" | null` (falls back to `doc.settings.sceneHeadingStyle`).
- isolating: true
- selectable: false
- group: -
- toDOM: `<div class="rga-scene-heading" data-setting="…" data-time="…">`
- parseDOM: `[{ tag: 'div.rga-scene-heading', getAttrs(dom) { … } }]`

**Rendering shape (NodeView per §3):** Setting picker `<select>` (chrome) — em-dash separator — time picker `<select>` (chrome) — slash separator — **location text rendered by PM into the NodeView's contentDOM**. The location text supports the full inline schema: marks (tag/annotation/bold/etc.), Kurdish/Arabic content, autocomplete, spellcheck. Per correction 1: location is not fixed metadata; it's first-class editable content.

#### `action` (NEW)
- `content: 'inline*'`
- attrs: none
- group: `sceneBody`
- toDOM: `<div class="rga-block-action">`
- parseDOM: `[{ tag: 'div.rga-block-action' }]`

#### `character` (NEW)
- `content: 'inline*'`
- attrs: none
- group: `sceneBody`
- toDOM: `<div class="rga-block-character">`
- parseDOM: `[{ tag: 'div.rga-block-character' }]`
- CSS handles centered / uppercase / bold visual; the data is plain text.

#### `dialogue` (NEW)
- `content: 'inline*'`
- attrs: none
- group: `sceneBody`
- toDOM: `<div class="rga-block-dialogue">`

#### `parenthetical` (REVISED per correction 3 — stores parens in content)
- `content: 'inline*'`
- attrs: none
- group: `sceneBody`
- toDOM: `<div class="rga-block-parenthetical">`
- **The text content includes the parentheses** (e.g., `"(barely a whisper)"`). No CSS `::before`/`::after` adds them. Copy/paste, exports, search, AI, and serialization all see the true content.
- Visual treatment (italic, centered, narrower column) is CSS — but the text characters are real.
- UX: when a user creates a new parenthetical block via Tab/Enter, an editing helper may auto-insert `()` and place the cursor between them. That's a one-time author affordance; the document stores what's typed.

#### `shot` (NEW)
- `content: 'inline*'`
- attrs: none
- group: `sceneBody`
- toDOM: `<div class="rga-block-shot">`

#### `transition` (REVISED per correction 2 — NOT atom, carries inline content)
- `content: 'inline*'` — the transition text is real content (e.g., `"CUT"`, `"MATCH CUT TO:"`, `"FADE OUT"`, or custom `"SLOW DISSOLVE INTO MEMORY"`).
- attrs:
  - `presetType: { default: null }` — when the content matches a known preset (`"CUT"`, `"MIX"`, `"FADE IN"`, `"FADE OUT"`, `"DISSOLVE"`, `"MATCH CUT"`, `"SMASH CUT"`, `"JUMP CUT"`), stored here so renderers / exporters can style or substitute accordingly. `null` means custom / unrecognized text.
- group: `sceneBody`
- selectable: true
- **NOT atom** — content is editable; user can write custom transitions naturally.
- toDOM: `<div class="rga-block-transition" data-preset-type="…">`
- parseDOM: `[{ tag: 'div.rga-block-transition', getAttrs(dom) { … } }]`

**UX (no NodeView, per correction C from architecture-reset):**
- Right-click on a transition opens a context menu with the preset list; selecting a preset both replaces the content and sets `attrs.presetType`.
- Mod-T command: insert a transition block at scene end with default `"CUT"` + `presetType: "CUT"`.
- Tab on a focused transition: cycle through presets (sets both content and `presetType`).
- Input rule: typing one of the known preset keywords directly into a transition block sets `presetType` automatically.
- Free-form text: typing anything that doesn't match a preset keeps `presetType: null` — the editor doesn't fight the writer.

### §2.1 `scene.attrs.metadata` shape (per correction 8)

```js
{
  linkedScenes: string[],          // sceneId references for callbacks, flashbacks, parallel scenes
  references:   string[],          // freeform external references (e.g., research links, beat sheet ids)
  production:   object             // production-specific fields (shoot day, location reservation, etc.)
}
```

Default value on new scene: `{ linkedScenes: [], references: [], production: {} }`. Future features (scene callbacks, flashback links, production breakdown joins) add fields without schema changes. Migration sets the default on every migrated v2 scene.

### Inline + marks

- `text` node: `group: 'inline'`. Unchanged.
- All 12 marks (`bold`, `italic`, `underline`, `strikethrough`, `color`, `highlight`, `link`, `fontFamily`, `fontSize`, `annotation`, `tag`, `revisionFlag`) attach to inline content in any block that accepts `inline*` — which now includes `sceneHeading` and `transition` (revised per corrections 1 + 2).
- Mark specs (parseDOM, toDOM, attrs, exclusion rules) are unchanged from `framework/base-outer-marks.js`.

### Marks compatibility per block type (revised)

| Block | Accepts inline marks |
|---|---|
| `titleStrip` | yes (all 12) |
| `heading` | yes (all 12) |
| `paragraph` | yes (all 12) |
| `sceneHeading` | yes (all 12) — including `tag` (location can link to a Locations registry entity) |
| `action` | yes (all 12) |
| `character` | yes (all 12) — `tag` typical for character entity link |
| `dialogue` | yes (all 12) |
| `parenthetical` | yes (all 12) |
| `shot` | yes (all 12) |
| `transition` | yes (all 12) — bold etc. could decorate a custom transition phrase |

Mark exclusion rules unchanged: `annotation` excludes `tag` + `revisionFlag`; `tag` excludes `annotation` + `revisionFlag`; `revisionFlag` excludes `annotation` + `tag`.

---

## §3 Final `.rga` v3 JSON shape

Complete realistic example: one short scene with treatment + tag marks + scene notes + structured transition + structured screenplay profile.

```json
{
  "rga_version": "3.0",
  "document_type": "screenplay",
  "metadata": {
    "title": "The Last Light",
    "author": "Rwanga Sample",
    "created": "2026-05-15T00:00:00.000Z",
    "modified": "2026-05-16T12:00:00.000Z",
    "version": 1,
    "revision_notes": "",
    "screenplayProfile": {
      "language": "en",
      "direction": "ltr",
      "screenplayConvention": "hollywood"
    },
    "production_type": "short",
    "genre": "Drama",
    "logline": "On the morning of her grandmother's death, a young woman returns to her childhood home in search of one final memory."
  },
  "settings": {
    "theme": "dark",
    "font_size": 12,
    "font_family": "Courier Prime",
    "show_scene_numbers": true,
    "page_size": "Letter",
    "pageSetup": {
      "paperSize": "Letter",
      "margins": { "top": 1, "right": 1, "bottom": 1, "left": 1.5 }
    },
    "vocabulary": {
      "settings": ["INT.", "EXT.", "INT./EXT.", "EXT./INT."],
      "times": ["DAY", "NIGHT", "CONTINUOUS", "DUSK", "DAWN"],
      "sceneWord": "SCENE"
    },
    "sceneHeadingStyle": "twoLine",
    "units": "in"
  },
  "tag_registry": {
    "characters": [
      { "id": "ent-nali",   "name": "NALI",       "color": "#4FC1FF", "notes": "Protagonist. Carries the film." },
      { "id": "ent-baban",  "name": "BABAN",      "color": "#FFB86C", "notes": "Grandmother. The reason we are here." },
      { "id": "ent-hassan", "name": "DR. HASSAN", "color": "#A8F0A8", "notes": "Family doctor. Witness." }
    ],
    "props": [], "wardrobe": [], "locations": [],
    "sfx": [], "vfx": [], "vehicles": [], "animals": [], "custom": []
  },
  "flag_log": [],
  "export_settings": {
    "branding": "rwanga",
    "letterhead_url": null,
    "include_scene_numbers": true,
    "include_revision_marks": false
  },
  "runtime": {
    "last_cursor": null,
    "active_scene_id": "scene-001",
    "ui_state": {}
  },
  "body": {
    "type": "doc",
    "content": [
      {
        "type": "titleStrip",
        "attrs": { "removable": true },
        "content": [{ "type": "text", "text": "The Last Light" }]
      },
      {
        "type": "body",
        "content": [
          {
            "type": "heading",
            "attrs": { "level": 2 },
            "content": [{ "type": "text", "text": "Logline" }]
          },
          {
            "type": "paragraph",
            "content": [
              { "type": "text", "text": "On the morning of her grandmother's death, a young woman returns to her childhood home in search of one final memory." }
            ]
          },
          {
            "type": "heading",
            "attrs": { "level": 2 },
            "content": [{ "type": "text", "text": "Characters" }]
          },
          {
            "type": "paragraph",
            "content": [{ "type": "text", "text": "NALI — 28, the granddaughter. Tired eyes, steady hands." }]
          },
          {
            "type": "scene",
            "attrs": {
              "id": "scene-001",
              "notes": "Open quiet. Mist as a character.",
              "revisionFlag": null,
              "metadata": {
                "linkedScenes": [],
                "references": [],
                "production": {}
              }
            },
            "content": [
              {
                "type": "sceneHeading",
                "attrs": {
                  "setting": "EXT.",
                  "time": "DAWN",
                  "headingStyle": null
                },
                "content": [
                  { "type": "text", "text": "OLD HOUSE — ROSE GARDEN" }
                ]
              },
              {
                "type": "action",
                "content": [
                  { "type": "text", "text": "A beat-up car rolls to a stop at the end of a long gravel drive. The engine ticks as it cools. Mist drifts low through an overgrown rose garden." }
                ]
              },
              {
                "type": "action",
                "content": [
                  { "type": "text", "text": "" },
                  {
                    "type": "text",
                    "text": "NALI",
                    "marks": [
                      { "type": "tag", "attrs": { "tagType": "character", "entityId": "ent-nali" } }
                    ]
                  },
                  { "type": "text", "text": " (28) steps out, holding a thin coat against the cold. She looks at the house — and the house looks back." }
                ]
              },
              {
                "type": "character",
                "content": [
                  {
                    "type": "text",
                    "text": "NALI",
                    "marks": [
                      { "type": "tag", "attrs": { "tagType": "character", "entityId": "ent-nali" } }
                    ]
                  }
                ]
              },
              {
                "type": "parenthetical",
                "content": [{ "type": "text", "text": "(barely a whisper)" }]
              },
              {
                "type": "dialogue",
                "content": [{ "type": "text", "text": "I came back." }]
              },
              {
                "type": "transition",
                "attrs": { "presetType": "CUT" },
                "content": [{ "type": "text", "text": "CUT" }]
              }
            ]
          }
        ]
      }
    ]
  }
}
```

### Notable shape decisions (revised)

- **No `paragraph {}` spacer nodes between scenes.** Inter-scene margin is CSS-only.
- **`scene.attrs.number` is NOT stored.** Display numbers derived from NavigationIndex.
- **`scene.attrs.metadata` has explicit shape** (`linkedScenes`, `references`, `production`) — not an empty `{}`.
- **`sceneHeading` has content** containing the location text (per correction 1). Setting + time + headingStyle in attrs.
- **`transition` has content + `presetType`** (per correction 2). Free-form text supported.
- **Parenthetical text includes parens** (per correction 3) — `"(barely a whisper)"`, not `"barely a whisper"`.
- **`metadata.screenplayProfile` replaces the flat `metadata.language` string** (per correction 6) — structured `{ language, direction, screenplayConvention }`.

---

## §4 Migration map (v2.0 → v3.0)

### Doc-level fields

| v2.0 path | v3.0 path | Transform |
|---|---|---|
| `rga_version` | `rga_version` | overwrite to `"3.0"` |
| `document_type` | `document_type` | as-is |
| `metadata.title` / `author` / `created` / `modified` / `version` / `revision_notes` / `production_type` / `genre` / `logline` | same | as-is |
| `metadata.language` | `metadata.screenplayProfile` | **DERIVED per correction 6:** `"en" → { language: "en", direction: "ltr", screenplayConvention: "hollywood" }`. `"ar" → { language: "ar", direction: "rtl", screenplayConvention: "hollywood" }`. `"ku" → { language: "ku", direction: "rtl", screenplayConvention: "hollywood" }`. (Convention defaults to `"hollywood"`; future Arabic-specific or Kurdish-specific conventions add as new values.) The old flat `metadata.language` field is dropped. |
| `settings.*` | `settings.*` | as-is; if `units` missing, omit (reader treats absence as `"in"`) |
| `tag_registry.*` | `tag_registry.*` | as-is, all categories preserved |
| `flag_log` | `flag_log` | as-is |
| `export_settings.*` | `export_settings.*` | as-is |
| `runtime.*` | `runtime.*` | as-is |

### Body-level transforms

| v2.0 location | v3.0 location | Transform |
|---|---|---|
| `body.content[0]` (`titleStrip`) | `body.content[0]` (`titleStrip`) | as-is |
| `body.content[1]` (`body` wrapper) | `body.content[1]` (`body` wrapper) | recurse into children |
| `body[1].content[*]` (`heading`) | same | as-is |
| `body[1].content[*]` (non-empty `paragraph`) | same | as-is |
| `body[1].content[*]` (empty `paragraph` between two scene siblings) | DROPPED | v2 spacer convention retired |
| `body[1].content[*]` (empty `paragraph` adjacent to treatment / doc boundary) | KEEP | legitimate empty paragraph in treatment area |
| `body[1].content[*]` (`sceneFrame`) | `scene` node | see sceneFrame transform |

### `sceneFrame` → `scene` transform

| v2 source | v3 destination | Transform |
|---|---|---|
| `sceneFrame.attrs.id` | `scene.attrs.id` | direct copy |
| `sceneFrame.attrs.number` | DROPPED | derived in v3 |
| `sceneFrame.attrs.headingStyle` | `scene.content[0].attrs.headingStyle` | moved into sceneHeading |
| `sceneFrame.attrs.innerDoc.attrs.notes` | `scene.attrs.notes` | direct copy |
| `sceneFrame.attrs.innerDoc.attrs.revisionFlag` | `scene.attrs.revisionFlag` | direct copy |
| — | `scene.attrs.metadata` | initialize to `{ linkedScenes: [], references: [], production: {} }` per correction 8 |
| `sceneFrame.attrs.innerDoc.content[0]` (`sceneLine`) | `scene.content[0]` (`sceneHeading`) | see sceneLine transform |
| `sceneFrame.attrs.innerDoc.content[1..N-1]` (mid-blocks) | `scene.content[1..N-1]` | per-block transform per next table |
| `sceneFrame.attrs.innerDoc.content[last]` (`transition`) | `scene.content[last]` (`transition`) | see transition transform |
| Edge case: scene with no transition at the end | append default `{ type: "transition", attrs: { presetType: "CUT" }, content: [{ type: "text", text: "CUT" }] }` | every v3 scene ends with a transition |

### `sceneLine` → `sceneHeading` transform (REVISED per correction 1)

| v2 source | v3 destination | Transform |
|---|---|---|
| `sceneLine.attrs.setting` | `sceneHeading.attrs.setting` | direct copy |
| `sceneLine.attrs.time` | `sceneHeading.attrs.time` | direct copy |
| `sceneLine.content` (text + any marks) | `sceneHeading.content` | **content moves verbatim** — including any marks the v2 text node carried. No flattening to a string attr. |
| `sceneFrame.attrs.headingStyle` | `sceneHeading.attrs.headingStyle` | already covered above |

### `transition` (v2) → `transition` (v3) transform (REVISED per correction 2)

| v2 source | v3 destination | Transform |
|---|---|---|
| `transition.content[*].text` (concatenated, uppercased, trimmed) | `transition.content` (single text node with the same string) | content preserved as inline text; `[{ "type": "text", "text": "<concatenated>" }]` |
| derived from v2 text | `transition.attrs.presetType` | if the concatenated text matches one of `["CUT", "MIX", "FADE IN", "FADE OUT", "DISSOLVE", "MATCH CUT", "SMASH CUT", "JUMP CUT"]` (case-insensitive, trimmed), set `presetType` to that canonical uppercase value; else `null` |
| edge: empty transition | populate `attrs.presetType: "CUT"` and `content: [{ "type": "text", "text": "CUT" }]` | default |

### `parenthetical` transform (REVISED per correction 3)

| v2 source | v3 destination | Transform |
|---|---|---|
| `parenthetical.content[*].text` (concatenated; v2 stores WITHOUT parens) | `parenthetical.content` (single text node with the text WRAPPED in parens) | `"barely a whisper"` → `"(barely a whisper)"`. If the v2 text already starts with `"("` and ends with `")"`, do NOT double-wrap. |
| any marks on the v2 text | preserved on the v3 text | byte-identical |

### Mark preservation

All `text` nodes inside any block carry their `marks` array unchanged. Mark structures are byte-identical between v2.0 and v3.0. **No mark migration is necessary.**

### Round-trip validation tests required

For each fixture in `tests/fixtures/`:
1. Load as v2.0 → migrate to v3.0 → schema.nodeFromJSON validates without errors.
2. Every original `sceneFrame` has a corresponding `scene` node with same `id`.
3. Every original mark is present in the v3 doc (especially the 6 `tag` marks in the sample).
4. Every scene's note text matches verbatim.
5. Every parenthetical's text is `( + originalText + )` (or unchanged if already wrapped).
6. Every transition has both content AND a `presetType` (null if custom).
7. Doc-level fields (`metadata` minus `language`, `settings`, `tag_registry`, `flag_log`, `export_settings`, `runtime`) byte-identical.
8. `metadata.screenplayProfile` correctly derived from old `metadata.language`.
9. Save v3 → re-load v3 → byte-identical re-save.

---

## §5 Feature-equivalence matrix

| Current feature | v3 single-doc implementation | Notes |
|---|---|---|
| Tab / Shift-Tab cycle block type | `cycleBlockType(dir)` command on single outer keymap; `setBlockType(state.schema.nodes[nextType])` | One command path |
| Enter creates next block per ENTER_NEXT | `enterFlow` command on single keymap | One handler |
| Enter on empty trailing block → spawn next scene | `enterFlow` detects condition + dispatches `spawnNextScene` | Same |
| Mod-Enter spawn next scene | `spawnNextScene` command | Same |
| Backspace at start of empty block | Single keymap; `joinBackward` + cross-scene rules | PM-native |
| Format toolbar (B/I/U/S/Color/Highlight/Link/Clear) | `toggleMark` on single editor | No focus cache needed |
| `_lastSceneBlock` focus tracking cache | DELETED | One editor, one selection |
| Character-cue autocomplete | Single plugin scoped to `character` node type | Same algorithm |
| Tag-suggest popup on blur of character cue | Single editor; fires on `character` block blur | Same |
| Right-click context menu | `contextMenuPlugin` on single editor | One instance |
| Notes (annotation marks) | Marks on inline content; refresh walks single doc | Simpler scan |
| Add note from toolbar / context-menu | `addAnnotation(view, payload)` against single editor | One view |
| Resolve / Restore / Remove note | Same as today | Logic unchanged |
| Notes panel click → navigate-to-mark | `navigateToAnnotation(id)` finds DOM by `data-id` | Same |
| Flags (revisionFlag marks) | Same model; panel scans single doc | Simpler |
| ✓ Accept flag / × Remove flag | `resolveFlag` / `removeRevisionFlag` on single editor | Same |
| Tags (production breakdown) | Tag marks on inline content; registry unchanged | Same |
| Tag dropdown (scene toolbox) | Reads single editor selection; mutates mark + registry | Same |
| Scene toolbox enabled state | `state.selection.$from.parent.type.name` walks ancestors looking for `scene` | Simpler |
| Scene toolbox block-type dropdown | `cycleBlockType` / `setBlockType` on single editor | One command |
| Setting / time pickers (slug) | NodeView for `sceneHeading` renders `<select>` chrome; `change` fires `setNodeMarkup` on `attrs.setting` / `attrs.time` | The location is now PM content inside the same NodeView's contentDOM (per correction 1) |
| Location text editing (slug) | NodeView's contentDOM holds the location text; PM-native editing, marks supported | NEW capability — location is real editable inline content |
| Transition picker | Per correction 2: no NodeView. Right-click menu / Mod-T command / Tab cycle / input rule. Free-form transitions supported (text + null presetType). | UX shift from picker to commands; new flexibility |
| Parenthetical creation | New parenthetical block: optional input rule that auto-inserts `()` and places cursor between them. The text content always includes the parens. | UX helper; data is true text |
| Scene NodeView chrome ("SCENE N" header) | NodeView for `scene`; label = `visibleSceneIndex` from NavigationIndex | Number derived |
| Drag handle / remove button on scene | Deferred (memory) — NodeView slot exists | Same |
| Undo / Redo (Mod-Z / Mod-Y) | `prosemirror-history` plugin on single editor | One history; cross-view fallback DELETED |
| Save / Save As | `state.doc` → serialize to v3 JSON | Single source |
| Session restore (reopen tabs) | Same outer mechanism; each tab loads via `Doc.deserialize` (v2 → v3 migration on load) | Same |
| Pagination (PageMap engine + renderer) | `layout/normalizer.js` walks single PM doc; engine + profiles unchanged; renderer takes one of two paths depending on view mode | Engine + profile + wrap untouched |
| Print view | Per correction 7: PrintRenderer consumes shared `RenderModel` (NOT editor DOM, NOT toDOM-duplicated). See §6.2. | Real fixed-size paper sheets |
| Flow view page markers | Renderer emits Decoration.widget breaks at PageMap boundaries | Same as today |
| Draft view | `body.view-draft-active` hides chrome | No structural change |
| Focus view (correction E from reset plan) | View-mode option; renders only focused scene (or ± N neighbors) via CSS visibility | One editor, visibility-based filtering |
| Theme dark/light toggle | Unchanged | No editor implications |
| Inspector panel | Stays placeholder; consumes DocumentOutline + NavigationIndex when implemented | Deferred |
| Tagged-entity list in sidebar | Deferred (memory); consumes NavigationIndex.tags | Same |
| File menu, OS accelerators | Unchanged | — |
| Multi-tab | Each tab has its own doc; one editor view swaps between tabs | — |
| Migration v1.x → 2.0 | Existing path kept | Extended to chain `1.x → 2.0 → 3.0` |
| Migration v2.0 → 3.0 (NEW) | Pure function in `doc.js`; triggered on load | See §4 |

### Features explicitly DELETED in v3

These exist only because of the nested-editor architecture and become unnecessary:

- `_lastSceneBlock` / `_lastSceneFrame` focus caches in `format-toolbar.js`
- `_dispatchInner` propagation logic in `scene-frame-pm.js`
- Inner-editor history plugin instances (one per block)
- Cross-view undo fallback (inner → outer)
- `_destroyBlockInnerEditor` teardown housekeeping
- `_findViewForAnnotation`, `_findViewForFlag` (one view; just walk it)
- Loop guard (`_lastDispatchedInnerDoc`) — no echo races
- Dual-scan refresh in `annotation-notes.js` / `revision-flags.js`
- Click-handler-as-defensive-fallback on each block

---

## §6 Navigation model

Per correction F (architecture reset) + correction 4 (this revision): `NavigationIndex` is derived, never persisted, and entries carry stable `nodeId`s — positions are ephemeral.

### §6.1 NavigationIndex (revised per correction 4)

```
NavigationIndex = {
  scenes: [
    {
      nodeId:        "scene-001",                  // STABLE — scene.attrs.id; survives reorderings + edits
      sceneNumber:   1,                            // derived: visibleSceneIndex (1-based, body order)
      pmPos:         42,                           // ephemeral snapshot — only valid for current doc state
      pmEndPos:      120,                          // ephemeral
      headingDisplay:"EXT. OLD HOUSE — ROSE GARDEN — DAWN",   // composed for display
      setting:       "EXT.",
      locationText:  "OLD HOUSE — ROSE GARDEN",    // pulled from sceneHeading's text content
      time:          "DAWN",
      transitionDisplay: "CUT",
      transitionPresetType: "CUT",
      blockCount:    4,                            // body blocks excluding heading + transition
      hasNotes:      true,
      hasRevisionFlag: false
    },
    ...
  ],
  characters: [
    {
      nodeId:           "ent-nali",                // STABLE — entityId from tag_registry
      name:             "NALI",
      color:            "#4FC1FF",
      cueCount:         9,                         // occurrences as a `character` block whose first tag links here
      mentionCount:     6,                         // tag-mark occurrences anywhere
      sceneAppearances: ["scene-001", "scene-002", "scene-003", "scene-005"]  // nodeIds
    },
    ...
  ],
  tags: {
    character: [...same shape as characters above...],
    prop:      [{ nodeId, name, color, mentionCount, sceneAppearances }],
    location:  [...],
    wardrobe:  [...],
    sfx:       [...],
    vfx:       [...],
    vehicle:   [...],
    animal:    [...],
    custom:    [...]
  },
  pages: [
    {
      pageNumber:    1,                            // pages are intrinsically positional — number IS the id
      startPmPos:    0,                            // ephemeral
      endPmPos:      1340,                         // ephemeral
      lineCount:     52,
      sceneIds:      ["scene-001", "scene-002"],   // nodeIds of scenes appearing on this page (in order)
      firstBlockNodeId: null,                       // reserved (would need block-level ids; out of scope for v3.0)
      lastBlockNodeId:  null
    },
    ...
  ]
}
```

**Stability rules:**
- `nodeId` survives reorderings, edits, line-break changes, and pagination shifts.
- `pmPos` / `pmEndPos` / `sceneNumber` / `startPmPos` / `endPmPos` / `pageNumber` are **ephemeral snapshots** — valid only for the doc state at the moment the index was built. Re-derived on every rebuild.
- Consumers that need to "jump to X later" should store `nodeId`, then resolve to a position at the moment of the jump via `Rga.Nav.findScene(doc, nodeId) → pmPos | null` (or analogous helpers for marks).

### §6.2 DocumentOutline (NEW per correction 5)

A separate derived structure focused on summary / explorer view / AI context / export.

```
DocumentOutline = {
  title:        "The Last Light",
  screenplayProfile: { language: "en", direction: "ltr", screenplayConvention: "hollywood" },
  scenes:       [
    {
      nodeId:           "scene-001",
      sceneNumber:      1,
      headingDisplay:   "EXT. OLD HOUSE — ROSE GARDEN — DAWN",
      summary:          "First 120 characters of the scene's first action block, for explorer hover…"
    },
    ...
  ],
  characters:   [
    { nodeId: "ent-nali", name: "NALI", appearances: 4 },     // appearances = unique scenes
    ...
  ],
  tags: {
    character: [...],
    prop:      [...],
    ...
  },
  statistics: {
    pages:         8,                              // from PageMap.totalPages
    words:         3420,                           // total words across all body content (excluding chrome)
    dialogueWords: 1980,                           // words inside dialogue blocks
    actionWords:   1320,                           // words inside action blocks
    sceneCount:    5
  }
}
```

**Consumers:**
- VSCode-style outline / explorer (future feature).
- AI context window (when AI features land — gives the model a summary instead of raw doc).
- Export summaries (page count, scene count, runtime estimate).
- Cross-script search and tooling.

**Builder:** `Rga.Outline.build(doc, pageMap?) → DocumentOutline`. Pure function. Recomputed on doc change.

### §6.3 Storage rule

**Neither NavigationIndex nor DocumentOutline appears in `.rga` files.** Both are computed at runtime from the PM doc + page setup. No migration concerns. No file-format implications.

---

## §6.5 Shared RenderModel (NEW per correction 7)

Both EditorRenderer and PrintRenderer consume the same `RenderModel`. Editor and print can never visually drift because they share the rendering source.

### Pipeline

```
PM Doc
   ↓ Rga.DocTypes.screenplay.layout.normalize(doc)
NormalizedBlock[]                                  (already exists from current paginator work)
   ↓ Rga.RenderModel.build(normalizedBlocks, profile, options)
RenderModel[]
   ↓
EditorRenderer (PM NodeViews + decorations consume RenderModel for chrome decisions)
PrintRenderer  (static HTML consumes RenderModel; no PM)
```

### `RenderModel` shape

```
RenderModel = {
  blocks: [
    {
      blockId:           "scene-001:b1",           // ephemeral, ok — renderer only
      sourceNodeId:      "scene-001",              // stable backref for navigation
      sourcePmPos:       42,                       // ephemeral
      kind:              "sceneHeading" | "action" | "character" | "dialogue" | ... | "pageBreak",
      displayText:       "EXT. OLD HOUSE — ROSE GARDEN — DAWN",
      inlineFragments:   [                          // for rendering with marks
        { text: "OLD HOUSE — ROSE GARDEN", marks: [] },
        ...
      ],
      attrs: { ... block-specific attrs ... },
      // Layout hints (from profile):
      indent:            "leftMargin" | "centeredColumn" | "rightAlign",
      typography:        { fontFamily: "Courier Prime", fontSize: 12, weight: "bold" | "normal", case: "upper" | "normal" },
      // Pagination context:
      pageNumber:        1,
      lineCountOnPage:   3
    },
    ...
  ],
  pages: [...PageMap.pages copied/extended...]
}
```

### Consumer contract

- **EditorRenderer** (PM NodeViews + decorations): uses `RenderModel` to know what chrome to show for each block; defers actual editable content to PM's normal rendering. Reads `kind`, `attrs`, `pageNumber` for chrome decisions.
- **PrintRenderer**: uses `RenderModel` to produce static HTML page shells. Reads `inlineFragments` to render text + marks. Builds DOM directly, no PM involvement.
- Neither renderer reads from the live editor DOM. Neither calls `toDOM` independently. Single source — `Rga.RenderModel.build` — produces what they both consume.

**Drift prevention:** if a typography decision changes (e.g., dialogue column width adjusts), it lives in the `profiles.js` layout profile → `RenderModel` builder reads it → both renderers reflect the change. No second place to update.

---

## §7 Risks

### R1 — Migration drops a field nobody noticed (severity: HIGH if it happens, LOW probability)
A real `.rga` file has a shape variant not in `sample-the-last-light.rga`. Mitigation: run migration against every fixture; snapshot v3 outputs; field-by-field assertions.

### R2 — Mark exclusion rules misbehave on the new node types (severity: MEDIUM)
Annotation/tag/revisionFlag exclusions tested against `paragraph` content only. New block types (action, character, dialogue, sceneHeading, transition) declare same `inline*` content + `inline` group, so exclusion semantics apply — but no test covers it yet on the new types. Mitigation: Phase 1 includes per-block-type exclusion tests.

### R3 — NodeView with contentDOM has subtle selection bugs (severity: MEDIUM)
`scene` and `sceneHeading` NodeViews own contentDOM. Cross-scene selection + drag/drop edges are a known PM pattern but have known edge cases. Mitigation: Phase 4 test plan covers cross-scene selection / paste / drag-drop explicitly.

### R4 — Parenthetical migration double-wraps parens on hand-edited files (severity: LOW)
v2 files written by the current editor store `"barely a whisper"` (no parens). But a user may have hand-edited a `.rga` to include parens (`"(quiet)"`). Migration must detect and not double-wrap. Mitigation: migration's parenthetical transform checks for leading `(` + trailing `)` and skips wrapping in that case.

### R5 — Transition presetType detection misses custom punctuation (severity: LOW)
v2 transition text `"CUT TO:"` (with colon) won't match the bare `"CUT"` preset; migration sets `presetType: null` for it. Renderer / engine treats it as custom text — visually still right; semantically future features (preset-based filtering) won't catch it. Mitigation: extend the preset-match logic to strip trailing punctuation (`:`, `.`, `…`) before comparing; also accept `"CUT TO"` variants.

### R6 — Print view RenderModel drift from editor (severity: LOW after correction 7)
Correction 7 explicitly addresses this: both renderers consume `RenderModel` from the same builder. Risk reduced to "the builder itself has a bug" — single test surface, easy to assert.

### R7 — 100-scene scale performance (severity: LOW, unverified)
PM handles large docs in production editors (Notion, etc.). Mitigation: Phase 9 acceptance gate (correction 9) explicitly tests 100-scene + insert-at-middle scenario.

### R8 — Loss of `useV2SceneFrame` flag breaks playground workflow (severity: LOW)
Routing logic must prioritize `useSchemaV3` over `useV2SceneFrame` during transition. Mitigation: routing precedence documented in Phase 1.

### R9 — Migration paragraph-spacer-vs-treatment ambiguity (severity: LOW)
Migration must drop empty paragraphs ONLY when both neighbours are scenes (or one neighbour is a scene + the other is body boundary). Empty paragraphs in treatment area are kept. Mitigation: migration logic checks both adjacent siblings before dropping.

### R10 — RenderModel performance at scale (severity: LOW)
Building `RenderModel` is O(blocks). At 100 scenes × ~10 blocks = 1000 entries, build time is sub-millisecond. No concern. Mitigation: profile if real-world docs ever push >10K blocks.

### R11 — `screenplayProfile` defaults for non-English scripts are conservative (severity: LOW)
Migrating from `language: "ar"` produces `screenplayConvention: "hollywood"` — a sensible default but probably not what Arabic productions actually want long-term. Mitigation: introduce convention values (`"arabic-tv"`, `"kurdish-feature"`, etc.) as future work; migration only ever produces `"hollywood"` for backward compat. Real conventions arrive as a separate feature.

---

## §8 Final implementation order

### Phase 1 — New v3 schema + feature flag
- Define schema per §2 (including revised sceneHeading + transition).
- Wire `metadata.useSchemaV3` routing.
- Per-node unit tests: every node spec, mark exclusions on new types, parseDOM/toDOM round-trips.

**Acceptance:** 192 existing tests + new tests pass; app boots unchanged.

### Phase 2 — Migration + fixture migration
- `Rga.Doc.migrateV2toV3(parsed) → parsed` per §4 (including parenthetical paren-wrap + transition presetType derivation + screenplayProfile derivation + scene.metadata default).
- Run against every `.rga` in `tests/fixtures/`. Snapshot v3 outputs.
- Round-trip tests per §4.

**Acceptance:** Every v2 fixture migrates cleanly; playground produces valid v3; round-trip stable.

### Phase 3 — NodeView chrome + default rendering + RenderModel builder
- NodeView for `scene` (chrome wrapper + contentDOM; scene number from NavigationIndex).
- NodeView for `sceneHeading` (setting `<select>` + em-dash + time `<select>` + slash + location contentDOM — PM owns the location text editing).
- NO NodeView for `transition`; renders via toDOM consulting `attrs.presetType` for styling hooks.
- Default PM rendering for `action`, `character`, `dialogue`, `parenthetical`, `shot` via toDOM + CSS classes.
- `Rga.RenderModel.build(blocks, profile, options) → RenderModel` (pure function, per §6.5).

**Acceptance:** Open migrated playground (with `useSchemaV3: true`) → renders visually matching v2 scene from screenshot. Location text is editable (type into it, marks apply). Transition text is editable (try a custom "MATCH CUT TO: BLACK" — content saved, presetType remains null).

### Phase 4 — Editing + keymaps on single editor
- Single keymap: Tab/Shift-Tab cycle, Enter (ENTER_NEXT), Mod-Enter (spawn scene), Backspace, mark toggles.
- Transition commands: Mod-T insert; Tab cycle when transition focused; right-click preset submenu; input rule for typed keywords.
- Parenthetical creation helper: auto-insert `()` and place cursor between on new parenthetical block (UX affordance only; data stores what user types).
- All 12 marks via toolbar + keyboard.
- Right-click context menu on single editor.
- Format toolbar `_view()` returns the single editor (no focus cache).

**Acceptance:** Every editing rule works; cross-block + cross-scene selection works; cross-scene Backspace sensible; all marks via toolbar + keyboard.

### Phase 5 — Notes / Tags / Flags / Autocomplete
- `annotation-notes.js` / `revision-flags.js` / `tags.js` refresh against single doc.
- Character-cue autocomplete plugin scoped to `character` node-type focus.
- Tag-suggest-on-blur popup on `character` block blur.
- Scene-level notes + revisionFlag UI in scene chrome (small badge; click to edit in inspector or popup).

**Acceptance:** All Notes / Flag / Tag operations preserved on migrated playground.

### Phase 6 — Pagination via PageMap on v3 doc + NavigationIndex + DocumentOutline
- `layout/normalizer.js` walks single doc.
- `layout/engine.js` + `layout/profiles.js` unchanged.
- `paginator-renderer.js` unchanged (Flow markers).
- `Rga.Nav.buildIndex(doc, pageMap?) → NavigationIndex` per §6.1 (with stable nodeIds).
- `Rga.Outline.build(doc, pageMap?) → DocumentOutline` per §6.2.
- Scene NodeView consumes `NavigationIndex.scenes[i].sceneNumber` for the chrome label.

**Acceptance:** Flow markers sensible; nav index + outline build and update on doc change.

### Phase 7 — Print view via shared RenderModel
- New `print-view-renderer.js`: when view = `printPreview`, renders N `<div class="rga-page-sheet">` containers per `PageMap.pages[]`. Each sheet has fixed CSS `width × height`.
- Consumes `RenderModel` from `Rga.RenderModel.build(...)`. **Never reads editor DOM. Never calls `toDOM` independently.**
- Shape A (read-only preview): editing in Flow, switching to Print regenerates.

**Acceptance:** Open migrated playground → switch to Print → real paper sheets with fixed heights regardless of content density. Type in Flow → switch back to Print → sheet heights unchanged, content reflows across sheets.

### Phase 8 — Focus view (architecture reset correction E)
- Add `focus` to view-mode cycle.
- Implementation: CSS visibility (`display: none` on non-focused scenes) OR decoration-based filtering. Decide in Phase 8 design.
- Variant 1: focus = single current scene. Variant 2: focus = current ± N neighbors (configurable).

**Acceptance:** View-mode pill includes Focus; selecting hides non-focused scenes; cursor stays in focused scene; editing continues to work.

### Phase 9 — Migration on save + legacy cleanup
- Auto-save writes v3.0 format.
- Legacy reader stays in `doc.js`.
- Archive nested-PM modules to `archived/`.
- Remove `sceneFrame` atom from outer schema.
- Remove `useV2SceneFrame` and `useSchemaV3` flags (v3 is the only schema).
- Bump `CURRENT_RGA_VERSION` to `"3.0"`.
- Update README, state inventory, locked memories.

**Acceptance:** Build/tests/app/fixtures all pass; no reference to `sceneFrame` atom or `attrs.innerDoc` in active paths.

### Final acceptance gate (NEW per correction 9)

After Phase 9, run the **100-scene insert-at-middle test**:

1. Generate (programmatically) a 100-scene `.rga` file with realistic block density (sceneHeading + 4–8 body blocks + transition per scene; some scenes with notes; some with tagged characters).
2. Open in the editor.
3. Place cursor between scene 50 and scene 51.
4. Issue Mod-Enter to insert a new scene (becomes scene 51; old 51..100 shift to 52..101).

Expected:
- Visible scene-number labels update (scene 51 becomes "SCENE 51"; old scene 51 becomes "SCENE 52"; etc.) within one frame of the insert.
- The user's selection remains stable — cursor lands inside the new scene's empty action block.
- Notes on existing scenes are preserved (scene with `notes: "X"` before the insert still has it after).
- PageMap recomputes; new total page count reflects the inserted scene.
- NavigationIndex updates: `scenes.length` is 101; lookups by `nodeId` return correct (new) `sceneNumber`s.
- DocumentOutline updates: statistics.sceneCount = 101.
- No freeze. No dropped frames. UI stays responsive throughout.

This is the integration gate — it exercises schema + pagination + NavigationIndex + DocumentOutline + chrome derivation + keymap + RenderModel + scale together. Failure of any one of them breaks this test.

---

## End of contract

**Sign-off required from Darya before Phase 1 begins.** Once signed off, no schema changes without re-opening this document.

Companion documents:
- `state-inventory-2026-05-16.md` — current reality.
- `architecture-reset-plan-2026-05-16.md` — original reset plan.
- `paginator-architecture-report-2026-05-16.md` — paginator history.

Current commit at time of writing: `d1c5f915` (fix: seed empty action block on freshly spawned scenes). 192/192 unit tests pass on the current architecture.
