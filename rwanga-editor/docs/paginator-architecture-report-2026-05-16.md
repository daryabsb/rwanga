# Rwanga Script Editor — Pagination Architecture Report
**Date:** 2026-05-16
**Audience:** External consultant reviewing pagination strategy
**Author:** Claude (working with Darya)

This document is a comprehensive context dump on what we're trying to build, what we have, what we tried, and where we're stuck. The goal is for a fresh pair of eyes to weigh in on the right architectural direction — we've gone through two failed approaches and the second iteration still doesn't match what users expect from a screenplay editor.

---

## 1. Product Context

**Rwanga Script Editor** is an Electron desktop app (Windows/Mac, with a web version planned) for writing screenplays. It targets filmmakers and writers, with a particular focus on Kurdish and Arabic cinema. The editor is built on **ProseMirror** as its content model.

There are three view modes the user can switch between:
- **Flow** — comfortable continuous text column; no paper edges; the default writing surface
- **Print** — a visual preview of how the script would look on paper, with page boundaries shown
- **Draft** — minimal chrome, focus mode

The pagination problem is most visible in **Print view**, but Flow view also shows page markers as a writing aid.

### Industry-standard screenplay pagination

Screenplay pagination matters because of the long-standing convention that **one page ≈ one minute of screen time**. Directors, producers, and ADs use page counts to estimate runtime. Standard screenplay format uses Courier 12pt, ~6 lines per inch, with 1-inch margins on top/bottom/right and 1.5-inch on the left.

For a US Letter page (8.5" × 11") with those margins, the usable content area is roughly 6" × 9" = ~864px in CSS pixels (at 96 DPI). That should hold approximately 54 lines of content. A typical scene is 8–20 lines, so a page typically contains 2–5 scenes.

---

## 2. Goal

Render a `<div>`-based editor that visually shows where page boundaries fall, with:
- Real flow-space gaps between "pages" (so content isn't visually masked by overlays)
- Page break positions that approximate where actual paper pages would break
- Block-aware: a paragraph/scene shouldn't split mid-block (split with `(CONTINUED)` markers can come later)
- Re-paginates on doc changes, page-setup changes, window resize

The user is editing in this same editor while seeing the page-break visualization — it's a live preview, not an export step.

---

## 3. Architecture

### Document model

The outer ProseMirror schema:
```
doc
├── titleStrip?
└── body
    ├── paragraph (treatment text)
    ├── heading
    ├── paragraph
    ├── sceneFrame (atom — a scene)
    ├── paragraph (spacer)
    ├── sceneFrame
    └── ... (typically 5–80 scenes)
```

Each `sceneFrame` is an **atom node** in the outer PM doc. The atom's `attrs.innerDoc` stores the scene's actual content as a JSON tree:
```js
{
  type: 'doc',
  attrs: { notes: '', revisionFlag: null },
  content: [
    { type: 'sceneLine', attrs: { setting: 'INT.', time: 'DAY' }, content: [...] },
    { type: 'action', content: [...] },
    { type: 'character', content: [...] },
    { type: 'dialogue', content: [...] },
    { type: 'transition', content: [...] }
  ]
}
```

### Rendering: nested ProseMirror editors

Each `sceneFrame` has a NodeView (`scene-frame-pm.js`) that renders:
- A scene header chrome row ("SCENE 2")
- A slug row (form controls: setting picker / time picker / location input)
- A blocks container — each block (action, character, dialogue, etc.) is its **own ProseMirror EditorView**, mounted eagerly when the NodeView builds
- A transition picker at the bottom

So the overall structure has:
- **1 outer ProseMirror EditorView** (the whole document)
- **N inner ProseMirror EditorViews per scene × M scenes** (one inner editor per block within each scene's NodeView)

For a 5-scene playground, that's about 25–30 active inner ProseMirror editors. Each has its own state, plugins, history, transactions.

This nested architecture was the **2026-05-16 result of a multi-week migration**. The previous "F1 placeholder" approach used vanilla `contenteditable` divs per block — simpler, but couldn't support marks (bold, italic, annotations, tags, revision flags) or right-click menus inside scenes. The nested-PM approach was needed to unlock those features and is now working well for the writing side (commits on `main` from `c83a6963` through `d0c9dcc5`).

### DOM hierarchy as rendered

```
#editor (.rga-page styled — paper) [in print view: white bg, shadow, fixed width 8.5in]
└── .ProseMirror (outer view.dom, contenteditable=true)
    ├── .rga-title-strip
    └── .rga-body
        ├── h2 (Logline)
        ├── p (logline text)
        ├── h2 (Characters)
        ├── p, p, p (character descriptions)
        ├── p (empty spacer)
        ├── .rga-scene-frame-placeholder (sceneFrame NodeView, contenteditable=false)
        │   ├── .rga-scene-frame-placeholder-num ("SCENE 1")
        │   ├── .rga-scene-frame-placeholder-slug (form controls)
        │   ├── .rga-scene-frame-placeholder-blocks
        │   │   ├── .rga-scene-block.rga-block-action (each has own inner .ProseMirror)
        │   │   ├── .rga-scene-block.rga-block-character
        │   │   ├── .rga-scene-block.rga-block-dialogue
        │   │   └── ...
        │   └── .rga-scene-frame-placeholder-transition (form control)
        ├── p (empty spacer)
        ├── .rga-scene-frame-placeholder (sceneFrame 2)
        └── ... (more scenes)
```

---

## 4. What We've Tried

### Approach 1 — V1 estimate engine (`archived/page-breaks-v1.js`)

**Algorithm:**
- Read `pageSetup` (paper size + margins)
- Estimate lines-per-page from `(paperHeight - margins) × 6 lines/inch`
- For each break: place a `<div>` at `top: i × fullPageHeightPx` (absolute positioning inside `.rga-page`)
- Re-render on every PM `view.update`

**Failure mode 1 — estimation is wrong:** The estimate is per-line based. But sceneFrame atoms are variable height (a scene can be 100px or 800px depending on content). So breaks landed at wrong content positions.

**Failure mode 2 — absolute overlays mask content:** Each break div was `position: absolute`, `height: 16px`, painted in the desk color. Content at that vertical pixel position was visually masked by the strip. The user reported "if a scene divides between two pages, some part is cut off" — that was the strip painting over text.

This is what triggered the whole rewrite.

### Approach 2 — V2 measurement engine (`paginator-v2.js`, current)

**Algorithm:**
- Run after PM renders (debounced 120ms after doc changes)
- Walk `view.dom`'s direct block children: `.rga-title-strip` + each child of `.rga-body`
- For each block, measure `getBoundingClientRect().height`
- Accumulate height; when adding the next block would exceed `usablePageHeight`, mark a break **before** that block
- Emit breaks as `Decoration.widget` entries — real flow-block `<div>` elements that take vertical space (16px desk-strip visual)

**Intended improvements over V1:**
- Real measurements instead of estimates → breaks at correct positions
- Flow-positioned widgets instead of absolute overlays → no content masking
- Block-aware breaking → never split a scene mid-block

**Current failure mode (what Darya sees):**
- Pages appear far too short. Each "page" holds only one scene (~250px) when an A4/Letter page should hold ~864px usable.
- The user described it as: "whenever it sees space, it trims it and move to the next page" — the paginator seems to treat any whitespace as a page boundary, ignoring real page height.
- The desk-strip gap is barely visible (background blends with the page color — only the two thin border lines are visible). User wants a clearer visual page-end indicator.

**Things we've ruled out:**
- CSS conflict with v1's leftover `.rga-page-break` rules (cleaned up in commit `0d538a6d` — multiple old rules had higher specificity and were overriding the new flow styling. Removing them did NOT fix the "pages too short" issue.)

**Suspected but unconfirmed:**
- `getBoundingClientRect` on a sceneFrame atom's outer `.rga-scene-frame-placeholder` div might be returning unexpected heights — possibly the full page height because of some CSS rule, or zero because it's mid-render
- The recompute loop might be measuring stale layouts (post-decoration-insert layouts include the decorations themselves, growing the cumulative height)
- `view.posAtDOM(sceneFrameDiv, 0)` might be returning a position INSIDE the atom (which is undefined for atoms) rather than the position before the atom, placing breaks at wrong PM positions
- The "empty paragraph" spacers between scenes might be measuring wrong

We haven't added instrumentation to confirm any of these. The user requested a stop-and-think before more iteration.

---

## 5. Current Symptoms (what the user observes)

From the screenshot Darya shared:
- In Print view, between scenes, there's a thin double-bordered separator (the two border lines of the desk strip — but the desk-color background blends with the page, so the gap doesn't read as a clear page boundary)
- Each "page" section holds only one short scene (5–10 lines)
- Page boundaries appear roughly at scene boundaries, but at the wrong cadence — many more breaks than there should be
- "Page 2", "Page 3" labels are positioned with the breaks (these come from a legacy `.rga-page-break::after { content: attr(data-page-label) }` rule we have since removed in the current commit, but were visible at time of screenshot)

User's verbatim description:
> "the gap is there (not as gap, the bg color is same as the page, only two strokes show the gap), the view still doesn't respect the page height, actually it doesn't recognize page height, it calculates space, whenever it sees space, it trims it and move to the next page. this architecture is not right."

User's preference:
> "stop, lets find another solution, I don't like patching, I like solid solutions."

---

## 6. Why Neither Approach Has Worked

The honest assessment:

**V1's overlay-on-continuous-flow approach** was architecturally incompatible with the goal — overlays will always mask the content they cover. It would have needed a fundamentally different rendering model (real spacers, not overlays) to fix.

**V2's measurement-after-render approach** is theoretically sound but has subtle complexity I underestimated:
- ProseMirror's render lifecycle is asynchronous and multi-staged with nested editors; measurement timing matters
- Inserting decorations changes the layout, so post-render measurement needs idempotency / convergence checks I haven't proven
- Block-level measurement assumes each block is one self-contained vertical unit; the nested-PM-editor scenes might violate that in ways I don't fully understand

The deeper issue may be that **measurement-based pagination is the wrong primitive for a screenplay editor.** Screenplays have STRUCTURE that maps to pagination conventions:
- Slug + first 2 lines should stay together (no orphan slugs at page bottom)
- (MORE) / (CONT'D) markers when a dialogue block splits across pages
- Scene boundaries are natural page break candidates
- Industry uses LINE COUNT, not pixel height, as the unit of measurement (6 lines per inch is the convention)

A pixel-measurement engine doesn't know any of this. It would always be guessing badly compared to a structure-aware engine.

---

## 7. Alternative Architectures Worth Considering

These are options the consultant might evaluate. We have not seriously prototyped any of them.

### Option A — True multi-page DOM (Final Draft model)
- Each page is a separate `<div class="rga-page">` element with its own paper styling
- A layout pass distributes content across pages
- Content "owns" a position on a specific page
- Editing inserts content; layout shifts content forward to maintain page boundaries
- Pros: directly matches user mental model; print export is trivial; per-page concerns (headers/footers, page numbers) are natural
- Cons: editing across page boundaries is complex; PM's content model is single-document, so making PM render across multiple DOMs requires creative use of NodeViews or multiple EditorViews

### Option B — Line-count-based pagination
- Don't measure pixels; count lines based on content structure
- Slug = 1 line + 1 blank above + 1 blank below
- Action paragraph = N lines based on character-count / 60-char-per-line
- Dialogue indented = N lines based on character-count / 35-char-per-line
- Each scene block contributes a known line count
- Match industry standard 54 lines per page (Letter, 1" margins)
- Pros: deterministic, matches industry convention, no measurement timing issues
- Cons: needs careful per-block line-count rules; doesn't match exact CSS pixel render; assumes Courier 12pt fixed-width

### Option C — Headless layout to canvas, paint to DOM
- Use a hidden offscreen renderer to measure exact heights of every block
- Compute page assignments
- Render visible DOM based on assignments
- Pros: gets exact measurements
- Cons: heavyweight; performance concerns

### Option D — paged.js (or similar CSS-paged-media polyfill)
- Use paged.js (https://pagedjs.org/) to convert the editor's content into properly paged output
- This is the same engine that powers many e-book and PDF generators
- Pros: handles all the edge cases (orphans, widows, (CONTINUED), running headers); production-tested
- Cons: external dependency; integration with PM nested editors is unexplored

### Option E — CSS `@page` + browser print
- Don't paginate on screen at all in Print view
- Use real `@page` and `break-after: page` CSS rules
- Browser's print engine paginates for actual paper output
- Show "Print Preview" as the browser's print dialog
- Pros: zero custom code; real CSS paged media
- Cons: no live page-break visualization while writing; only works for actual print; doesn't address Flow view's page markers either

### Option F — Hybrid: line-count for breaks + measurement for visualization
- Use Option B's line-count engine to DECIDE break positions
- Use measurement to VISUALIZE the break in the editor
- Get industry-correct pagination without the timing/precision issues of pixel-only

---

## 8. Code Locations

- Current paginator: `rwanga-editor/renderer/js/doc-types/screenplay/plugins/paginator-v2.js`
- Archived v1: `rwanga-editor/renderer/js/doc-types/screenplay/archived/page-breaks-v1.js`
- Scene NodeView: `rwanga-editor/renderer/js/doc-types/screenplay/scene-frame-pm.js`
- Editor mount + plugin registration: `rwanga-editor/renderer/js/editor/mount.js`
- CSS: `rwanga-editor/renderer/css/editor-prosemirror.css` (the v2 paginator's `.rga-page-break` rule is near the top of the file; the print-view container styling is also there)
- Outer schema: `rwanga-editor/renderer/js/editor/mount.js` lines 13–80 (defines doc/body/sceneFrame/etc.)

Sample fixture: `rwanga-editor/tests/fixtures/playground-the-last-light.rga` — a 5-scene short film with characters tagged in the registry. Used for hands-on testing.

The git log on `main` shows the full history of this work — the relevant commits are roughly the last 20, all prefixed `feat(scene-v2)`, `fix(scene-v2)`, or `feat(paginator)`.

---

## 9. Concrete Questions for the Consultant

1. Is measurement-based pagination viable at all for a nested-PM-editor document, or does the rendering complexity make it fundamentally unreliable?
2. Would line-count-based pagination (Option B) be a better primitive given that screenplays have such fixed typography rules?
3. Is paged.js (Option D) worth integrating, or does PM's content model make integration too painful?
4. Is the nested-PM-editor architecture itself making this harder than it needs to be? Should we reconsider the "one PM editor per block" decision specifically for paginatable views?
5. Are there industry-standard libraries or patterns for "live paginated screenplay editor" that we should evaluate?

Any feedback welcome — including "all four directions you tried are wrong, here's what you should actually do."

---

*End of report.*
