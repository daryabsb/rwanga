# RTL Paper-Truth Density Probe — Density Slices 1 + 3 + 4 + 6 + 7

Generated 2026-05-21 16:55:53
Fixture: `tests/fixtures/mysterious-guest-rtl.rga`
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
- total normalized blocks: 1729
- **PageMap page count: 65**
- **Paper-view rendered sheet count: 65**  — matches PageMap (one sheet per page) ✓
- A4 paper 8.268 × 11.693 in; margins top/bottom 1/1; available content height **9.693 in**; PageMap `linesPerPage` 57

## First 5 pages — block range, consumed height, overflow
| Page | block range (norm. index) | blocks | consumed content | available | overflow |
|---|---|---:|---:|---:|---:|
| 1 | 0–27 | 28 | 9.167 in | 9.693 in | -0.526 in |
| 2 | 28–55 | 28 | 9.167 in | 9.693 in | -0.526 in |
| 3 | 56–81 | 26 | 9.000 in | 9.693 in | -0.693 in |
| 4 | 82–110 | 29 | 9.333 in | 9.693 in | -0.360 in |
| 5 | 111–137 | 27 | 9.500 in | 9.693 in | -0.193 in |

## Overflow summary — all 65 sheets
- content overflows the available area (> +0.05 in): **0 / 65**
- content under-fills (> 0.05 in short): 64 / 65
- mean consumed content height: 9.205 in  (available 9.693 in)

## Leading-blank model — PageMap charge vs Paper-truth surface (Density Slice 3)

Rendered line-box height **16.00 px**  ·  font-size **16.00 px**  ·  the `.rga-print-block` leading gap is CSS `margin-top`.
Both measured columns are in LINE UNITS (measured px ÷ line-box px) — directly
comparable to PageMap's integer `leadingBlankLines`. `margin-top` = the resolved
CSS value; collapsed gap = `thisBlock.top − prevBlock.bottom` (painted geometry,
trusts no CSS value). `.rga-print-block-first` blocks are excluded — no air by design.

| Type | PageMap leadingBlankLines | measured margin-top (lines) | measured collapsed gap (lines) | n | verdict |
|---|---:|---:|---:|---:|---|
| sceneHeading | 1 | 1.00 | 1.00 | 45 | MATCH ✓ |
| action | 1 | 1.00 | 1.00 | 651 | MATCH ✓ |
| character | 1 | 1.00 | 1.00 | 401 | MATCH ✓ |
| parenthetical | 0 | 0.00 | 0.00 | 84 | MATCH ✓ |
| dialogue | 0 | 0.00 | 0.00 | 434 | MATCH ✓ |
| shot | 1 | — | — | 0 | no samples |
| transition | 1 | 1.00 | 1.00 | 43 | MATCH ✓ |
| paragraph | 1 | 1.00 | 1.00 | 6 | MATCH ✓ |
| heading | 1 | — | — | 0 | no samples |

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

Paper sheet font resolved to **`"Noto Naskh Arabic", "Traditional Arabic", "Simplified Arabic", serif`** · dir **rtl** · line box **16.00 px** · font-size 16.00 px.
PageMap `_charsPerInch` is direction-aware (Density Slice 7): for this **rtl** document it uses **14.5 cpi** at 12pt — the measured Noto Naskh capacity for RTL (Courier 10 cpi for LTR).

Block-count integrity — normalized **1729** · predicted array **1729** · rendered DOM blocks **1729** · per-block type cross-check mismatches **0** — predicted ↔ rendered are index-aligned ✓

### Predicted vs rendered content lines

Content lines only (leading blank excluded — Slice 3). `error ratio` = Σ predicted ÷ Σ rendered; `Δ lines` = Σ predicted − Σ rendered (PageMap over-count when > 0).

| Type | blocks | PageMap cpl | Σ predicted lines | Σ rendered lines | error ratio | Δ lines | Δ pages |
|---|---:|---:|---:|---:|---:|---:|---:|
| sceneHeading | 47 | 83 | 47.0 | 47.0 | 1.00 | 0.0 | 0.00 |
| action | 677 | 83 | 907.0 | 885.0 | 1.02 | 22.0 | 0.39 |
| dialogue | 436 | 36 | 953.0 | 937.0 | 1.02 | 16.0 | 0.28 |
| character | 434 | 50 | 434.0 | 434.0 | 1.00 | 0.0 | 0.00 |
| parenthetical | 84 | 29 | 91.0 | 90.0 | 1.01 | 1.0 | 0.02 |
| transition | 44 | 83 | 44.0 | 44.0 | 1.00 | 0.0 | 0.00 |
| paragraph | 7 | 83 | 7.0 | 7.0 | 1.00 | 0.0 | 0.00 |
| **TOTAL** | **1729** |  | **2483.0** | **2444.0** | **1.02** | **39.0** | **0.68** |

### Over-count decomposition — newline-run charging vs cpl error

`_measureContentLines` splits `block.text` on hard newlines and charges every run a minimum of one line. This isolates that effect from the cpl model. **predFlat** = `ceil(textLen ÷ cpl)` treating the text as ONE run (cpl model only); **predNewline** = the shipping PageMap (per-run). `newline charge` = predNewline − predFlat; `cpl error` = predFlat − rendered; `net` = predNewline − rendered.

| Type | blocks w/ newline | Σ newlines | Σ rendered | Σ predFlat | Σ predNewline | newline charge | cpl error | net |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| sceneHeading | 0 | 0 | 47.0 | 47.0 | 47.0 | 0.0 | 0.0 | 0.0 |
| action | 0 | 0 | 885.0 | 907.0 | 907.0 | 0.0 | 22.0 | 22.0 |
| dialogue | 0 | 0 | 937.0 | 953.0 | 953.0 | 0.0 | 16.0 | 16.0 |
| character | 0 | 0 | 434.0 | 434.0 | 434.0 | 0.0 | 0.0 | 0.0 |
| parenthetical | 0 | 0 | 90.0 | 91.0 | 91.0 | 0.0 | 1.0 | 1.0 |
| transition | 0 | 0 | 44.0 | 44.0 | 44.0 | 0.0 | 0.0 | 0.0 |
| paragraph | 0 | 0 | 7.0 | 7.0 | 7.0 | 0.0 | 0.0 | 0.0 |
| **TOTAL** |  |  |  |  |  | **0.0** | **39.0** | **39.0** |

### Text-content integrity — PageMap input vs truth-surface render

PageMap measures the normalizer's `block.text`; the truth surface paints PrintRenderer's output (`el.textContent`). If these diverge, every line count above is comparing two different strings — `ratio` = Σ `block.text.length` ÷ Σ `el.textContent.length` (1.00 = same text).

| Type | Σ block.text.length (PageMap input) | Σ el.textContent.length (truth render) | ratio |
|---|---:|---:|---:|
| sceneHeading | 845 | 845 | 1.00× |
| action | 47224 | 47224 | 1.00× |
| dialogue | 26303 | 26303 | 1.00× |
| character | 2086 | 2086 | 1.00× |
| parenthetical | 1487 | 1487 | 1.00× |
| transition | 140 | 140 | 1.00× |
| paragraph | 128 | 128 | 1.00× |

The two surfaces measure the same text (max divergence 0%) — the line-count gap is a genuine cpl / column-width calibration error.

### Line-capacity forensic — characters that actually fit per rendered line

`Σ chars ÷ Σ lines` understates capacity badly for low-line-count blocks (half of a 2-line block is its partial last line). This measures capacity DIRECTLY: per rendered-line bucket **R**, `max textLen` is the longest text that fit in exactly R painted lines, so `max textLen ÷ R` is a tight estimate of per-line **capacity**. A capacity value that holds steady down the R column confirms it. `cap cpi` = capacity ÷ measured text-box width.

**action** — measured text-box width **5.77 in** · PageMap `cpl` **83** (= 14.5 cpi assumption):

| rendered lines R | blocks | avg textLen | max textLen | capacity (max ÷ R) | cap cpi |
|---:|---:|---:|---:|---:|---:|
| 1 | 495 | 50.1 | 92 | 92.0 | 15.9 |
| 2 | 162 | 111.3 | 165 | 82.5 | 14.3 |
| 3 | 15 | 191.9 | 208 | 69.3 | 12.0 |
| 4 | 4 | 288.0 | 303 | 75.8 | 13.1 |
| 5 | 1 | 384.0 | 384 | 76.8 | 13.3 |

→ **action line capacity ≈ 81.3 chars** (14.1 cpi) vs PageMap `cpl` 83 — PageMap assumes **1.02×** the real capacity.

**dialogue** — measured text-box width **2.50 in** · PageMap `cpl` **36** (= 14.5 cpi assumption):

| rendered lines R | blocks | avg textLen | max textLen | capacity (max ÷ R) | cap cpi |
|---:|---:|---:|---:|---:|---:|
| 1 | 182 | 21.1 | 41 | 41.0 | 16.4 |
| 2 | 120 | 55.7 | 77 | 38.5 | 15.4 |
| 3 | 74 | 88.4 | 111 | 37.0 | 14.8 |
| 4 | 27 | 121.0 | 142 | 35.5 | 14.2 |
| 5 | 19 | 161.5 | 187 | 37.4 | 15.0 |
| 6 | 12 | 192.6 | 216 | 36.0 | 14.4 |
| 8 | 1 | 259.0 | 259 | 32.4 | 12.9 |
| 10 | 1 | 323.0 | 323 | 32.3 | 12.9 |

→ **dialogue line capacity ≈ 38.8 chars** (15.5 cpi) vs PageMap `cpl` 36 — PageMap assumes **0.93×** the real capacity.

**parenthetical** — measured text-box width **2.00 in** · PageMap `cpl` **29** (= 14.5 cpi assumption):

| rendered lines R | blocks | avg textLen | max textLen | capacity (max ÷ R) | cap cpi |
|---:|---:|---:|---:|---:|---:|
| 1 | 78 | 15.7 | 32 | 32.0 | 16.0 |
| 2 | 6 | 44.3 | 52 | 26.0 | 13.0 |

→ **parenthetical line capacity ≈ 29.0 chars** (14.5 cpi) vs PageMap `cpl` 29 — PageMap assumes **1.00×** the real capacity.

### Contribution ranking — what drives the content-line over-count

1. **action** — Δ 22.0 lines (0.39 pages, 56% of the over-count) · error ratio 1.02 · 677 blocks.
2. **dialogue** — Δ 16.0 lines (0.28 pages, 41% of the over-count) · error ratio 1.02 · 436 blocks.
3. **parenthetical** — Δ 1.0 lines (0.02 pages, 3% of the over-count) · error ratio 1.01 · 84 blocks.
4. **sceneHeading** — Δ 0.0 lines (0.00 pages, 0% of the over-count) · error ratio 1.00 · 47 blocks.
5. **character** — Δ 0.0 lines (0.00 pages, 0% of the over-count) · error ratio 1.00 · 434 blocks.
6. **transition** — Δ 0.0 lines (0.00 pages, 0% of the over-count) · error ratio 1.00 · 44 blocks.
7. **paragraph** — Δ 0.0 lines (0.00 pages, 0% of the over-count) · error ratio 1.00 · 7 blocks.

### Verdict — content-line model (calibrated, Density Slice 7)

The atomic RTL profile calibration (Density Slice 7) is in place: `_charsPerInch` is direction-aware (RTL Noto Naskh **14.5 cpi**, LTR Courier 10) and `blockWidthsIn.dialogue` is the truth-surface CSS column (2.5in). On the Fork A Paper truth surface PageMap now predicts content lines within **1.02×** of the rendered truth — 39.0 excess lines ≈ **0.7 pages** — down from the pre-calibration 1.13× / 329 lines.

Per-type accuracy: action **1.02×**, dialogue **1.02×**, parenthetical **1.01×** — every wrapping type within ~2%; the non-wrapping types (character / sceneHeading / transition) and Slice 3's leading-blank model stay exact at 1.00×. No type regressed.

The residual 1.02× is `ceil`-quantization plus proportional-font variance — Noto Naskh capacity ranges ≈ 12–16 cpi by glyph, so a single `cpl` can never be exact (Slice 4). It is small and **conservative**: 0 of 65 sheets overflow the usable area.

Page count: **65** (was 71). Per Option C / Rule 10 this is an OUTPUT of the ratified Kurdish/RTL profile, not a target — the success metric is that PageMap prediction ≈ Paper-truth behaviour, which the per-type table above confirms.

## Historical Word reference — RETIRED as a metric (Density Slice 5 · Rule 10)

Option C is ratified: Rwanga paginates to a Kurdish/RTL screenplay profile and the
page count is an OUTPUT of that profile — never a target. The figure below is kept
only as a historical, **non-reproducible** reference — the "Word ≈ 40 pages" was a synthetic CSS reconstruction (Arial 11pt, single full-width column) of a
generic, non-screenplay DOCX whose source file is not in the repo. It is NOT a truth
surface and must not be used to calibrate PageMap or the Paper render.

- historical synthetic "Word" page count: 40  _(retired — do not calibrate to this)_
- Paper-truth (PageMap → PrintRenderer) page count: **65**

## Contribution estimate

_Estimates — each grounded in the measurement above or a cited prior probe._

**1. Vertical line model.** PageMap budgets `linesPerPage = 57`, derived from Courier Prime 12pt leading 1 (= 6.0 lines/in over 9.69 in usable). Word truth is 11pt single. The 12pt-vs-11pt basis alone makes PageMap ~1.09× sparser per line — the single largest model assumption.

**2. Blank-line model — MEASURED on the truth surface (Density Slice 3).** PageMap charged **1146 leading-blank lines** across the document. The per-type table above measures the real leading air on THIS Paper truth surface: every block type matches PageMap’s charged `leadingBlankLines` within 0.00 line — `margin-top: 1em` at the sheet’s `line-height: 1.0` is exactly one line. The blank-line model is already truth-accurate; it contributes **0 pages** of over-count. (The 0.40–0.77-line figures from the `rtl-calibration` probe were measured on the Flow comfort surface — `.ProseMirror`, `line-height: 1.5`, a different stylesheet — and do NOT apply here.)

**3. Scene chrome.** PageMap models **none**. This fixture has 47 scenes; the rtl-calibration probe measured ≈ 0.72 in chrome per scene (number badge 0.254 in + scene margins 0.467 in) → ≈ 33.8 in unmodelled. NOTE: this makes PageMap *under*-count (opposite direction) — a real model gap, but it does not drive the over-count.

**4. RTL font / content-line model — CALIBRATED (Density Slice 7).** `_charsPerInch` is now direction-aware (14.5 cpi for Noto Naskh Arabic RTL, Courier 10 for LTR) and `blockWidthsIn.dialogue` matches the truth-surface CSS column (2.5in). The predicted-vs-rendered table above confirms PageMap now tracks the Paper truth within 1.02× (39.0 excess lines ≈ 0.7 pages). The small residual is ceil-quantization plus proportional-font variance — see the Slice 7 verdict above.

## Files / scripts used (read-only)
- driver: `tests/diagnostics/rtl-paper-truth-density/probe.js`
- surface: `tests/diagnostics/rtl-paper-truth-density/probe-page.html`
- production modules required: `renderer/js/constants.js`, `framework/base-outer-marks.js`, `doc-types/screenplay/schema-v3.js`, `framework/layout-profile.js`, `framework/pagemap-engine.js`, `framework/screenplay-normalizer.js`, `framework/render-model.js`, `framework/print-renderer.js`
- production CSS linked: `tokens.css`, `reset.css`, `shell.css`, `editor.css`, `editor-prosemirror.css`, `components.css`, `overlays.css`
- fixture: `tests/fixtures/mysterious-guest-rtl.rga`

_This probe changes nothing — it only `require`s production JS and `<link>`s production CSS. Density Slices 1/3/4/5 produced evidence; Slices 6/7 implemented their fixes (the parenthetical CSS box; the atomic direction-aware cpi + dialogue width calibration) test-first in separate authorized slices._