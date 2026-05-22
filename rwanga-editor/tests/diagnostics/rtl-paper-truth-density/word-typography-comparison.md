# Density Slice 5 — Truth Surface vs Word Typography Gap

Investigation only. No production code, no constants changed. Generated 2026-05-21.

Slice 4 proved the PageMap-vs-Paper-truth mismatch is only ≈ 1.08× (≈ 3.6 pages) — so the
remaining 71→40 gap is **not** a PageMap calibration bug. This slice asks the next question:
**what is the "Word truth", and should Rwanga be trying to match it at all?**

Sources (all read-only):
- Rwanga Paper truth surface — measured in Density Slices 1/3/4 (`paper-truth-report.md`) +
  `renderer/css/editor-prosemirror.css`, `.rga` fixture settings.
- "Word truth" model — `tests/diagnostics/rtl-density/{probe.js,probe-page.html}`.
- Actual DOCX geometry — `unzip` inspection of the Mysterious-Guest `.docx` files in `Projects/`.

---

## Finding 0 — the "Word truth" is synthetic and non-reproducible

The campaign's "Word = 40 pages" figure does **not** come from measuring a Word document. The
`rtl-density` probe builds a **synthetic CSS reconstruction**:

```
#word-flow { width: 6.79in; font-family: Arial; font-size: 11pt;
             line-height: normal; direction: rtl; }
.w-para    { margin: 0.0556in 0; }            /* every block — one full-width paragraph */
```

Every block (action, dialogue, character, parenthetical) is rendered as **one identical
full-width paragraph** — there is no screenplay column structure in the "Word truth" at all.

The probe's geometry (`A4`, `Arial 11pt`, margins `top 0.886in / bottom 0.690in`, `6.79in`
column) was hand-transcribed from **`SCREENPLAY-FINAL-V4.docx`** — the file named in the
fixture's own `_conversion_notes.source`. **That file is not in the repository** and cannot
be re-measured. The only "FINAL" `.docx` files present are unrelated design-kit notes.

## Finding 1 — typography comparison

| Attribute | Rwanga **Paper truth** surface | "Word truth" (rtl-density synthetic → 40 pp) | Actual repo Mysterious-Guest `.docx` |
|---|---|---|---|
| Page size | A4 — 8.27 × 11.69 in | A4 — 8.27 × 11.69 in | **US Letter — 8.5 × 11 in** |
| Margins T/R/B/L | 1.0 / 1.0 / 1.0 / 1.5 in | 0.886 / — / 0.690 / — in | 1.0 / 1.0 / 1.0 / 1.0 in |
| Usable text height | 9.69 in | 10.12 in | 9.0 in |
| Body font | Noto Naskh Arabic (RTL) | Arial | Aptos theme font (MS-365 default) |
| Font size | 12 pt (16 px) | 11 pt | 12 pt (`w:sz` 24 half-pt) |
| Line-height | **1.0** (single) | `normal` ≈ 1.15 | `w:line 278/240` ≈ 1.16 |
| Paragraph spacing | `margin-top: 1em` (≈ 0.167 in) above action/scene/character/shot/transition/paragraph; **0** above dialogue/parenthetical | 0.0556 in before + after **every** block | docDefaults `after 160tw` (~0.11 in); revised drafts `before 360tw / after 80tw` |
| Action column | 5.77 in | 6.79 in (no per-type column) | 6.5 in (no per-type column) |
| Dialogue column | 2.50 in | 6.79 in (no per-type column) | 6.5 in (no per-type column) |
| Parenthetical column | **0.50 in — defective** (`padding-left:1.5in` + `max-width:2.0in`) | 6.79 in (no per-type column) | 6.5 in (no per-type column) |
| Scene-heading chrome | **bold + UPPERCASE**, 1 em lead, no badge/box/rule | none — a plain `Normal` paragraph | none — a plain `Normal` paragraph |
| Page header / footer | `"N."` top-right every sheet; footer + running-header opt-in (default off) | none rendered | 0.5 in header/footer band reserved; no screenplay running header |
| Pages (this manuscript) | **71** (PageMap = 71 sheets) | **40** (synthetic) | not measured — would differ again (Letter, no layout) |

## Finding 2 — is the "Word truth" screenplay-standard, or custom/generic?

**It is generic word-processor geometry — and not even one consistent geometry.** Evidence:

1. **No screenplay styles.** Every Mysterious-Guest `.docx` in the repo carries only `Normal`,
   `DefaultParagraphFont`, and stock Word `Heading1–9 / Title / Subtitle / Quote /
   ListParagraph / IntenseQuote`. A screenplay document (or one from a screenwriting tool /
   template) has named styles — *Scene Heading, Action, Character, Dialogue, Parenthetical,
   Transition*. **There are none.** The screenplay text was typed into a default Word document.
2. **No column structure.** Both the synthetic "Word truth" and the real `.docx` files lay
   every block out as one full-width paragraph. Screenplay format is *defined* by its per-type
   columns (narrow centred dialogue, indented character cue, indented parenthetical). The
   "Word truth" has none.
3. **Default template.** Theme font = **Aptos** (the Microsoft-365 default since 2024) — a
   brand-new blank-document template, not a screenplay template.
4. **Generic geometry.** Real `.docx`: Letter, 1 in margins all sides, 12 pt, ~1.16 line.
   That is Word's out-of-the-box default, not Hollywood screenplay geometry (Courier 12 pt,
   1.5 in binding margin, fixed per-type columns, ~55 lines/page, 1 page ≈ 1 minute).
5. **Internally inconsistent + non-reproducible.** The synthetic "Word truth" (A4 / Arial
   11 pt / 0.886+0.690 margins / 6.79 in) matches **none** of the three real repo `.docx`
   files (Letter / 12 pt / Aptos / 1 in) — and the file it *was* taken from is not in the repo.

**Conclusion:** the "40-page Word truth" is a **synthetic, non-screenplay, non-reproducible**
figure. It is not a valid calibration anchor and "71 → 40" is not a valid success metric.

## Finding 3 — should Rwanga match A, B, or C?

- **A — match the Word document exactly.** **Reject.** "Word" here is an unformatted generic
  text dump (no styles, no columns, default template). Matching it means abandoning screenplay
  layout entirely and turning Rwanga's Paper view into a word processor. It also chases a
  non-reproducible target.
- **B — screenplay-standard profile.** The correct **structural** reference — block taxonomy,
  per-type columns, fixed page geometry, the 1-page-≈-1-minute discipline. But the Hollywood
  standard is LTR / English / **Courier**, and Courier renders Kurdish/Arabic poorly — which is
  precisely why Rwanga's truth surface already uses Noto Naskh. B cannot be adopted verbatim.
- **C — a Kurdish / RTL Rwanga screenplay profile, screenplay-grounded.** **Recommended.**
  Take screenplay-standard structure (B) as the skeleton, and define the typography — font
  (Noto Naskh), cpi, per-type RTL column widths, margins, line-height, paragraph air —
  **deliberately, for Kurdish RTL**, derived from the truth surface itself. Under option C the
  page count is an **output** of a correct profile, never a target to hit.

**Recommendation: option C.** Ratifying it is a product decision and belongs to the user; it
formally **retires "40 pages" as a success metric**. The job stops being "shrink 71 → 40" and
becomes "define the correct Kurdish RTL screenplay page, and accept the page count it yields."

## Finding 4 — recommended next repair target (one only)

**Fix the parenthetical truth-surface CSS box** — `.rga-print-block-parenthetical` in
`renderer/css/editor-prosemirror.css`. `padding-left: 1.5in` + `max-width: 2.0in` leaves only
**0.50 in** of text column (Slice 4 measurement), so parenthetical text over-wraps and PageMap
under-counts it by 110 lines. This is the right next step because it is:

- a **confirmed, isolated render defect** — not a calibration/judgement call;
- a **Slice-4 prerequisite** — no `cpl` calibration is valid while a block type renders into a
  defective box (PageMap must not be calibrated to a broken truth surface);
- **A/B/C-independent** — the box is wrong under any profile choice;
- **small and contained** — one CSS rule.

It does carry one small embedded decision — the *intended* parenthetical metric (indent +
text width) — which should be set per option C, not guessed. That is the natural first
concrete task once option C is ratified.

## Net conclusion

The Density campaign should **stop treating 71→40 as a defect to close**. Slice 4 capped
PageMap's own error at ≈ 3.6 pages; Slice 5 shows the rest of the gap is measured against a
synthetic, non-screenplay, non-reproducible "Word truth". The campaign's next phase is a
**design decision (adopt option C)**, and its next concrete repair is the **parenthetical CSS
box** — after which the Slice-4 `cpl` recalibration can finally be done against a sound surface.

_Density Slice 5 produces evidence + a recommendation only. No production behaviour, no
layout-profile constant, no CSS, was changed._
