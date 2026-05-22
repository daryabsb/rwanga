# Density Slice 8 — Broader verification / status gate

Verification only — no production code, no model change. Generated 2026-05-21.

Goal: decide whether **MT-01 / MT-03 / MT-09 / MT-11** can flip to `TRUE`, or state the
exact evidence still missing. Method: run the Paper-truth probe (parametrised this slice
with an optional fixture argument — diagnostic tooling only) across multiple fixtures, plus
a determinism check and a render-path inspection.

---

## 1 — Fixtures measured

| Fixture | schema | direction | usable | runnable on the v3 probe? |
|---|---|---|---|---|
| `mysterious-guest-rtl.rga` | v3 | RTL | A4 | ✓ — the campaign fixture (1729 blocks) |
| `playground-the-last-light.rga` | v3 | LTR (English) | Letter | ✓ — "The Last Light" in v3 form (51 blocks) |
| `v3-sample-hand-authored.rga` | v3 | LTR | Letter | ✓ — short synthetic, one of every block type (9 blocks) |
| `sample-the-last-light.rga` | **v2.0** | — | — | ✗ — v2 schema; the v3 pipeline cannot parse it. `playground-the-last-light.rga` is its v3 form and was measured instead. |

Three v3 fixtures span the cases that matter: RTL/large/A4, LTR/medium/Letter, and a tiny
synthetic with dialogue + parenthetical + transition + every other type.

## 2 — Cross-fixture comparison

| Fixture | blocks | PageMap pages | Paper sheets | 1 sheet/page | total predicted ÷ rendered | overflow | under-fill |
|---|---:|---:|---:|:--:|---:|---:|---:|
| mysterious-guest-rtl | 1729 | 65 | 65 | ✓ | **1.02×** | **0 / 65** | 64 / 65 |
| playground-the-last-light | 51 | 3 | 3 | ✓ | **0.98×** | **0 / 3** | 2 / 3 |
| v3-sample-hand-authored | 9 | 1 | 1 | ✓ | **1.00×** | **0 / 1** | 1 / 1 |

Per-type error ratio (predicted ÷ rendered content lines), worst case per fixture:
- **RTL**: action 1.02× · dialogue 1.02× · parenthetical 1.01× · character/sceneHeading/transition 1.00×.
- **LTR (playground)**: action 0.94× (−2 lines on 14 blocks) · every other type 1.00×.
- **LTR (synthetic)**: every type exactly 1.00×.

**Every fixture: PageMap page count = Paper sheet count exactly (one sheet per page); 0 sheets
overflow; total line-prediction error ≤ 2%.** Under-fill is present and conservative (content
fits within the fixed leaf — it never clips). The LTR-action 0.94× is a 6%-on-one-type
under-count worth 2 lines total — within tolerance and it produced no overflow.

## 3 — Determinism and page-break stability

- **Deterministic:** the probe was run twice on `mysterious-guest-rtl.rga`; the two reports
  are **byte-identical** (213 lines each, timestamp excluded). `PageMap.build`,
  `Normalizer.normalize` and `LayoutProfile.compose` are pure functions — no DOM, no `Date`,
  no `Math.random`, no shared state — so determinism is structural, and this confirms it.
- **Localised re-flow:** `PageMap.build` is a greedy *sequential* packer (`pagemap-engine.js`)
  — page k's boundaries are determined solely by the blocks before page k+1. An edit at
  block N therefore re-flows only pages from N forward; every page break before the edit
  point is unchanged. This is a structural property, evident from the code.

## 4 — Print Preview vs Paper view

Both surfaces are the **same pure pipeline**: `Normalizer → LayoutProfile → PageMap →
RenderModel → PrintRenderer`.
- **Paper view** (Fork A, `view-mode.js` → `paper-view.js`): reuses the nav-index PageMap
  (`Rga.Nav.getPageMap`) → `RenderModel.build` → `PrintRenderer.render`.
- **Print Preview** (`print-preview.js`): builds via `Rga.PageMap` → `RenderModel.build` →
  `PrintRenderer.render`.

`PageMap.build` is pure, so the reused PageMap and a freshly built one are identical;
`RenderModel.build` copies each `PageMap.pages[i]` 1:1; `PrintRenderer` emits exactly one
sheet per page. **Print Preview and Paper view therefore render identically by
construction** — and the probe confirms the shared output: sheet count = page count, with a
block-count integrity check (every block lands where PageMap places it; 0 type mismatches).

---

## 5 — Per-item verdict

### MT-01 — PageMap owns pagination → **flip to TRUE**
PageMap is the sole paginator: Fork A's geometry-ownership campaign made every page leaf
content-range-bound to `PageMap.pages[i]` (Operating Rule 8; `paper-geometry-ownership.test.js`;
the A2-stretch lock `a2-killer.spec.js`). Slice 7 calibrated the content-line model; Slice 8
verifies — across RTL + LTR + synthetic fixtures — that PageMap, Paper view and Print
Preview agree with the ratified Kurdish/RTL profile (sheets = pages 1:1; predictions within
2%; 0 overflow). **Evidence satisfies the bar.**

### MT-03 — Print Preview matches PageMap → **flip to TRUE**
Structurally airtight: `RenderModel.build` copies `PageMap.pages` 1:1 and `PrintRenderer`
emits one sheet per page, so Print Preview's page breaks *are* PageMap's. Slice 8 confirms
it empirically on all three fixtures (sheet count = page count; per-block integrity check
passes). **Evidence satisfies the bar.**

### MT-09 — No fake page growth → **flip to TRUE**
The A2 page-growth mechanism is removed and e2e-locked (`a2-killer.spec.js` — repeated Enter
grows the page *count*, never page *size*); page leaves carry a fixed inline height
(`paper-geometry-ownership.test.js`). Slice 8 confirms **0 sheets overflow** across all
three fixtures — no page's content ever exceeds its fixed leaf. **Evidence satisfies the bar.**

### MT-11 — Page breaks are stable → **stays PARTIAL**
Determinism is proven structurally (pure functions) and empirically (probe run twice →
byte-identical), and localised re-flow is a structural property of the greedy sequential
packer. **But MT-11's Evidence-required column names an automated _test_, and none exists.**
Exact missing evidence: a unit test that asserts (a) `PageMap.build` is deterministic — same
blocks + profile built twice yields identical page boundaries; and (b) localised re-flow —
after an edit, every page break before the edit point is unchanged. Until that test exists
and passes, MT-11 cannot be cited as `TRUE` (Honesty Rule 3: code existing is not evidence).

## 6 — Residual gaps (noted, not blocking the three flips)

These are transparency notes — the flipped items meet their bars; broader confidence would
still come from: app-level (Playwright) cross-fixture render checks rather than the
probe alone (Fork A already e2e-verified the app's Paper view round-trip); more fixtures,
including a heavily-edited document; and the v2 fixture, which the v3 pipeline cannot
measure. PDF agreement is explicitly deferred (Rule 10 "(later) PDF"; MT-04, blocked on
IE-04).

## Net result

**MT-01, MT-03, MT-09 → TRUE.  MT-11 → PARTIAL** (missing the named deterministic/reflow
test). Per Option C / Rule 10 the page counts above (65 / 3 / 1) are outputs of the
ratified profile, not targets.

_Slice 8 is verification only. The probe was parametrised with an optional fixture argument
(diagnostic tooling); no production behaviour, no layout-profile constant, no CSS was changed._
