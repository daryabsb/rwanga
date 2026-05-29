# Print Preview — Review Surface UX Direction

> **Direction only. No implementation, no CSS patch, no engineering plan.**
> Created: 2026-05-29 · Surface: Print Preview (`#rga-print-preview-root`, ViewManager `printPreview`)
> Grounded in: `PRINT_PREVIEW_PHASE0_AUDIT.md`, `Filmustageation UX Direction.html`, Rwanga design foundation + shell docs, the working render pipeline (`print-preview.js` / `print-renderer.js` / `render-model.js`) and PDF pipe (`Rga.PdfExport.run()`).

---

## The correction this surface exists to serve

The wrong shape was being built:

```
Flow Editor → Export PDF          ✗
```

The right shape:

```
Flow Editor → Print Preview → Review the real pages → Export PDF / Print   ✓
```

**Print Preview is not an implementation detail. It is a first-class review surface — the gate before export.** The director/writer sees the screenplay as a *package* — real pages, real geometry — and only then ships it. Export and Print are actions that live *inside* this surface, not standalone menu verbs that bypass review.

The audit's finding sharpens the brief: the pages are already real. The pipeline (Normalizer → ManuscriptGeometry → PageMap → RenderModel → PrintRenderer) paints one inch-true `.rga-page-sheet` per page, mirrors correctly for RTL, and the PDF pipe works end-to-end underneath. What's missing is **the room around the pages** — today Print Preview is a bare stack of sheets on a dark overlay with *zero* visible chrome, controllable only by Esc and undiscoverable PageUp/PageDown. This document designs that room.

---

## 1. Overall Review-Surface Identity

**The page, held up to the light.** Print Preview is the moment the draft stops being editable text and becomes a *deliverable* — the room you step into to review the package before it leaves your hands. Its closest real-world analogue is the lock review at a production office: the script held up, read as pages, checked before it's sent out.

- **A surface you enter, not a panel you toggle.** Crossing into Print Preview should feel like a deliberate shift of mode — the writing chrome recedes, the pages take the stage. This is reverent, full-attention review, not a glance.
- **Read-only by nature.** Nothing here edits the script. That frees the surface to be calm: no dirty state, no save anxiety, no inline editing. You look, you navigate, you ship or you step back.
- **Architecturally, keep it a ViewManager peer mode** (mutual exclusion, restores the prior view on exit) — but **dress it as a first-class surface** with its own bespoke chrome. The audit's open question ("peer view mode vs. dedicated workspace") should be answered *conservatively for now*: do not reopen the Shell-doctrine tab-kinds relationship in this arc. Own the chrome; keep the lifecycle simple.
- **Three things it must never be:** a browser print dialog (no system Destination/Pages/Layout sidebar), a generic OS print panel, or a dashboard (no stat tiles, no metadata panels). It is a screenplay page-review surface — the page is the hero and the chrome whispers.

---

## 2. Top Toolbar / Toolbox Anatomy

The single most important missing piece is a **persistent chrome host that is not one of the scrolling sheets.** The direction: **one slim top review bar**, floating above the sheet stack, always present.

Why a top bar (not a side rail, not a bottom bar) as the primary chrome: the page-review mental model is "the page in front of me, controls up and out of the way." A top bar keeps the sheets centered and uninterrupted, reads as the surface's title/command strip, and mirrors cleanly for RTL. (A side rail is reserved for the *optional* thumbnail strip — §8.)

**Three zones, reading inline-start → inline-end (LTR):**

```
┌────────────────────────────────────────────────────────────────────────────┐
│  ← Done   The Collector · Letter · 12pp   │  ‹  3 / 12  ›  ⤢ Fit  − 100% +  │  ⬇ Export PDF   ⎙ Print │
└────────────────────────────────────────────────────────────────────────────┘
   CONTEXT / EXIT                              NAVIGATION + ZOOM (center)          OUTPUT (commit)
```

- **Context / Exit (inline-start):** the visible exit (§6) and the package identity — script title, page size, total page count (`The Collector · Letter · 12 pp`). This zone answers "where am I and what am I reviewing."
- **Navigation + Zoom (center):** the page-navigation cluster (§3) and the zoom/fit cluster (§4). The functional heart of the bar.
- **Output / Commit (inline-end):** Export PDF and Print (§5) — the terminal actions, the only visually weighted elements in the entire surface.

**Treatment.** Calm, dark, thin — built from the shell's chrome tokens (`--statusbar-bg` family, not accent fills), with quiet vertical separators between zones. Utility density (tight, like the status bar). Not a ribbon, not a floating island of buttons. It is always visible — hiding it would repeat today's "no visible controls" failure — though it may dim slightly when the pointer is idle over the pages.

---

## 3. Page Navigation

All of this is backed by data that **already exists** (`RenderModel.totalPages`, `ScriptSession.currentPage {number,total}`, and `_scrollByOneSheet`'s internal current-index computation that is simply never reported). The design surfaces what the engine already knows.

- **Current-page indicator — the awareness anchor.** A monospaced `3 / 12` at the center of the bar. It updates *live as the writer scrolls* — the audit notes the current-sheet index is computed but never reported; surfacing it is the point. This is the "you are on page N of the package" signal, and it is the navigation cluster's gravitational center.
- **Previous / next.** Quiet chevrons flanking the indicator (`‹ 3 / 12 ›`), each scrolling one sheet via the existing `_scrollByOneSheet`. PageUp/PageDown keep working and gain a discoverable hint.
- **Page count.** The `/ 12` — `RenderModel.totalPages`. One honest total, never a guess.
- **Jump to page.** The current-page number *is* the jump control: click it, it becomes a small mono input, type `7`, Enter → scroll to page 7. No separate modal, no go-to dialog — the indicator and the jump are the same object. Esc cancels the edit.
- **Keyboard.** PageUp/PageDown (sheet-by-sheet, existing), Home/End to first/last sheet, and the jump field for direct access. Surface these as a quiet, discoverable hint — today they are invisible.

> **Direction.** Page awareness is the difference between "a stack of paper" and "a reviewable package." The indicator is not decoration; it is the surface's spine. It must be live, monospaced, and always legible.

---

## 4. Zoom / Fit

The sheets render at fixed inch dimensions; large paper (A4, Legal, landscape) and small screens can overflow with only horizontal scroll. Fit modes solve this — and they frame *how* the page is reviewed.

- **Fit page — the default on entry.** A director reviewing wants to see the *whole page as a page* — composition, white space, where scenes break. Entering the surface should land on Fit page, the entire sheet visible.
- **Fit width — the reading mode.** Fills the horizontal space to read dialogue and action at a comfortable size, scrolling vertically through the package. The second primary control.
- **Zoom in / out — secondary inspection.** A `−  100%  +` stepper with a percentage readout, for checking detail. A stepper + readout is right; a continuous slider is dashboard-y overkill for this surface.
- **One hard constraint:** zoom and fit are **presentation transforms only** (CSS scale on the sheet stack). They must *never* feed back into PageMap or inch-truth. The page geometry is the single source of truth (single-resolver doctrine); zoom changes how big the page looks, never what the page *is*.

---

## 5. Export / Print Actions

These are the reason the surface exists as a gate — export is *downstream of review*. They live in the **output zone (inline-end)** of the top bar, the natural commit edge, and they are the only "loud" elements in an otherwise quiet surface.

- **Export PDF — primary, weighted.** A filled accent button (the screenplay-gold or interaction accent — the one place a confident fill belongs). It routes to the working `Rga.PdfExport.run()` pipe — no backend change needed.
- **Direct or options? A light review-aware popover — not a modal, not silent.** A one-tap silent export would undercut the entire "review first" correction; a heavy generic export modal would turn the surface into the print dialog the brief forbids. The answer between them: Export PDF opens a **compact options popover anchored to the button** — filename, page range, and a place that *grows* as package features land (include title page, scene-number draft, revision color — all deferred, §12/§14). For now the popover is small (it has few live options); it is designed to expand gracefully, not rebuilt later. The confirm is an explicit "Export."
- **Print — present the slot, defer the wire.** Print sits beside Export as a sibling output action, but the audit flags that the native print / `@media print` path is a *deferred slice*. So Print appears in the design with a reserved slot and is explicitly **shown-but-deferred** (disabled/"coming" until the print slice lands). Design the home; do not assume the pipe.
- **Feel.** Calm everywhere, deliberate here. These buttons carry the weight of "the review is done; ship it." Their prominence is earned by being the only commitment in the room.

---

## 6. Exit / Back-to-Editor

Today the only exit is Esc — invisible and undiscoverable. The surface needs an explicit, visible way out.

- **A visible exit in the context zone (inline-start):** a `← Done` / `← Editor` affordance (label + arrow reads clearer than a bare ✕ for "step back to where I was writing"). Keep Esc as the keyboard path.
- **Returns to the prior view exactly.** ViewManager restores Flow/Draft and the writer's cursor and scroll position — stepping out of the review room lands you precisely where you left writing. This restoration is already implemented; preserve it.
- **Instant and safe.** Because the surface is read-only, exit needs no confirmation, no "discard?" prompt. It is a frictionless step back.

---

## 7. Page Review Atmosphere

This is the surface's soul: **calm, director-ready, reverent toward the page.**

- **Paper on a warm-dark field.** The existing dark overlay is right — but warm-dark, matching Rwanga's writing-environment philosophy, never cold institutional black. The sheets are the only bright objects; everything else recedes.
- **Real paper presence.** A soft, realistic page shadow gives the sheet physical weight. This is the *one* place Rwanga's no-shadow philosophy is rightly suspended — the surface is depicting paper, a real object held up for review; the shadow is representational, not decorative.
- **Generous rhythm, centered column.** Comfortable space between sheets, the stack centered, the page given room to breathe. The per-sheet manuscript page number (`N.`, top-right, already rendered) stays — it is correct screenplay convention.
- **The mood is "table read / lock review,"** not "edit," not "configure," not "browser preview." Quiet enough that the writer can *read* the pages and trust what they see is what ships.

> **Direction.** Every chrome decision is judged against one question: does the page still feel like the hero? If a control, a panel, or an option makes the chrome compete with the paper, it is wrong for this surface.

---

## 8. Optional Page Thumbnails / Page Strip

**Yes — but as an optional, collapsible left rail, and deferred past the first bundle.**

- **Where:** a narrow vertical rail on the inline-start edge, holding mini-sheets with page numbers; click to jump, current page highlighted. This is the *only* side-chrome the surface has, and it is reserved for this.
- **Off by default.** The page is the hero; the strip is a power tool for orientation in long packages (100+ pages). Toggle it from the top bar.
- **Deferred, by necessity.** A thumbnail rail needs render-to-thumbnail and virtualization for long scripts (the audit flags both). It is *designed now, built later*. The jump-to-page field (§3) covers the navigation need in the first bundle; the strip is an enhancement, not a dependency.

---

## 9. RTL / LTR Chrome Behavior

The sheets already mirror correctly (binding side, page number, padding). **The chrome must mirror with them.**

- **The whole top bar flows by logical direction.** In RTL (Kurdish/Sorani, Arabic), the zones flip via logical properties: exit/context moves to the right, output/commit (Export, Print) to the left — each following the reading and binding direction so "commit" stays on the natural forward edge.
- **Directional glyphs mirror.** Prev/next chevrons point with the language (prev points inline-start in both directions); the page indicator and jump field stay logical (`3 / 12` reads consistently).
- **This matches the editor's existing RTL discipline** — logical properties throughout, three supported languages. The chrome should feel native in each direction, never an LTR layout with mirrored content bolted on.

---

## 10. Empty / Error / Loading States

The page is the artifact, so these states must be handled with composure — never a broken white void or a raw error.

- **Loading.** Composing the model for a long script takes a beat. A calm, centered "Composing pages…" with the page-size context — no heavy spinner, no progress-bar theatre. It should feel like the pages are being *laid out*, briefly.
- **Empty.** No content / zero pages: "Nothing to preview yet — write a scene to see pages." Centered, muted, matching the calm empty-state voice used elsewhere in the shell. No illustration, no CTA hero.
- **Error.** A pagination/render failure is serious (the artifact failed to compose) but is presented with composure: "Couldn't compose the page preview," a Retry, and a Back-to-editor. Never a stack trace, never an alarm-red dashboard. The writer's work is safe in Flow; the message should make that obvious.

---

## 11. How the Title Page Should Eventually Fit

The title page is the *cover of the package*. Today `titleStrip` is an in-flow body block, not a cover sheet (a deferred slice). The direction reserves the mental model now:

- **The title page becomes the first sheet in the reviewed stack** — a proper cover (title, author, contact, draft date), centered to manuscript convention, with its page number suppressed (cover pages aren't numbered `1.`).
- **The package reads cover-first.** The review surface presents `[title page] → body → [optional sides]`, so the director reviews the deliverable in the order it will be received.
- **The page indicator treats it honestly.** The cover reads as "Title" in the indicator; body numbering begins at `1`. Industry convention, surfaced in the navigation.
- **Deferred, but anticipated.** It ships with the title-page slice; the surface's framing (package, not body-sheets) is designed to absorb it without rework.

---

## 12. How Future MORE / CONT'D and Revision Marks Should Fit

These are *page-output truths* — and Print Preview is the only surface where they can be verified (they don't exist in Flow). They divide cleanly into two kinds:

- **MORE / CONT'D continuation marks — render in the sheet, no chrome.** These are part of the page's content at a break; they appear *within* the sheets when the continuation-mark slice lands. The review surface needs no special control for them — it is simply the right place to *see and verify* them. (Deferred render slice.)
- **Scene-number gutters and revision marks — toggleable review layers.** Scene numbers in the margin gutter, revision asterisks, revision-colored pages — these are *draft-state overlays* the director may want on (reviewing the production draft) or off (reading the clean copy). The direction: a small **"review layers" toggle group** in the top bar (e.g. *Scene numbers · Revision marks*) that shows/hides these gutter overlays on the sheets. This is where the "package review" framing earns its keep — the surface reviews the *production draft as marked*, not just clean body text.
- **Both deferred** (gutter and revision slices), but the surface reserves the toolbar slot for the layer toggles now, so they have a home when they arrive.

---

## 13. What Belongs in This Surface NOW

Everything here uses data and pipes that **already exist** (audit §3) — no new pagination logic, no engine invention:

- The **persistent top review bar** — the chrome host, the central missing piece.
- A **visible exit** (`← Done`) alongside the existing Esc.
- **Page navigation:** live current-page indicator (`N / total`), prev/next, and jump-to-page (the indicator-as-input) — all from `totalPages`, `currentPage`, and `_scrollByOneSheet`.
- **Zoom / fit:** Fit page (default), Fit width, and a `−  %  +` stepper — CSS transform only, never feeding page truth.
- **Export PDF** wired to the working `Rga.PdfExport.run()` pipe, with a light, growable options popover.
- The **calm review atmosphere** — warm-dark field, paper shadow, centered stack, per-sheet page numbers.
- **RTL chrome mirroring.**
- **Loading / empty / error** states with composure.
- **Discoverable keyboard hints** for the controls that already work.

---

## 14. What Must Stay Deferred

Designed-for, but explicitly out of the first arc — each is its own slice and the surface must *expose* these gracefully without *assuming* them:

- **Thumbnail / page-strip rail** — needs thumbnail render + virtualization. Home designed (§8); build Phase 2.
- **Print action wiring** — native print / `@media print` slice not built. Show the slot, mark deferred; do not assume the pipe.
- **Title page as cover sheet** — title-page slice.
- **MORE / CONT'D rendering** — continuation-mark slice (renders in-sheet).
- **Scene-number / revision-mark gutters + revision-color layers** — gutter/revision slices; reserve the "review layers" toggle group.
- **The fuller "package"** (sides, scene-number draft) — body-first review now; the package framing is the north star, filled in as slices land.
- **Reframing Print Preview as a workspace tab** — the Shell-doctrine tab-kinds question stays closed in this arc. Keep it a ViewManager peer mode with bespoke chrome.

---

# Closing

## 1. Strongest existing foundation

**The pure, well-tested rendering pipeline — the pages are already real and correct.** Normalizer → `ManuscriptGeometry.resolve` → `PageMap` → `RenderModel` → `PrintRenderer` paints one inch-true `.rga-page-sheet` per page, never measuring DOM, with correct Letter/A4/Legal geometry and RTL binding-side mirroring — and the `Rga.PdfExport.run()` pipe works end-to-end underneath. Page-awareness data (`totalPages`, `nav-index` pages, `ScriptSession.currentPage`) already exists, merely unsurfaced. The redesign does not touch the page truth; it builds the room around pages that are already trustworthy.

## 2. Biggest missing UX piece

**There is no chrome at all — and therefore no review *workflow*.** While Print Preview is active, every shell control is hidden, leaving a bare stack of sheets with only Esc and undiscoverable PageUp/PageDown. There is no visible page count, no current-page tracking, no navigation affordance, and no way to export from within the surface. The single biggest piece is the **persistent top review bar** that hosts page awareness, navigation, and Export — the element that converts a silent sheet stack into a reviewable, shippable package.

## 3. Recommended first implementation bundle

**"Review Bar v1."** The persistent top bar carrying: a visible exit (`← Done`); a live page indicator (`N / total`) with prev/next and jump-to-page; Fit page (default) / Fit width / zoom stepper; and Export PDF wired to the existing pipe with a light options popover. No thumbnails, no Print wire, no package features (title page, gutters, layers). Every element draws on data and pipes that already exist (audit §3), so the bundle is low-risk and high-payoff: it delivers the entire "review then export" workflow correction in one coherent surface without touching page truth or any deferred slice.

## 4. Highest-risk design mistake to avoid

**Turning the review surface into a browser print dialog, a generic export modal, or a dashboard** — burying the page under system-style option panels, destination pickers, or stat tiles. The page must stay the hero and the chrome must whisper; the moment options or panels out-shout the paper, the surface has failed its purpose. Two technical corollaries of the same mistake: letting **zoom or chrome feed back into page truth** (zoom is presentation-only; PageMap is the single resolver), and **leaking page seams back into Flow** (page truth lives here, never upstream in continuous drafting). Guard the page's primacy and the single-source-of-truth boundary above all.

## 5. STOP

UX Direction only. No implementation has begun, no code or CSS has been written, and no engineering plan beyond the recommended first bundle has been authored. The render pipeline, single-resolver page truth, no-DOM-measurement, ViewManager mutual exclusion, and the deferred-slice boundaries are treated as immovable. The next decision — authorize, amend, or reject this direction and the Review Bar v1 bundle — belongs to the user, not to this document.
