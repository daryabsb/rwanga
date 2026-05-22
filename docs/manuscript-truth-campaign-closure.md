# Manuscript Truth Campaign — Closure Report

Closed 2026-05-21. Companion to `docs/RWANGA_IDE_LAUNCH_CHECKLIST.md`.

The campaign spanned **Fork A (Bricks 1–6)** and **Density Slices 1–9**. It is now
**closed**: MT-01, MT-03, MT-09, MT-11 are all `TRUE`. Do not reopen unless new evidence
breaks an invariant in §5.

---

## 1 — Original problem

The manuscript would not paginate truthfully, and nothing could be trusted to say where a
page ended.

- **Geometry ownership failure** — more than one surface believed it owned page geometry;
  no single source of pagination truth.
- **A4 → A2 growth** — repeated Enter grew the *page itself* (a single tall fake sheet
  stretching toward A2), instead of adding pages.
- **PageMap vs Paper disagreement** — the pure-math paginator and the rendered paper
  surface did not agree on page count or page breaks.
- **Synthetic Word target confusion** — the campaign was implicitly chasing "Word ≈ 40
  pages" as if it were ground truth.
- **Density drift** — the manuscript rendered far taller than expected (a reported
  "~1.77×"), with pages over- and under-filling unpredictably.

## 2 — Root causes discovered

- **Ownership duplication** — `#editor` carried the `.rga-page` paper class *and* a paper
  growth model existed; two owners of page geometry, neither authoritative.
- **Fake paper shell** — the `.rga-page` `min-height` growth model rendered a decorative
  paper that grew with content — a visual page with no relationship to PageMap.
- **Parenthetical render defect** — `.rga-print-block-parenthetical` resolved to a **0.50in**
  text column (`max-width: 2.0in` − `padding-left: 1.5in`, border-box) while the engine
  assumed 2.0in — a pure CSS defect that desynced the render from PageMap.
- **Invalid Word anchor** — the "Word 40 pages" figure was a *synthetic CSS reconstruction*
  (Arial 11pt, single full-width column) of a generic, non-screenplay DOCX whose source
  file is not even in the repo. Not a truth surface; not reproducible.
- **RTL profile assumptions** — `_charsPerInch` hardcoded Courier 10 cpi and `blockWidthsIn`
  used Hollywood-LTR nominal widths; both are wrong for an RTL Noto Naskh manuscript.

## 3 — Fixes landed

**Fork A — geometry ownership (Bricks 1–6).** Made PageMap the sole paginator and the
Paper surface a one-way render of it.
- B1 — `data-pm-from`/`data-pm-to` renderer contract on every print block.
- B2 — `Rga.PaperView` controller (RenderModel → PrintRenderer, read-only).
- B3 — `view-mode` ↔ Paper view wiring; Playwright e2e unblocked (test-harness only).
- B4+5 — `#editor` loses the `.rga-page` paper class; the `min-height` growth model is
  retired; `page-surface.js` reduced to a pure `--page-width` publisher.
- B6 — click-to-edit affordance (Paper block → Flow caret).

**Density Slices 1–9 — pagination truth.**
- S1 — built the Paper-truth probe; measured PageMap = PrintRenderer (71 pages = 71 sheets).
- S2 — calibration plan (chose Target B — *later rejected by measurement*).
- S3 — Target B **rejected**: the leading-blank model was already truth-accurate
  (`margin-top: 1em` = exactly one line). No code.
- S4 — content-line forensic: over-count decomposed; cpl model identified as the owner.
- S5 — Word typography gap: the "40-page" anchor proven synthetic / non-reproducible.
- S6 — **Option C ratified**; parenthetical CSS box fixed (0.50in → 2.0in).
- S7 — **atomic RTL profile calibration**: direction-aware `_charsPerInch` (RTL 14.5 cpi) +
  `blockWidthsIn.dialogue` 2.5in. Over-count 1.13× → 1.02×.
- S8 — cross-fixture verification (RTL + LTR + synthetic) → **MT-01 / MT-03 / MT-09 TRUE**.
- S9 — page-break stability test added → **MT-11 TRUE**.

## 4 — Evidence summary

- **Unit tests:** ~1024 → **1063** green (+39 across +6 files). Fork A +28 (B1→1027,
  B2→1037, B3→1045, B4+5→1048, B6→1052); Density +11 (S6→1056, S7→1059, S9→1063).
- **Playwright integration:** 0 → **8/8** (`paper-view.spec.js`, `a2-killer.spec.js` — incl.
  the A2-stretch regression lock and click-to-edit).
- **Diagnostic reports:** `tests/diagnostics/rtl-paper-truth-density/` — `probe.js` +
  `probe-page.html` (the truth-surface probe), `paper-truth-report.md`,
  `word-typography-comparison.md` (S5), `slice-8-verification.md` (S8), and two per-fixture
  `paper-truth-report--*.md`.
- **Checklist deltas:** P0 `TRUE` 19 → **23**, `PARTIAL` 29 → **25**; all-items `TRUE`
  25 → **29**. ~17 Implementation-log entries appended (Rule 6).
- **MT status changes:** MT-01, MT-03, MT-09, MT-11 — all **PARTIAL → TRUE**. (MT-08 was
  already TRUE pre-campaign.)
- **Headline measurement:** PageMap predicts within **1.02×** of the Paper truth on RTL,
  **0.98×** LTR, **1.00×** synthetic; one sheet per page; **0 sheet overflow** on every
  fixture; pagination deterministic and forward-only re-flowing.

## 5 — Invariants created

The campaign operated under, and added, Operating Rules 6–10 (`checklist §2`):

- **Rule 6 — checklist-update discipline.** Every repair/verification step updates the
  checklist *in the same step* (the append-only Implementation log). Process invariant.
- **Rule 7 — "launch" ≠ "finished".** Two separate bars; neither declared by assertion.
- **Rule 8 — geometry ownership invariant.** A page leaf may exist *only if* its boundaries
  come from a `PageMap.pages[i]` range — 1:1, never decorative. No visual page structure
  independent of PageMap.
- **Rule 9 — hidden editor is state-preservation only.** While Paper view is active the
  Flow editor holds selection/undo/plugin state only; it is forbidden as a geometry or
  pagination source. Truth flows one way: RenderModel → PrintRenderer → Paper surface.
- **Rule 10 — manuscript truth is the ratified Kurdish/RTL profile (Option C).** Rwanga
  paginates to a Kurdish/RTL screenplay profile; the page count is an *output*, never a
  target. "Word ≈ 40 pages" is retired as a metric.

Rules 8–10 are the campaign's technical invariants — reopening the campaign is justified
only if new evidence breaks one of them.

## 6 — Remaining open P0 items (37, sorted by impact)

**Tier 1 — actively FALSE (known-broken):**
- `IE-04` PDF export · `PP-14` PDF export — PDF export is non-functional (IPC plumbing only).
- `SW-08` Scene field — unparsed RTL slug support (the real RTL slug sits in an `action`
  block; the scene-heading pickers render empty).
- `QG-12` "No known P0/P1 bugs" — FALSE by definition while any item above stands (meta).

**Tier 2 — UNKNOWN (unverified — risk):**
- `PF-08` Crash recovery works · `QG-11` Crash recovery tests · `PF-13` No console errors.
- `MT-04` PDF/export page count · `RTL-11` RTL export correct (both gated on PDF export).
- `RTL-12` Mixed English/Kurdish readable · `RTL-13` Bidi punctuation stable.
- `LR-01` Installer works.

**Tier 3 — PARTIAL (code exists, unverified — grouped by wound):**
- **Core editor trust (highest):** `PF-01` app opens · `PF-02` new doc · `PF-03` open doc ·
  `PF-04` save · `PF-05` save-as · `PF-06` autosave · `PF-11` unsaved-close warning.
- **RTL correctness:** `RTL-04..10` (action / dialogue / character / parenthetical /
  transitions / scene-headings / Print-Preview alignment) · `SW-01` scene-heading insert ·
  `SW-23` RTL convention · `PP-16` RTL print behaviour.
- **Page setup:** `MT-02` flow markers stable · `MT-05` A4/Letter/Legal · `MT-06` margins ·
  `MT-07` bottom margin · `MT-10` empty lines · `PP-01` paper size · `PP-03` margins ·
  `PP-13` print preview.

## 7 — Recommended next campaign (one only)

**Core Editor Trust — verify and close the `PF` cluster (PF-01…PF-13, with QG-11).**

Rationale:
- It is the **checklist's own mandated priority** — Operating Rule 2 ("do not start
  invention until P0 editor trust is TRUE") and Stage 1 ("Foundation — editor trust only").
- It is the **largest coherent P0 cluster** (10 items) and the **bedrock**: app-open,
  new/open/save/save-as/autosave, crash recovery, unsaved-close, console-clean. Pagination
  correctness is moot if a writer cannot trust the editor to open and save their script.
- The items are mostly PARTIAL ("code exists, unverified") — so, like Density Slice 8, this
  is primarily a **verification campaign**: prove each lifecycle path with automated +
  recorded-QA evidence, fix only what verification exposes.

Defer PDF/export and RTL-correctness to subsequent campaigns — both are real wounds, but
neither is foundational the way document-lifecycle trust is.

---

_Closure report only — no implementation. The Manuscript Truth campaign (Fork A + Density
Slices 1–9) is closed; MT-01 / MT-03 / MT-09 / MT-11 are TRUE with cited evidence._
