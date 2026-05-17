# Rwanga Editor — Recovery Forensic Report

**Date:** 2026-05-17  
**Author:** investigation pass (no code changes)  
**Workstream:** Editor Recovery + Functional Recovery Phase 1  
**Status:** INVESTIGATION COMPLETE — recommendations only, no
implementation.  
**Cross-reference:** Runtime Ownership Stabilization is LOCKED
(`docs/design-system/rwanga-runtime-stabilization-final.md`). The
shell architecture is not the issue.

---

## 0. Executive summary (read this first)

**The Rwanga editor's "the editor feels worse than pre-reset" complaint
has one dominant technical cause and several smaller cosmetic ones.**

- **Dominant cause:** the `Rga.Nav` + `screenplay-normalizer` +
  `pagemap-engine` + `layout-profile` pipeline IS production-ready
  and IS computing real page maps — but **Flow view does not use
  any of it for rendering**. Flow shows a single scrollable column
  with 1px dashed lines as "page hints". The full paged-sheets
  rendering only exists in **Print Preview** (a separate view).
  The editor surface a writer spends 95% of their time in
  therefore reads as "one long paper" — not a screenplay.
- Pre-reset (per the LOCKED commits `64e49140` /
  `501a4b00` / `6cb69e15`) Flow was apparently never paged
  either — but with crisper page-break visuals and a more
  intentional "single page" treatment. The Slice 1–9 shell work
  reordered DOM and added padding for the toolbox, which made
  the lack of visual pagination more obvious.
- The Scene Navigator → editor scroll chain technically works; the
  click moves cursor + scrolls. The UX issue is the dual-state
  design (keyboard-focus row vs cursor-current row) which can
  confuse users when navigating fast.
- The toolbox CSS is sound (Slice V1 §T4 fix held); the
  disabled-class wiring lives in v3 plugins which were not
  investigated. If "toolbox questionable" persists, it's a v3
  plugin behaviour, not a shell issue.
- View-mode triad (Flow / Print / Draft) is FUNCTIONALLY distinct
  but VISUALLY thin: Print is just a CSS class + container padding
  swap; it doesn't render true page sheets the way Print Preview
  does.

**Headline recovery move:** introduce true paged-sheet rendering in
**Flow view** (reuse the existing `pagemap-engine` output), so the
editor finally feels like a screenplay manuscript. Everything else is
polish on top.

---

## 1. What existed before

Reconstructed from project memory + git history of the three "locked"
commits referenced in user memory:

- **`64e49140` — "Script framework LOCKED 2026-05-15"** — frozen
  the v3 schema's slug/Enter-flow / Tab cycle / scene-spawning
  behaviour.
- **`501a4b00` — "Flow view LOCKED 2026-05-15"** — froze the Flow
  view styling and chrome: 8.5in column, slug = setting—time/location
  with dark-pink underline, line-height 1.3, per-character
  tag-registry tinting, VSCode-style per-visual-line gutter.
- **`6cb69e15` — "Print + Draft views LOCKED 2026-05-15"** —
  paper feel, page-break gaps, title+page-N headers, Page Setup
  works. Font reduced 12pt → 11pt across slug + blocks.

What the user appears to remember as "pre-reset":
- A more **intentional single-page treatment** in Flow (the
  page-as-paper aesthetic was tighter; line-gutter present;
  slug treatment distinctive).
- **Page-break gaps + title/page-N labels** in Print view
  (currently those labels are explicitly DEFERRED per
  `editor-prosemirror.css:50–52`).
- A working **scene toolbox** that responded to cursor position.
- A working **Scene Navigator** with reliable click-to-navigate.

What did NOT exist pre-reset (so isn't a regression):
- Paged-sheet rendering in Flow. Flow has always been a single
  scrollable surface with page-break decorations. The pagination
  pipeline was designed for Print Preview only.
- A second editor view that does true pagination inline.

---

## 2. What exists now

A focused inventory of the editor surface area as of 2026-05-17 (Slice
9 complete; all 650/650 tests passing).

### 2.1 Mount path (`renderer/js/editor/mount.js`)

- **Phase-9-final.** No pre-Phase-9 branches remain.
- Schema selection flows through
  `Rga.DocTypes.screenplay.selectSchema()` (line 109) → always v3.
- Plugin stack (lines 140–171):
  - Universal: `history`, `keymap({"Mod-z": undo, "Mod-y": redo,
    "Mod-b": toggleBold, "Mod-i": toggleItalic, …})`
  - v3-specific: `sp.buildV3Keymap()`,
    `sp.buildV3ScenePlugins()`, mark plugins (annotations / tags /
    revisionFlags / context-menu)
- NodeViews: `sp.buildV3NodeViews()` (scene + sceneHeading).
- The `Rga.Nav` plugin is wired (via `buildV3ScenePlugins`) and
  emits **scene-number decorations + page-break widget
  decorations for Flow view**.

**Verdict:** mount is correct and engine-complete. ✓

### 2.2 View-mode triad

Three controllers registered with `Rga.ViewManager`:

| View | Body class | Container class | Visual effect |
|---|---|---|---|
| **Flow** | none | `view-flow` | Single scrollable column; `.rga-page-break` rendered as 1px dashed line (editor-prosemirror.css:90) |
| **Print** | `view-print-active` | `view-print` | Same editor DOM; `.rga-page-break` rendered as 16px gap (editor-prosemirror.css:53–64); paper-style padding via page-surface.js |
| **Draft** | `view-draft-active` | `view-draft` | Hides format-toolbar + scene-toolbox; full-screen editing |

Plus **Print Preview** (registered by `Rga.PrintPreview`) — a
separate view that renders REAL page sheets into
`#rga-print-preview-root`, read-only.

**Verdict:** Flow and Print share the same editor DOM with
different CSS — there is no true page-sheet structure in either.
Only Print Preview produces actual pages.

### 2.3 Pagination pipeline (engine)

Four-module pipeline, all of which work and are tested:

1. **`screenplay-normalizer.js`** — PM doc → NormalizedBlock[].
   Each block carries `pmFrom/pmTo`, `sceneNodeId`, `sceneNumber`,
   `keepWithNext` discipline. No DOM, no measurement.
2. **`layout-profile.js`** — typographic constants → per-block
   specs (linesPerPage: 54 for Letter 12pt Courier; cpl per block
   type; leadingBlankLines).
3. **`pagemap-engine.js`** — NormalizedBlock[] + LayoutProfile →
   PageMap[]. Conservative V1 packer; respects keep-with-next
   chains; never splits a block.
4. **`nav-index.js`** — enriched navigation index with page
   placeholders (consumed by Scene Navigator's "p.N" badge).

**Where it's consumed:**
- **Print Preview** — fully. Builds RenderModel → PrintRenderer
  renders one `.rga-page-sheet` per page with `data-page-number`.
- **Flow view** — only for the page-break widget decorations
  (cosmetic 1px lines) and the navigation-index page-numbering
  used by the Scene Navigator's page badge.

### 2.4 Scene Navigator → editor chain

`renderer/js/shell/panels/scene-navigator.js`

- `scrollToScene(nodeId)` (line 173–206):
  - `Rga.Nav.findScene(view.state.doc, nodeId)` → pmPos
  - `TextSelection.near($pos)` → setSelection + scrollIntoView
  - **Backup (Slice 1 §C):** `view.nodeDOM(pmPos).scrollIntoView({block: 'start'})`
  - `view.focus()`
- Two visual marks coexist by design:
  - `row-current` ← editor cursor (via ScriptSession)
  - `row-selected` ← keyboard-nav focus (private `_selectedNodeId`)

**Verdict:** the navigation chain is correct; the dual-state UX is
intentional but probably confuses users navigating fast.

### 2.5 Toolbox

`editor-prosemirror.css:218–297` + (un-investigated) v3 plugin code
for the disabled state.

- `position: absolute; top: 32px; right: 16px` inside `#editor-area`
  (Slice V1 §T4 fix).
- Width 88px; padding/border/shadow correct.
- Disabled state: `opacity: 0.35; pointer-events: none`.
- Hidden in Draft mode.
- **Disabled-class wiring lives in v3 plugins** — not investigated;
  off-limits to modify.

### 2.6 Format toolbar

`renderer/js/format-toolbar.js` — selection-aware Bold / Italic /
Underline / Strikethrough / Color / Highlight / Link toolbar. Uses
PM's standard `toggleMark` / `addMark` / `removeMark`. Schema-agnostic;
works with v3.

### 2.7 Boot sequence (`renderer/index.html:690–769`)

Sound 17-step boot:
1. Theme → 2. WorkspaceState → 3. Resize → 4. Keyboard → 5.
BottomPanel → 6. CommandPalette → 7. Shell (chrome) → 8. TabManager
(mounts PM EditorView) → 9. bootSession → 10-13. Shortcuts /
ScriptLanguage / ViewMode / Units → 14. FlowChrome / FormatToolbar.

No obvious broken code or no-ops.

---

## 3. What improved (since pre-reset)

Genuine wins delivered by Slices 1–9 + V1/V1.1 visual stabilization:

| Improvement | Where |
|---|---|
| Bottom panel reopen works (Cmd+\`, Ctrl+J, close button, command palette — all reversible) | Slice 1 §A + V1.1 fix 6 |
| Status bar is grey, not VS-Code blue | V1 §T2 |
| Scene Navigator has real row structure (number column, ellipsised heading, page chip, current + selected states) | V1 §T3 |
| Active panel restored on reload | Slice 4 §A + Slice 5 §B fix |
| Active tab restored on reload | Slice 9 §A fix (pre-Slice-9 it was lost) |
| Theme toggle visible in titlebar | V1.1 fix 2 |
| Inspector right-click actually opens (Rga.Inspector.open exists now) | Slice 9 §A |
| ScriptMetrics derives independently from ScriptSession | Slice 7 §A |
| Single keyboard listener (no duplicate Ctrl+J / Ctrl+B) | Slice 2 §A |
| `app-shell.js` shrank from 1080 → 201 LOC | Slices 3 / 8 / 9 |

---

## 4. What regressed (vs pre-reset / vs user expectation)

Recovery targets, ordered by user-visible impact:

| # | Regression | Source / cause |
|---|---|---|
| R1 | **Flow view shows one tall scrollable column, not a paginated manuscript** | Flow has never been paged in this codebase — but the lack of paged feel is more noticeable now that the surrounding chrome is cleaner. |
| R2 | **Page-N + title headers absent in Print view** | Explicitly DEFERRED in `editor-prosemirror.css:50–52` ("reinstating them needs an explicit 'top margin' reservation per page"). |
| R3 | **Page-break gap visual in Flow is just a 1px dashed line** | `editor-prosemirror.css:90–93`. Pre-reset this was a more prominent gap. |
| R4 | **Toolbox feels "questionable"** | The CSS position is correct (Slice V1 §T4). If the toolbox renders but feels off, the disabled-class wiring in v3 plugins may be misfiring. Not investigated. |
| R5 | **Scene Navigator click behaviour is sometimes confusing** | Dual-state UX (keyboard focus vs cursor location) — by design (Slice 1 §C). User may expect them unified. |
| R6 | **Draft mode feels jarring** | Hides format-toolbar AND scene-toolbox, leaving the editor isolated. Pre-reset Draft had a clearer "exit" affordance. |
| R7 | **No visible page numbers in Flow view** | Pagination produces page numbers (consumed by Scene Navigator's badge) but they are NOT rendered in the editor surface. |
| R8 | **Slug / scene-heading visual treatment is plain** | Pre-reset memory says "dark-pink underline" — current CSS doesn't apply it (slug renders as a normal heading). |
| R9 | **No line-number gutter in Flow** | `Rga.FlowChrome` is initialized in boot but appears to render nothing — needs deeper investigation. Memory says "VSCode-style per-visual-line gutter" was locked at `501a4b00`. |
| R10 | **Title + author treatment in Logline / Characters sections renders as plain HTML** | Per the V1.1 screenshot, sections render as default-styled HTML headings, not screenplay-styled. Likely a CSS gap in `editor-prosemirror.css`. |

---

## 5. Architecture gaps

Structural issues that constrain recovery work:

| Gap | Detail | Recovery implication |
|---|---|---|
| **A1: Flow has no page-sheet DOM** | `#editor` is a single `.rga-page` div; PM renders into it; page breaks are widget decorations only. | A real paged-Flow needs either (a) multiple `.rga-page-sheet` siblings or (b) a Flow-specific RenderModel that wraps content in per-page containers. Both are non-trivial; (a) breaks PM's contiguous-doc model, (b) requires a re-render-on-edit pipeline. |
| **A2: Pagination output isn't subscribed to by Flow** | `pagemap-engine` produces PageMap[]; nav-index uses it for the page-break decorations and Scene Navigator page badges, but no other Flow consumer reads it. | Recovery candidates need to identify a clean Flow-side subscription point that doesn't fight PM's contenteditable. |
| **A3: View-mode controllers are CSS-only** | Flow/Print/Draft differ in body class + container class only. None of them produce different DOM structure. | If Print should look different from Flow, that's a new responsibility for the Print controller — not just a class swap. |
| **A4: Toolbox enable/disable logic lives in v3 plugins (off-limits)** | Disabled-class wiring is in `doc-types/screenplay/v3-*.js`. Editor Recovery cannot touch it without crossing into engine territory. | If toolbox disable state is buggy, recovery options are: (a) accept the limitation, (b) lift the engine-touchability gate, (c) override from shell with a CSS rule based on a higher-level signal (e.g., ScriptSession.currentBlockType). |
| **A5: `FlowChrome` is initialized but invisible** | Boot script calls `Rga.FlowChrome.init()` but no visible gutter in the editor screenshot. Module may be a stub or its DOM target may not exist. | Needs investigation before any rendering work on Flow chrome. |
| **A6: Slug / scene-heading styling lives in `editor-prosemirror.css` AND in v3 node-views** | Two layers control how a scene-heading looks. CSS can change visual treatment; the structural slug attributes (setting, time, location) come from the v3 node-view. | Recovery work that touches slug visuals must understand both layers. |

---

## 6. UX gaps

Issues that aren't broken behaviour — just unclear or unsatisfying.

| Gap | Detail |
|---|---|
| **U1: Flow doesn't feel like paper** | Single scrollable surface with 1px dashed lines reads as "long Google Doc", not "screenplay manuscript". |
| **U2: Print view isn't visibly different from Flow** | Both render the same editor DOM with different padding. Users may not understand the difference, especially since Print Preview (the real paged view) is a third button. |
| **U3: Draft mode is over-stripped** | Hides EVERY non-editor element. No status bar, no scene context, no exit affordance other than Esc. Distraction-free becomes context-loss. |
| **U4: Scene Navigator dual-state mark is invisible** | Two distinct marks (`row-current` = cursor; `row-selected` = keyboard) exist in code but the visual difference isn't pronounced enough for users to know which is which. |
| **U5: Page numbers in Scene Navigator badges aren't anchored to anything visible in the editor** | The "p.N" chip on each scene row is a real number, but the editor doesn't show page markers, so users can't verify or trust the badge. |
| **U6: Format toolbar feels detached** | Lives in its own strip above the page; doesn't follow the cursor or context. Pre-reset memory suggests this was always the case, so not a regression but an old gap. |
| **U7: No "you are on page N of M" indicator anywhere except the status bar's small "Page: N/M" segment** | Pagination data is computed; only one consumer renders it. |

---

## 7. Technical gaps

Code-level issues that are smaller but worth fixing during recovery:

| Gap | File:line | Detail |
|---|---|---|
| **T1: Page-N/title labels deferred** | `editor-prosemirror.css:50–52` | Explicit TODO; needs explicit top-margin reservation per page. |
| **T2: `editor-empty-state-recent` reserves DOM but no content wired** | `renderer/index.html:113` | Empty container; recent-files list never populates. |
| **T3: `Rga.SceneManager` referenced in StudioPanel's notes-connector but module not loaded** | `studio-panel.js` (folded from `SceneNotesConnector`) | `if (Rga.SceneManager && Rga.SceneManager.scenes)` — defensively guarded; means scene-notes save behaviour silently degrades. |
| **T4: `Rga.Cursor.getCurrentBlock` is the StudioPanel scene-notes connector's only DOM walker** | `studio-panel.js` | Couples shell to a DOM API that may not survive future engine refactors. |
| **T5: PrintPreview's `previousView` heuristic doesn't handle printPreview-from-printPreview** | `print-preview.js:70` | Edge case; unlikely to hit but documented. |
| **T6: ScriptMetrics relies on ScriptSession recompute as its trigger signal** | `script-metrics.js:103–113` | If ScriptSession's shallow-equality filter rejects a recompute that contained ONLY a wordCount change in the underlying Outline, ScriptMetrics won't see it. In practice cursor movements always trigger ScriptSession churn so this works. |
| **T7: `injectIcons()` still iterates `.activity-icon[data-panel]` selectors** | `renderer/index.html:441-453` | Activity rail uses Lucide SVGs now (Slice 8); the old icon-injection loop is dead. |

---

## 8. Prioritized recovery candidates

Each candidate carries a recovery shape, not an implementation. The
intent is to give the next workstream owner a menu to choose from.

### C1 — True paged Flow rendering ★ HEADLINE

**Goal:** When the user is in Flow view, the editor surface visually
breaks into discrete page sheets with gaps between them, matching the
PageMap the engine already computes.

**Approach options:**
- (a) **Multi-sheet DOM (high reward, high risk).** Wrap PM's
  contenteditable in N `.rga-page-sheet` containers (one per page).
  Page breaks become real DOM gaps. RISK: ProseMirror expects a
  single contenteditable; splitting the doc DOM may break selection /
  paste / undo.
- (b) **CSS-only paged feel (medium reward, low risk).** Stop using
  1px dashed page-breaks; render them as visible 16px gaps with
  page-number labels (same treatment Print uses), in Flow too.
  Reuses existing CSS rules — almost free. DOES NOT produce true
  sheets but gives the visual feel.
- (c) **Hybrid: paged background + single editable foreground.**
  CSS background-image of page boundaries; editor scrolls normally
  over it. Visual win without DOM risk.

**Recommendation:** start with (b), measure how it feels; only
escalate to (a) if (b) doesn't address the user complaint.

### C2 — Restore page-N + title headers in Print view

**Goal:** Each page in Print view shows "1." (or the configured
page-number style) at top-right and the script title at top-left.

**Approach:** unblock the deferred TODO at
`editor-prosemirror.css:50–52`. Reserve explicit top margin per page,
position labels absolutely within the reserved space. Same engine
output; just CSS + tiny per-page-N data attribute.

### C3 — Scene Navigator: make the dual-state visually clear

**Goal:** Users see at a glance which row is the cursor-current scene
vs which is keyboard-selected.

**Approach:** revisit the V1 §T3 CSS for
`.rga-shell-scene-navigator-row-current` vs `-row-selected`. Currently
they're a left-rule vs filled background — but with similar
saturations. Make them more distinct (e.g., current = stronger left
bar + bolder text; selected = filled background + slight inset
shadow).

### C4 — FlowChrome line-number gutter recovery

**Goal:** Restore the VSCode-style per-visual-line gutter that the
"Flow view LOCKED" memory says existed at commit `501a4b00`.

**Approach:** investigate why `Rga.FlowChrome.init()` produces no
visible gutter. Either the module is a stub (likely) or its DOM
target was removed. Either restore the implementation or vendor a
similar pattern.

### C5 — Slug / scene-heading dark-pink underline

**Goal:** Restore the "setting—time/location with dark-pink
underline" treatment locked at `501a4b00`.

**Approach:** add CSS rules for the v3 node-view's slug-heading
classes. Engine-side selectors are fixed (off-limits to modify
structurally); only the CSS layer needs work.

### C6 — Draft mode UX hardening

**Goal:** Draft mode keeps a minimal status footer (mode + Esc
hint) so users don't lose orientation.

**Approach:** in Draft mode, instead of hiding the status bar,
collapse it to a one-line footer with just "Draft mode — Esc to
exit" + the word count. Compromise between distraction-free and
context-loss.

### C7 — Page numbers in the editor surface

**Goal:** Show "Page N" at the top of each rendered page in BOTH
Flow and Print.

**Approach:** depends on C1 (paged Flow). With paged Flow, page
numbers are a natural decoration. Without paged Flow, this is just
the Scene Navigator badge.

### C8 — Toolbox enable/disable investigation

**Goal:** Understand why the toolbox feels "questionable".

**Approach:** investigate `doc-types/screenplay/v3-*.js` for the
disabled-class wiring. If logic is broken there, recommend a shell-
side override (e.g., based on `ScriptMetrics.currentBlockType !==
null`). Engine-side fix is preferred but currently off-limits.

### C9 — Print Preview header / footer page metadata

**Goal:** Print Preview pages currently show only "1." at top. Add
script title at top-left and total-page count at bottom.

**Approach:** modify `print-renderer.js`'s per-page builder. Engine
file — off-limits this workstream. Park for after engine-touchability
gate.

### C10 — Cleanup dead `injectIcons()` loop

**Goal:** Remove the dead activity-rail icon-injection block in
`index.html:441-453` left behind by Slice 8's Lucide migration.

**Approach:** delete the block. Trivial. Cosmetic cleanup, not a
feature.

---

## 9. Top 10 editor pain ranking

| Rank | Pain | Impact | Difficulty | Recommended order |
|---|---|---|---|---|
| 1 | **Flow doesn't feel like paper** (one tall scrollable column) | ⭐⭐⭐⭐⭐ user-blocking aesthetic complaint | MEDIUM (CSS-only approach) → HIGH (true paged DOM) | First. Start with C1(b) CSS approach; escalate only if needed. |
| 2 | **No page-N / title headers in Print view** | ⭐⭐⭐⭐ — Print is supposed to look like the output | MEDIUM — unblocks a documented TODO; needs careful CSS positioning | Second. C2. |
| 3 | **Slug / scene-heading visual treatment plain** | ⭐⭐⭐⭐ — screenplay-first aesthetic | LOW — pure CSS work | Third. C5. |
| 4 | **Page-break gaps in Flow are 1px dashed lines** | ⭐⭐⭐ — visual page hint too weak | LOW — change CSS rule | Bundle with C1(b). |
| 5 | **Scene Navigator dual-state visually subtle** | ⭐⭐⭐ — keyboard navigators get confused | LOW — CSS contrast bump | Fourth. C3. |
| 6 | **Draft mode strips too much context** | ⭐⭐⭐ — distraction-free becomes context-loss | LOW–MEDIUM — minimal new footer | Fifth. C6. |
| 7 | **No line-number gutter in Flow** | ⭐⭐ — was present pre-reset, now absent | MEDIUM — needs FlowChrome investigation + reimplementation | Sixth. C4. After C1/C2/C5/C3/C6 land. |
| 8 | **Toolbox enable/disable feels questionable** | ⭐⭐ — works mechanically, feels uncertain | HIGH (engine-touchability) or MEDIUM (shell-side override) | Defer until C4 lands; investigate then. |
| 9 | **Print view isn't visibly different from Flow** | ⭐⭐ — semantic confusion (Print vs Print Preview) | MEDIUM — depends on C1 + C7 outcomes | Re-evaluate after C1 ships. |
| 10 | **Dead `injectIcons()` block + minor dead-DOM** | ⭐ — invisible to users; technical hygiene | LOW — mechanical cleanup | Last. C10. |

---

## 10. Recommended sequencing

A 3-phase sequence that the next workstream could adopt:

**Phase 1: Make Flow feel like paper (1 slice).**
- C1(b) CSS-only paged feel (visible page-break gaps with
  optional page-number labels in Flow).
- Bundle with rank-4 (better page-break visual).

**Phase 2: Tighten the screenplay aesthetic (2–3 slices).**
- C2 — page-N + title headers in Print view.
- C5 — slug / scene-heading dark-pink underline.
- C3 — Scene Navigator dual-state contrast bump.

**Phase 3: Restore lost surfaces (2 slices).**
- C4 — FlowChrome line-number gutter.
- C6 — Draft mode minimal footer.

**Park until engine-touchability gate:**
- C8 — toolbox enable/disable wiring fix.
- C9 — Print Preview header / footer page metadata.

**Cleanup, anytime:**
- C10 — dead injectIcons loop.

---

## 11. Out of scope (do NOT include in recovery work)

- Anything in `framework/`, `doc-types/`, `editor/` —
  engine-touchability gate (Runtime Stabilization LOCKED rules apply).
- Shell ownership refactoring — closed, frozen.
- Workspace persistence — closed (Slice 4).
- Keyboard / Theme / Session / Metrics ownership — closed
  (Slices 2 / 7).
- StudioPanel restructure — closed (Slice 9).
- Activity Rail icon family — LOCKED on Lucide.
- Any new feature additions — recovery only.

End of report.
