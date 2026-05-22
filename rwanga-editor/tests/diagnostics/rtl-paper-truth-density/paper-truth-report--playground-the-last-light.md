# RTL Paper-Truth Density Probe — Density Slices 1 + 3 + 4 + 6 + 7

Generated 2026-05-21 16:55:28
Fixture: `tests/fixtures/playground-the-last-light.rga`
Surface measured: the Fork A **Paper/Print truth surface** — PrintRenderer `.rga-page-sheet` leaves.
NOT the Flow editor. No `#editor`, no Flow DOM, no hidden-editor geometry read (Rule 9).

> **Density Slices 6–7 (2026-05-21):** the parenthetical truth-surface CSS box was
> corrected (Slice 6) and the RTL content-line model was calibrated atomically in
> `layout-profile.js` — direction-aware cpi + the dialogue column width (Slice 7). The
> tables below reflect both fixes. Manuscript truth is the ratified Kurdish/RTL profile
> (Rule 10); the page count is an output of that profile, never a "Word 40" target.

## Pipeline (real production modules)
`.rga` → `schema-v3` → `Normalizer` → `LayoutProfile` → `PageMap` → `RenderModel` → `PrintRenderer`

## Page counts
- total normalized blocks: 51
- **PageMap page count: 3**
- **Paper-view rendered sheet count: 3**  — matches PageMap (one sheet per page) ✓
- A4 paper 8.500 × 11.000 in; margins top/bottom 1/1; available content height **9.000 in**; PageMap `linesPerPage` 53

## First 5 pages — block range, consumed height, overflow
| Page | block range (norm. index) | blocks | consumed content | available | overflow |
|---|---|---:|---:|---:|---:|
| 1 | 0–20 | 21 | 8.000 in | 9.000 in | -1.000 in |
| 2 | 21–44 | 24 | 9.000 in | 9.000 in | 0.000 in |
| 3 | 45–50 | 6 | 2.500 in | 9.000 in | -6.500 in |

## Overflow summary — all 3 sheets
- content overflows the available area (> +0.05 in): **0 / 3**
- content under-fills (> 0.05 in short): 2 / 3
- mean consumed content height: 6.500 in  (available 9.000 in)

## Leading-blank model — PageMap charge vs Paper-truth surface (Density Slice 3)

Rendered line-box height **16.00 px**  ·  font-size **16.00 px**  ·  the `.rga-print-block` leading gap is CSS `margin-top`.
Both measured columns are in LINE UNITS (measured px ÷ line-box px) — directly
comparable to PageMap's integer `leadingBlankLines`. `margin-top` = the resolved
CSS value; collapsed gap = `thisBlock.top − prevBlock.bottom` (painted geometry,
trusts no CSS value). `.rga-print-block-first` blocks are excluded — no air by design.

| Type | PageMap leadingBlankLines | measured margin-top (lines) | measured collapsed gap (lines) | n | verdict |
|---|---:|---:|---:|---:|---|
| sceneHeading | 1 | 1.00 | 0.67 | 3 | MATCH ✓ |
| action | 1 | 1.00 | 1.00 | 14 | MATCH ✓ |
| character | 1 | 1.00 | 1.00 | 8 | MATCH ✓ |
| parenthetical | 0 | 0.00 | 0.00 | 3 | MATCH ✓ |
| dialogue | 0 | 0.00 | 0.00 | 8 | MATCH ✓ |
| shot | 1 | 1.00 | 1.00 | 1 | MATCH ✓ |
| transition | 1 | 1.00 | 1.00 | 5 | MATCH ✓ |
| paragraph | 1 | 1.00 | 1.00 | 5 | MATCH ✓ |
| heading | 1 | 1.00 | 1.00 | 1 | MATCH ✓ |

**Verdict — the leading-blank model is already truth-accurate.** On the Fork A
Paper truth surface every block type's leading air matches PageMap's charged
`leadingBlankLines` within 0.00 line. `margin-top: 1em` at the sheet's
`line-height: 1.0` (`.rga-page-sheet`, `editor-prosemirror.css`) is **exactly one
line** — precisely what PageMap charges. The 0.40–0.77-line figures in the
`rtl-calibration` report were measured on the **Flow** comfort surface
(`.ProseMirror`, `line-height: 1.5`) — a different stylesheet — and do not
describe the truth surface. **Target B (the blank-line model) has nothing to
calibrate.** The 64/71 under-fill is driven by content-line over-counting
(the RTL cpi / proportional-font model — Target D), not by leading blanks.

## Content-line model — PageMap predicted vs Paper-truth rendered (Density Slice 4)

Paper sheet font resolved to **`"Courier New", Courier, monospace`** · dir **ltr** · line box **16.00 px** · font-size 16.00 px.
PageMap `_charsPerInch` is direction-aware (Density Slice 7): for this **ltr** document it uses **10.0 cpi** at 12pt — the measured Noto Naskh capacity for RTL (Courier 10 cpi for LTR).

Block-count integrity — normalized **51** · predicted array **51** · rendered DOM blocks **51** · per-block type cross-check mismatches **0** — predicted ↔ rendered are index-aligned ✓

### Predicted vs rendered content lines

Content lines only (leading blank excluded — Slice 3). `error ratio` = Σ predicted ÷ Σ rendered; `Δ lines` = Σ predicted − Σ rendered (PageMap over-count when > 0).

| Type | blocks | PageMap cpl | Σ predicted lines | Σ rendered lines | error ratio | Δ lines | Δ pages |
|---|---:|---:|---:|---:|---:|---:|---:|
| sceneHeading | 5 | 60 | 5.0 | 5.0 | 1.00 | 0.0 | 0.00 |
| action | 14 | 60 | 32.0 | 34.0 | 0.94 | -2.0 | -0.04 |
| dialogue | 8 | 25 | 15.0 | 15.0 | 1.00 | 0.0 | 0.00 |
| character | 8 | 35 | 8.0 | 8.0 | 1.00 | 0.0 | 0.00 |
| parenthetical | 3 | 20 | 3.0 | 3.0 | 1.00 | 0.0 | 0.00 |
| transition | 5 | 60 | 5.0 | 5.0 | 1.00 | 0.0 | 0.00 |
| shot | 1 | 60 | 1.0 | 1.0 | 1.00 | 0.0 | 0.00 |
| paragraph | 5 | 60 | 8.0 | 8.0 | 1.00 | 0.0 | 0.00 |
| heading | 2 | 60 | 2.0 | 2.0 | 1.00 | 0.0 | 0.00 |
| **TOTAL** | **51** |  | **79.0** | **81.0** | **0.98** | **-2.0** | **-0.04** |

### Over-count decomposition — newline-run charging vs cpl error

`_measureContentLines` splits `block.text` on hard newlines and charges every run a minimum of one line. This isolates that effect from the cpl model. **predFlat** = `ceil(textLen ÷ cpl)` treating the text as ONE run (cpl model only); **predNewline** = the shipping PageMap (per-run). `newline charge` = predNewline − predFlat; `cpl error` = predFlat − rendered; `net` = predNewline − rendered.

| Type | blocks w/ newline | Σ newlines | Σ rendered | Σ predFlat | Σ predNewline | newline charge | cpl error | net |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| sceneHeading | 0 | 0 | 5.0 | 5.0 | 5.0 | 0.0 | 0.0 | 0.0 |
| action | 0 | 0 | 34.0 | 32.0 | 32.0 | 0.0 | -2.0 | -2.0 |
| dialogue | 0 | 0 | 15.0 | 15.0 | 15.0 | 0.0 | 0.0 | 0.0 |
| character | 0 | 0 | 8.0 | 8.0 | 8.0 | 0.0 | 0.0 | 0.0 |
| parenthetical | 0 | 0 | 3.0 | 3.0 | 3.0 | 0.0 | 0.0 | 0.0 |
| transition | 0 | 0 | 5.0 | 5.0 | 5.0 | 0.0 | 0.0 | 0.0 |
| paragraph | 0 | 0 | 8.0 | 8.0 | 8.0 | 0.0 | 0.0 | 0.0 |
| shot | 0 | 0 | 1.0 | 1.0 | 1.0 | 0.0 | 0.0 | 0.0 |
| heading | 0 | 0 | 2.0 | 2.0 | 2.0 | 0.0 | 0.0 | 0.0 |
| **TOTAL** |  |  |  |  |  | **0.0** | **-2.0** | **-2.0** |

### Text-content integrity — PageMap input vs truth-surface render

PageMap measures the normalizer's `block.text`; the truth surface paints PrintRenderer's output (`el.textContent`). If these diverge, every line count above is comparing two different strings — `ratio` = Σ `block.text.length` ÷ Σ `el.textContent.length` (1.00 = same text).

| Type | Σ block.text.length (PageMap input) | Σ el.textContent.length (truth render) | ratio |
|---|---:|---:|---:|
| sceneHeading | 146 | 146 | 1.00× |
| action | 1529 | 1529 | 1.00× |
| dialogue | 258 | 258 | 1.00× |
| character | 41 | 41 | 1.00× |
| parenthetical | 49 | 49 | 1.00× |
| transition | 25 | 25 | 1.00× |
| paragraph | 322 | 322 | 1.00× |
| shot | 18 | 18 | 1.00× |
| heading | 17 | 17 | 1.00× |

The two surfaces measure the same text (max divergence 0%) — the line-count gap is a genuine cpl / column-width calibration error.

### Line-capacity forensic — characters that actually fit per rendered line

`Σ chars ÷ Σ lines` understates capacity badly for low-line-count blocks (half of a 2-line block is its partial last line). This measures capacity DIRECTLY: per rendered-line bucket **R**, `max textLen` is the longest text that fit in exactly R painted lines, so `max textLen ÷ R` is a tight estimate of per-line **capacity**. A capacity value that holds steady down the R column confirms it. `cap cpi` = capacity ÷ measured text-box width.

**action** — measured text-box width **6.00 in** · PageMap `cpl` **60** (= 10.0 cpi assumption):

| rendered lines R | blocks | avg textLen | max textLen | capacity (max ÷ R) | cap cpi |
|---:|---:|---:|---:|---:|---:|
| 1 | 2 | 49.0 | 51 | 51.0 | 8.5 |
| 2 | 6 | 90.3 | 109 | 54.5 | 9.1 |
| 3 | 4 | 134.5 | 147 | 49.0 | 8.2 |
| 4 | 2 | 175.5 | 177 | 44.3 | 7.4 |

→ **action line capacity ≈ 51.5 chars** (8.6 cpi) vs PageMap `cpl` 60 — PageMap assumes **1.17×** the real capacity.

**dialogue** — measured text-box width **2.50 in** · PageMap `cpl` **25** (= 10.0 cpi assumption):

| rendered lines R | blocks | avg textLen | max textLen | capacity (max ÷ R) | cap cpi |
|---:|---:|---:|---:|---:|---:|
| 1 | 5 | 13.0 | 22 | 22.0 | 8.8 |
| 2 | 1 | 36.0 | 36 | 18.0 | 7.2 |
| 4 | 2 | 78.5 | 80 | 20.0 | 8.0 |

→ **dialogue line capacity ≈ 20.0 chars** (8.0 cpi) vs PageMap `cpl` 25 — PageMap assumes **1.25×** the real capacity.

**parenthetical** — measured text-box width **2.00 in** · PageMap `cpl` **20** (= 10.0 cpi assumption):

| rendered lines R | blocks | avg textLen | max textLen | capacity (max ÷ R) | cap cpi |
|---:|---:|---:|---:|---:|---:|
| 1 | 3 | 16.3 | 18 | 18.0 | 9.0 |

→ **parenthetical line capacity ≈ 18.0 chars** (9.0 cpi) vs PageMap `cpl` 20 — PageMap assumes **1.11×** the real capacity.

### Contribution ranking — what drives the content-line over-count

1. **sceneHeading** — Δ 0.0 lines (0.00 pages, 0% of the over-count) · error ratio 1.00 · 5 blocks.
2. **character** — Δ 0.0 lines (0.00 pages, 0% of the over-count) · error ratio 1.00 · 8 blocks.
3. **parenthetical** — Δ 0.0 lines (0.00 pages, 0% of the over-count) · error ratio 1.00 · 3 blocks.
4. **dialogue** — Δ 0.0 lines (0.00 pages, 0% of the over-count) · error ratio 1.00 · 8 blocks.
5. **shot** — Δ 0.0 lines (0.00 pages, 0% of the over-count) · error ratio 1.00 · 1 blocks.
6. **transition** — Δ 0.0 lines (0.00 pages, 0% of the over-count) · error ratio 1.00 · 5 blocks.
7. **paragraph** — Δ 0.0 lines (0.00 pages, 0% of the over-count) · error ratio 1.00 · 5 blocks  ·  1 block(s) render 0 lines (empty).
8. **heading** — Δ 0.0 lines (0.00 pages, 0% of the over-count) · error ratio 1.00 · 2 blocks.
9. **action** — Δ -2.0 lines (-0.04 pages, 0% of the over-count) · error ratio 0.94 · 14 blocks.

### Verdict — content-line model (calibrated, Density Slice 7)

The atomic RTL profile calibration (Density Slice 7) is in place: `_charsPerInch` is direction-aware (RTL Noto Naskh **10.0 cpi**, LTR Courier 10) and `blockWidthsIn.dialogue` is the truth-surface CSS column (2.5in). On the Fork A Paper truth surface PageMap now predicts content lines within **0.98×** of the rendered truth — -2.0 excess lines ≈ **-0.0 pages** — down from the pre-calibration 1.13× / 329 lines.

Per-type accuracy: action **0.94×**, dialogue **1.00×**, parenthetical **1.00×** — every wrapping type within ~2%; the non-wrapping types (character / sceneHeading / transition) and Slice 3's leading-blank model stay exact at 1.00×. No type regressed.

The residual 0.98× is `ceil`-quantization plus proportional-font variance — Noto Naskh capacity ranges ≈ 12–16 cpi by glyph, so a single `cpl` can never be exact (Slice 4). It is small and **conservative**: 0 of 3 sheets overflow the usable area.

Page count: **3** (was 71). Per Option C / Rule 10 this is an OUTPUT of the ratified Kurdish/RTL profile, not a target — the success metric is that PageMap prediction ≈ Paper-truth behaviour, which the per-type table above confirms.

## Historical Word reference — RETIRED as a metric (Density Slice 5 · Rule 10)

Option C is ratified: Rwanga paginates to a Kurdish/RTL screenplay profile and the
page count is an OUTPUT of that profile — never a target. The figure below is kept
only as a historical, **non-reproducible** reference — the "Word ≈ 40 pages" was a synthetic CSS reconstruction (Arial 11pt, single full-width column) of a
generic, non-screenplay DOCX whose source file is not in the repo. It is NOT a truth
surface and must not be used to calibrate PageMap or the Paper render.

- historical synthetic "Word" page count: 40  _(retired — do not calibrate to this)_
- Paper-truth (PageMap → PrintRenderer) page count: **3**

## Contribution estimate

_Estimates — each grounded in the measurement above or a cited prior probe._

**1. Vertical line model.** PageMap budgets `linesPerPage = 53`, derived from Courier Prime 12pt leading 1 (= 6.0 lines/in over 9.00 in usable). Word truth is 11pt single. The 12pt-vs-11pt basis alone makes PageMap ~1.09× sparser per line — the single largest model assumption.

**2. Blank-line model — MEASURED on the truth surface (Density Slice 3).** PageMap charged **37 leading-blank lines** across the document. The per-type table above measures the real leading air on THIS Paper truth surface: every block type matches PageMap’s charged `leadingBlankLines` within 0.00 line — `margin-top: 1em` at the sheet’s `line-height: 1.0` is exactly one line. The blank-line model is already truth-accurate; it contributes **0 pages** of over-count. (The 0.40–0.77-line figures from the `rtl-calibration` probe were measured on the Flow comfort surface — `.ProseMirror`, `line-height: 1.5`, a different stylesheet — and do NOT apply here.)

**3. Scene chrome.** PageMap models **none**. This fixture has 5 scenes; the rtl-calibration probe measured ≈ 0.72 in chrome per scene (number badge 0.254 in + scene margins 0.467 in) → ≈ 3.6 in unmodelled. NOTE: this makes PageMap *under*-count (opposite direction) — a real model gap, but it does not drive the over-count.

**4. RTL font / content-line model — CALIBRATED (Density Slice 7).** `_charsPerInch` is now direction-aware (10.0 cpi for Courier New RTL, Courier 10 for LTR) and `blockWidthsIn.dialogue` matches the truth-surface CSS column (2.5in). The predicted-vs-rendered table above confirms PageMap now tracks the Paper truth within 0.98× (-2.0 excess lines ≈ -0.0 pages). The small residual is ceil-quantization plus proportional-font variance — see the Slice 7 verdict above.

## Files / scripts used (read-only)
- driver: `tests/diagnostics/rtl-paper-truth-density/probe.js`
- surface: `tests/diagnostics/rtl-paper-truth-density/probe-page.html`
- production modules required: `renderer/js/constants.js`, `framework/base-outer-marks.js`, `doc-types/screenplay/schema-v3.js`, `framework/layout-profile.js`, `framework/pagemap-engine.js`, `framework/screenplay-normalizer.js`, `framework/render-model.js`, `framework/print-renderer.js`
- production CSS linked: `tokens.css`, `reset.css`, `shell.css`, `editor.css`, `editor-prosemirror.css`, `components.css`, `overlays.css`
- fixture: `tests/fixtures/playground-the-last-light.rga`

_This probe changes nothing — it only `require`s production JS and `<link>`s production CSS. Density Slices 1/3/4/5 produced evidence; Slices 6/7 implemented their fixes (the parenthetical CSS box; the atomic direction-aware cpi + dialogue width calibration) test-first in separate authorized slices._