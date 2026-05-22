# Rwanga — Screenplay Patterns

Status: **FORENSIC EXTRACTION** — 2026-05-17
Source: `renderer/js/doc-types/screenplay/`, `renderer/css/editor-prosemirror.css`

---

## 1. Schema (v3 — LOCKED)

The v3 ProseMirror schema is the canonical document model. Contract: `docs/phase0-final-schema-contract.md`.

### Document Structure
```
doc
  ├── titleStrip?          (optional, removable)
  └── body
      └── outerBlock+
          ├── heading      (treatment text — h1/h2/h3)
          ├── paragraph    (treatment text)
          └── scene        (the screenplay unit)
              ├── sceneHeading   (setting + time attrs; location = inline content)
              └── sceneBody+
                  ├── action
                  ├── character
                  ├── dialogue
                  ├── parenthetical
                  ├── shot
                  └── transition   (presetType attr; text = inline content)
```

### Key Contract Corrections (LOCKED)
- **Correction A:** Scene numbers are DERIVED (via NavigationIndex), never stored in attrs.
- **Correction 1:** sceneHeading carries inline content (location text), not just attrs.
- **Correction 2:** transition carries inline content (custom text), not an atom.
- **Correction 3:** Parenthetical text includes its own parens — `(barely a whisper)` not `barely a whisper`.

---

## 2. Block Types — Visual Rules

| Type | Alignment | Text Transform | Weight | Margins | Status |
|---|---|---|---|---|---|
| `action` | `start` | none | normal | `0.6em 0 0 0` | EXISTING |
| `character` | `center` | `uppercase` | `700` | `1em 0 0 0` | EXISTING |
| `dialogue` | `center` | none | normal | `max-width: calc(100% - 2 * var(--dialogue-side-margin))`, auto margins | EXISTING |
| `parenthetical` | `center` | none | italic | `max-width: calc(100% - 2 * var(--parenthetical-side-margin))` | EXISTING |
| `transition` | `end` | `uppercase` | `700` | `1em 0 0 0` | EXISTING |
| `shot` | `start` | `uppercase` | `700` | `0.8em 0 0 0` | EXISTING |

### Design Kit vs Production — MAJOR DIVERGENCE
The design kit used **left-margin indentation** (industry standard: 1.5in action, 3.7in character, 2.5in dialogue, 3.1in parenthetical). Production uses **centered layout** with `max-width` constraints for dialogue/parenthetical and `text-align: center` for character. This was a deliberate user decision (2026-05-15).

### CSS Variables for Screenplay Layout
```css
:root {
  --dialogue-side-margin: 1in;
  --parenthetical-side-margin: 1.6in;
}
```

---

## 3. Scene Chrome (v3 NodeViews — NEW)

### Scene Container
`.rga-scene-v3`:
- Left border: 3px solid `--accent-rwanga` (#C2185B)
- Left padding: 0.75in
- Scene number badge (`.rga-scene-v3-num`): non-editable, uppercase, `--text-secondary`, derived from NavigationIndex decorations.
- Reserved right-chrome slot (`.rga-scene-v3-chrome-right`): `display: none`. Future drag handle + delete button.

### Scene Heading
`.rga-scene-heading-v3`:
- Flex row: setting picker → em-dash → time picker → slash → location contentDOM
- Bottom border: 2px solid `--accent-rwanga`
- Font: `--font-editor`, 12pt, 700 weight, uppercase
- Pickers blend into text (transparent bg, border only on hover/focus)
- Location text is ProseMirror inline content with marks support

### Vocabulary
Setting/time dropdown options come from `doc.settings.vocabulary` → `Rga.Constants.DEFAULT_VOCABULARY`:
```js
settings: ['INT.', 'EXT.', 'INT./EXT.', 'EXT./INT.']
times: ['DAY', 'NIGHT', 'CONTINUOUS', 'DUSK', 'DAWN']
sceneWord: 'SCENE'
```
Custom values appended if not in list. i18n-ready via vocabulary CSV.

---

## 4. Marks System (12 marks — EXISTING)

Marks come from `Rga.Framework.baseOuterMarks`. They survive migration v1→v2→v3 byte-for-byte.

### Formatting Marks
| Mark | Rendering | Toolbar Button |
|---|---|---|
| `bold` | `<strong>` | **B** |
| `italic` | `<em>` | *I* |
| `underline` | `<u>` | U̲ |
| `strikethrough` | `<s>` | ~~S~~ |
| `textColor` | `<span style="color:…">` | **A** with colour swatch |
| `highlight` | `<span style="background:…">` | Highlight icon |
| `link` | `<a href="…">` | 🔗 |

### Production Marks
| Mark | Class | Rendering | Status |
|---|---|---|---|
| `annotation` | `.rga-annotation` | Background highlight + 📝 pseudo | NEW |
| `annotationResolved` | `.rga-annotation-resolved` | Transparent bg, 📝 remains | NEW |
| `tag` | `.rga-tag` + `.rga-tag-{type}` | 2px bottom border, type-coloured | NEW |
| `revisionFlag` | `.rga-revision-flag` | 2px dashed bottom border, colour from attrs | NEW |
| `revisionResolved` | `.rga-revision-resolved` | Dotted border, 0.6 opacity | NEW |

### Tag Mark Sub-Types
Character tags also apply `color` to the text (not just border). Other types are border-only:

```css
.rga-tag-character { border-bottom-color: var(--tag-character); color: var(--tag-character); }
.rga-tag-prop      { border-bottom-color: var(--tag-prop); }
/* etc. */
```

---

## 5. Page Model

### Paper Dimensions
Configurable via `doc.settings.pageSetup`. Defaults:
```js
PAPER_SIZES: {
  Letter: { width: 8.5, height: 11 },
  A4:     { width: 8.27, height: 11.69 },
  Legal:  { width: 8.5, height: 14 }
}
```

### Page Setup Dialog (NEW)
`.ps-dialog` — modal form for paper size, margins (grid 2×2). Inline styles override `.rga-page` dimensions.

### Pagination
**v2 paginator** inserts `.rga-page-break` widgets as flow-block decorations:
- **Print view:** 16px desk-strip with negative margins extending across page padding
- **Flow view:** 1px dashed divider, 0.55 opacity
- **Draft view:** hidden

Page markers (`.rga-page-marker`) are separate widget decorations showing `— Page N —` text.

---

## 6. Character Autocomplete (NEW)

`.rga-autocomplete-ghost` — inline ghost text in character blocks suggesting the next character name. Matches font/weight/case of the host block. Non-interactive.

Arrow-right accepts the suggestion. Shows `→` hint glyph.

---

## 7. Tag Suggestion Popup (NEW)

`.rga-tag-suggest-popup` — fires on blur from a character cue matching a registered character without a tag mark. Positioned absolutely next to the block. Auto-dismisses after 6 seconds. Yes/No buttons.

---

## 8. Context Menu — Screenplay Items (NEW)

`.rga-context-menu` built by `plugins/context-menu.js`:
- Block type change submenu
- Tag selection submenu (by type)
- Annotation add
- Revision flag add
- Cut / Copy / Paste

---

## 9. Migration Chain (EXISTING)

```
v1.0 → v1-to-v2.js → v2.0 → v2-to-v3.js → v3.0
```

- **v1→v2:** Scene frame restructuring
- **v2→v3:** Major — converts sceneFrame placeholders to real scene+sceneHeading+sceneBody nodes. 15KB of migration logic. Mark preservation tested extensively.

Current version: `Rga.Constants.CURRENT_RGA_VERSION = '3.0'`
Supported: `['1.0', '1.1', '2.0', '3.0']`

---

## 10. Print Rendering (NEW)

### Print Preview Mode
`body.view-print-preview-active` overlays `#rga-print-preview-root`:
- Fixed inset: 0, z-index 9000
- Grey background (#4a4a4a)
- Vertical scroll of `.rga-page-sheet` elements (0.5in gap)

### Page Sheet
`.rga-page-sheet`:
- Fixed 8.5in × 11in (Rule 6 — never content-recalculated)
- White bg, `color: #111`, Courier New 12pt, line-height 1.0
- Padding: 1in 1in 1in 1.5in (left wider for binding)
- Page number top-right via `::after` counter
- Title top-left on page 1 via `::before`
- Scene heading bold uppercase with Rwanga-pink underline

### Print-specific Block Styles
```css
.rga-print-action      { text-indent: 0; margin: 0.3em 0 0 0; }
.rga-print-character    { text-align: center; text-transform: uppercase; font-weight: 700; margin: 0.8em 0 0 0; }
.rga-print-dialogue     { margin: 0 auto; max-width: calc(100% - 2in); text-align: center; }
.rga-print-parenthetical { margin: 0 auto; max-width: calc(100% - 3.2in); text-align: center; font-style: italic; }
.rga-print-transition   { text-align: right; text-transform: uppercase; font-weight: 700; }
.rga-print-shot         { text-transform: uppercase; font-weight: 700; }
```

---

## 11. Ownership Map

| Concern | Owner | File(s) |
|---|---|---|
| Schema definition | Engine (LOCKED) | `schema-v3.js` |
| Block type CSS | Engine CSS | `editor-prosemirror.css` |
| Scene NodeView | Engine | `v3-node-views.js` |
| Scene numbering | Framework | `framework/nav-index.js` |
| Pagination | Framework | `framework/pagemap-engine.js`, `layout-profile.js` |
| Print rendering | Framework | `framework/print-renderer.js`, `render-model.js` |
| Annotations plugin | Engine | `plugins/annotations.js`, `annotation-notes.js` |
| Tags plugin | Engine | `plugins/tags.js` |
| Revision flags | Engine | `plugins/revision-flags.js` |
| Context menu | Engine | `plugins/context-menu.js` |
| Commands (Tab/Enter) | Engine | `v3-commands.js`, `v3-keymap.js` |
| Format toolbar | Engine chrome | `format-toolbar.js` |
| Scene toolbox | Engine chrome | `flow-chrome.js` |

End of screenplay patterns audit.
