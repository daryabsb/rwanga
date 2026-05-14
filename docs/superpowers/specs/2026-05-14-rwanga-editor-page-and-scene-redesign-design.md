# Rwanga Script Editor — Page Surface & Scene Presentation Redesign

**Date:** 2026-05-14
**Status:** Design spec — approved through all sections in the brainstorming session of 2026-05-14. Awaiting user review of the written spec before the implementation plan.
**Supersedes:** `docs/superpowers/specs/2026-05-13-rwanga-editor-redesign-design.md` — **Part 1 § 3.3 (auto-formatting), § 5 (widget menu and toolbar)** are replaced wholesale by this document. Everything else in the 2026-05-13 spec (schema, file I/O, marks, app shell) remains authoritative.
**Why this exists:** Phases 0–4 of the 2026-05-13 redesign shipped solid (schema, file I/O, tabs, in-scene keymap, marks). Phase 5 — the layer the writer actually sees and touches — was built three times and rejected three times. The root cause was diagnosed in this brainstorming session and is addressed by the Contract below.

---

## 0. The Contract — binding preamble

**This spec is a contract between designer and implementer. Read this section before any other.**

Three builds of this layer failed for one reason, and it was not a missing feature or a weak agent. It was this: **the implementer hit something the spec did not explicitly cover, guessed a "reasonable" continuation, and kept building.** The guess was then revealed late, as a finished phase, and rejected. Build horizontally → reveal late → reject. Three times.

Therefore:

1. **Guessing is the failure mode.** If you — the implementer — encounter any decision that is not explicitly made in this document, you have hit a **GAP**. You must **STOP**. Do not "continue reasonably." Do not pick "the obvious option." Do not infer from surrounding code. Return to the designer with the specific question.

2. **A halted build with a question is a success. A build continued on a guess is a failure by definition** — regardless of whether the guess happens to be correct.

3. **The Stop-Point Register (§ 6) is the enforcement mechanism.** It lists every edge the designer currently knows about, each marked `RESOLVED`, `DECIDED`, `CONFIRM`, `GO/NO-GO`, or `STOP`. Rows marked `STOP` or `CONFIRM` must be resolved with the designer before the code that depends on them is written. When you discover a new gap not in the register, **add a row and stop** — the register is living.

4. **Build risk-first, verify per-step (§ 5).** Do not build this as one "Phase 5" unit. The sequence in § 5 builds the single high-risk piece first, in isolation, behind a GO/NO-GO checkpoint, and shows every step working in the real editor before the next begins. Horizontal-build-then-reveal is the prohibited pattern.

---

## 1. The Page Surface

### 1.1 Desk and page

The editor area renders two layers:

- **The desk** — the outer, scrollable background that fills the editor viewport (`#editor-container`).
- **The page** — the paper (`.rga-page`), horizontally centered on the desk, with a drop shadow.

**The page is mandatory.** There is always a page. The editor is never a borderless void. An empty document is one empty page. There is no state in which content sits directly on the desk.

### 1.2 Theme-driven appearance

Both layers respond to `[data-theme]` on `<html>`:

| Theme | Desk | Page | Shadow |
|---|---|---|---|
| Dark | darkest surface | one clear step lighter than the desk | visible drop shadow between page and desk |
| Light | mid-grey | white / near-white paper | visible drop shadow |

The current `tokens.css` values `--editor-bg: #1e1e1e` and `--editor-page-bg: #1a1a1a` make the page *darker* than and nearly indistinguishable from the desk. **These tokens must be re-set** so the page is clearly distinct from the desk in both themes (desk darkest, page a clear step lighter, shadow between). Exact hex values are an implementation detail for the page-surface step; the *requirement* is unmistakable page-vs-desk separation.

### 1.3 Page measure and Page Setup

- The page has a real **content measure** = paper width − left margin − right margin.
- **Default:** US Letter (8.5″ × 11″), margins 1.5″ left / 1″ right / 1″ top / 1″ bottom → ~6″ Courier-12 measure.
- **Page Setup is configurable per document.** A "Page Setup" dialog edits: paper size (`Letter` | `A4` | `Legal`) and the four margins. The values are stored in the `.rga` file at `settings.pageSetup` (see § 4.2). New documents seed `pageSetup` from a global preference (`prefs.defaultPageSetup`).
- Changing Page Setup re-lays the page immediately.

### 1.4 Continuous sheet with estimated page breaks (Approach A)

- The page is **one continuous sheet** that grows vertically as content grows. It is not a stack of discrete sheets. True stacked-sheet pagination is deferred to v0.2 (§ 8).
- Page-break lines and page numbers are drawn as **ProseMirror decorations** at *estimated* positions. The estimation: usable page height = paper height − top margin − bottom margin; lines-per-page = usable height ÷ line height (~55 for Letter / Courier-12 / 1″ margins). A decoration draws a horizontal break line + a page-number label at each estimated boundary.
- The decoration system must be built as a self-contained plugin (`page-breaks.js`) so that true pagination can replace it in v0.2 without touching the rest of the editor.

---

## 2. The Scene — Sovereign Territory

### 2.1 Core principle

**The scene is the temple of the document. No floating UI ever enters it.** Inside a scene the writer uses only the keyboard grammar already built in Phase 3 (Tab / Enter / Shift-Tab / Esc / Ctrl+Enter). The "+" insert buttons, and any future insertion affordance, never appear inside a scene. The scene has its own personality in the document and is not invaded by chrome.

### 2.2 The two-line heading block

Every scene opens with a heading block of two lines:

```
SCENE 1                ← identity line — auto-generated, never typed
INT. CAFÉ - NIGHT      ← slug line — segmented zones (§ 2.3)
```

- Both lines sit inside the **heading band** (§ 2.4).
- The **identity line** ("SCENE 1") is auto-generated from `scene.attrs.number`. It is not editable text. It auto-renumbers whenever scenes are inserted, reordered, or deleted:
  - Insert a scene mid-document → every scene after it renumbers.
  - Insert a scene at the end → it takes the next number; nothing after it, nothing to renumber.
  - Delete a scene → every scene after it renumbers.
- The word "SCENE" itself is part of the document vocabulary (§ 2.5), default `"SCENE"`.

### 2.3 The slug line — segmented zones

The slug line renders as **one plain uppercase line** but is internally three zones: **Setting | Location | Time**.

- **Setting zone** — sourced from `sceneLine.attrs.setting`. Picker-driven, never free-typed. Focusing the zone opens a small inline pick-list populated from the document's setting vocabulary (`INT.` / `EXT.` / `INT./EXT.` / `ژوورەوە` / …). Typing filters the list. A value outside the list cannot be committed.
- **Location zone** — the only editable text. It is the `sceneLine` node's text content. Auto-uppercased via CSS. Autocompletes from locations already used elsewhere in the document.
- **Time zone** — sourced from `sceneLine.attrs.time`. Picker-driven, same behavior as Setting, populated from the document's time vocabulary (`DAY` / `NIGHT` / `CONTINUOUS` / …).
- Because Setting and Time are constrained at entry and Location is plain text, **a malformed scene heading is structurally impossible.** There is no after-the-fact parser guessing what the writer meant — the structure is captured as it is typed.
- **Separators are chrome.** The visible line composites `setting` + `". "` + `location` + `" - "` + `time`. The `". "` and `" - "` are rendered by the view, not typed and not stored.

**Zone navigation:**

| Key | Effect |
|---|---|
| Tab / Right-Arrow / Enter | Move forward: Setting → Location → Time. From Time forward → exit the slug into the scene's first `action` (existing Phase 3 behavior: Enter on sceneLine → action). |
| Shift-Tab / Left-Arrow | Move backward: Time → Location → Setting. From Setting backward → no-op (stays in Setting). |

Arrow-key navigation applies when the caret is at the edge of a zone (Right-Arrow at the end of Location moves to Time; Left-Arrow at the start of Location moves to Setting). Within a zone, arrows move the caret normally.

### 2.4 Heading band treatment — configurable

The heading band has three styles:

1. **Plain caps** — uppercase text, no decoration.
2. **Underlined caps** — uppercase text, underlined.
3. **Gray band + underline** — uppercase text on a subtle gray highlight band, underlined.

- **Default:** style 3 (gray band + underline).
- Set globally in preferences (`prefs.defaultSceneHeadingStyle`).
- Overridable per scene via `scene.attrs.headingStyle` (`null` = inherit the document default).
- All three styles must remain available; they are not a one-time pick.

### 2.5 The vocabulary

Each document carries two constrained vocabularies plus the scene word:

- `settings.vocabulary.settings` — the Setting-zone list (e.g. `["INT.", "EXT.", "INT./EXT."]`).
- `settings.vocabulary.times` — the Time-zone list (e.g. `["DAY", "NIGHT", "CONTINUOUS"]`).
- `settings.vocabulary.sceneWord` — the identity-line word (default `"SCENE"`).

- Stored in the `.rga` file, so the vocabulary **travels with the document** — a collaborator opening a Kurdish script gets its Kurdish vocabulary.
- New documents seed all three from a global preference (`prefs.defaultVocabulary`).
- Editable per document via an "Edit list…" item at the bottom of each picker, and in document/scene settings.

---

## 3. Insert Affordances & Floating Toolbar

### 3.1 The two "+" circles

Two circular buttons:

- **Left circle (blue)** — insert a **new scene**.
- **Right circle (grey)** — insert **free text** (a body-level `paragraph`).

**Placement and visibility:**

- The pair is **cursor-driven.** It follows the caret as the caret moves up and down through **body-level positions**, appearing as a lead/hint that a block can be inserted at that line.
- It is visible **only when the caret is at a body-level insertable position and not inside a scene.** The moment the caret enters a scene, both buttons vanish.
- Body-level insertable positions are: inside a body-level `paragraph` / `heading` / `quote` / list item, **or** a gap-cursor between two adjacent body blocks (requires the `prosemirror-gapcursor` plugin — see Register row 7).
- The left button renders in the page's left margin on the caret's line; the right button in the page's right margin on the same line. On a narrow window the right button tucks just inside the page's right edge rather than floating off onto the desk.

**Behavior:**

- **Left + (new scene)** — inserts a `scene` at the caret's body position. The new scene = a `sceneLine` (empty `location`; `setting` and `time` default to the first entry of each vocabulary list) + one empty `action`. The caret lands in the new scene's **Setting zone**. Scene renumbering applies per § 2.2.
- **Right + (free text)** — inserts an empty `paragraph` at the caret's body position. The caret lands in the new paragraph.

Neither button opens a menu. They are direct, single-action affordances. The full block catalogue (heading, quote, list, horizontal rule, page break, title) is reached by typing `/` on an empty body line — the `/` slash-command surface is retained from the 2026-05-13 spec § 5.2.

### 3.2 The floating selection toolbar

There is **no persistent toolbar.** Formatting and writer actions live on a floating toolbar:

- Appears only on a **non-empty text selection.** Positioned above the selection; flips below when the selection is near the top edge. Vanishes when the selection collapses or empties.
- **Primary row:** Bold · Italic · Underline · Strikethrough | text color · highlight color | link | annotate · tag · flag.
- **`⋯` overflow:** font family, font size, clear formatting.
- It is an *additional* surface for annotate / tag / flag. The Phase 4 right-click context menu for those actions stays.

---

## 4. Schema Changes & Codebase Impact

### 4.1 `sceneLine` node — model change

- Current: `sceneLine` has `content: 'inline*'` and `attrs: { setting, location, time }`, rendered as a plain styled div.
- New: `sceneLine` is rendered via a **NodeView**. `attrs.setting` and `attrs.time` drive the picker zones (not text content). `attrs.location` is dropped in favor of the node's **text content being the location** (the only editable part). The NodeView composites the visible line: `[setting attr] ". " [location text] " - " [time attr]`.
- The exact NodeView structure (whether the identity line is drawn by the `sceneLine` NodeView reading the parent scene's number, or by a `scene` NodeView wrapping it) is an implementation choice for the GO/NO-GO step (§ 5 Step B, Register row 3). The *behavior* in § 2.2–2.3 is fixed; the mechanism is the implementer's, proven by the spike.

### 4.2 `.rga` `settings` additions

```jsonc
"settings": {
  // ...existing fields...
  "pageSetup": {
    "paperSize": "Letter",        // Letter | A4 | Legal
    "margins": { "top": 1, "right": 1, "bottom": 1, "left": 1.5 }  // inches
  },
  "vocabulary": {
    "settings": ["INT.", "EXT.", "INT./EXT."],
    "times": ["DAY", "NIGHT", "CONTINUOUS"],
    "sceneWord": "SCENE"
  },
  "sceneHeadingStyle": "band"     // plain | underline | band
}
```

`scene.attrs` gains `headingStyle: { default: null }` (null = inherit `settings.sceneHeadingStyle`).

### 4.3 Files

**Added:**
- Page-surface rendering — the desk + `.rga-page` wrapper (in `mount.js` and `editor-prosemirror.css`).
- `renderer/js/doc-types/screenplay/plugins/page-breaks.js` — decoration-based estimated page breaks.
- `renderer/js/doc-types/screenplay/scene-line-nodeview.js` — the segmented-zone slug NodeView.
- `renderer/js/editor/insert-buttons.js` — the two "+" circles.
- `renderer/js/editor/selection-toolbar.js` — the floating selection toolbar.

**Modified:**
- `renderer/js/doc-types/screenplay/schema.js` — `sceneLine` model (§ 4.1), `settings` additions (§ 4.2), `scene.attrs.headingStyle`.
- `renderer/js/doc-types/screenplay/keymap.js` — slug zone navigation (Tab / Arrow / Enter inside `sceneLine`).
- `renderer/css/tokens.css` — desk/page color tokens (§ 1.2).

**Removed:**
- `renderer/js/editor/widget-menu.js` — the rejected "+" button code (the `/` slash-command logic, if still wanted, is re-homed; see Register row 8).
- `renderer/js/editor/toolbar.js` — the persistent toolbar.
- `renderer/js/doc-types/screenplay/plugins/scene-line-parser.js` — obsolete; zones are constrained at entry, there is nothing to parse after the fact.

**Untouched:**
- Phase 3 in-scene keymap (Tab/Enter/Shift-Tab/Esc/Ctrl+Enter cycling).
- Phase 4 marks (annotation / tag / revisionFlag), their plugins, and their right-click context menu.

---

## 5. Build Sequencing — risk-first, verify per-step

Do **not** build this as one unit. Build in this order. Each step is shown working in the real editor and accepted by the designer **before the next step begins.**

| Step | Scope | Risk | Verification |
|---|---|---|---|
| **A** | Page surface — desk + page, theme tokens, Page Setup dialog, estimated page-break decorations | Low | Open a document → see paper on a desk; switch theme → both layers flip; change Page Setup → page re-lays; scroll → page-break lines + numbers appear at estimates |
| **B** | **`sceneLine` segmented-zone NodeView** — the slug line: Setting/Location/Time zones, Tab/Arrow/Enter navigation, constrained pickers, free-text location | **GO/NO-GO** | Create a scene → slug has three zones; Tab/Arrow/Enter navigate; Setting/Time pickers constrain to vocabulary; Location is free text; gibberish cannot be committed. **If this cannot be built cleanly, STOP, invoke the fallback (guided free-text + validation), and re-confirm with the designer before proceeding.** |
| **C** | Two-line heading block — identity line from `scene.attrs.number`, heading band styles, auto-renumber plugin | Low (depends on B) | Scene shows "SCENE N" above the slug; switch band style → all three render; insert/delete/reorder scenes → numbers update |
| **D** | The two "+" circles + gap-cursor | Moderate | Caret in body → buttons appear on the caret line; caret enters a scene → buttons vanish; left + inserts a scene (caret → Setting zone, renumber); right + inserts a paragraph; gap-cursor between adjacent scenes works |
| **E** | Floating selection toolbar | Low–Moderate | Select text → toolbar appears above it; marks apply; `⋯` overflow works; deselect → toolbar vanishes |

The high-risk piece (B) is built first and in isolation. Its fallback is named *now* (guided free-text + validation, option B from the brainstorming session) so that a stall becomes a downgrade, not a dead phase.

---

## 6. The Stop-Point Register

Living list. `STOP` and `CONFIRM` rows must be resolved with the designer before the dependent code is written. New gaps discovered during the build are added here, and adding a row means stopping.

| # | Point | Status |
|---|---|---|
| 1 | "+" buttons appear at every body-level insertable position (not only scene-adjacent gaps), cursor-driven, as a lead/hint | **RESOLVED** |
| 2 | "+" button tracking = cursor-driven (follows the caret line through body positions); not mouse-hover | **RESOLVED** |
| 3 | `sceneLine` segmented-zone NodeView — three zones, constrained pickers, free-text location, Tab/Arrow/Enter navigation | **GO/NO-GO** — § 5 Step B; prove in isolation; fallback = guided free-text + validation |
| 4 | `inlineFreeText` inside a scene — is it kept in v0.1? If kept, how is it triggered, given that no button enters a scene (candidate: `/` slash command only)? | **STOP — undecided.** Must be resolved before any `inlineFreeText` code is written. Does not block Steps A–E. |
| 5 | Per-span font family / font size UI | **DECIDED** — `⋯` overflow on the floating selection toolbar |
| 6 | The word "SCENE" on the identity line | **DECIDED** — part of the document vocabulary (`settings.vocabulary.sceneWord`), default `"SCENE"` |
| 7 | Inserting between two *adjacent* scenes (no paragraph between) requires a caret position that does not naturally exist — resolved via `prosemirror-gapcursor` | **CONFIRM** — designer to confirm the gap-cursor behavior is acceptable (press Down/Up to land in the gap between two scenes, then the "+" pair appears) |
| 8 | The `/` slash-command surface (block catalogue) from the 2026-05-13 spec § 5.2 — is it kept in this redesign, and if so where does its code live now that `widget-menu.js` is removed? | **STOP — undecided.** § 3.1 assumes `/` still exists; its home must be decided before that code is written. |

---

## 7. Out of Scope / Deferred

- **True stacked-sheet pagination** (Approach B) — discrete page sheets with content flowed and broken across them. v0.2. The § 1.4 decoration plugin is built so this can replace it without a rewrite.
- **`inlineFreeText` inside a scene** — blocked on Register row 4. No `inlineFreeText` UI ships until that STOP is resolved.
- **Curated Kurdish / Arabic vocabulary packs** — the vocabulary *system* ships; pre-built localized lists do not.
- **Location-autocomplete polish** — a basic suggestion list ships; ranking, fuzzy matching, and richer UI are later work.

---

*End of design spec.*
