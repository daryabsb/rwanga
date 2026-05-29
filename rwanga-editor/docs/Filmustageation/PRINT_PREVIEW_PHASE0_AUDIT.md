# Rwanga — Print Preview Phase 0 Forensic Audit

> **Audit only. No implementation, no schema changes, no commit, no fixes.**
> Created: 2026-05-29 · HEAD: `f0149534` (Print-Bundle-1 landed; PDF pipe functional underneath).
> Purpose: inventory the current Print Preview surface so the designer can lead a proper redesign **before** any further export-workflow work.

---

## 0. Why this audit exists — the workflow correction

The export campaign was heading toward the wrong product shape:

```
Flow Editor → Export PDF          ❌  (what was being built)
```

The intended workflow is:

```
Flow Editor → Print Preview → Review Actual Pages → Export PDF   ✅
```

**Print Preview is not an implementation detail. It is a first-class Filmustageation surface.** The director/writer must review the real page output — the screenplay *package* — before any export or print happens. Export and Print become actions *inside* the review surface, not standalone menu verbs.

This audit answers six questions, evidence-first:
1. What Print Preview already has.
2. What is missing.
3. What can be reused.
4. What must be redesigned.
5. Which parts belong to designer direction.
6. Which parts belong to engineering.

It makes **no design decisions** and proposes **no fixes**. It is the hand-off package for the designer.

### Files inspected (evidence base)

- `renderer/js/framework/print-preview.js` — the PrintPreview controller (full API read).
- `renderer/js/framework/print-renderer.js` — RenderModel → page-sheet DOM.
- `renderer/js/framework/render-model.js` — page model (`totalPages`, per-page blocks, `title`).
- `renderer/js/framework/view-manager.js` — view-mode lifecycle (mutual exclusion).
- `renderer/js/framework/paper-view.js` — the in-Flow paper surface (sibling renderer consumer).
- `renderer/js/framework/layout-profile.js` + `manuscript-geometry.js` — page-size / margin truth.
- `renderer/js/shell/script-session.js` — writer-context truth, incl. `currentPage` derivation.
- `renderer/css/editor-prosemirror.css` (≈ L2068–2335) — Print Preview + sheet CSS.
- `renderer/index.html` — view-mode wiring, status-bar dropdown, menu definitions.
- `electron/menu.js` — native menu Print Preview entries.
- `tests/unit/framework/print-preview-phase-d.test.js`, `print-preview-integration.test.js` — the contracted behaviour.

---

## 1. What Print Preview already HAS

| Capability | State | Evidence |
|---|---|---|
| **Controller with view lifecycle** | Real. Registered with `ViewManager` as view id `printPreview`, body class `view-print-preview-active`. `show()/hide()/isActive()/open()/refresh()/buildModel()/setOptions()/getOptions()`. Restores the prior view (Flow/Draft) on close. | `print-preview.js:36-283` |
| **Pure rendering pipeline** | Real, well-tested. `buildModel(view)` runs Normalizer → ManuscriptGeometry.resolve → PageMap → RenderModel; `PrintRenderer.render` paints **one `.rga-page-sheet` per PageMap page**. Never measures DOM. | `print-preview.js:113-137`, `print-renderer.js:47-63` |
| **Per-sheet page identity** | Real. Each sheet shows a top-right `"N."` manuscript page number, positioned inline from `layoutProfile.margins`. | `print-renderer.js:123-132` |
| **Page-size / margin truth** | Real. Sheet width/height/padding written inline from `layoutProfile.pageSize` + `margins` (Letter/A4/Legal each correct). RTL mirrors padding + page-number to the binding side. | `print-renderer.js:89-131`, `print-preview-phase-d.test.js` P0.1/P0.2 |
| **Keyboard page scroll** | Real but invisible. `PageDown`/`PageUp` scroll one sheet via `_scrollByOneSheet`, gated on `isActive()`. | `print-preview.js:199-245` |
| **Esc to exit** | Real. Registered on `show()` (last-wins), unregistered on `hide()`; returns to prior view. | `print-preview.js:247-270` |
| **Refresh on geometry change** | Real. `refresh()` re-renders an open preview after Page Setup changes; no-op when closed; exactly one render, no duplicate root. | `print-preview.js:161-175`, phase-d Step 8 tests |
| **Optional footer / running header** | Real but opt-in & off by default. `setOptions({footerStyle:'bottom-center', headerStyle:'running'})`; running header reads `doc.metadata.title`. | `print-preview.js:43-45,183-190`, `print-renderer.js:134-178` |
| **Three entry points** | Real. File menu, View menu (`view.printPreview`), and the status-bar view-mode dropdown `printPreview` option (calls `PrintPreview.open()`, not `ViewMode.set`). | `menu.js:42,75`, `index.html` MENU_DEFS, phase-d D.1 dropdown tests |
| **RTL fidelity** | Real. `dir="rtl"` on sheets; RTL font chain + margin mirror reach the preview. | `print-renderer.js:85-87`, `editor-prosemirror.css:2224` |
| **Page-awareness DATA layer (not surfaced)** | Real but unused by Print Preview. `RenderModel.totalPages` exists; `Rga.Nav.getPageMap()` gives page count; `Rga.Nav.getIndex().pages[]` gives per-page `{pageNumber, sceneIds}`; `ScriptSession.currentPage` already derives `{number, total}` from cursor → scene → page. | `render-model.js:78`, `script-session.js:165-180` |
| **PDF pipe underneath** | Functional (Print-Bundle-1). `Rga.PdfExport.run()` → offscreen render → `printToPDF`. Verified end-to-end via probes. Currently a standalone menu verb, **not** wired into the preview surface. | `renderer/js/export/pdf-export.js`, `electron/bridge/export-pdf.js` |

---

## 2. What is MISSING

The defining gap: **Print Preview today is a bare stack of paper sheets on a dark overlay, with zero chrome.** While it is active, the status bar and all shell chrome are CSS-hidden (`editor-prosemirror.css:2184-2194`), so the writer has **no visible controls at all** — only Esc and (undiscoverable) PageUp/PageDown.

Against the target "page review workflow", these are absent:

| Missing capability | Notes |
|---|---|
| **Print-preview-specific toolbar** | No chrome inside the preview. Nothing to host any control. This is the central missing piece. |
| **Visible page-count awareness** | `totalPages` and current-page data exist but are never shown. No "Page 3 of 12" anywhere in the preview. |
| **Current-page indicator while scrolling** | No tracking of which sheet is in view → no "you are on page N" as the writer scrolls. (`_scrollByOneSheet` computes a current index internally but never reports it.) |
| **Previous / next page buttons** | Only keyboard PageUp/PageDown; no on-screen affordance. |
| **Page jump / go-to-page** | No "jump to page N" control. |
| **Zoom / fit-to-width / fit-to-page** | Sheets render at fixed inch dimensions; no zoom, no fit. Large paper can overflow horizontally with only scroll. |
| **Thumbnail / page-strip navigation** | No overview rail of pages. |
| **Export from within Print Preview** | Export is a separate menu command; not an action in the review surface. |
| **Print from within Print Preview** | No print action at all (no `window.print()`, no native print path — see Print/Export audit §5). |
| **Title page in the reviewed package** | `titleStrip` is an in-flow body block, not a cover sheet (Print/Export audit §3.2). The reviewed package has no industry title page. |
| **MORE / CONT'D dialogue continuation marks** | Not emitted (Print/Export audit §3.3). |
| **Scene-number / revision-mark gutters** | Persisted flags exist; preview does not render them (Print/Export audit §3.4–3.5). |
| **Screenplay "package" review framing** | No concept of reviewing the deliverable as a package (title page → body → optional sides/scene-number draft). Today it is body sheets only. |

---

## 3. What can be REUSED (as-is, no redesign)

These are sound and should be the foundation — the redesign builds chrome *around* them, not instead of them:

- **The entire pure pipeline**: Normalizer → `ManuscriptGeometry.resolve` → `PageMap` → `RenderModel` → `PrintRenderer`. Single source of page truth; never measures DOM. (`print-preview.js:113-137`)
- **`ViewManager` lifecycle** — mutual-exclusion, body-class side-effect, `onChange` subscription, re-activation = re-render. (`view-manager.js`)
- **`RenderModel.totalPages`** — page count, already computed. (`render-model.js:78`)
- **`nav-index` page data** — `getPageMap()` (count) + `getIndex().pages[]` (`{pageNumber, sceneIds}`); one PageMap per document, shared with the editor. (consumed at `script-session.js:167-178`)
- **`ScriptSession.currentPage`** — `{number, total}` derivation from cursor position; subscribable; calm (only notifies on change). A ready-made data feed for a page indicator. (`script-session.js:165-180`)
- **`_scrollByOneSheet(direction)`** — sheet-by-sheet scroll mechanics + current-sheet index computation (no `getBoundingClientRect`). (`print-preview.js:199-227`)
- **`refresh()`** — re-render-on-change contract, proven single-render / no-duplicate-root. (`print-preview.js:161-175`)
- **`setOptions/getOptions`** — extensible per-render options channel (footer/header today; could carry future review toggles). (`print-preview.js:183-190`)
- **`PrintRenderer` inline geometry + RTL mirror** — paper-size truth + binding-side correctness. (`print-renderer.js:89-131`)
- **The PDF pipe** — `Rga.PdfExport.run()` works end-to-end; can be invoked from a future in-preview Export action without backend changes.
- **`PaperView`** — sibling read-only renderer (in-Flow paper feel) sharing the same `PrintRenderer`; precedent for a second consumer of the pipeline. (`paper-view.js`)

---

## 4. What must be REDESIGNED

Structural decisions the current architecture forces open:

1. **Print Preview has no chrome host.** It is a fixed dark overlay (`#rga-print-preview-root`, `position:fixed; inset:0; z-index:9000`, `editor-prosemirror.css:2169-2181`) containing only sheets. A review surface needs a persistent frame (toolbar / rail / status) that is *not* one of the scrolling sheets. **Where that chrome lives and how it coexists with the sheet stack is a redesign, not an addition.**

2. **All shell chrome is hidden while active** (`:2184-2194`), including the status bar that elsewhere shows page count. So the preview cannot borrow existing chrome — it must own its own. Decision: does Print Preview keep *some* shell chrome, or fully own a bespoke review chrome?

3. **"View mode" vs "review surface".** Print Preview is modeled as a peer view mode (Flow/Draft/Print/PrintPreview) entered via the same dropdown. A first-class review *workflow* may want a different shell relationship (e.g. a dedicated workspace-like surface, its own toolbar row, its own lifecycle). This is a Shell-doctrine question (cf. `[[project_shell_doctrine_tab_kinds]]`).

4. **Entry/exit model.** Today: enter via 3 menus/dropdown, exit only via Esc. A review workflow likely wants explicit, visible enter/exit and an explicit "Export"/"Print" exit-with-action. Redesign needed.

5. **Export/Print belong inside the surface.** The whole point of the correction: export is downstream of review. The standalone `file.exportPdf` menu verb and `kb.exportPdf` shortcut must be re-framed as actions *within* Print Preview (the menu verbs can remain as shortcuts that route *through* the surface).

6. **The reviewed artifact is incomplete as a "package".** No title page, no continuation marks, no scene-number/revision gutters. Whether the review surface reviews the *current* (body-only) output or a *fuller package* is a product decision that changes what gets rendered.

7. **Zoom / fit / large-paper handling.** Fixed-inch sheets on a fixed overlay have no zoom; the review experience for A4/Legal/landscape and small screens is undefined.

---

## 5. Which parts belong to DESIGNER direction

The designer owns the *experience and presentation* of the review surface. None of these should be engineer-invented (per the Settings Constitution design-freeze precedent, `[[project_settings_constitution]]`):

- **Review-surface chrome anatomy** — is there a top toolbar, a side rail, a bottom bar, or a combination? Visual language, density, iconography.
- **Page navigation affordances** — prev/next buttons, page-jump control shape, current-page indicator presentation ("Page 3 / 12"), keyboard hint discoverability.
- **Thumbnail / page-strip** — whether it exists, where it sits, how it behaves.
- **Zoom / fit controls** — presence, control type (slider? fit buttons?), default behaviour.
- **Placement of Export & Print actions** — where the buttons live in the surface, labels, confirm/options affordances (the earlier "export options dialog" question is now *the designer's* to answer, in context).
- **The "screenplay package review experience"** — what the writer/director sees and in what order (title page? sides? scene-number draft toggle? revision color?), framed as reviewing a deliverable.
- **Enter / exit gestures and their visual treatment.**
- **Overall visual treatment** — the dark overlay, paper shadow, spacing, "table read / lock review" mood.
- **RTL presentation of all chrome** (the sheets already mirror; the chrome must too).

---

## 6. Which parts belong to ENGINEERING

Engineering wires behaviour behind whatever the designer specifies — no invented chrome, badges, or hierarchy:

- **Surface a chrome host** inside/around `#rga-print-preview-root` per the designer's layout, without breaking the sheet-stack render or the `view-print-preview-active` hide rules.
- **Wire page count + current page** from existing data (`RenderModel.totalPages`, `nav-index` pages, `ScriptSession.currentPage`) into the designer's indicator. No new pagination logic.
- **Scroll-position → current-page tracking** — extend `_scrollByOneSheet`'s existing current-index computation to *report* the active sheet as the writer scrolls (already DOM-measurement-free).
- **Prev/next/go-to-page** — scroll-to-sheet using existing `scrollIntoView` mechanics + `data-page-number` anchors.
- **Export-from-preview / print-from-preview invocation** — route the designer's buttons to `Rga.PdfExport.run()` (works today) and to a print path (needs the deferred `@media print` / native print slice — flag, don't assume).
- **Zoom/fit transform** — apply a CSS transform/scale to the sheet stack per the designer's control; keep inch-truth intact (scale is presentation only, must not feed back into PageMap).
- **Refresh integrity** — keep `refresh()` single-render and the single-source-of-truth contract with PageMap when chrome state changes.
- **Performance** — large scripts (100+ sheets); thumbnails/virtualization if the designer asks for a page strip.
- **Keyboard registry integration** — new controls must register through `Rga.KeyboardRegistry` (last-wins, `when` predicates), consistent with existing Esc/PageUp/PageDown.
- **Tests** — each behaviour ships owned unit + Playwright coverage (slice doctrine).

---

## 7. Binding constraints the redesign must honour

- **Flow continuous-drafting doctrine** (`[[project_flow_continuous_doctrine]]`) — page truth lives in Print Preview, NOT in Flow. This redesign is the *correct* home for paginated review; it must not leak page seams back into Flow.
- **Single-resolver page truth** — all geometry flows from `ManuscriptGeometry.resolve` → `LayoutProfile.compose`; preview and any future consumer must not diverge (S8 rule).
- **No DOM measurement** in the pipeline (Phase 7 rule) — current-page tracking must stay measurement-free (use `offsetTop`/scroll math as `_scrollByOneSheet` already does, not `getBoundingClientRect`).
- **ViewManager mutual exclusion** — exactly one view active; Print Preview must continue to restore the prior view on exit.
- **Settings Constitution design-freeze** (`[[project_settings_constitution]]`) — engineers wire behaviour; designers own all chrome/visual/hierarchy decisions. No engineer-invented toolbars or badges.
- **Shell Doctrine — Tab Kinds** (`[[project_shell_doctrine_tab_kinds]]`) — if Print Preview becomes more workspace-like, reconcile with document-vs-workspace tab semantics before building.
- **Deferred dependencies** — title page, MORE/CONT'D, scene-number/revision gutters, native print/`@media print` are each separate slices (Print/Export audit §7); the review surface may *expose* them but must not silently assume them.

---

## 8. Open questions for the designer hand-off

1. Is Print Preview a **peer view mode** (as today) or a **dedicated review surface/workspace** with its own shell relationship?
2. Does it review the **current body-only output** or a **fuller package** (title page, sides, scene-number draft)?
3. Where do **Export** and **Print** actions live, and do they open options or go direct?
4. What chrome layout (toolbar / rail / strip) and what navigation controls?
5. Zoom/fit behaviour and default?
6. How is RTL chrome handled?

---

# STOP

Audit + inventory only. No code edited, no schema changed, no fixes applied, no commit created. Next step: hand this document to the designer and design the Print Preview review surface before resuming any export-workflow implementation.
