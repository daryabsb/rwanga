# RTL Calibration Probe — Slice 0

Fixture: `tests/fixtures/mysterious-guest-rtl.rga`  ·  generated 2026-05-20
Method: PageMap pure-math prediction vs. real-CSS rendered geometry (hidden Electron/Chromium window).

## PageMap profile under test

- paper: 8.268 × 11.693 in (A4)
- font assumed by PageMap: Courier Prime 12pt, leading 1
- linesPerPage budget: **57**  (theoretical 58 − safety 1)
- cpl (chars-per-line) by type: action 57, dialogue 35, character 35, parenthetical 20, sceneHeading 57, transition 57
- nominal block widths (in): action 6, dialogue 3.5, character 3.5, parenthetical 2, sceneHeading 6, transition 6
- leadingBlankLines: action 1, dialogue 0, character 1, parenthetical 0, sceneHeading 1, transition 1

---

## Scenario: `app-current`

_dir=rtl on #editor only (exactly as Rga.ScriptLanguage sets it)_

- resolved CSS `font-family`: `"Courier Prime", "Courier New", monospace`
- resolved `font-size`: 16px  ·  CSS `line-height`: 24px
- rendered 1-line box per type (px → in): action 24.0px/0.250, dialogue 24.0px/0.250, character 24.0px/0.250, parenthetical 24.0px/0.250, sceneHeading 35.9px/0.374, transition 24.0px/0.250
- per-scene chrome PageMap ignores: scene-number badge 24.4px (0.254in), scene margin 22.4+22.4px

### Predicted vs Actual — content lines

| BlockType     | Samples | PredictedLines | ActualLines | ErrorRatio | Note |
|---------------|---------|----------------|-------------|------------|------|
| action        |     677 |           1.72 |        1.57 |       1.10 | roughly aligned |
| dialogue      |     436 |           2.23 |        1.92 |       1.17 | PageMap OVER-counts |
| character     |     434 |           1.00 |        1.00 |       1.00 | roughly aligned |
| parenthetical |      84 |           1.24 |        1.07 |       1.16 | PageMap OVER-counts |
| sceneHeading  |      47 |           1.00 |        1.00 |       1.00 | roughly aligned |
| transition    |      44 |           1.00 |        1.00 |       1.00 | roughly aligned |

_ErrorRatio = Σ predicted ÷ Σ actual. >1 ⇒ PageMap reserves more lines than the text renders._

### Per-type detail

| Type | EffWidth in (PageMap nominal) | LineBox in | Mean rendered h (in) | leadingBlank: PageMap → measured | Observed cpl / cpi |
|------|-------------------------------|------------|----------------------|----------------------------------|--------------------|
| action | 6.49 in  (PageMap 6 → cpl 57) | 0.250 | 0.392 | 1 line → 9.6px (0.40 line) | 45.0 / 6.9 cpi  (n=312) |
| dialogue | 4.49 in  (PageMap 3.5 → cpl 35) | 0.250 | 0.479 | 0 line → 0.0px (0.00 line) | 34.0 / 7.6 cpi  (n=231) |
| character | 6.49 in  (PageMap 3.5 → cpl 35) | 0.250 | 0.250 | 1 line → 16.0px (0.67 line) | — (no multi-line samples) |
| parenthetical | 3.29 in  (PageMap 2 → cpl 20) | 0.250 | 0.268 | 0 line → 0.0px (0.00 line) | 21.5 / 6.5 cpi  (n=6) |
| sceneHeading | 6.49 in  (PageMap 6 → cpl 57) | 0.374 | 0.374 | 1 line → 27.7px (0.77 line) | — (no multi-line samples) |
| transition | 6.49 in  (PageMap 6 → cpl 57) | 0.250 | 0.250 | 1 line → 16.0px (0.67 line) | — (no multi-line samples) |

---

## Scenario: `naskh-forced`

_dir=rtl also on #editor-container (forces the [dir=rtl] .ProseMirror font rule to match)_

- resolved CSS `font-family`: `"Noto Naskh Arabic", "Traditional Arabic", "Simplified Arabic", serif`
- resolved `font-size`: 16px  ·  CSS `line-height`: 24px
- rendered 1-line box per type (px → in): action 24.0px/0.250, dialogue 24.0px/0.250, character 24.0px/0.250, parenthetical 24.0px/0.250, sceneHeading 35.9px/0.374, transition 24.0px/0.250
- per-scene chrome PageMap ignores: scene-number badge 24.4px (0.254in), scene margin 22.4+22.4px

### Predicted vs Actual — content lines

| BlockType     | Samples | PredictedLines | ActualLines | ErrorRatio | Note |
|---------------|---------|----------------|-------------|------------|------|
| action        |     677 |           1.72 |        1.22 |       1.41 | PageMap OVER-counts |
| dialogue      |     436 |           2.23 |        1.43 |       1.56 | PageMap OVER-counts |
| character     |     434 |           1.00 |        1.00 |       1.00 | roughly aligned |
| parenthetical |      84 |           1.24 |        1.01 |       1.22 | PageMap OVER-counts |
| sceneHeading  |      47 |           1.00 |        1.00 |       1.00 | roughly aligned |
| transition    |      44 |           1.00 |        1.00 |       1.00 | roughly aligned |

_ErrorRatio = Σ predicted ÷ Σ actual. >1 ⇒ PageMap reserves more lines than the text renders._

### Per-type detail

| Type | EffWidth in (PageMap nominal) | LineBox in | Mean rendered h (in) | leadingBlank: PageMap → measured | Observed cpl / cpi |
|------|-------------------------------|------------|----------------------|----------------------------------|--------------------|
| action | 6.49 in  (PageMap 6 → cpl 57) | 0.250 | 0.304 | 1 line → 9.6px (0.40 line) | 59.5 / 9.2 cpi  (n=132) |
| dialogue | 4.49 in  (PageMap 3.5 → cpl 35) | 0.250 | 0.358 | 0 line → 0.0px (0.00 line) | 48.5 / 10.8 cpi  (n=147) |
| character | 6.49 in  (PageMap 3.5 → cpl 35) | 0.250 | 0.250 | 1 line → 16.0px (0.67 line) | — (no multi-line samples) |
| parenthetical | 3.29 in  (PageMap 2 → cpl 20) | 0.250 | 0.253 | 0 line → 0.0px (0.00 line) | 26.0 / 7.9 cpi  (n=1) |
| sceneHeading | 6.49 in  (PageMap 6 → cpl 57) | 0.374 | 0.374 | 1 line → 27.7px (0.77 line) | — (no multi-line samples) |
| transition | 6.49 in  (PageMap 6 → cpl 57) | 0.250 | 0.250 | 1 line → 16.0px (0.67 line) | — (no multi-line samples) |

---

## Recommended correction values (evidence for Slice 1)

> Two scenarios were measured because the editor only sets `dir=rtl` on `#editor`
> itself, while the font rule `[dir="rtl"] .ProseMirror` needs a `[dir=rtl]`
> *ancestor*. `app-current` = what ships today; `naskh-forced` = the intended
> Naskh rendering. Slice 1 must calibrate against whichever font actually ships.

Font resolved per scenario (action blocks):
- `app-current`  → `"Courier Prime", "Courier New", monospace`
- `naskh-forced` → `"Noto Naskh Arabic", "Traditional Arabic", "Simplified Arabic", serif`

**1. RTL chars-per-inch (cpi)** — PageMap currently hardcodes Courier **10 cpi**:

- action: naskh-forced ≈ **9.2 cpi**  ·  app-current ≈ 6.9 cpi  _(observed chars ÷ rendered lines ÷ column width; mild lower bound — last line is partial)_
- dialogue: naskh-forced ≈ **10.8 cpi**  ·  app-current ≈ 7.6 cpi  _(observed chars ÷ rendered lines ÷ column width; mild lower bound — last line is partial)_

**2. leadingBlankLines** — PageMap charges 1 full line (0.250 in) before action/character/sceneHeading/transition:

| Type | PageMap charges | Measured margin (naskh-forced) | Suggested value |
|------|-----------------|--------------------------------|-----------------|
| action | 1 line | 9.6px = 0.40 line | 0.40 |
| dialogue | 0 line | 0.0px = 0.00 line | 0.00 |
| character | 1 line | 16.0px = 0.67 line | 0.67 |
| parenthetical | 0 line | 0.0px = 0.00 line | 0.00 |
| sceneHeading | 1 line | 27.7px = 0.77 line | 0.77 |
| transition | 1 line | 16.0px = 0.67 line | 0.67 |

**3. Column widths** — PageMap derives cpl from Hollywood-LTR nominal widths; measured Flow widths differ:

| Type | PageMap nominal in | Measured effective in | Δ |
|------|--------------------|-----------------------|---|
| action | 6 | 6.49 | +0.49 in |
| dialogue | 3.5 | 4.49 | +0.99 in |
| character | 3.5 | 6.49 | +2.99 in |
| parenthetical | 2 | 3.29 | +1.29 in |
| sceneHeading | 6 | 6.49 | +0.49 in |
| transition | 6 | 6.49 | +0.49 in |

**4. Per-scene chrome** — PageMap models none of it: scene-number badge 0.254in + scene margins 0.467in per scene (×47 scenes in this fixture).

_Slice 0 produces evidence only. No production behavior was changed._
