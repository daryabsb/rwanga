# Rwanga Script Editor — Content Model & App Shell Redesign

**Date:** 2026-05-13
**Status:** Design spec approved through all sections in brainstorming session of 2026-05-13. Implementation plan to follow.
**Supersedes:**
- `docs/superpowers/specs/2026-05-12-rwanga-editor-subproject-a-design.md` — Section 1 (architectural frame), Section 2 (`window.rwanga.*` IPC), Sections 3+ on file I/O, autosave, tabs, Electron packaging, and auto-update remain authoritative. The editor-engine, content model, and `.rga` schema sections are superseded by this document.
- `rwanga_script_editor_design_kit/specs/01-Implementation-Plan.md` — block model, scene-header widget design, and `.rga` schema v1.0 sections.
- `rwanga_script_editor_design_kit/specs/03-Component-Library.md` — scene-header widget component spec.
**Status of existing implementation:** The current `rwanga-editor/` build at commit `e731683f` ships the Electron shell, file I/O, multi-tab plumbing, autosave, font vendoring, and packaging path correctly. The text-editor engine is structurally broken and is replaced wholesale by this redesign (see Part 1 § 8).

---

## Preamble — Why this redesign exists

The original sub-project A design (2026-05-12) inherited two assumptions from the design-kit prototype without questioning them:

1. **Scenes as containers.** `.rga` body was `scenes: [{ elements: [] }]` — a hierarchical model where every screenplay element must live inside a scene. Free-form text, notes, treatment outlines, transitions outside scenes, character bibles — none of it fit.
2. **Scene-header as a `contentEditable=false` widget.** The scene line was a form with INT/EXT dropdowns and a location input — explicitly excluded from the editor's typing flow. This created a wall in the document that the writer's cursor could not cross naturally.

Implementation of the prototype's editor surfaced both flaws as user-visible bugs:
- "Frozen editor after inserting a scene header" — the widget's `contentEditable=false` left the cursor with nowhere to go after the scene line.
- "Orphan action above Scene #1" — the editor started with a default empty action block; inserting a scene below it left invalid content above.
- "Editor types into the wrong block" — custom `contentEditable` handling raced the MutationObserver, with the first keystroke landing as a bare text node at `#editor` root.
- "Tab cycles through scene-header" — pressing Tab seven times on an action block triggered scene-header creation with side effects.
- "How do I add a scene?" — undiscoverable; only reachable via the command palette.
- "No rich text, no notes, no flags, no fonts" — the editor refused everything that didn't fit the rigid block grammar.

The deeper diagnosis: the IDE was a parser disguised as an editor. A screenwriter using it had no path to take a session-long note, mark a line for revision, bold a word, drop a director's instruction, or write a treatment paragraph — without leaving for Word or a text file. The IDE failed at its core purpose: being the writer's complete tool from blank page to handover.

This redesign rebuilds the editor on a real rich-text foundation (ProseMirror), defines a flat-tree document model where structured screenplay regions sit alongside free rich text, and reworks the surrounding app shell so the writer is never stuck or confused about how to act.

---

## Cross-cutting principles

These extend the sub-project A spec's principles. Implementations of any section in this document must honor them.

1. **Files sovereign, offline-first.** Unchanged from sub-project A. Files live on the writer's disk where the writer puts them. No feature is gated behind sign-in.

2. **The writer's complete tool.** The IDE supports the entire screenplay writing session from blank page to handover. If a writer using this editor needs to take their text to Word/Pages for formatting, notes, revision marks, or any other writing task, the editor has failed. Rich text, annotations, flags, freeform content all coexist with structured screenplay grammar.

3. **Future-proof for other document types.** The architecture supports `document_type` other than `screenplay` (book, diagram, flowchart, etc.) being added later as plug-in node packages, not as separate applications. v0.1 ships only the screenplay package; the framework supports more.

4. **Schema enforced at the engine level.** The editor's document model is validated against a strict schema by ProseMirror; invalid states (orphan blocks, missing scene lines, action outside scenes) are structurally impossible. No silent corruption.

5. **One command layer for the whole app.** Native menu, in-app menu, command palette, keyboard shortcuts, status bar clicks, sidebar buttons, context menus — all dispatch through `Rga.Commands.execute('<id>')`. A new feature registers a command once and is surfaced everywhere automatically. No orphan handlers.

6. **Per-doc-type renderers in shell-agnostic frameworks.** Outline panel, Entities panel, Inspector, Bottom panel, Status bar (right side), Menu bar — all framework code is doc-type-agnostic; per-type code lives in `renderer/js/doc-types/<type>/`. Adding a new document type registers a package; the shell adapts.

7. **Renderer-portable.** Unchanged from sub-project A. The renderer never branches on platform. It calls `window.rwanga.*`. ProseMirror is pure vanilla JS and works the same in Electron and a future Django-served web page.

8. **Open source (Apache 2.0).** Unchanged from sub-project A. The moat is server-side.

9. **No CDN.** Unchanged from sub-project A. All fonts, icons, ProseMirror, and the Rwanga code are vendored.

10. **`.rga` is pure JSON.** Unchanged from sub-project A. v2.0 is a ProseMirror-tree-based JSON document; Python's `json.loads()` reads it directly for server-side analysis.

---

## Part 1 — Editor design

### § 1. Architectural frame

The editor is built on **ProseMirror** — a vanilla-JS rich-text framework used by Atlassian, the New York Times, Substack, the Guardian, and others. ProseMirror provides:

- A schema-based document model (tree of typed nodes with marks on text spans)
- A reactive view that owns selection, cursor, IME, paste, undo/redo, drag-and-drop
- A plugin system for keymaps, decorations, commands, and behaviors
- Native RTL support for Kurdish/Arabic
- No framework dependency (works alongside vanilla JS, React, Vue, etc.)

ProseMirror replaces the entire custom editor stack: `editor-engine.js`, `scene-manager.js`, `tag-system.js`, `problems.js`, `Rga.Cursor.*`, the MutationObserver-based block wrapping, the `_onTab` / `_onEnter` / `_onBackspace` handlers, the scene-header widget. The Rwanga-specific screenplay layer is built on top as a node package — schema, keymap, plugins, marks, and UI glue.

**Three layers in the renderer:**

1. **ProseMirror state** — the document tree, source of truth.
2. **ProseMirror view** — renders the tree to DOM, captures input.
3. **Rwanga screenplay package** — custom node specs, custom keymap (Tab cycling inside scene, double-Enter to exit), custom marks (annotation, tag, revisionFlag), the widget insertion menu, the toolbar, the per-doc-type plugins (active scene tracking, problems validation, placeholders).

**Estimated rewrite scope:** ~3,000 lines of current editor-engine / scene-manager / tag-system / problems get deleted. ~1,500 lines of ProseMirror node specs, keymap, plugins, and UI glue replace them. Most of the prototype's CSS for `.editor-block`, `.scene-header`, etc. stays — ProseMirror renders schema nodes to DOM elements that are styled normally.

**What stays from sub-project A:**
- Electron main process (`main.js`, `preload.js`, all `electron/bridge/*` and `electron/lib/*`)
- File I/O (`Rga.FileManager`, `Rga.Doc` — modified to use ProseMirror JSON serialization)
- Multi-tab (`Rga.TabManager`)
- `window.rwanga.*` IPC contract (additions in this spec, no removals)
- Application shell (menu bar HTML, sidebar shell, status bar shell, theme system, icon system)
- Font vendoring (Courier Prime + Noto Naskh Arabic + Noto Sans Arabic — already in place)
- Packaging, auto-update, code signing strategy (sub-project A § 14, § 15)

### § 2. Document structure & node schema

The `.rga` body is a ProseMirror tree with the following node and mark types. The schema strictly enforces what's allowed where; invalid documents fail validation on load.

**Top-level structure:**

```
doc
├── titleStrip?           ← 0 or 1, sticky at top of page 1; × button removes it; re-insertable via widget menu
├── body                  ← container for all editable content
    └── (any sequence of)
        ├── paragraph     ← rich text — bold/italic/underline/strikethrough/color/highlight/font/size/link
        ├── heading       ← levels 1–3 (for "ACT ONE", section markers, treatment headers)
        ├── quote         ← styled blockquote
        ├── bulletList / orderedList (with listItem children)
        ├── scene         ← container; structured screenplay grammar inside
        ├── horizontalRule
        └── pageBreak     ← writer-inserted page break
```

**Inside a `scene` node:**

```
scene
├── sceneLine            ← exactly 1, first child; styled distinctly but pure text
├── (any sequence of)
│   ├── action
│   ├── character
│   ├── dialogue
│   ├── parenthetical
│   ├── transition
│   ├── shot
│   └── inlineFreeText   ← free rich-text paragraph embedded in scene flow (the "second + button" insertion)
```

**Marks (inline formatting and annotations on text spans):**
- `bold`, `italic`, `underline`, `strikethrough` — inline formatting
- `color` — text color (custom hex value)
- `highlight` — background color (custom hex value)
- `fontFamily`, `fontSize` — typography overrides per span
- `link` — URL or in-doc scene reference
- `annotation` — inline writer note (`{ id, text, color, createdAt, author }`)
- `tag` — entity tagging (`{ tagType: 'character'|'prop'|..., entityId }`)
- `revisionFlag` — workflow flag (`{ reason?, createdAt, status: 'open'|'resolved' }`)

**Schema-enforced invariants:**
1. A `sceneLine` MUST be the first child of every `scene`. A scene without a scene line cannot exist.
2. `action`, `character`, `dialogue`, `parenthetical`, `transition`, `shot` are NOT allowed at the body top level. They live only inside a `scene`.
3. `paragraph`, `quote`, `heading`, `bulletList`, `orderedList` are NOT allowed inside a `scene`. They live only in body. The two grammars are cleanly separated.
4. `titleStrip` appears 0 or 1 times, always as the first child of the doc if present.

These invariants resolve the three structural bugs of the prototype: no orphan action above a scene (rule 2), no scene without a line (rule 1), no "frozen widget" scene-header (the scene line is a normal text node, not `contentEditable=false`).

### § 3. Inside-scene grammar

Once the writer is inside a scene, this is the keyboard model. A custom ProseMirror `keymap` plugin owns it.

#### 3.1 State machine

The cursor is always in one of the scene's child node types. Behavior depends on which.

| In node | Enter | Tab | Shift+Tab | Backspace at start |
|---|---|---|---|---|
| `sceneLine` | → action | (no cycling — scene line is fixed) | — | exit scene (delete scene line; cursor goes to previous block above) |
| `action` | → action (new action below) | → character | → sceneLine | merge with previous action; if first action, → sceneLine |
| `character` | → dialogue | → action | → action | → action |
| `dialogue` | → action | → parenthetical | → character | → character |
| `parenthetical` | → dialogue | → transition | → dialogue | → dialogue |
| `transition` | → action | → shot | → parenthetical | → parenthetical |
| `shot` | → action | → action (cycles back) | → transition | → transition |

#### 3.2 Special keys

- **Double-Enter** (anywhere except `sceneLine`): exits the scene. Cursor moves to a new `paragraph` immediately after the scene in `body`. If content already exists after the scene, the new paragraph is inserted before it.
- **Esc**: exits the scene (same as double-Enter).
- **Smart Enter** on an empty `action`: treats as double-Enter (exit scene). Natural "I'm done with this scene" gesture.
- **Ctrl+Enter** (anywhere — inside or outside a scene): inserts a new scene immediately after the current scene (or at cursor position if not in a scene). Cursor lands in the new scene's `sceneLine`. The new scene's first `action` child has a placeholder watermark (`Action...`). If the previous scene was incomplete (only `sceneLine`, or all children empty for >some threshold), a Problem is auto-registered: "Scene #N has no content."
- **Tab does NOT include `sceneLine` in its cycle.** Scene insertion is exclusively via Ctrl+Enter or the "+" widget. Tab cycles only content block types within a scene.

#### 3.3 Auto-formatting

- `character`, `transition`, `shot`, and `sceneLine`: text is visually uppercased via CSS `text-transform: uppercase`; stored case-preserved in the data model.
- Industry-standard indentation per node type, applied via CSS using logical properties (`padding-inline-start`) so RTL mirrors correctly.
- Placeholder watermarks via CSS `::before` content with attribute selectors on empty nodes.

#### 3.4 Inline free-text block inside a scene

The "second-color +" insertion mentioned by the user. Mid-scene, the writer can step out of the structured grammar into a free rich-text paragraph without exiting the scene.

- Triggered by clicking the secondary "+" button (different color from the primary "new scene" "+"), or via command `script.insertInlineFreeText`
- Inserts an `inlineFreeText` node between the current scene child and the next
- Cursor lands in it
- Full rich-text formatting works inside (bold/italic/color/highlight/link)
- **Exit:** Enter on an empty `inlineFreeText` → returns to `action` after it. Esc → same.
- Multiple `inlineFreeText` paragraphs can stack (Enter creates new ones until the writer empties one).

#### 3.5 Scene activation lifecycle

A scene is **active** whenever the cursor or selection is inside it, OR the writer has clicked anywhere within the scene's DOM bounds. The active scene drives:

- The Inspector panel (Scene view, see Part 2 § A5)
- The bottom panel Notes / Problems / Breakdown tabs (filtered to active scene by default, see Part 2 § A6)
- The status bar active-scene chip (Part 2 § A4)
- The Outline panel highlight (Part 2 § A3)

A custom `active-scene` plugin tracks this. It emits `editor.activeSceneChange` on the renderer event bus whenever activation changes; all subscribers react.

When the cursor is outside any scene (in `body` free text), no scene is active; subscribed panels show document-level info.

#### 3.6 Scene metadata (not exported)

Each `scene` node has `attrs`:

```
scene.attrs = {
  id:           opaque scene id (stable across edits),
  number:       integer (1-based, can be renumbered),
  notes:        rich-text string, "terminal-style" — for-the-writer notes that never print,
  revisionFlag: null | { reason?, status: 'open'|'resolved' }
}
```

The `notes` field is the per-scene equivalent of the inline `annotation` mark — but for the whole scene, not a span of text. It's editable in the Inspector's Scene view and the bottom panel's Notes tab. It does not appear in the exported PDF.

### § 4. Annotations and inline marks

Three distinct mechanisms, all implemented as ProseMirror marks (text-span attributes), not nodes. All applied via right-click on a selection.

#### 4.1 Inline annotation (right-click → Add Note)

- Writer selects text → right-click → "Add note" → small popup appears anchored to the selection
- The span gets the `annotation` mark with `attrs: { id, text, color, createdAt, author }`
- Default color: warm yellow. Editable per annotation.
- Visual: highlighted background + small watermark icon at the end of the span
- Click the marked span → popup shows the note text, editable, with delete button
- Notes are rich-text-formatted inside the popup (bold/italic work)
- Annotation contents never appear in the exported PDF; the underlying text does print, without the highlight
- All annotations for the active scene listed in the Notes bottom-panel tab

#### 4.2 Tags (character / prop / wardrobe / location / sfx / vfx / vehicle / animal / custom)

Replaces the current `Rga.TagSystem`.

- Writer selects text → right-click → "Tag as..." → submenu of tag types → pick an existing entity or create a new one
- The span gets the `tag` mark with `attrs: { tagType, entityId }`
- Visual: text gets a colored underline (color from the type's theme color)
- Hovering shows a tooltip with entity name
- Click the marked span → Inspector shows entity details
- `tag_registry` in `.rga` body lists all entities; marks just reference `entityId`
- The Breakdown bottom-panel tab is derived from all tag marks grouped by type and entity

#### 4.3 Revision flag

- Writer selects text → right-click → "Flag for revision" with optional reason
- The span gets the `revisionFlag` mark with `attrs: { reason?, createdAt, status }`
- Visual: dashed red underline + small flag icon
- Click → popup with reason and Resolve / Edit / Remove actions
- Listed in the Problems bottom-panel tab grouped by scene

#### 4.4 Scene-level flags and notes

- `scene.attrs.revisionFlag` flags an entire scene (not a span)
- `scene.attrs.notes` are scene-wide writer notes (terminal-style; not exported)
- Both show in Notes / Problems alongside span-level marks

#### 4.5 Overlap

Marks can overlap. A single span can carry `tag` + `annotation` + `revisionFlag` — three layered visual treatments. Each mark is independently editable / removable.

### § 5. Widget insertion menu and toolbar

#### 5.1 The "+" widget menu

A button appears between blocks in the editor, anchored to the cursor's current line. Click → a small floating menu opens with insertable items. Type to filter.

**Outside any scene (in `body`):**
| Item | Inserts |
|---|---|
| Title | A `titleStrip` (only one allowed; if present, replaces existing) |
| Heading | A `heading` (default level 1; adjustable after) |
| Paragraph | A `paragraph` — used when the writer wants to drop a paragraph at a specific position |
| Quote | A `quote` |
| Bulleted list | `bulletList` |
| Numbered list | `orderedList` |
| Horizontal rule | `horizontalRule` |
| Page break | `pageBreak` |
| Scene | A `scene` with empty `sceneLine` + one empty `action` child; cursor lands in `sceneLine` |

**Inside a scene** (secondary, different-color "+"):
| Item | Inserts |
|---|---|
| Inline free text | An `inlineFreeText` paragraph between current and next child |

#### 5.2 Slash command

At the start of an empty line, typing `/` opens the same widget menu inline (Notion convention). Typing filters: `/sce` → Scene.

#### 5.3 Toolbar

A persistent toolbar at the top of the editor area. Always visible. Buttons are context-sensitive (disabled when not applicable).

**Always-on:**
- Bold, Italic, Underline, Strikethrough
- Text color, Highlight color (popover swatches)
- Font family dropdown (default Courier Prime + curated alternates)
- Font size dropdown (10 / 11 / 12 / 14 pt)
- Clear formatting

**Outside a scene only** (disabled inside):
- Paragraph type dropdown (Paragraph / Heading 1 / Heading 2 / Heading 3 / Quote)
- Bulleted / Numbered list toggles
- Text align (left / center / right)

**Inside a scene only** (disabled outside):
- Block type dropdown (Action / Character / Dialogue / Parenthetical / Transition / Shot)
- Active scene chip ("Scene #3 — INT. CAFÉ — DAY")

**Right side, always-on:**
- Add Annotation (when text is selected)
- Tag As... (when text is selected)
- Flag for Revision (when text is selected)
- Undo / Redo

#### 5.4 Keyboard shortcuts

| Shortcut | Action |
|---|---|
| Ctrl+B / I / U | Bold / Italic / Underline |
| Ctrl+Enter | New scene |
| Ctrl+/ | Open widget menu at cursor |
| Tab / Shift+Tab | Inside scene: cycle block types. Outside: indent / outdent list items |
| Esc | Inside scene: exit. Inside popup: close. |
| Ctrl+K | Insert link |
| Ctrl+Shift+H | Add annotation on selection |
| Ctrl+Shift+T | Tag as... (opens type submenu) |
| Ctrl+Shift+F | Flag for revision |
| Ctrl+Shift+L | Change script language |

#### 5.5 Why three insertion mechanisms (toolbar / widget menu / slash)

- The "+" / "/" mechanisms insert *structural* nodes (new block types).
- The toolbar applies *formatting* to existing text and existing blocks (bold, color, paragraph style).
- They never overlap in purpose.

### § 6. Data model — `.rga` schema v2.0

```jsonc
{
  "rga_version": "2.0",
  "document_type": "screenplay",
  "metadata": {
    "title": "The Coffee Order",
    "author": "Darya",
    "created": "2026-05-13T10:00:00Z",
    "modified": "2026-05-13T14:30:00Z",
    "version": 1,
    "revision_notes": "",
    "language": "en",            // script language code: en|ar|ckb|kmr
    "production_type": "short",  // unified with platform Project.project_type
    "genre": "",
    "logline": ""
  },
  "settings": {
    "theme": "dark",
    "font_size": 12,
    "font_family": "Courier Prime",
    "show_scene_numbers": true,
    "page_size": "Letter"
  },
  "body": {
    "type": "doc",
    "content": [
      {
        "type": "titleStrip",
        "attrs": { "removable": true },
        "content": [{ "type": "text", "text": "The Coffee Order" }]
      },
      {
        "type": "paragraph",
        "content": [
          { "type": "text", "text": "Opening should feel quiet. See " },
          { "type": "text", "text": "outline notes", "marks": [{ "type": "link", "attrs": { "href": "https://..." } }] },
          { "type": "text", "text": "." }
        ]
      },
      {
        "type": "scene",
        "attrs": {
          "id": "scene-7f2a",
          "number": 1,
          "notes": "Establish mood. Camera stays wide.",
          "revisionFlag": null
        },
        "content": [
          {
            "type": "sceneLine",
            "attrs": { "setting": "INT", "location": "CAFÉ", "time": "NIGHT" },
            "content": [{ "type": "text", "text": "INT. CAFÉ — NIGHT" }]
          },
          {
            "type": "action",
            "content": [
              { "type": "text", "text": "A dimly lit café. Rain streaks the windows. " },
              { "type": "text", "text": "Sarah", "marks": [{ "type": "tag", "attrs": { "tagType": "character", "entityId": "ent-sarah" } }] },
              { "type": "text", "text": " sits alone with a " },
              {
                "type": "text",
                "text": "watch",
                "marks": [
                  { "type": "tag", "attrs": { "tagType": "prop", "entityId": "ent-watch" } },
                  { "type": "annotation", "attrs": { "id": "note-001", "text": "Make it her father's", "color": "#FFE08A" } }
                ]
              },
              { "type": "text", "text": "." }
            ]
          },
          {
            "type": "inlineFreeText",
            "content": [{ "type": "text", "text": "Director note: Push wide on this beat." }]
          },
          { "type": "character", "content": [{ "type": "text", "text": "SARAH" }] },
          {
            "type": "dialogue",
            "content": [
              {
                "type": "text",
                "text": "I've been waiting for an hour.",
                "marks": [{ "type": "revisionFlag", "attrs": { "reason": "Punchier?", "status": "open" } }]
              }
            ]
          }
        ]
      }
    ]
  },
  "tag_registry": {
    "characters": [{ "id": "ent-sarah", "name": "SARAH", "color": "#4FC1FF", "notes": "" }],
    "props":      [{ "id": "ent-watch", "name": "WATCH", "color": "#FFB347", "notes": "Heirloom" }],
    "wardrobe": [], "locations": [], "sfx": [], "vfx": [],
    "vehicles": [], "animals": [], "custom": []
  },
  "export_settings": {
    "branding": "rwanga",
    "letterhead_url": null,
    "include_scene_numbers": true,
    "include_revision_marks": false
  },
  "runtime": {
    "last_cursor": [3, 2, 14],
    "active_scene_id": "scene-7f2a",
    "ui_state": {}
  }
}
```

**Notes:**
- `document_type` at the root enables future doc types without touching the format.
- The hierarchical `scenes: [{elements: []}]` of v1.x is gone. Scenes are tree nodes containing screenplay-block children. The platform's analysis service derives a flat scenes list from the tree if needed.
- `tag_registry` stays at the body root; marks just reference `entityId`.
- `runtime.last_cursor` is a ProseMirror path (array of indices). Position restoration on reopen.
- The renderer validates the body against the ProseMirror schema on load. Invalid documents throw a clear error with the path to the offending node.

### § 7. Migration from `.rga` v1.x → v2.0

#### 7.1 Versions to handle

- **v1.0** — original schema with `scenes: [{ elements: [] }]`.
- **v1.1** — added `metadata.production_type` and `runtime` block.
- **v1.1+blocks** — the recent workaround added a flat `body.blocks` array; needs handling.

#### 7.2 Migration on open

When the renderer opens a file with `rga_version < 2.0`:
1. Run the in-memory converter (§ 7.3).
2. Write a backup copy alongside the original at `<filename>.rga.v1.bak` **before** the first v2.0 save.
3. The original file on disk is untouched until the writer saves; the first save writes v2.0.
4. Cache Management UI lists `.v1.bak` files for cleanup.

#### 7.3 Converter mapping

| v1.x source | v2.0 destination |
|---|---|
| `rga_version: "1.0"` or `"1.1"` | `rga_version: "2.0"`, `document_type: "screenplay"` |
| `metadata.*` | Copy as-is. Backfill `production_type: "untyped"` if missing. |
| `settings.*` | Copy as-is. |
| `scenes[].{setting, location, time, notes}` | A `scene` node with `attrs.notes` and a `sceneLine` child carrying setting/location/time as attrs. |
| `scenes[].elements[].{type, text}` | A child node of the scene with the matching type. |
| `scenes[].elements[].tags[]` (start/end + tag_id ranges) | `tag` marks on the corresponding text spans in the v2.0 tree. |
| `tag_registry` | Copy as-is. Entity ids preserved. |
| `body.blocks` (the recent workaround) | Each block becomes a `paragraph` in body at top level (not inside any scene; they were never in one). Block's type stored in `paragraph.attrs._sourceType` for debugging and discarded on next save. |
| Anything unrecognized | Logged to console, dropped. |
| `runtime` | Reset to defaults (v1.x cursor positions are invalid in v2.0 tree paths). |

#### 7.4 Failure modes

- **Schema validation fails after conversion:** open with a banner — "This file used an older format. We converted it but some content may not have transferred cleanly. Original file backed up to `<name>.rga.v1.bak`." Renderer is editable; writer reviews and resaves.
- **JSON parse fails (corrupt file):** existing v1 behavior — error message, suggest opening the `.bad-<timestamp>` backup the file system makes.
- **`document_type` unknown (future case):** "This file is a `<type>` document. Rwanga doesn't support that type yet (or the package is not installed). Open in read-only mode?"

#### 7.5 No backward write

v2.0 documents never get written back as v1.x. Once a file is v2.0, it is v2.0. Matches the strategy of VS Code, Word, Photoshop.

### § 8. What changes in the current implementation

#### 8.1 Files deleted

| File | Replaced by |
|---|---|
| `renderer/js/editor-engine.js` | ProseMirror view + screenplay node package |
| `renderer/js/scene-manager.js` | Scene node spec + plugin + Inspector view |
| `renderer/js/tag-system.js` | `tag` mark + plugin + Inspector view |
| `renderer/js/problems.js` | Schema enforcement + Problems plugin |
| `renderer/js/sample-data.js` | Test fixtures in `tests/` |
| Most CSS targeting `.editor-block[data-block-type]` | `.ProseMirror node-name` CSS |

#### 8.2 Files that stay

| File | Notes |
|---|---|
| `electron/main.js`, `electron/preload.js`, `electron/bridge/*`, `electron/lib/*` | Full Electron + IPC layer unchanged |
| `renderer/js/file-manager.js` | Save / open / saveAs flow unchanged; serialization swaps to ProseMirror JSON |
| `renderer/js/tab-manager.js` | Each tab owns a ProseMirror `EditorState` instead of a custom doc body |
| `renderer/js/doc.js` | `Doc.serialize` / `deserialize` rewritten to use ProseMirror JSON; migration logic lives here |
| `renderer/js/constants.js` | `CURRENT_RGA_VERSION` bumps to `2.0`; `SUPPORTED_RGA_VERSIONS` adds `2.0` |
| `renderer/js/utils.js` | Stays minus `Rga.Cursor.*` (ProseMirror owns the cursor) |
| `renderer/js/icons.js`, `app-shell.js` (shell parts only) | Stay — chrome is doc-type-agnostic |
| `index.html` | Stays; boot sequence simplified — `Editor.mount(activeDoc)` after ProseMirror loads |
| All Electron-side tests, file I/O tests, json-file tests | Stay |

#### 8.3 New files added

```
renderer/js/
├── editor/
│   ├── mount.js              ← Creates the ProseMirror EditorView for a tab
│   ├── widget-menu.js        ← The "+" / "/" insertion UI
│   ├── toolbar.js            ← Toolbar buttons, wired to ProseMirror commands
│   ├── commands.js           ← The Rga.Commands.execute() command layer
│   └── shortcuts.js          ← Global keyboard shortcuts wired to commands
├── doc-types/
│   └── screenplay/
│       ├── schema.js         ← Node + mark specs
│       ├── keymap.js         ← Tab/Enter/double-Enter/Ctrl+Enter/Esc rules
│       ├── plugins/
│       │   ├── active-scene.js
│       │   ├── annotations.js
│       │   ├── tags.js
│       │   ├── revision-flags.js
│       │   ├── placeholders.js
│       │   └── problems.js
│       ├── widget-items.js
│       ├── toolbar-config.js
│       ├── inspector.js
│       ├── outline.js
│       ├── bottom-panel.js
│       ├── status-bar.js
│       └── menu-contributions.js
└── migration/
    └── v1-to-v2.js
```

#### 8.4 Dependencies added

```json
{
  "prosemirror-state": "^1.4.x",
  "prosemirror-view": "^1.32.x",
  "prosemirror-model": "^1.19.x",
  "prosemirror-commands": "^1.5.x",
  "prosemirror-keymap": "^1.2.x",
  "prosemirror-history": "^1.3.x",
  "prosemirror-schema-basic": "^1.2.x",
  "prosemirror-schema-list": "^1.3.x",
  "prosemirror-inputrules": "^1.2.x",
  "prosemirror-menu": "^1.2.x"
}
```

All MIT licensed. Pure JS, no React. Total bundle add ~100 KB minified gzipped.

#### 8.5 Implementation phasing (sketch — full plan in the writing-plans output)

1. Strip the broken editor (delete files in § 8.1).
2. Add ProseMirror, mount a vanilla rich-text editor first (no screenplay structure). Verify bold/italic/RTL/paste/undo/IME work.
3. Add screenplay node package: schema, keymap, scene grammar.
4. Add marks: annotation, tag, revisionFlag with right-click handlers.
5. Add widget menu and toolbar.
6. Add plugins: active-scene, problems validation, placeholders.
7. Add migration v1 → v2.
8. Wire bottom panels, Inspector, Outline, Entities, status bar, menu to the editor's events via the command layer.

#### 8.6 Not covered here (handled elsewhere)

- Preferences panel, Open Folder / File Tree workspace, autosave, crash recovery, PDF export, packaging, auto-update — covered in sub-project A spec's later phases. The editor refactor is independent.
- Sync, sign-in, AI, MCP, dataset capture — sub-projects B+.

---

## Part 2 — App shell design

### § A1. First-run experience & folder model

#### A1.1 The Welcome view — persistent empty state

The Welcome view is the **persistent empty state of the editor area**, shown whenever no tab is open. It is not a one-time first-run screen; it returns whenever the writer closes all tabs or closes a folder.

```
   Welcome to Rwanga Script Editor

   Where should Rwanga keep your scripts?

   ●  Documents / Rwanga Scripts
        (Recommended — we'll create this folder)

   ○  Choose a different folder...

   [  Continue  ]

   ─────────────────────────────────────────

   Or, if you just want to write a single file:

   [ + New Script ]   [  Open File...  ]
```

- **Use Documents/Rwanga Scripts** — creates the folder if missing, sets it as the current folder, opens an Untitled.rga, focuses the editor.
- **Choose different folder** — native folder picker → folder set.
- **+ New Script / Open File** (escape hatch) — single-file mode, no folder set.

#### A1.2 Launch behavior

The Electron main process keeps `workspace.json` (extends sub-project A's spec):

```
workspace.json {
  currentFolder: <handle> | null,
  recentFolders: [{ handle, displayName, lastOpenedAt }, ...]  // max 5
  recentFilesPerFolder: { <folderHandle>: [{ handle, displayName, openedAt }] },
  lastOpenTabsPerFolder: { <folderHandle>: [{ handle, displayName, isActive }] },
  firstRunCompletedAt: <iso timestamp> | null
}
```

Launch flow:
1. If `currentFolder` is set and exists → open it, restore last tabs.
2. If `currentFolder` is set but missing → Welcome view with "Last folder `<path>` was not found. Open another folder?"
3. If never set → Welcome view (A1.1).

#### A1.3 Persistent sidebar actions

Top of the Explorer panel always shows two buttons (visible regardless of state):

```
[ + New File ]   [ Open Folder ]
```

Keyboard equivalents: `Ctrl+N`, `Ctrl+K Ctrl+O`. Same actions the welcome view offers; writer is never stuck.

#### A1.4 Single-file mode

If the writer opened a file directly from disk (double-click `.rga` outside the app) without a folder set:
- Explorer shows the welcome buttons and the message "No folder open. Open a folder to see your files here."
- Tab bar shows that one file.
- Editor and all features work normally.
- Dismissable per-session banner above the editor: "Working in single-file mode. [ Open Folder ]"

### § A2. Explorer / file tree

Classic OS-style file tree. No "project" or "workspace" concept — just the folder as it lives on disk.

#### A2.1 With a folder open

The Explorer panel shows the file tree rooted at the open folder.

- **All files** are shown, not filtered to `.rga`. Writers may store supporting files (PDFs, .txt notes, .md outlines, image moodboards) alongside scripts.
- `.rga` files get a screenplay icon. Other types get a generic file icon.
- Folders expandable (chevron); collapsed by default below depth 1.
- Section header: `WORKSPACE — <folder-name>` (note: this is the in-code term; user-facing "WORKSPACE" label may be renamed to the folder name without prefix in finishing UI pass).
- "Open Editors" sub-section above the file tree lists currently open tabs.

Non-`.rga` file handling:
- Native support: `.rga` only.
- Other file types: future extension territory. v0.1 opens unknown types in the OS default app via `shell.openPath`.

#### A2.2 File operations (right-click context menu)

| Action | Behavior |
|---|---|
| New File | Inline rename input; creates an empty `.rga` |
| New Folder | Inline; creates subfolder |
| Rename | Inline; renames on disk |
| Delete | Confirmation prompt; moves to OS trash (`shell.trashItem`), not permanent |
| Reveal in OS File Browser | Opens parent folder, file selected |
| Copy Path | Absolute path to clipboard |
| Copy Relative Path | Relative to folder root |

Drag-and-drop reordering is deferred.

#### A2.3 External-mutation handling

A file watcher (chokidar in Electron main, debounced) detects external changes:
- New files appear in the tree.
- A currently-open file deleted externally → tab shows banner: "This file no longer exists on disk. [ Save As... ] [ Close Tab ]"
- A file renamed externally → tab updates its display name and handle.

#### A2.4 New IPC additions

| `window.rwanga.files` method | Returns | Notes |
|---|---|---|
| `rename(handle, newName)` | `{ handle }` | Renames; returns new handle |
| `trash(handle)` | `void` | Moves to OS trash |
| `revealInOS(handle)` | `void` | Opens OS file browser at file |

| `window.rwanga.workspace` method | Notes |
|---|---|
| `watch(handle, onEvent)` | Subscription for file watcher events |

### § A3. Activity bar & sidebar panels

#### A3.1 Activity bar icons

The 48px left strip. Icons are **doc-type-agnostic in identity**; their panel content adapts per doc type.

| Icon | Panel | Type-agnostic? |
|---|---|---|
| Explorer | File tree (§ A2) | Yes |
| Outline | Document structure (replaces "Scenes") | Identity yes; rendering per-type |
| Entities | Tag registry (replaces "Tags") | Identity yes; rendering per-type |
| Sync | Placeholder | Yes |
| Extensions | Placeholder | Yes |
| (spacer) | | |
| Settings (bottom) | Settings tab in editor area | Yes |

#### A3.2 Outline panel — replaces "Scenes"

For screenplay docs, shows the document's structural tree:

```
The Coffee Order              ← titleStrip
└── (free text — heading "Notes")
└── (free text — quote)
└── Scene #1 — INT. CAFÉ — DAY
└── Scene #2 — EXT. STREET — NIGHT
    └── Director note (inline preview)
└── (free text — paragraph)
└── Scene #3 — INT. APARTMENT — DAWN
```

Click → editor scrolls/selects that node. Active scene highlighted. Right-click on a scene → Rename / Reorder / Delete / Add note.

Per-doc-type rendering: future `book` package would show chapters; `diagram` would show node groups.

#### A3.3 Entities panel — replaces "Tags"

Shows `tag_registry` grouped by type:

```
CHARACTERS (3)
  ● SARAH        — 12 occurrences
  ● AHMED        —  8 occurrences
  ● BARISTA      —  2 occurrences

PROPS (1)
  ● Watch        —  3 occurrences

LOCATIONS, WARDROBE, SFX, VFX, VEHICLES, ANIMALS, CUSTOM
  (sections collapse when empty)
```

Click → Inspector shows entity. Right-click → Rename / Change color / Delete. "+ Add..." at the bottom of each group adds an entity without tagging text first.

#### A3.4 Sync & Extensions — honest empty states

**Sync:**
```
RWANGA SYNC

  Sign in to back up your scripts, sync across
  devices, and unlock AI features.

  [  Sign in  ]    [  Create account  ]

  Available in v0.2. Currently in development.
  Privacy: nothing leaves your device until you sign in.
```

**Extensions:**
```
EXTENSIONS

  Browse and install extensions to add support
  for more file types, themes, screenplay
  templates, language tools, and more.

  Coming in v0.2.

  ─────────────────────────────

  INSTALLED:
    Rwanga Script (.rga)     [ Built-in ]
```

Both panels look intentional, not broken.

#### A3.5 Settings — moves to editor area

Clicking the gear opens a `⚙ Settings` tab (focuses existing if open). Sections:

- **Appearance** — theme (dark / light / system), accent color
- **Editor** — font family, font size, line spacing, gutter visibility
- **Folder** — default folder for new scripts, recent folders limit
- **Language** — UI language (v0.1: English only; deferred for community translation)
- **Updates** — current version, channel, last check, "Check for updates now"
- **Cache & Storage** — link to Cache Management UI (sub-project A § 12)
- **About** — version, license, credits, "Send feedback"

Each change writes via `window.rwanga.prefs.write(partial)` immediately.

#### A3.6 Panel chrome

- Sidebar collapses to icon-only with `Ctrl+B`.
- Horizontally resizable (existing `resize-handle`).
- Default width 260 px; min 180; max 600.
- Width persists per-folder.

### § A4. Status bar

24 px bar at the bottom. Doc-type-agnostic left side; per-doc-type right side.

#### A4.1 Always-on (left)

| Item | Behavior |
|---|---|
| Sync status | `● Offline` (default until sub-project B). |
| Problems badge | `⚠ N` count. Click → Problems tab. |
| Cursor position | `Ln X, Col Y` — VS Code convention. |

#### A4.2 Per-doc-type (right) — screenplay

| Item | Behavior |
|---|---|
| Active scene chip | `Scene #N — INT. ... — ...` when cursor inside a scene. Hidden in free text. Click → scrolls to scene. |
| Block type indicator | `Action` / `Character` / etc. inside a scene; `Paragraph` / `Heading 2` / `Quote` outside. Click → block-type dropdown. |
| Word count | Counts text content (excludes annotation popups, scene metadata notes). |
| Page count | Industry estimate (~250 words/page). |

#### A4.3 Always-on (far right)

| Item | Behavior |
|---|---|
| Theme toggle | Sun/moon icon. Cycles: Dark → Light → System → Dark. Right-click → Appearance settings. |
| Script language chip | `Script: EN` / `Script: AR ←` (RTL marker for RTL scripts). Click → script language picker popover. Right-click → opens language settings. |

Note: The UI language toggle is deferred (English only ships in v0.1; user will handle UI translation polish in a later finishing pass). Status bar shows only the **script language**, which is per-document and a first-class feature.

#### A4.4 Theme modes

| Mode | Behavior |
|---|---|
| Dark | Default. Dark editor and chrome. |
| Light | Light editor and chrome. |
| System | Follows OS `prefers-color-scheme`; flips on OS change. |

`data-theme="dark"|"light"` on `<html>`. System mode resolves at boot and updates on OS change.

#### A4.5 Script language — first-class

The script language is a per-document property (`metadata.language`). When changed, the editor immediately applies:

| Effect | Detail |
|---|---|
| Text direction | LTR or RTL applied to the editor body. ProseMirror handles `dir="rtl"` on the contenteditable; cursor, selection, click-to-position work under RTL. |
| Font stack | Latin: Courier Prime. Arabic-script: Noto Naskh Arabic + Noto Sans Arabic fallback. All vendored locally. |
| Block alignment | Screenplay indentation mirrors under RTL via CSS logical properties (`padding-inline-start`). |
| Digits | Arabic-Indic digits (٠١٢٣) for `ar` script. Standard digits otherwise. Optional override in prefs. |
| Scene markers | v0.1: English keywords (`INT.` / `EXT.`). Localized keywords (`دیمەنی`) deferred to a future plugin. |

Available languages in v0.1:

| Code | Name | Direction | Fonts |
|---|---|---|---|
| `en` | English | LTR | Courier Prime |
| `ar` | Arabic | RTL | Noto Naskh Arabic |
| `ckb` | Kurdish (Sorani) | RTL | Noto Naskh Arabic |
| `kmr` | Kurdish (Kurmanji) | LTR | Courier Prime |

Picker surfaces:
- Status bar chip click → picker popover
- Inspector (when doc itself is selected) → script language as an editable field
- `Ctrl+Shift+L` → opens picker as a small modal at cursor
- Command palette → "Change script language"
- New-doc default → last-used (persisted in `prefs.lastScriptLanguage`)

#### A4.6 Reactivity

Status bar subscribes to:
- `editor.cursorChange` → updates cursor position, active scene chip, block type
- `editor.contentChange` (debounced 500 ms) → word / page count
- `editor.activeSceneChange` → scene chip
- `problems.update` → badge

Tab switch rebinds all items to the new doc's editor.

#### A4.7 Layout examples

Inside a scene:
```
● Offline   ⚠ 0   Ln 12, Col 3        Scene #3 — INT. CAFÉ — DAY   Dialogue   4,231 words   42 pages   ☀ Dark   Script: EN
```

In free text, Arabic script:
```
● Offline   ⚠ 0   Ln 4, Col 0                                      Paragraph   4,231 words   42 pages   ☀ Dark   Script: AR ←
```

No doc open (welcome view):
```
● Offline                                                                                                ☀ Dark   Script: —
```

### § A5. Inspector panel

Right-side panel, 280 px default, toggleable via `Ctrl+Shift+I`. Per-doc-type renderer.

#### A5.1 Selection-driven views

| Selection state | View |
|---|---|
| Nothing open | Panel collapses / hides per pref |
| Doc open, no selection | Document view |
| Cursor in a scene (no text selected) | Scene view |
| Cursor in free text (no text selected) | Document view |
| Text selected, no marks | Selection view (char count + shortcuts) |
| Text selected, one mark | Single-mark editor |
| Text selected, multiple marks | Tabbed view (one tab per mark type) |

#### A5.2 Document view

Editable metadata + read-only stats:

```
DOCUMENT
  Title            [ The Coffee Order ]
  Author           [ Darya            ]
  Production       [ ▼ Short Film     ]
  Script language  [ ▼ English (LTR)  ]
  Genre            [ Drama            ]
  Logline          [ ─────────────── ]

STATISTICS
  Scenes 12   Words 4,231   Pages 17
  Tags 8 characters, 4 props, 2 locations

  [ Open as .rga (raw JSON) ]
```

#### A5.3 Scene view

```
SCENE #3
  Number     [ 3 ]                [ Auto-renumber ]
  Setting    [ ▼ INT ]
  Location   [ CAFÉ ]                [ ▼ Recent ]
  Time       [ ▼ NIGHT ]

  Notes (not exported)
  ┌────────────────────────────┐
  │ Establish mood. Wide.      │
  └────────────────────────────┘

  Status
  ☐ Flag for revision   [ Reason: ___________ ]

  [ Renumber from here ]  [ Delete scene ]
```

Editing fields writes to `scene.attrs.*` via a transaction.

#### A5.4 Tag mark view

```
TAG — CHARACTER
  Entity     [ SARAH         ]
  Color      [ ● #4FC1FF     ]
  Notes      [ Protagonist. 30s. ]

  Occurrences in this document (12)
  • Scene 1 — "Sarah walks in..."
  • Scene 1 — "SARAH"
  • Scene 3 — dialogue
  ...

  [ Rename ]  [ Change color ]  [ Remove tag ]
```

#### A5.5 Annotation mark view

```
ANNOTATION
  Anchored: "her father's watch"

  ┌────────────────────────────┐
  │ Make it her father's.      │
  └────────────────────────────┘

  Color    [ ● Yellow ]
  Created  May 13, 2026

  [ Resolve ]  [ Delete ]
```

#### A5.6 Revision flag view

```
REVISION FLAG
  Anchored: "I've been waiting for an hour."
  Reason   [ Punchier dialogue?       ]
  Status   ● Open    ○ Resolved
  Created  May 13, 2026

  [ Remove flag ]
```

#### A5.7 Multi-mark view

Tabs at top, one per mark type. Each tab content is one of the single-mark views above.

#### A5.8 Empty / muted states

- Panel narrower than 200 px → auto-collapses to icon-only with a chevron.
- No doc open → panel hides entirely.

#### A5.9 Reactivity

Subscribes to `editor.selectionChange` (100 ms debounce), `editor.markChange`, `editor.docChange`. Tab switch rebinds.

#### A5.10 Per-doc-type renderer

Framework in shell; views in `renderer/js/doc-types/screenplay/inspector.js`. Future `doc-types/book/inspector.js` renders chapter-attrs, character-bio entries, etc.

### § A6. Bottom panel (Notes / Problems / Breakdown)

200 px panel below the editor area, `Ctrl+J` to toggle. Tabs registered by the doc-type package.

#### A6.1 Notes tab

For screenplay docs, lists scene-level notes + inline annotations.

```
NOTES — Scene #3 — INT. CAFÉ — DAY

SCENE NOTES (not exported)
┌────────────────────────────────┐
│ Establish mood. Camera stays wide. │
└────────────────────────────────┘
[ Edit ]

INLINE ANNOTATIONS (3)
  ● "her father's watch"
    > Make it her father's. Adds backstory.
    [ Jump ] [ Resolve ] [ Delete ]

  ● "(checking her watch)"
    > Maybe just glance, not check.
    [ Jump ] [ Resolve ] [ Delete ]

  ● "I've been waiting for an hour."
    > Tone? Reads bitter.
    [ Jump ] [ Resolve ] [ Delete ]
```

Toggle "Active scene" vs "All notes in document" via a small dropdown.

#### A6.2 Problems tab

Three sources, sorted by document position:

| Source | Examples |
|---|---|
| Schema violations (ProseMirror) | Rare; only from bad imports or future plugin bugs. |
| Heuristic problems (Problems plugin) | "Scene #5 has no content"; "Character cue not followed by dialogue"; "Shift+Enter linebreak in action"; "Unresolved annotation older than 7 days". |
| Revision flags (`revisionFlag` marks) | All open flags grouped by scene. |

```
PROBLEMS (4)

⚠ Scene #5 — Empty scene
  No content after the scene line.                  [ Jump ]

⚠ Scene #3 — Character cue not followed by dialogue
  "BARISTA" on line 47 has no dialogue.             [ Jump ]

🚩 Scene #3 — Revision flagged
  "I've been waiting for an hour." — Punchier?      [ Jump ] [ Resolve ]

ℹ Scene #7 — Unresolved annotation (8 days old)
  "her father's watch"                              [ Jump ] [ Resolve ]
```

Click → editor scrolls and selects. Status bar Problems badge tracks count.

#### A6.3 Breakdown tab

Computed from `tag` marks + `tag_registry`. Grouped by type, then entity, then scene occurrences.

```
BREAKDOWN

CHARACTERS (3)
  SARAH       Scenes:  1, 3, 5, 7, 12       (5 scenes, 12 lines)
  AHMED       Scenes:  3, 5, 9              (3 scenes, 8 lines)
  BARISTA     Scenes:  1, 12                (2 scenes, 2 lines)

PROPS (1)
  Watch       Scenes:  1, 7                 (2 scenes, 3 occurrences)

(other type sections, collapsible when empty)

[ Export breakdown as CSV ]   [ Open in inspector ]
```

CSV export: JSON tree → flat rows → `window.rwanga.files.pickSaveAs` with `.csv` filter.

#### A6.4 Reactivity & badges

- Subscribes to `editor.docChange`, `editor.activeSceneChange`.
- Active tab refreshes live; inactive tabs lazy-refresh on focus.
- Tab labels show counts: `Problems (4)`.

#### A6.5 Per-doc-type framework

`renderer/js/doc-types/screenplay/bottom-panel.js` registers these three tabs. Future doc types register their own.

### § A7. Menu bar

#### A7.1 Platform strategy — one menu source per platform

| Platform | Menu source | Reasoning |
|---|---|---|
| macOS | Native menu (top of screen) | Required by macOS conventions |
| Windows | In-app HTML menu | Frameless window already; HTML menu fits the custom title bar |
| Linux | In-app HTML menu | Matches Code/Discord/Slack convention |

On macOS the HTML menu bar is hidden (`display: none`). On Windows/Linux the native menu is disabled (`Menu.setApplicationMenu(null)`). Exactly one canonical menu per platform.

#### A7.2 Shared command layer

Both menus call into `Rga.Commands.execute('<id>')`. The same layer is used by:
- Native menu items (macOS)
- HTML menu items (Windows/Linux)
- Command palette
- Keyboard shortcuts
- Status bar clicks
- Sidebar buttons
- Context menus

Adding a new feature registers one command and gets surfaced everywhere automatically.

#### A7.3 Command catalogue

(Subset; full catalogue is part of the implementation plan.)

| Command id | Action |
|---|---|
| `file.newFile`, `file.openFile`, `file.openFolder` | Create / open |
| `file.openRecent.<index>` | Dynamic recent files |
| `file.save`, `file.saveAs` | Save |
| `file.closeTab`, `file.closeFolder` | Close |
| `file.exportPDF`, `file.manageStorage`, `file.quit` | Other |
| `edit.undo`, `edit.redo`, `edit.cut`, `edit.copy`, `edit.paste`, `edit.selectAll` | Standard |
| `edit.find`, `edit.replace` | Find/replace |
| `view.toggleSidebar`, `view.toggleInspector`, `view.toggleBottomPanel` | Layout toggles |
| `view.zoomIn`, `view.zoomOut`, `view.zoomReset` | Zoom |
| `view.toggleFullScreen`, `view.toggleDevTools` | View |
| `script.newScene`, `script.insertWidget`, `script.renumberScenes`, `script.changeLanguage` | Screenplay |
| `tools.manageEntities`, `tools.runProblems`, `tools.exportBreakdown` | Tools |
| `help.welcome`, `help.docs`, `help.shortcuts`, `help.feedback`, `help.checkUpdates`, `help.about` | Help |

#### A7.4 Menu structure

```
File
├── New File                          Ctrl+N
├── Open File...                      Ctrl+O
├── Open Folder...                    Ctrl+K Ctrl+O
├── Open Recent ▶
├── ───
├── Save                              Ctrl+S
├── Save As...                        Ctrl+Shift+S
├── ───
├── Close File                        Ctrl+W
├── Close Folder
├── ───
├── Export as PDF...                  Ctrl+Shift+E
├── Manage Storage...
├── ───
└── Quit                              Ctrl+Q

Edit
├── Undo / Redo                       Ctrl+Z / Ctrl+Y
├── Cut / Copy / Paste / Select All   std
├── Find                              Ctrl+F
└── Find in Folder...                 Ctrl+Shift+F

View
├── Toggle Sidebar                    Ctrl+B
├── Toggle Inspector                  Ctrl+Shift+I
├── Toggle Bottom Panel               Ctrl+J
├── Zoom In / Out / Reset             Ctrl+= / Ctrl+- / Ctrl+0
├── Toggle Full Screen                F11
└── Toggle Developer Tools

Script
├── New Scene                         Ctrl+Enter
├── Insert Widget...                  Ctrl+/
├── Renumber Scenes
├── Collapse / Expand All Scenes
└── Change Script Language...         Ctrl+Shift+L

Tools
├── Manage Entities...
├── Find Problems
└── Export Breakdown as CSV

Help
├── Welcome
├── Documentation
├── Keyboard Shortcuts
├── Send Feedback
├── Check for Updates
└── About Rwanga Script Editor
```

#### A7.5 Per-doc-type menu extensions

`Script` and `Tools` are screenplay-specific contributions from the screenplay doc-type package. Future doc types register their own menus; the shell composes the final menu when the active doc's type changes.

#### A7.6 HTML menu UI

- Click a top-level item (`File`) → dropdown; sub-items render with shortcut hints right-aligned.
- Click outside → closes.
- Hover transition: with another menu already open, hover switches to the hovered one (no extra click).
- Keyboard: `Alt+F`, `Alt+E`, etc.; arrow keys navigate.
- Disabled commands render gray.

Existing CSS for `.menu-item` / `.menu-bar` is reused; only behavior changes.

---

## Part 3 — Migration from current implementation

This redesign supersedes Phases 6+ of the current sub-project A implementation plan (`docs/superpowers/plans/2026-05-12-rwanga-editor-subproject-a-plan.md`). Phases 0–5 of that plan (Electron shell, file I/O, multi-tab plumbing) are mostly retained; Phase 6 (multi-tab refactor of the editor) and beyond are reworked.

What's kept from the current build (commit `e731683f`):
- `electron/` directory complete
- `renderer/css/tokens.css`, fonts, font vendoring
- `renderer/js/file-manager.js`, `tab-manager.js` (with serialization rewired to ProseMirror JSON)
- `renderer/js/doc.js` (with `serialize` / `deserialize` and migration rewritten)
- `renderer/js/constants.js` (version bumped to 2.0)
- `renderer/js/icons.js`, theme system, keyboard manager
- All Electron-side tests, file-I/O tests, json-file tests
- `index.html` shell HTML (toolbar, sidebar, status bar, bottom panel chrome — content gets re-wired)

What's deleted:
- `renderer/js/editor-engine.js`
- `renderer/js/scene-manager.js`
- `renderer/js/tag-system.js`
- `renderer/js/problems.js`
- `renderer/js/sample-data.js`
- Custom block CSS targeted at `.editor-block[data-block-type]`

What's added (per § 8.3 of Part 1):
- `renderer/js/editor/` — mount, widget menu, toolbar, commands, shortcuts
- `renderer/js/doc-types/screenplay/` — schema, keymap, plugins, per-type views
- `renderer/js/migration/v1-to-v2.js`
- ProseMirror npm dependencies (§ 8.4 of Part 1)

The implementation plan that follows this spec will phase the work: strip the broken engine first, mount a vanilla rich-text editor, layer screenplay structure, layer marks, layer plugins, wire the shell.

---

## Part 4 — Out of scope / deferred

### v0.1 explicitly does NOT include

- Open Folder file watcher hot-reload of external changes (basic watch is in; rich UX for conflicts deferred)
- Drag-and-drop reordering in the Explorer
- In-Explorer file preview pane for non-`.rga` types
- UI language switching at runtime (English only; per user request)
- Localized scene-line keywords (always `INT.` / `EXT.` in v0.1)
- Find in Folder (cross-file search)
- Other doc types beyond screenplay (book / diagram / etc.)
- Sub-project B+ features: sync, sign-in, AI, MCP, dataset capture, character-detection heuristics

### Things to revisit in finishing UI pass

- The user has reserved the UI polish / translation pass for themselves. The current draft uses English labels everywhere; visual style follows the existing Rwanga design tokens (`--rw-*`). The user will iterate visual styling and Kurdish/Arabic UI strings in a later pass.

### Open architectural questions

- **Inspector panel collapsing strategy at narrow widths** — currently spec'd as auto-collapse below 200 px. Could be a manual collapse instead. To verify in implementation.
- **Outline panel scope** — currently shows the document tree summary. Could include a per-scene drill-down (sub-tree of inside-scene blocks). Deferred to user feedback after first build.
- **Multi-select in Inspector** — when the writer selects across multiple marks/nodes, the spec shows tabs per mark type but doesn't address selection-spans-multiple-nodes. To handle in implementation; likely shows the dominant mark or a "Multiple selections" summary.
- **Inline annotation popup persistence on save** — the popup is editor-only UI but the annotation data lives in the `.rga` file. Verifying serialize/deserialize round-trips correctly with annotation marks is a test target.

---

*End of design spec.*
