# Print Recognition Bundle — Phase 0

**Date:** 2026-06-01
**Status:** INVESTIGATION + DOCTRINE ONLY. No implementation, no CSS, no
renderer/PageMap/PDF/settings change. Branch `main`, HEAD `6e2077f9`, single
worktree, clean. Per the Print Truth Doctrine (locked): **Print owns geometry;
identity may travel; geometry may not.** This document only determines *which
identity elements can travel* — it does not move them.

> Closed and not reopened here: cue alignment, dialogue/parenthetical width,
> screenplay columns, pagination, page numbers, PageMap, export pipeline, PDF
> generation, print-renderer geometry, Flow pagination. R1 closed the RTL
> mirror; geometry + PDF parity are correct.

---

## 1. Executive Summary

The dissatisfaction is **recognition, not rendering**. Measured fact (from the
fidelity-audit probe): when a writer crosses from Flow into Print Preview, every
*identity* signal Flow gives them is **stripped**, while only the *geometry*
survives. Print is geometrically true but visually anonymous — it reads as "a
correct screenplay," not "**my** screenplay."

The identity signals Flow uses, and their fate in Print today:

| Flow identity signal | In Flow | In Print today |
|---|---|---|
| Scene-heading **brand-pink underline** (3px `--accent-rwanga`) | present | **dropped** |
| Scene-heading **type-step** (13pt vs 12pt body) | present | dropped (slug = body size) |
| Body font **Courier Prime** (vendored) | present | **`Courier New`** (OS fallback) |
| RTL body font **Noto Naskh Arabic** | present | present ✅ (already travels) |
| Character-name **brand tint** (tagged) | present | dropped (all #111) |
| Warm ink (`#1d1c18` on white) | present | near-black `#111` on white |

The opportunity: a **small, geometry-safe recognition bundle** — carry a few of
these identity signals into Print *without touching a single inch of layout*.
The safest, highest-recognition candidate is the **scene-heading brand-pink
underline** — it is pure decoration (border-bottom), zero geometry, and it is
the single most Rwanga-specific mark in the product.

Recommended v1 (detail in §7): **slug underline + Courier Prime body font +
warm ink** — three decoration/typeface changes, no geometry. Everything else is
rejected or deferred.

---

## 2. Scene Heading Identity

**What creates scene-heading identity in Flow today** (`.rga-scene-heading-v3`,
editor-prosemirror.css ~2005):
- `border-bottom: 3px solid var(--accent-rwanga, #C2185B)` — the **brand-pink
  underline**. This is the signature mark.
- `font-size: 13pt` — one type-notch above the 12pt body (hierarchy by type-step).
- `font-weight: 700` + `text-transform: uppercase` + `letter-spacing: 0.04em`.
- RTL: scene-number badge bumped (16px/800) for Kurdish glyph weight.

**What Print does today** (`.rga-print-block-sceneHeading`, ~2376): only
`text-transform: uppercase` + `font-weight: bold`, at body size (12pt), **no
underline, no type-step, no letter-spacing**. Geometrically correct (full body
width, start-aligned) but identity-stripped.

| Element | Identity | Geometry | Safe For Print |
|---|---|---|---|
| Brand-pink 3px underline (`--accent-rwanga`) | ✅ strong | ❌ none (border, zero layout) | ✅ **YES** — top candidate |
| Uppercase | partial (industry-universal) | — | already in Print ✅ |
| Bold (weight 700) | partial | — | already in Print ✅ |
| Letter-spacing `0.04em` | mild identity | ⚠️ minor — widens glyph advance, *could* shift wrap/line-fit | ⚠️ measure first (likely fine; tiny) |
| Type-step to 13pt | mild identity | ❌ **NO** — larger glyphs change line height + char-per-line → **affects pagination** | ❌ excluded (geometry) |
| Setting/time pickers, hover chrome | editing affordance, not identity | — | ❌ N/A (Print is read-only) |
| Scene-number badge ("SCENE N" / "دیمەنی N") | editor chrome | — | ❌ excluded (production scene numbering is a deferred feature) |

**Verdict:** the **underline is the safe, high-value travel candidate** —
border-bottom adds no layout box in this context (block already has its own
line). Letter-spacing is a *maybe* pending a wrap re-measure. Type-step is
**geometry** (excluded). The pink underline alone likely delivers most of the
scene-heading recognition.

---

## 3. Paper Warmth

**What creates "warmth" — decomposed by cause:**

| Source | Contributes to | Travels safely? |
|---|---|---|
| **Ink colour** — Flow body `#1d1c18` (warm near-black) vs Print `#111` (cool near-black) | recognition (subtle) | ✅ YES — colour only, no geometry. Aligns Print ink to the writer's paper ink. |
| **Paper colour** — both white (`#fff`) by default | truth (page truth = white, locked) | ✅ already aligned; do not change |
| **Body typeface** — Flow **Courier Prime** (vendored) vs Print **`Courier New`** (OS) | recognition (real — different glyph shapes) | ✅ YES *iff metrics match* — see note below |
| **Soft page shadow + recessive desk** (F2/F3) | recognition + "paper" feel | ✅ already in Print (the truth surface has its own warm-dark field + sheet shadow) |
| **Line spacing / leading** | *truth* (feeds PageMap) | ❌ NO — geometry; excluded |
| **Spacing atmosphere** (block top-margins) | truth (1em air = pagination budget) | ❌ NO — geometry; excluded |

**Courier Prime caveat (the one to verify, not assume):** Courier Prime and
Courier New are *both* 10-cpi monospace and PageMap calibrates on cpi, not the
family — so swapping the **family name** should be metrics-neutral. BUT this must
be **measured** (rendered advance width per glyph) before it travels, because a
font swap that subtly changed the cpi would silently desync pagination. It is
listed as a v1 candidate **with a mandatory pre-check**, not a blind swap.

**What contributes to truth (do not touch):** leading, block spacing, column
widths, margins — all pagination inputs, all closed.

**What can travel:** warm ink colour (`#1d1c18`), and the Courier Prime family
(pending the cpi-neutral measurement). Both are colour/typeface, not geometry.

---

## 4. Transition Identity

**What makes a transition recognizable in Flow** (`.rga-block-transition`, ~1091):
`text-align: end` (right in LTR, left in RTL) + `text-transform: uppercase` +
`font-weight: 700` + `letter-spacing: 0.03em`.

**What Print does** (`.rga-print-block-transition`, ~2410): `text-align: end` +
`text-transform: uppercase`, weight **400** (not bold), no letter-spacing.

| Signal | Purely visual (identity) | Alters screenplay truth | Candidate |
|---|---|---|---|
| End-alignment (right/left mirror) | — | this IS geometry; already correct via R1 | ❌ closed (geometry) |
| Uppercase | identity (industry) | no | already present ✅ |
| **Bold (700)** | identity — Flow transitions are bold, Print's are not | ⚠️ weight can affect advance width in some fonts; in Courier (monospace) it does **not** change cpi | ✅ candidate, pending the same monospace-advance confirmation |
| Letter-spacing `0.03em` | mild identity | ⚠️ widens advance → *could* touch wrap | ⚠️ measure first |

**Verdict:** the **bold weight** is the recognizable transition signal that Print
drops. In a true monospace face, bold does not change the character cell width,
so it is geometry-neutral — but that must be confirmed for the shipped font
before it travels. Letter-spacing is a maybe (wrap re-measure). Transitions are
single short tokens (`CUT TO:`) that never wrap, which makes both low-risk — but
"never wraps" should be verified, not assumed.

---

## 5. Recognition Anchors (most important)

When a writer opens Print Preview, ranked by **how immediately each says "this is
my screenplay"** vs **how safely it can travel** (geometry-free):

| Rank | Anchor | Recognition power | Geometry risk | Travels? |
|---|---|---|---|---|
| **1** | **Scene-heading brand-pink underline** | **Highest** — the single most Rwanga-specific mark; the eye lands on slugs first | **None** (border-bottom) | ✅ v1 |
| **2** | **Body typeface = Courier Prime** | High — the whole page's texture; "my font" | None *if cpi-neutral* (must measure) | ✅ v1 (gated on measure) |
| **3** | **Warm ink `#1d1c18`** | Medium — felt, not consciously named | None (colour) | ✅ v1 |
| 4 | Transition bold weight | Medium — slugs + transitions are the scannable skeleton | None in monospace (confirm) | ⚠️ v1-maybe |
| 5 | RTL Noto Naskh body font | High **for RTL writers** | None | ✅ already travels |
| 6 | Scene-heading letter-spacing | Low–medium | minor wrap risk | ⚠️ defer to measure |
| 7 | Character-name brand tint | Medium **but** depends on tags + is a colour-in-production-script question | None (colour) | ❌ defer (see §8) |
| — | Scene-heading 13pt type-step | (would help) | **geometry** | ❌ excluded |

**The throughline:** the top three anchors (underline, font, ink) are **100%
geometry-free** and together likely deliver most of the recognition. Anchor 1
alone is probably the highest recognition-per-risk move in the whole campaign.

---

## 6. RTL Readability Note (investigate only)

**Question posed:** does increased RTL leading belong to *readability* or
*geometry*?

**Finding — it is BOTH, and that is exactly why it is hard.** Measured: Print
sheet `line-height: 1.0` (16px) applies identically to LTR Courier and RTL Noto
Naskh. For Noto Naskh, tashkeel/diacritics and the looping baseline crowd at 1.0
— a genuine **readability** deficit (designer doctrine already approved exploring
~1.2–1.3). BUT `line-height` is a **direct PageMap input** (`linesPerInch` →
`linesPerPage`); the density campaign calibrated RTL pagination against the 1.0
leading. So:

- **Readability dimension:** RTL needs more leading — real, designer-approved.
- **Geometry dimension:** changing leading **moves page breaks** unless RTL
  `linesPerPage`/cpi are recalibrated in lockstep.

**Recommendation (only):** RTL leading is **not** a recognition-bundle item and
**must not** ride in this Phase. It is a **paginated, geometry-coupled slice** of
its own (matches the fidelity audit's PP-D5): it requires a recalibration plan
(new RTL leading → recomputed `linesPerPage`, LTR held as the regression anchor)
and its own verification. Belongs to **truth**, executed as a dedicated slice —
not to recognition. Do not fold it in.

---

## 7. Recommended Recognition Bundle v1

**Principle:** carry identity that is provably geometry-free; verify the two
typeface items with a measurement before they travel; exclude everything that
touches an inch.

| # | Change | Surface | Why safe | Pre-check required |
|---|---|---|---|---|
| **R-1** | Scene-heading **brand-pink underline** in Print (`.rga-print-block-sceneHeading` gains the `--accent-rwanga` border-bottom) | Print + PDF (inherits) | border-bottom adds no layout box; PageMap measures lines, not borders | none — pure decoration |
| **R-2** | Body **Courier Prime** in Print (align `.rga-page-sheet` family to Flow's `--font-editor`) | Print + PDF | both 10-cpi monospace; PageMap keys on cpi not family | **MANDATORY**: measure rendered glyph advance — confirm Courier Prime cpi == Courier New cpi before shipping. If not equal → R-2 is rejected, not forced. |
| **R-3** | Warm ink **`#1d1c18`** in Print body (align to Flow ink) | Print + PDF | colour only | confirm contrast on white stays ≥ current (it does; warmer near-black) |

This is **three changes, zero geometry**. R-1 is the anchor and is unconditionally
safe. R-2/R-3 are safe pending a one-time measurement (R-2) / contrast check (R-3).
All three inherit into the PDF automatically (same renderer + linked CSS).

**Note for whoever implements (do NOT execute now):** all three are edits to the
`.rga-print-block-*` / `.rga-page-sheet` CSS only — no renderer JS, no PageMap, no
PDF-pipe change. R-2 must be gated behind the cpi measurement; if the measurement
shows any cpi delta, R-2 is dropped and v1 ships R-1 + R-3 only.

---

## 8. Rejected Ideas

| Idea | Why rejected |
|---|---|
| Scene-heading **13pt type-step** in Print | Larger glyphs change line height + chars-per-line → **pagination**. Geometry. Closed. |
| **RTL leading 1.0 → 1.3** in this bundle | Geometry-coupled (PageMap); belongs to a dedicated truth slice (§6), not recognition. |
| Carry Flow's **centered** character/dialogue into Print | That is the *geometry* the Print Truth Doctrine assigns to Print; reopening it is forbidden. |
| **Character-name brand tint** in Print | Two reasons to defer: (a) depends on the tag data model + whether tags are even present; (b) "colour in a production script" is a real domain question (clean B&W shooting script vs. annotated draft) — a **designer decision**, not a safe auto-travel. Deferred to §9, not rejected forever. |
| Slug **letter-spacing** / transition letter-spacing into Print | Widens glyph advance → possible wrap shift. Not worth the geometry risk for low recognition gain. Defer behind a measure if ever wanted. |
| Re-introducing **editing chrome** (pickers, hovers) into Print | Print is read-only by doctrine; these are affordances, not identity. |

---

## 9. Suggested Future Slices (documented, NOT executed)

1. **Recognition Bundle v1 implementation** (R-1 + R-3 unconditionally; R-2 after
   the cpi measurement). Pure `.rga-print-block-*`/`.rga-page-sheet` CSS; a
   computed-style + cpi-parity test; LTR+RTL screenshots. Smallest safe step.
2. **R-2 cpi measurement spike** (tiny, read-only): render Courier Prime vs
   Courier New at 12pt, measure advance width / chars-per-inch. Gate for R-2.
3. **RTL leading slice (PP-D5)** — paginated, geometry-coupled; its own
   recalibration + verification plan. Truth, not recognition. (Designer already
   approved the *direction*; the *implementation* needs the pagination plan.)
4. **Character-tint-in-Print decision** — a designer/domain call (production B&W
   vs annotated draft), then possibly a colour-only travel slice. Needs the tag
   model present.
5. **Transition bold weight** — fold into v1 only if the monospace-advance
   confirmation (R-2's measurement) also clears it; otherwise its own micro-slice.

---

## Stop Condition

Investigation + doctrine complete. **Nothing implemented.** No CSS, renderer,
PageMap, PDF, or settings change. The Print Truth Doctrine was not reopened —
geometry stays in Print; this document only identifies the geometry-free identity
that may travel. The recommended v1 (R-1 underline unconditionally; R-2 font +
R-3 ink pending one measurement) awaits review and authorization.
