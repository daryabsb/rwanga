# Rwanga Manuscript v1 — Living Manuscript — Plan

> **Status:** Plan accepted by user 2026-05-18 with 5 corrections (A–E) applied below. Phase A is being executed; Phases B–G await Phase A sign-off.
> **Author session:** 2026-05-18 (post shell-lock pre-flight). Shell tip: `f837ed8e` (pending user smoke).
> **Doctrine:** *Flow should feel like writing. Print Preview should feel like paper.*
> **Required execution sub-skill:** `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`.
>
> **Hard rules (from acceptance review):**
> - no shell redesign
> - no owned-chrome changes
> - no toolbar changes
> - no schema changes unless explicitly stopped and approved
> - no export implementation in v1 (Phase F is spec-only)
> - no fake page separators
> - all page-break UI must derive from PageMap
> - tests green after each phase
>
> **Label doctrine (per correction C):**
> - **Flow** = writing reality
> - **Print Preview** = paper truth
> - **Print** = reading mode / temporary legacy view (kept in v1, not removed)

---

## Goal

Promote today's pagination from "PageMap exists; Flow shows markers; Print Preview renders sheets but is unreachable from the UI" to a coherent **Manuscript Reality** where Flow remains a continuous writing canvas with *real, trustworthy* page-break confidence, Print Preview is exact paper truth, and Export is a known third reality with explicit branding rules.

## Architecture (in one paragraph)

A single **Manuscript Geometry** contract feeds the existing pure pipeline (Normalizer → LayoutProfile → PageMap → RenderModel) which is already the source of truth for Print Preview. Three consumers render that truth at three fidelities: Flow (writer reality — continuous, with PageMap-derived markers + numbers + last-line indicator), Print Preview (paper reality — fixed page stack, headers/footers, exact export confidence), and Export (PDF/print, branded by tier). Margin tuning operates on the geometry contract as named presets; custom values are not exposed in v1 of the v1.

## Tech stack (already in place — do not change)

- Electron + ProseMirror, vanilla JS modules, `window.Rga.*` namespace.
- Pure pipeline: `Rga.Normalizer`, `Rga.LayoutProfile`, `Rga.PageMap`, `Rga.RenderModel`, `Rga.PrintRenderer`.
- View controller: `Rga.ViewManager` + `Rga.ViewMode`.
- Doc model: `Rga.Doc` v2.0 (.rga); v3 schema (`Rga.DocTypes.screenplay.buildSchemaV3`).
- CSS tokens in `renderer/css/tokens.css`; manuscript CSS in `renderer/css/editor-prosemirror.css`.

---

## 1. Current manuscript reality

This is what exists at `f837ed8e`, mapped per file. Verified during this session by reading source.

### 1.1 The views

| View | Body class | Container class | Active surface | Source |
|---|---|---|---|---|
| **Flow** (default) | *(none)* | `view-flow` | `.rga-page` (single tall) | `renderer/js/view-mode.js`, `editor-prosemirror.css:66-83` |
| **Draft** | `view-draft-active` | `view-draft` | `.rga-page` + body chrome hidden | `view-mode.js`, CSS `:167-221` |
| **Print** | `view-print-active` | `view-print` | `.rga-page` + page-marker repurposed as `N.` | CSS `:13-65`, `:2093-2114` |
| **Print Preview** | `view-print-preview-active` | *(separate root)* | `#rga-print-preview-root` with `.rga-page-sheet` × N | `renderer/js/framework/print-preview.js`, CSS `:2127-2188` |

Crucial finding: only Print Preview is a **separate, per-sheet** renderer. Flow / Draft / Print all share the same single `.rga-page` ProseMirror surface; their differences are CSS treatment + per-view DOM rules.

### 1.2 The pipeline (PURE, no DOM)

```
PM Doc
  → Rga.Normalizer.normalize(doc)                      → NormalizedBlock[]
  → Rga.LayoutProfile.compose(screenplayProfile, settings) → layoutProfile
  → Rga.PageMap.build(normalized, layoutProfile)       → PageMap[]
  → Rga.RenderModel.build(doc, pageMap, normalized, lp)   → RenderModel
  → Rga.PrintRenderer.render(renderModel, container)   → .rga-page-sheet × N
```

| Stage | File | Owns |
|---|---|---|
| Normalizer | `renderer/js/framework/screenplay-normalizer.js` | PM Doc → renderable blocks; structured `sceneHeading {setting,location,time}`; keep-with-next flags |
| LayoutProfile | `renderer/js/framework/layout-profile.js` | All page geometry arithmetic (paper, margins, font → linesPerPage, per-block cpl) |
| PageMap | `renderer/js/framework/pagemap-engine.js` | V1 greedy packer; keep-with-next chains; **no splitting** (V1 rule 6) |
| RenderModel | `renderer/js/framework/render-model.js` | Per-page block list + inline runs (text + marks) |
| PrintRenderer | `renderer/js/framework/print-renderer.js` | Sheet DOM builder; renderer-side `setting + location + time` composition |

### 1.3 Where Flow gets its "page" today

`renderer/js/editor/page-surface.js` imperatively writes `doc.settings.pageSetup` (paper size + 4 margins) to the ONE `.rga-page` element as inline styles. `.ProseMirror` min-height matches the content area. The `--page-width: 8.5in` token (`tokens.css:98`) is consumed by `.rga-page` and by `.rga-shell-toolbar-inner` (Row-3 toolbar's centered band) — currently two consumers, one source.

### 1.4 Where Flow gets its page-break markers today

This was the most important discovery of the audit. **Flow already shows real PageMap-derived page-break markers.** They are not decorative.

- `renderer/js/framework/nav-index.js:342-383` (`buildDecorations` + `_buildPageMarkerWidget`) emits widget Decorations at `pageMap[p].blocks[last].pmTo` for each page boundary, with `data-page-number = p+2` (the page about to start).
- The widget DOM is `<div class="rga-page-marker" data-page-number="N">— Page N —</div>`.
- CSS `editor-prosemirror.css:2004-2070` styles it as a "desk strip" gap (negative horizontal margin, dual hairlines, gradient).
- The plugin runs the full normalizer → layout-profile → page-map pipeline on every `tr.docChanged`. So the markers move as the writer types.

In **Print** view the same markers are repurposed to a right-aligned `N.` per `body.view-print-active .rga-page-marker::after { content: attr(data-page-number) '.'; }`. The "— Page N —" text is hidden via `font-size: 0`.

In **Draft** and **Print Preview** the markers are hidden.

So today's Flow already has *some* of what the brief asks for. The honest gap is "feel like writing with paper-confidence" not "build page breaks from scratch."

### 1.5 Page Setup dialog

`renderer/js/editor/page-setup-dialog.js` opens a modal that edits `doc.settings.pageSetup.paperSize` and `doc.settings.pageSetup.margins.{top,right,bottom,left}` in inches. On Apply, it `Rga.Doc.markDirty(doc)` and calls `Rga.PageSurface.apply(ps)` — but does NOT push to `LayoutProfile` / re-run pagination. Pagination is recomputed on the next PM transaction (via the nav-index plugin). For a margin change with no doc change in between, **the markers will not move** until the writer types. **This is a latent bug** — file in §9 risks.

Trigger today: **Ctrl+Shift+G** (`page-setup-dialog.js:113-120`, comment: "TEMPORARY trigger for Step A verification. The permanent trigger (a File menu item) is tracked in the Stop-Point Register."). Page Setup is NOT in the File menu.

### 1.6 Export path

`electron/menu.js:34` has the menu entry: `Export to PDF…` → action `file.exportPdf`, accelerator Ctrl+Shift+E.

`renderer/index.html:1305-1308`: *"file.exportPdf / file.manageStorage / help.loadSample / help.checkUpdates — not yet wired. Native macOS menu still includes them; they will be promoted to commands in Phase A3."*

**Export is unimplemented.** No `webContents.printToPDF`, no `Rga.Export.*` module, no IPC handler.

### 1.7 PrintPreview entry point

`Rga.PrintPreview.show(view)` API exists and is registered as the `printPreview` ViewManager view. But:

- View menu in `electron/menu.js` has only Flow / Draft / Print (no Print Preview).
- Status-bar dropdown holds `printPreview` as a hidden disabled option — comment says "the user enters PrintPreview via the toolbar (a path outside the dropdown)" — but format-toolbar.js has no `printPreview` reference (grepped, zero matches).
- No keyboard shortcut binds it.

**Print Preview is implemented as a renderer but is unreachable from the live UI today.** This is the single biggest "ghost feature" in the manuscript subsystem.

### 1.8 Manual page break (`.rga-page-break`)

CSS exists for `.ProseMirror .rga-page-break` in Flow (`:92-116`) and Print (`:53-64`). **The v3 schema has no `pageBreak` node** (grepped). This rule survives from v2 (pre-migration era). In v3, the writer has no way to insert a manual page break.

### 1.9 Status bar — page count

`renderer/js/shell/status-bar.js:203-213` renders `Page: N/M` from `Rga.ScriptSession.currentPage.{number, total}`. The total comes from PageMap (via the nav-index plugin's exposed page-map → ScriptSession bridge). So the writer DOES see "page X of Y" in the status bar today, in any view. This is the existing "page count is stable" signal.

### 1.10 Things consumed by the geometry that may surprise future work

- `tokens.css:98` `--page-width: 8.5in` is referenced by **the Row-3 toolbar's centered band** (`.rga-shell-toolbar-inner`). Changing paper width changes the toolbar visual alignment. The handoff memory `project_session_handoff_2026-05-18.md:94` marks this LOCKED — it cannot be regressed.
- `doc.settings.pageSetup` uses inches as canonical. `Rga.Units` (`renderer/js/units.js`) does in/cm/mm/px conversion at display time only.
- `Rga.LayoutProfile.DEFAULT_HOLLYWOOD_LETTER_COURIER_12` is built at module load. Tests rely on it. Any change to defaults invalidates fixtures.

---

## 2. Target doctrine

Three realities, named, with one truth source feeding all three.

### 2.1 Writer Reality = Flow

Continuous canvas, comfortable column, **manuscript-aware**. The writer never sees a fake page edge, but they always know:

- Which page they're on (page-band labels at boundaries; status-bar page X of Y).
- That a boundary is coming up (a calm "next page" indicator before the gap, when within ~3 lines of the budget).
- Where the last line of a page lands and where the next page begins.

Flow is editable. Flow is not paginated by paper edges; it is paginated by PageMap.

### 2.2 Paper Reality = Print Preview

Read-only, fixed sheets, paper feel (white sheets on a dark desk, soft shadow, page-end gaps, page numbers in their canonical positions, headers/footers per format). What you see IS what gets exported — pixel-equivalent within rounding.

### 2.3 Export Reality = PDF/Print

The renderer for "leaving the editor." Same RenderModel as Print Preview. Adds branding (Rwanga watermark on free tier; clean on Pro), title page (optional), and a `webContents.printToPDF` (or platform print) round-trip.

### 2.4 The invariant

`PageMap output is identical for Flow, Print Preview, and Export at the same `(doc, layoutProfile)`.` There is exactly one pagination engine. If Flow and Print Preview disagree about where page 4 ends, that is a *bug*, not a *design difference*.

---

## 3. Architecture proposal

### 3.1 The shared geometry contract — `Rga.ManuscriptGeometry`

A new pure module that owns the *resolution* step: "for this doc + this preset + these overrides, what is the layoutProfile?" Today this lives implicitly inside `LayoutProfile.compose()`. Promoting it lets margin presets, future profiles, and tests share one resolution path.

**Correction D (binding):** ManuscriptGeometry is a **thin owner** over LayoutProfile, **not a duplicate geometry engine**. It does NOT recompute linesPerPage, cpl, or any arithmetic that LayoutProfile already owns. It composes inputs and delegates. Tests pin this with an explicit "ManuscriptGeometry.resolve === LayoutProfile.compose(same inputs)" identity check.

**Proposed shape** (planning only; no code yet):

```
Rga.ManuscriptGeometry = {
  // Pure resolution.
  resolve(doc) → layoutProfile          // calls LayoutProfile.compose internally with the right inputs
  resolveFrom(screenplayProfile, settings) → layoutProfile

  // Named margin presets (read-only catalog).
  PRESETS = {
    normal:      { top: 1.0, bottom: 1.0, left: 1.5, right: 1.0 },
    compact:     { top: 0.75, bottom: 0.75, left: 1.25, right: 0.75 },
    veryCompact: { top: 0.5, bottom: 0.5, left: 1.0, right: 0.5 },
    expanded:    { top: 1.25, bottom: 1.25, left: 1.75, right: 1.25 }
  }
  applyPreset(doc, presetName) → void   // writes doc.settings.pageSetup.margins + marks dirty
  presetOf(doc) → 'normal' | 'compact' | 'veryCompact' | 'expanded' | 'custom'
}
```

This module is the SSOT for "what does a doc's manuscript look like." Everything else reads from it.

### 3.2 Authority: PageMap

PageMap stays the authority. It already is. No change to its inputs or outputs in v1. A v2 refinement (block splitting) is explicitly out of scope.

### 3.3 Flow page-break rendering — promote from "marker" to "page band"

The nav-index plugin already emits `.rga-page-marker` widgets at every page boundary. The change in v1 is purely presentational + label-honest:

- Rename the visual to "page band" (the writer reads it as a clear *between-page* zone).
- Show the boundary as: **end-of-page-N marker (subtle, right-aligned, "Page N ends") above the gap → desk-strip gap → start-of-page-(N+1) marker (calm, left-aligned, "Page N+1 begins") below.** Today's single centered "— Page N —" is replaced.
- Decoration source: same widget pipeline. Widget DOM gains a slot for the *prior* page number (already known: `pageMap[p].pageNumber`).
- Add a tiny **"last line on page N"** hint: a 1-line desk decoration before the gap rendered as a one-character indicator in the gutter (the existing flow-line-gutter, `flow-chrome.js`). No new gutter; reuses the existing per-visual-line numbers infrastructure.
- Add a **"approaching page end"** soft cue when current cursor is within ~3 measured lines of the budget. Source: `Rga.ScriptSession.currentPage` + per-block measurement already in PageMap. This is the "page-end awareness" the brief asks for.

No engine change. No new decoration type. Existing widget pipeline + CSS.

### 3.4 Print Preview page rendering — restore the page stack

Today's Print Preview is correct in shape (one `.rga-page-sheet` per PageMap page) but spartan:

- Add a **per-sheet footer band**: page number bottom-center in `N.` format (matches Hollywood convention used at the top-right today).
- Add a **per-sheet running header** (optional, opt-in): script title top-left, scene/act tag in the future.
- Add **page-end depth**: the sheet shadow + the desk gap need a more paper-y feel. Single-design pass, no new structure.
- Behavior: Print Preview **stays read-only**. Editing happens in Flow.

### 3.5 Export renderer

A new `Rga.Export` module wrapping the existing pipeline:

```
Rga.Export = {
  buildPdf(doc, opts) → Promise<{ filePath }>
  // opts: { destination, branding: 'free' | 'pro', titlePage: boolean, headerFooter: 'standard' | 'minimal' | 'none' }
}
```

Underneath, `buildPdf`:

1. Calls `Rga.PrintPreview.buildModel(view)` (the same pure RenderModel that Print Preview uses).
2. Mounts an off-screen invisible container that the existing `Rga.PrintRenderer.render(model, container)` paints into.
3. Calls `window.rwanga.export.pdf(container.outerHTML)` over a new IPC bridge → `webContents.printToPDF` on the Electron side (a hidden BrowserWindow rendered with the same CSS).
4. Free tier adds the `Rwanga Manuscript Watermark` overlay decoration; Pro skips it.

### 3.6 Branding layer

`Rga.Branding` (pure module): given a tier (`'free'` | `'pro'`), returns either `{ watermark, titlePageFooter }` decorations or `{}`. Print Preview optionally previews branding via a "Show export branding" toggle. Export ALWAYS applies branding per tier. Branding never participates in PageMap (does not consume line budget) — it's painted as overlay only.

### 3.7 Margin / profile layer

`doc.settings.pageSetup` continues to be the persisted shape. `Rga.ManuscriptGeometry.PRESETS` is the catalog. The Page Setup modal in `renderer/js/editor/page-setup-dialog.js` adds a **Preset** picker above the four margin inputs. Picking a preset writes the matching values into the four inputs *and* into `doc.settings.pageSetup.margins`. Editing any of the four values silently switches the preset label to "Custom." Custom is **visible but not selectable from the picker** in v1 — it is a *state*, not a *choice*.

---

## 4. Flow design

### 4.1 Continuous editor (no change)

`.rga-page` stays a single tall element. ProseMirror EditorView mounts inside it. Writer types continuously.

### 4.2 Real page-break markers (already exist; replace styling)

- **DOM contract:** same widget the nav-index plugin already emits. Possibly extend the dataset to carry both `data-page-number-ends` (= N) and `data-page-number-begins` (= N+1) so CSS can render both sides without engine work.
- **CSS contract:** replace today's `#editor-container.view-flow .rga-page-marker` rule (`editor-prosemirror.css:2030-2065`) with a two-line band:
    - Top half: right-aligned, muted, "Page N ends"
    - Gap: same desk-strip the current implementation has
    - Bottom half: left-aligned, calm, "Page N+1 begins"
- **No engine changes.** Widget data carries both numbers; CSS does the layout via `::before` / `::after`.

### 4.3 Page number bands

Already present (the widget text). v1 polish: bigger, more confident type for the boundary; less apologetic dashes.

### 4.4 Page-end awareness

Two cues:

- **Approaching page end (soft):** when `pagemap[currentPage].usedLines >= availableLines - 3` AND cursor is in the last block on that page, the gutter line at the cursor position gets a thin dark-pink (`--accent-rwanga`) tick. Implemented via flow-chrome's per-line gutter; one extra class on the line that matches. No new decoration system.
- **Last-line-on-page indicator (calm):** the last line on page N gets a `.rga-flow-page-end-line` class on its line-gutter entry. Subtle.

Both are **derived** from PageMap + flow-chrome; no schema change, no new plugin.

### 4.5 Last-line / next-page confidence

The boundary widget answers "where does N end / where does N+1 begin." Combined with the status-bar `Page X / Y` (already present), the writer always knows their location. This is the entire "export confidence in Flow" feature.

### 4.6 No fake decorative breaks

The `.rga-page-break` legacy CSS rules (Flow `:92-116`, Print `:53-64`) target a v2 PM node that no longer exists in v3. They survive as dead CSS. **Action in v1:** remove the dead rules (single CSS edit). The user-inserted manual page break concept is **out of scope for v1**; if revived later, the schema gains a `pageBreak` node and the CSS comes back targeted.

---

## 5. Print Preview design

### 5.1 Page stack

`#rga-print-preview-root` is a vertical flex column of `.rga-page-sheet` × N. Each sheet is `8.5in × 11in` (fixed; CSS rule 6 enforces this). Visible scroll. **No change to the structural rule** that one sheet = one PageMap page.

### 5.2 Fixed page dimensions

`width / height` are inline-style fixed; `overflow: hidden` per sheet. This is correct today; v1 confirms and codifies.

### 5.3 Margins

`padding: 1in 1in 1in 1.5in` on `.rga-page-sheet` (current CSS `:2168`). When margin presets change `doc.settings.pageSetup.margins`, the geometry contract must push the new padding to the sheet. **Today, sheet padding is hardcoded.** v1 connects it to `pageSetup.margins`.

### 5.4 Headers / footers

Today: `<div class="rga-page-sheet-header">N.</div>` top-right.

v1 adds:

- **Bottom-center page number** (optional via `opts.headerFooter`). For Hollywood convention, the top-right `N.` stays as primary; bottom-center is alt mode.
- **Running header** (optional): script title top-left in muted type. Source: `doc.metadata.title`.
- **Page 1 exception:** first page may suppress the page number (Hollywood convention). Default ON.

All header/footer rendering lives in `Rga.PrintRenderer._buildPageSheet` extension. No new modules.

### 5.5 Shadows / depth

Current shadow `0 6px 18px rgba(0,0,0,0.45)` is good. Gap between sheets `0.5in` (existing). v1 keeps both; adds a subtle inner bevel only if the design pass demands it (let the design pass call this, not the plan).

### 5.6 Scrollable pages

Existing. `overflow-y: auto` on the root. v1 adds **keyboard navigation**: Page Up / Page Down move sheet-by-sheet, Home/End jump to first/last sheet. Reuse `Rga.KeyboardRegistry`.

### 5.7 Exact export confidence

The acceptance rule: paint Print Preview into a hidden BrowserWindow and `printToPDF` it. The resulting PDF should match Print Preview pixel-for-pixel within sub-pixel rounding. **This is the v1 acceptance gate for Export, not a separate verification.**

### 5.8 Entry points (UI surfaces that today are missing)

Per correction B: **Ctrl+Shift+P is reserved for Command-Palette-style behavior and is NOT bound to Print Preview.**

- **File menu → Print Preview** (new entry, no accelerator in v1) — REQUIRED.
- **Status bar View dropdown** — convert the hidden disabled `printPreview` option into a live option — REQUIRED.
- **From Print Preview:** `Esc` deactivates and returns to prior view (already implemented in `Rga.PrintPreview.hide` via `_previousViewId`) — already works.
- **Optional shortcut:** may be proposed during Phase D execution (e.g. Ctrl+Shift+V for "View Preview" or no shortcut at all). Proposer must check `keyboard-registry.js` for conflicts and get user sign-off before binding. **Do not bind Ctrl+Shift+P.**

---

## 6. Margin tuning model

### 6.1 The four named presets

| Preset | Top | Bottom | Left | Right | Lines/page (Letter, Courier 12pt) |
|---|---|---|---|---|---|
| `normal` | 1.0″ | 1.0″ | 1.5″ | 1.0″ | 54 (Hollywood standard) |
| `compact` | 0.75″ | 0.75″ | 1.25″ | 0.75″ | 57 |
| `veryCompact` | 0.5″ | 0.5″ | 1.0″ | 0.5″ | 60 |
| `expanded` | 1.25″ | 1.25″ | 1.75″ | 1.25″ | 51 |

Numbers derived from `LayoutProfile._linesPerInch(12, 1.0) = 6 lpi × usable_h`. The math already exists; we add the catalog.

### 6.2 Custom

Custom is a **state**, not a preset. When the writer edits any of the four margin inputs, the picker shows "Custom" but does NOT add it to the picker's options list. To return from Custom, the writer picks one of the four named presets.

**Correction E (binding):** v1 ships **no custom-preset saving**. There is no "Save current margins as preset…" UI, no `doc.settings.pageSetup.customPresets[]` array, no per-user preset library. Custom values persist with the doc (via `doc.settings.pageSetup.margins`), but they are never promoted to a named preset. A future v2 may add a per-user preset library; v1 does not.

### 6.3 What CAN change

- The four margins (top / bottom / left / right) via preset or custom edit.
- Paper size (Letter / A4 / Legal) via the existing paper dropdown.
- (Out of scope for v1 of v1) Font size, font family. The model supports them in `LayoutProfile`, but the v1 UI exposes only paper + margins. Font tuning is a future "Typography presets" sub-feature.

### 6.4 What CANNOT change

- Per-block column widths (action 6″, character 3.5″ etc.) — these are anchored to the screenplay convention. Future Arabic / Kurdish profiles get their own preset bundle; not exposed as ad-hoc tuning.
- Leading (line height) — locked at 1.0 (single-spaced) for v1. Industry standard.
- The pagination algorithm (no splitting in V1; the brief explicitly defers this).

### 6.5 Recalculation contract

Changing any geometry input MUST re-run the pipeline immediately so Flow markers and the status-bar Page X / Y update on the same frame as the modal closes. Today this is a latent bug (see §1.5). v1 fixes it by having Page Setup modal dispatch a synthetic dispatchTransaction with `meta.geometryChanged = true` (or simpler: call `view.dispatch(view.state.tr.setMeta('forceReindex', true))`). The nav-index plugin's `apply` hook ignores `tr.docChanged === false` today; v1 amends it to also re-run if `tr.getMeta('forceReindex')`.

---

## 7. Branding / export model

### 7.1 Manuscript rules

PageMap pagination is the manuscript. Manuscript rules NEVER reference branding, tier, or watermark — they describe lines, columns, blocks. Pure typography.

### 7.2 Title page

A title page is **optional** and lives OUTSIDE the manuscript PageMap. It is page 0 (not counted in `Page X / Y`). Rendered by Print Preview when `doc.settings.titlePage.enabled === true`, populated from `doc.metadata.title`, `doc.metadata.author`, `doc.metadata.contact`. Title-page settings are a new `doc.settings.titlePage` block; default disabled.

### 7.3 Metadata

`doc.metadata` already carries `title`, possibly `author`, `screenplayProfile`. v1 confirms a stable contract for what Print Preview / Export consume.

### 7.4 Rwanga branding

A `Rga.Branding` module that returns DOM decorations the renderer paints. Free tier: footer line "Made with Rwanga" + a subtle wordmark on the title page (when title page enabled). Pro tier: empty (no branding).

### 7.5 Watermark / future pro branding

A semi-transparent diagonal `Rwanga` watermark overlay on each page of the **exported PDF on free tier** (Print Preview shows it too with a toggle). Implementation: SVG overlay or CSS pseudo-element on `.rga-page-sheet`. Pro: no watermark.

### 7.6 Export templates

v1 ships exactly two export configurations:

- **Standard:** title page off, header `N.` top-right, footer empty, branding per tier.
- **Minimal:** title page off, no page numbers, no branding (Pro only).

Future templates (Hollywood, Industry, Submission-ready) drop in as new entries; they share the renderer.

---

## 8. Implementation phases

Each phase is independently testable and produces a working state. Acceptance gates are codified in §10. **Build risk-first**: the parts most likely to surprise us go first.

### Phase A — Forensic geometry audit (this plan + commit acceptance)

- [ ] **A.1** Confirm the audit in §1 against current code (this plan IS the artifact).
- [ ] **A.2** Run `node --test rwanga-editor/tests/unit/**/*.test.js` against `f837ed8e`; capture current test count (handoff says 879).
- [ ] **A.3** Author + apply user-facing **Stop-Point Register** (one document) listing all current "ghost" features (PrintPreview unreachable, exportPdf unwired, Page Setup hidden behind Ctrl+Shift+G, `.rga-page-break` dead CSS, manual page-break missing in v3) — explicit STOP gates per fix.
- [ ] **A.4** User signs off this plan. No code yet.

### Phase B — Manuscript geometry contract

- [ ] **B.1** Create `renderer/js/framework/manuscript-geometry.js`. Pure module. `resolve(doc)`, `PRESETS`, `applyPreset(doc, name)`, `presetOf(doc)`.
- [ ] **B.2** Tests: unit tests for each preset's math (linesPerPage); `applyPreset` writes the right margins; `presetOf` returns `'custom'` when margins don't match any preset.
- [ ] **B.3** No consumers wired yet — module exists in isolation.
- [ ] **B.4** Acceptance: tests pass; no existing test regresses; no visible runtime change.

### Phase C — Flow page-break markers from real PageMap (presentation only)

- [ ] **C.1** Extend the widget DOM in `nav-index.js:_buildPageMarkerWidget` to carry both `data-page-number-ends` and `data-page-number-begins`. Engine + DOM only.
- [ ] **C.2** CSS rewrite `editor-prosemirror.css:2030-2065` to render the two-line "Page N ends / Page N+1 begins" band. Same widget pipeline.
- [ ] **C.3** Add "approaching page end" cue in `flow-chrome.js` — soft pink tick at the cursor line when within 3 lines of budget. Reuse existing gutter.
- [ ] **C.4** Delete dead `.rga-page-break` CSS in Flow + Print sections.
- [ ] **C.5** Acceptance: Flow visually distinguishes "this is page 3 ending → page 4 beginning"; markers move when geometry changes; status bar Page X / Y matches what Flow shows.

### Phase D — Print Preview page-stack restoration

- [ ] **D.1** Add Print Preview entry points: File menu entry (no accelerator) + status-bar dropdown live option. Command-palette entry optional. **Ctrl+Shift+P stays unbound — reserved for Command Palette per correction B.**
- [ ] **D.2** Connect `.rga-page-sheet` padding to `doc.settings.pageSetup.margins` (the hardcoded 1in/1.5in goes away).
- [ ] **D.3** Add bottom-center page number (opt-in via `Rga.PrintPreview.options.footerStyle`).
- [ ] **D.4** Add running header (opt-in, top-left script title).
- [ ] **D.5** Add Page-Up / Page-Down sheet navigation via `Rga.KeyboardRegistry`.
- [ ] **D.6** Acceptance: Print Preview is reachable from three surfaces; sheet padding follows margins; sheet count matches `Rga.PageMap.build(...).length` exactly; Esc returns to prior view.

### Phase E — Margin presets

- [ ] **E.1** Wire `Rga.ManuscriptGeometry.PRESETS` into `page-setup-dialog.js`. Add a preset `<select>` above the four margin inputs.
- [ ] **E.2** Picking a preset fills the four inputs. Editing any input switches the picker label to "Custom" (not selectable).
- [ ] **E.3** On Apply, dispatch `forceReindex` meta so PageMap recomputes immediately. (Fix the latent §1.5 bug.)
- [ ] **E.4** Promote Page Setup to the File menu (`renderer-owned menubar` + `electron/menu.js`). Retain Ctrl+Shift+G as accelerator.
- [ ] **E.5** Acceptance: changing preset moves Flow markers, updates status-bar Page X / Y, and changes Print Preview sheet count — all on the same modal Apply.

### Phase F — Export / branding planning (no implementation)

- [ ] **F.1** Author a separate brainstorm + spec for Export (PDF / DOCX / TXT / MD), Title Page, Branding tier, and the IPC contract (`window.rwanga.export.pdf`). Output: `docs/superpowers/specs/2026-NN-NN-rwanga-export-and-branding-design.md`.
- [ ] **F.2** Stop. Export implementation is a separate plan and a separate session. v1 of Manuscript v1 does NOT ship Export.
- [ ] **F.3** Acceptance: spec exists and is reviewed; the IPC contract is named; the branding-by-tier table is locked.

### Phase G — Lock Manuscript v1

- [ ] **G.1** Tests: 879 + new tests all green.
- [ ] **G.2** Manuscript subsystem locked into a new memory entry `project_manuscript_v1_locked.md` (SHA + which surfaces are frozen).
- [ ] **G.3** Delete the transient `project_session_handoff_2026-05-18.md` per the transient-handoff convention.

---

## 9. Risks

### 9.1 PM editing vs pagination races

The nav-index plugin recomputes PageMap on every `tr.docChanged`. Burst typing → burst pagination. **Mitigation:** measure; if it stutters, debounce the *decoration emission* (the widget rebuild), not the pagination math. Today's PageMap is fast (no DOM); risk is low but unverified at scale.

### 9.2 Fake vs real page breaks (already mostly resolved)

Flow markers are PageMap-derived today. The v1 risk is the **legacy `.rga-page-break` CSS targeting a no-longer-existing PM node** — confusing for any maintainer. v1 deletes it (Phase C.4). If someone in the future re-adds a manual page break, they will design it intentionally, not stumble into dead CSS.

### 9.3 Page number drift

Flow's status bar reads `Rga.ScriptSession.currentPage`; Flow's marker widgets read PageMap directly. If these two snapshots are taken at different times, they can disagree by one page during a transaction. **Mitigation:** verify the ScriptSession update path is on the same `apply` cycle as the nav-index plugin. Likely fine; verify with a smoke test.

### 9.4 Performance

Each margin change re-runs the full pipeline. For a 120-page screenplay (~3,500 blocks), the cost is mostly Normalizer + PageMap arithmetic — no DOM. Should be sub-50ms. **Verify** with a large fixture before Phase E ships.

### 9.5 RTL / Kurdish / Arabic scripts

`LayoutProfile.compose` has the hook (`screenplayProfile.screenplayConvention`) but V1 hardcodes Hollywood. Flow CSS has `[dir="rtl"]` mirror rules (`:163-165`, `:846-848`). Print Preview today does NOT handle RTL — `.rga-page-sheet` `padding-left: 1.5in` is unconditionally wider. **Risk:** Arabic / Kurdish writers using Print Preview today see wrong-side binding margin. **Mitigation:** v1 mirrors padding in Print Preview for RTL — single CSS rule. Full RTL screenplay convention work is a separate plan.

### 9.6 Export mismatch

Without an export implementation in v1, the "Export Reality = PDF" doctrine is unverified. Phase F locks the spec; the actual mismatch risk lives in the Export-implementation plan, not here. **Plan accepts this.**

### 9.7 Margin hacking abuse

A writer could set margins to 0.1″ to fit 100 pages in 80. This is allowed (Custom exists). Industry-standard export templates ignore custom geometry — a future Export template "Submission-ready" silently snaps to `normal` regardless of doc settings. Tracked in the Export spec, not here.

### 9.8 Cross-platform paper conventions

Letter (US) vs A4 (Europe / world default). LayoutProfile already supports both. The default depends on locale. v1 keeps Letter as the in-repo default; honors `doc.settings.pageSetup.paperSize` if set. Locale-based default selection is a future preference.

### 9.9 Geometry contract drift

The new `Rga.ManuscriptGeometry` and the existing `Rga.LayoutProfile` overlap. **Mitigation:** ManuscriptGeometry is a thin shell around LayoutProfile; it does NOT duplicate compose logic. Tests pin this.

### 9.10 Print view ambiguity (Flow with paper labels) — RESOLVED via doctrine

Per correction C: **v1 keeps Print view; does NOT remove it.** Label doctrine is now binding:

- **Flow** = writing reality
- **Print Preview** = paper truth
- **Print** = reading mode / temporary legacy view

Print view stays as a low-cost "looks more print-like" reading mode. Print Preview is the *only* surface that previews export. Any future cleanup that proposes removing Print view must come back through brainstorming.

---

## 10. Acceptance gates

A phase ships when ALL its gates pass. v1 ships when all of these pass:

### 10.1 Pagination identity

- [ ] For any (doc, layoutProfile), `Rga.PageMap.build(...)` returns the same array regardless of which view consumes it.
- [ ] **Verification:** unit test runs PageMap on a fixture; Print Preview sheet count and Flow marker count both equal `pageMap.length`.

### 10.2 Flow page breaks match Print Preview

- [ ] For the fixture `tests/fixtures/playground-the-last-light.rga`, the blocks ending each Flow page band match the last block in the corresponding Print Preview sheet.
- [ ] **Verification:** test compares `pageMap[p].blocks[last]` → `RenderModel.pages[p].blocks[last].pmFrom`.

### 10.3 Print Preview matches export

- [ ] Deferred to Phase F + Export-implementation plan. v1 accepts this gate as "specified, not enforced." When Export ships, the gate becomes pixel-comparison of preview vs. exported PDF.

### 10.4 Margin changes recalculate pages

- [ ] Opening Page Setup → picking `compact` → Apply → Flow markers shift, status-bar Page X / Y updates, Print Preview sheet count changes — all on the modal close, with no requirement that the writer type a character.
- [ ] **Verification:** smoke test (manual, recorded). Latent §1.5 bug must be fixed.

### 10.5 Page count is stable

- [ ] For the same (doc, geometry) the page count does not flicker between transactions.
- [ ] **Verification:** smoke test (manual). The widget pipeline is idempotent per `apply`; if it isn't, find out why.

### 10.6 No fake page separators

- [ ] No CSS rule targets a PM node that doesn't exist in v3 schema.
- [ ] **Verification:** grep for `.rga-page-break` after Phase C.4; expect zero matches in Flow / Print sections.

### 10.7 No shell changes

- [ ] No commit in Phases B–E touches files under `renderer/js/shell/` other than `status-bar.js` (the dropdown live-option from §5.8) and `keyboard-registry.js` (any new shortcuts).
- [ ] **Verification:** git diff per phase; lock SHA reference is `f837ed8e`.

### 10.8 Reachability

- [ ] Print Preview is reachable from BOTH the File menu and the status-bar dropdown (both required per correction B).
- [ ] Page Setup is reachable from the File menu (in addition to Ctrl+Shift+G).
- [ ] **No new keybinding on Ctrl+Shift+P** (reserved for Command Palette per correction B).
- [ ] **Verification:** menu walkthrough; grep for `Ctrl+Shift+P` or `'p', { ctrl: true, shift: true` returns no Print-Preview binding.

### 10.9 Test count grows, never shrinks

- [ ] 879 (today) + N new tests; 0 regressions.
- [ ] **Verification:** `node --test rwanga-editor/tests/unit/**/*.test.js` clean.

### 10.10 Stop-Point Register honored

- [ ] Each "ghost feature" entry from Phase A.3 either gets fixed in v1 or is explicitly carried forward into a named follow-up plan.
- [ ] No silent abandonment.

---

## Open unknowns (to call out per brief)

1. **PageMap and ScriptSession sync window.** The widget pipeline and the status-bar page count both flow from `nav-index.js:_buildPluginState`. The bridge from PageMap → ScriptSession was not read in this session. If there is a frame of delay between the two, the writer sees Flow show "between pages" while status bar still says "Page 3 / 5" briefly. Verify in Phase C.
2. **Performance at 120+ pages.** PageMap is pure and fast; the Normalizer walks the full doc on every transaction. No measurement done. Verify in Phase C.
3. **Whether Print view stays.** It costs little but adds conceptual noise (Flow vs Print vs Print Preview). v1 keeps it; v2 may collapse it.
4. **Title page model.** `doc.metadata` does not today have a stable `titlePage` block. The shape `{ enabled, author, contact, dedication }` is proposed in §7.2 but not locked. Defer to Phase F spec.
5. **Branding watermark technique.** SVG overlay vs CSS pseudo-element vs DOM injection — choose in Phase F spec, not here.
6. **Export-format priority.** Brief mentions PDF / DOCX / TXT / MD. v1 + Phase F target **PDF only**. Other formats are explicitly deferred. User should confirm this scoping.
7. **Manual page break (v3 schema).** Out of v1 scope. If needed, will require a v3.1 schema migration. The dead CSS is removed in Phase C.4 regardless.
8. **RTL Print Preview.** Single-CSS-rule mirror in Phase D may not cover all edge cases (e.g., Arabic-numeric vs Hindi-numeric page numbers). Verify with a Kurdish-language fixture if one exists; otherwise log and ship the LTR-correct version.
9. **macOS native menu surface.** Print Preview menu entry must go to BOTH `electron/menu.js` (macOS) and the renderer-owned menubar (Windows / Linux). Owners differ; both must be synced.
10. **Locale default for paper size.** Letter (US) is the in-repo default. Whether to switch to A4 based on `app.getLocale()` is a UX question, not a manuscript-engine question — defer to a UX cycle.

---

## Self-review (per writing-plans skill)

**Spec coverage** — every section of the user's brief maps to a numbered section above (§1 → user's #1, §2 → #2, etc.). No gaps.

**Placeholder scan** — no "TBD," "implement later," or "TODO." Every Phase A–G item is concrete enough to execute. Phase F is intentionally "produce a spec, do not implement" — explicit, not a placeholder.

**Type / name consistency** — the new module is consistently `Rga.ManuscriptGeometry` everywhere. The existing modules retain their names (`Rga.PageMap`, `Rga.PrintPreview`, etc.). The widget data attribute is consistently named in §4.2 and §C.1 (`data-page-number-ends` / `data-page-number-begins`).

**Realism check (per brief)** — three findings I want to flag the user on:

- The brief says "Flow must show meaningful page breaks, not fake decorative separators." Flow's markers today already ARE PageMap-derived (real). The work is to make them *feel* more like real page boundaries, not to invent the boundaries themselves. The plan reflects this.
- The brief asks for export confidence. Export is unimplemented. The plan honestly carves Export out into Phase F (spec only) and a follow-up plan. v1 ships the *preview* side of confidence; the *exported file* side ships next.
- The brief asks for "small slices, no giant rewrite." Phases B–E are each 1–2 days of focused work; Phase A is 0 days (this plan + sign-off); Phase F is spec-only. No phase is a rewrite.

---

## What this plan does NOT do

- No code is written.
- No CSS is changed.
- No tests are added.
- No menu entries are added.
- No memory entries are created or modified.
- No commits.
- No PRs.
- The shell at `f837ed8e` is not touched.

This is the read of current manuscript reality and the proposed map of the territory. The user reviews; if approved, the implementation sessions execute Phases B–E + the Phase F spec-author session.

---

## Reading order for the next agent (when execution begins)

1. This plan, top to bottom.
2. `renderer/js/framework/pagemap-engine.js` (the authority).
3. `renderer/js/framework/layout-profile.js` (the geometry math).
4. `renderer/js/framework/nav-index.js` (the widget emitter).
5. `renderer/js/framework/print-preview.js` + `print-renderer.js` (the per-sheet renderer).
6. `renderer/css/editor-prosemirror.css` lines 2004–2188 (the manuscript CSS surface).
7. `renderer/js/editor/page-setup-dialog.js` (the only writer-facing geometry surface today).

Memory entries to read before starting Phase B:

- `project_session_handoff_2026-05-18.md` (transient — read first; delete after first session progresses).
- `reference_ide_key_files.md` (note: stale on test count; verify).
- `project_ide_renderer_portable.md` (the renderer must stay cross-platform).
- `project_ide_save_vs_export.md` (export is a separate verb).

---

*End of plan.*
