# Scene Heading Identity Audit

**Date:** 2026-06-01
**Phase:** Print Recognition Bundle — Phase 1
**Status:** INVESTIGATION ONLY. No implementation, no CSS, no renderer, no
PageMap, no PDF, no settings, no screenshot redesign, no speculative
architecture. Branch `main`, HEAD `6e2077f9`, single worktree, clean (only the
known untracked noise). This document decomposes scene-heading identity into
atomic parts and classifies each. It proposes nothing to build.

**Question this audit answers:** *not* "how should scene headings look" — but
**"what actually creates scene-heading identity today?"**

**Scope boundary (inherited from the task non-goals).** This audit is
**scene-heading only**. It does NOT investigate dialogue, parentheticals,
transitions, PageMap, pagination, PDF, export, RTL leading, **typeface family
swaps** (Courier Prime — Phase 0's R-2), or **body ink warmth** (Phase 0's R-3).
Where a scene-heading attribute *is itself* typographic (weight, case,
letter-spacing, type-step), it is in scope as an **identity component** —
because it belongs to the heading's anatomy — but no font-family or ink-warmth
recommendation is made here.

---

## 1. Executive Summary

A scene heading in Rwanga is not one thing. It is **fourteen separable
contributors** spread across three code surfaces (the Flow NodeView, the Flow
block CSS, and the Print block renderer + CSS). Decomposed, they sort into five
roles: **recognition**, **atmosphere**, **hierarchy**, **geometry**, and
**editing affordance**.

The single most important finding confirms Phase 0 and sharpens it: the
scene-heading **brand-pink underline** is the only **Critical**, **zero-geometry**
identity carrier the heading has. Everything else is either (a) already shared
between Flow and Print (uppercase, bold), (b) pure editor affordance that has no
business in Print (pickers, hover, the scene-number badge), or (c) geometry that
the Print Truth Doctrine forbids from travelling (the 13pt type-step).

Two findings are **new** to this audit (Phase 0 did not surface them):

1. **The slug word-order differs between Flow and Print.** Flow composes the
   slug as `SETTING — TIME / LOCATION` (e.g. `INT. — DAY / KITCHEN`); Print
   composes it as `SETTING LOCATION — TIME` (e.g. `INT. KITCHEN — DAY`). These
   are produced by two independent code paths (the NodeView DOM order vs.
   `print-renderer.js` `_appendHeadingDisplay`). A writer reading their own slug
   in Print sees the *words in a different order* than they typed them. This is
   a recognition discontinuity that has nothing to do with decoration — it is
   the *content string itself* differing.

2. **The "SCENE N" number badge is Flow-only and never reaches Print as visible
   text.** In Print the scene number survives only as a `data-scene-number`
   attribute on the block (`print-renderer.js:189`); it is never rendered. This
   is correct (production scene numbering is a deferred, doctrine-gated feature)
   — but it means the most *prominent* mark above a Flow scene heading simply
   does not exist in Print, and its absence is a large part of why Print "feels
   anonymous." It is classified here as **editing-affordance / deferred
   feature**, not as a recognition gap to close in this bundle.

**Bottom line:** the true identity carrier is the underline. The slug-order
divergence is a real recognition defect but is a *content* question, not a
decoration question, and may be doctrine-sensitive (industry order vs. Rwanga
picker order). Three candidate packages are proposed in §6 — none implemented.

---

## 2. Scene Heading Anatomy

A complete inventory of every contributor, by surface. File:line references are
to HEAD `6e2077f9`.

### 2.1 Flow surface — the NodeView chrome (`v3-node-views.js`)

The heading is rendered by `SceneHeadingNodeView` (`v3-node-views.js:97–181`)
as a flex row of five DOM children, **in this order**:

| # | Element | Class | Editable? | Source |
|---|---|---|---|---|
| 1 | Setting picker (`<select>`) | `.rga-scene-heading-v3-setting` | chrome (CE=false) | `node.attrs.setting` |
| 2 | Em-dash separator ` — ` | `.rga-scene-heading-v3-sep` | chrome | literal |
| 3 | Time picker (`<select>`) | `.rga-scene-heading-v3-time` | chrome (CE=false) | `node.attrs.time` |
| 4 | Slash separator ` / ` | `.rga-scene-heading-v3-sep` | chrome | literal |
| 5 | Location text | `.rga-scene-heading-v3-location` (contentDOM) | **editable (PM)** | inline content |

→ **Flow visible slug = `SETTING — TIME / LOCATION`.** Setting and time are
attrs mutated by the pickers via `setNodeMarkup`; the location is real PM inline
content. Vocabulary (settings/times/sceneWord) is doc- or constant-driven
(`_vocab()`, `:220`).

### 2.2 Flow surface — the scene-number badge (`SceneNodeView` + CSS)

Above the heading sits the **scene-number badge**, owned by the *parent*
`SceneNodeView` (`v3-node-views.js:44–48`), not the heading itself:

- DOM: `.rga-scene-v3-num`, content `SCENE N` / `دیمەنی N` (`:66–71`).
- The number is a **derived** value delivered by the nav-index decoration
  plugin — never stored on attrs (`:28–33`, `:248–253`).
- CSS `.rga-scene-v3-num` (`editor-prosemirror.css:1928–1948`): 13px, weight
  700, `letter-spacing 0.06em`, uppercase, `--text-secondary` grey, plus a
  1.5em hairline rule via `::after` (`:1941`).
- RTL bump (`:1956–1960`): 16px / weight 800 / no letter-spacing for Kurdish
  glyph weight.

### 2.3 Flow surface — the heading block CSS (`.rga-scene-heading-v3`)

`editor-prosemirror.css:2005–2025`:

| Property | Value | Note |
|---|---|---|
| `font-family` | `--font-editor` (Courier Prime → New) | scoped; RTL override `:2029` → `--font-editor-rtl` |
| `font-size` | **13pt** | one type-notch above the 12pt body — the "type-step" |
| `font-weight` | **700** | |
| `text-transform` | **uppercase** | |
| `letter-spacing` | **0.04em** | |
| `border-bottom` | **3px solid `--accent-rwanga`** | the brand-pink underline — `#C2185B` dark / `#AD1457` light (`tokens.css:188`/`:313`) |
| `margin` | `0.4em 0 0.9em 0` | top tightened to avoid num→slug "chasm"; bottom = air to first action |
| `padding` | `0 0 0.4em 0` | underline clears uppercase descenders at 13pt |
| `display` | `flex; align-items:center` | lays the five chrome children on one line |

Picker/sep/location sub-styles (`:2033–2075`): pickers inherit font/weight/case,
transparent until `:hover`/`:focus` (hover = `--bg-hover`; focus = inset
accent box-shadow); separators `opacity 0.7`; empty location shows a `Location`
placeholder via `::before` (`:2071`).

### 2.4 Flow surface — the empty-state placeholder (`.rga-scene-frame-placeholder-slug`)

`editor-prosemirror.css:995–1006` — a separate, non-NodeView specimen used in
the empty scene frame: uppercase, `letter-spacing 0.04em`, 11pt, weight 700,
**2px** `--accent-rwanga` border-bottom (note: 2px, not the 3px of the live
heading). Listed for completeness; it is a placeholder, not the live identity.

### 2.5 Print surface — the block (`.rga-print-block-sceneHeading` + renderer)

CSS `editor-prosemirror.css:2376–2380`:

| Property | Value |
|---|---|
| `margin-top` | `1em` |
| `text-transform` | uppercase |
| `font-weight` | bold |
| *font-size* | **inherited body size (12pt)** — no type-step |
| *border-bottom* | **none** — no underline |
| *letter-spacing* | **none** |

Content is composed by `print-renderer.js _appendHeadingDisplay` (`:212–220`):
`parts = [setting, location]; display = parts.join(' '); if time → display +=
' — ' + time`. → **Print visible slug = `SETTING LOCATION — TIME`.**

The scene number is written as `data-scene-number` on the block
(`print-renderer.js:189`) but **never rendered as visible text** — there is no
`SCENE N` badge in Print.

### 2.6 Anatomy summary — the fourteen atomic contributors

| # | Contributor | Surface(s) | Present in Print? |
|---|---|---|---|
| A | Brand-pink underline (border-bottom) | Flow only | ❌ dropped |
| B | Uppercase (`text-transform`) | Flow + Print | ✅ |
| C | Bold (weight 700 / bold) | Flow + Print | ✅ |
| D | Letter-spacing `0.04em` | Flow only | ❌ |
| E | Type-step to 13pt | Flow only | ❌ (Print = 12pt) |
| F | Slug word-order (`SETTING — TIME / LOCATION` vs `SETTING LOCATION — TIME`) | both, **divergent** | ⚠️ different |
| G | Separators ` — ` / ` / ` (em-dash + slash) | Flow chrome | ⚠️ Print uses ` ` + ` — ` only |
| H | Setting/time **pickers** | Flow only | ❌ (affordance) |
| I | Picker hover/focus states | Flow only | ❌ (affordance) |
| J | Location `Location` placeholder | Flow only | ❌ (affordance) |
| K | "SCENE N" number **badge** | Flow only | ❌ (data-attr only) |
| L | Scene-num hairline `::after` rule | Flow only | ❌ |
| M | RTL number-size bump (16/800) | Flow only | ❌ |
| N | Top/bottom margin air around heading | Flow + Print (different values) | ⚠️ Flow `0.4/0.9em`, Print `1em` top |

---

## 3. Recognition Weight Analysis

For each contributor: *if removed, would a writer notice?* Ranked
**Critical / Strong / Moderate / Weak / Invisible**. Judged against the Flow
identity the writer authored in (since that is the reference "my screenplay"
feeling), and against industry expectation.

| Contributor | Rank | Reasoning |
|---|---|---|
| **A — Brand-pink underline** | **Critical** | The single most Rwanga-specific mark. The eye lands on slugs first; the pink rule is what makes a Rwanga slug *a Rwanga slug*. Its absence in Print is the most-named recognition loss. |
| **F — Slug word-order** | **Strong** | The writer typed `INT. — DAY / KITCHEN`; Print shows `INT. KITCHEN — DAY`. The *words reorder*. Noticeable on every slug, every page. Not decoration — content. |
| **B — Uppercase** | **Strong** *(but already shared)* | Removing it would read as broken, but it is industry-universal and already present in both surfaces → not a *gap*. |
| **C — Bold** | **Moderate** *(already shared)* | Reinforces "this is a heading"; present in both. Industry-common, mildly Rwanga in weight choice. Not a gap. |
| **K — "SCENE N" badge** | **Strong (in Flow) / N/A (Print)** | The most *prominent* Flow mark above a slug. But it is a production-numbering affordance, deferred by doctrine; its Print absence is *correct*, not a recognition bug to fix here. High Flow weight, deliberately zero Print weight. |
| **E — Type-step (13pt)** | **Moderate** | Gives Flow slugs their "section-start" presence. A writer would feel Print slugs are "flatter." But it is **geometry** (see §4) → cannot travel. |
| **D — Letter-spacing** | **Weak–Moderate** | Subtle widening; contributes to the slug's deliberate, spaced voice. Few writers would consciously name it; some would feel Print slugs are "tighter." |
| **G — Separators (em-dash/slash)** | **Weak** | The ` / ` before location is a Rwanga picker convention; in Print it collapses to a space. Tied to finding F. |
| **N — Margin air** | **Weak** | Spacing around the heading; Flow and Print differ but both give the slug breathing room. Mostly atmosphere. |
| **H/I — Pickers + hover/focus** | **Invisible (correctly)** | Editing affordances. Print is read-only; their absence is *expected*, not a loss. |
| **J — Location placeholder** | **Invisible** | Authoring affordance only. |
| **L — Hairline `::after`** | **Invisible** | Subtle separator under the number; tied to the deferred badge. |
| **M — RTL number bump** | **Invisible (Print) / Moderate (Flow, RTL writers)** | Tied to the badge; not in Print. |

**True identity carriers (the answer to the mission question):**
1. **A — the brand-pink underline** (Critical, and the only zero-geometry one).
2. **F — the slug word-order** (Strong, but a content/doctrine question).
3. **K — the "SCENE N" badge** (Strong in Flow, but deferred-by-doctrine for Print).

Everything else is shared-already, affordance, or geometry.

---

## 4. Geometry Classification

**Strict rule applied:** anything that can alter pagination, line-fit, page
breaks, or column width is classified **geometry** and is unsafe for Print under
the Print Truth Doctrine (Print owns geometry; identity may travel; geometry may
not).

| Component | Recognition | Geometry Risk | Safe For Print |
|---|---|---|---|
| **A — Brand-pink underline (border-bottom)** | Critical | **None** — a border adds no layout box on a block that already owns its line; does not change glyph advance, line count, or wrap | ✅ **YES** |
| **B — Uppercase** | Strong (shared) | None *(already in Print)* | ✅ already present |
| **C — Bold** | Moderate (shared) | **None in monospace**, but Print body is currently non-monospace `Courier New` *fallback*; bold of a monospace face does not change cell width. Already present in Print. | ✅ already present |
| **D — Letter-spacing 0.04em** | Weak–Mod | **⚠️ REAL** — widens glyph advance → can change chars-per-line and therefore *wrap* on long slugs → can shift a slug onto another line → pagination contact | ❌ **NO** (until measured; treat as geometry) |
| **E — Type-step 13pt** | Moderate | **YES** — larger glyphs change line-height and chars-per-line → directly changes line count → **pagination** | ❌ **NO** |
| **F — Slug word-order** | Strong | **⚠️ INDIRECT** — reordering the same words does not change *character count*, so total line-fit is ~neutral; BUT it is a content change to the rendered string and **must not** be done in a way that changes how many display lines the slug occupies. Low risk if the reordered string has equal length, but it touches the rendered text → verify line-count parity. | ⚠️ **VERIFY** (content change, length-neutral but must confirm no wrap change) |
| **G — Separators** | Weak | Tied to F; changing them changes string length slightly → same caution as F | ⚠️ **VERIFY** |
| **K — "SCENE N" badge** | Strong (Flow) | **YES if rendered** — adding a visible badge line above each slug inserts a *new line* into the flow → changes line count → **pagination**. (As a data-attr it has zero geometry.) | ❌ **NO** (and deferred by doctrine regardless) |
| **L — Hairline ::after** | Invisible | Adds a block → geometry if rendered | ❌ NO |
| **M — RTL number bump** | Invisible (Print) | Tied to badge | ❌ NO |
| **N — Margin air** | Weak | **YES** — top/bottom margin is vertical space the PageMap budgets; changing Print's `1em` would shift page breaks | ❌ NO (Print margins are truth) |
| **H/I/J — Pickers/hover/placeholder** | Invisible | N/A — interactive chrome, not present in read-only Print | ❌ N/A |

**Geometry verdict:** exactly **one** scene-heading identity component is
**unconditionally geometry-free and safe to travel: A, the brand-pink
underline.** F/G (slug word-order + separators) are *content*, not decoration —
length-neutral in principle but must be wrap-verified, and may be a doctrine
question (see §5). Everything else is either geometry (D, E, K, L, N), already
shared (B, C), or affordance (H, I, J).

---

## 5. Industry vs Rwanga Identity

Separating what belongs to **the medium** (screenplay convention) from what
belongs to **the product** (Rwanga's own marks).

| Signal | Industry convention | Rwanga-specific | Notes |
|---|---|---|---|
| **Uppercase slug** | ✅ universal | — | Every screenplay format uppercases scene headings. |
| **Bold slug** | ~common (many house styles bold the slug; some don't) | partial | Borderline; Rwanga bolds, which is a common-but-not-universal choice. |
| **`SETTING LOCATION - TIME` order** | ✅ **this is the industry slug** (`INT. KITCHEN - DAY`) | — | Print's order **matches the medium.** |
| **`SETTING — TIME / LOCATION` order** | ❌ not industry | ✅ **uniquely Rwanga** | The Flow picker layout (setting—time/location) is a *product* composition, driven by the picker-first authoring model. |
| **Em-dash + slash separators** | ✅ a hyphen/dash before TIME is conventional; the **`/` before LOCATION is not** | ✅ the `/` is Rwanga | Flow's ` / ` separator is product chrome. |
| **Brand-pink underline** | ❌ never — no screenplay format underlines slugs | ✅✅ **the** Rwanga mark | This is pure product identity; it is the most defensible thing to carry into Print *because* it is unmistakably "ours" and violates no reading expectation (it is decoration on a line that already exists). |
| **"SCENE N" number badge** | ✅ production scene numbers exist (shooting scripts) | the always-on badge presentation is Rwanga | Industry numbers appear *in the margins of a locked shooting script*, not as a heading badge in a writing draft. Rwanga's badge is a Flow authoring aid. |
| **Letter-spacing** | — neutral | mild Rwanga | Not a convention either way; a product micro-choice. |
| **13pt type-step** | ❌ industry slugs are body-size (12pt) | ✅ Rwanga | Industry does *not* enlarge slugs; Rwanga's type-step is a product hierarchy choice — which is also why it is correctly absent from page-truth Print. |

**The medium vs. the product, crystallised:**
- **Print today is the more *industry-true* surface** for the slug *content*:
  its `SETTING LOCATION — TIME` order and body-size glyphs are exactly what a
  Hollywood page expects.
- **Flow is the more *product-expressive* surface**: picker order, the `/`
  separator, the type-step, and — above all — the pink underline.
- The **collision** is finding F: the writer authors in the product order and
  reads page-truth in the industry order. Deciding which order Print should show
  is therefore **not** a recognition-decoration call — it is a *convention*
  decision (honor the medium, or honor what the writer typed), and per the
  design-freeze doctrine it is a **designer/domain call**, not an engineering
  one.
- The pink underline is the **one** signal that is purely product, geometry-free,
  and convention-neutral — making it the cleanest identity to let travel.

---

## 6. Candidate Identity Packages

Three packages. **No code. No implementation recommendation. Identity analysis
only** — these describe *what set of identity each package would carry into
Print*, and the doctrine cost of each, so a reviewer can choose scope.

### Package A — Minimal

**Carry only the brand-pink underline (component A) into Print.**

- Identity gained: the Critical carrier, the single most Rwanga-specific mark.
- Geometry cost: **zero** (border-bottom on an existing line).
- Doctrine cost: **none** — convention-neutral, decoration-only, no content
  change, no font/ink touch.
- What stays missing: type-step (geometry, must), slug-order divergence
  (untouched), badge (deferred, must).
- Character: the smallest possible recognition gain per risk. Print slugs become
  unmistakably Rwanga while remaining geometrically and conventionally identical
  to today.

### Package B — Moderate

**Underline (A) + resolve the slug word-order (F/G) so Print matches what the
writer authored — OR explicitly ratify the industry order.**

- Identity gained: A, plus closing the *content* discontinuity — the writer
  reads their slug in the order they typed it (or a designer ratifies the
  industry order as the deliberate page-truth convention, closing the question
  the other way).
- Geometry cost: A = zero; F/G = length-neutral in principle but **requires a
  wrap/line-count verification** before it could ever be built.
- Doctrine cost: **F/G is a designer/domain decision** (medium vs. product
  order) — Package B cannot be chosen without that decision being made first.
- Character: closes both the decoration gap (A) and the content gap (F), leaving
  only the geometry-bound signals behind. Larger because it touches the rendered
  string, not just decoration.

### Package C — Maximum doctrine-safe

**Underline (A) + slug-order resolution (F/G) + letter-spacing (D), with D gated
behind a measured wrap-parity check; type-step (E), badge (K), and margins (N)
remain excluded as geometry/deferred.**

- Identity gained: A + F + the fuller slug *voice* (the deliberate spacing that
  makes Flow slugs read as spaced, intentional headings).
- Geometry cost: A = zero; F = verify; **D = real wrap risk** — admissible only
  if a measurement proves the spaced slug never gains a display line at the
  longest realistic location string. If the measurement fails, D drops and C
  degrades to B.
- Doctrine cost: F's designer decision (as B) **plus** a mandatory D
  measurement. This is the ceiling of what *can* travel without reopening the
  Print Truth Doctrine.
- Character: the most complete scene-heading identity that is still
  doctrine-safe — explicitly **excludes** the type-step, the badge, and any
  margin change, because those are geometry or deferred features that the
  doctrine forbids. "Maximum" here means *maximum within the geometry fence*, not
  maximum visual change.

**What no package includes (and why):** type-step 13pt (E) — geometry; "SCENE N"
badge (K) — geometry *and* a deferred production-numbering feature; margin
changes (N) — pagination truth; pickers/hover/placeholder (H/I/J) — read-only
Print has no affordances; typeface family / ink warmth — out of this audit's
scope (Phase 0's R-2/R-3).

---

## 7. Findings

1. **Scene-heading identity decomposes into 14 atomic contributors** across the
   NodeView, Flow CSS, and Print renderer+CSS (§2.6). They sort into five roles:
   recognition (A, F), atmosphere (D, N), hierarchy (E, C), geometry (the
   classification of D/E/K/L/N), and editing affordance (H, I, J, and the badge
   family K/L/M).

2. **The brand-pink underline (A) is the only Critical, zero-geometry,
   convention-neutral identity carrier.** It is the cleanest possible
   travel candidate and confirms Phase 0's anchor finding. (Live value 3px
   `--accent-rwanga`; `#C2185B` dark / `#AD1457` light.)

3. **NEW: the slug word-order diverges between Flow and Print** (finding F).
   Flow = `SETTING — TIME / LOCATION` (NodeView DOM order); Print =
   `SETTING LOCATION — TIME` (`print-renderer.js:212–220`). This is a *content*
   recognition gap, not decoration. Print's order is the industry-true one; Flow's
   is the product order. Resolving it is a designer/domain decision.

4. **NEW: the "SCENE N" badge never reaches Print as visible text** — only as
   `data-scene-number` (`print-renderer.js:189`). Its Flow prominence vs. Print
   absence is a large contributor to "Print feels anonymous," but the absence is
   *correct* (production numbering is deferred and doctrine-gated). It is an
   affordance/deferred-feature, not a recognition bug to fix in this bundle.

5. **The type-step (E) is geometry and cannot travel** — larger glyphs change
   line count → pagination. Confirms Phase 0; closed.

6. **Letter-spacing (D) is geometry-suspect**, not free: it widens glyph advance
   and can shift slug wrap. Treat as geometry until a wrap-parity measurement
   proves otherwise. (Phase 0 flagged the same "measure first.")

7. **Uppercase (B) and bold (C) already travel** and are industry-shared — not
   identity gaps.

8. **Strictest safe scope = the underline alone** (Package A). Anything beyond it
   either requires a designer decision (F/G word-order) or a measurement gate
   (D), and nothing geometry-bound (E, K, N) is admissible at all.

---

## 8. Rejected Paths

| Path | Why rejected (in this audit) |
|---|---|
| **Carry the 13pt type-step (E) into Print** | Geometry — changes line count → pagination. Forbidden by the Print Truth Doctrine. Closed (also matches Phase 0 §8). |
| **Render the "SCENE N" badge in Print** | (a) Inserts a new line → pagination (geometry); (b) production scene numbering is a *separate deferred feature* with its own brainstorm (memory: production-scene-numbering-deferred). Not a recognition item. |
| **Carry letter-spacing (D) blindly** | Real wrap/advance risk on long slugs. Could only ever be considered behind a measured wrap-parity check; not safe to assert as decoration. |
| **Unilaterally reorder the Print slug to match Flow (or vice-versa)** | Finding F is a *convention* decision (industry order vs. authored order) — a designer/domain call under the design freeze, not an engineering choice. Documented, not decided here. |
| **Add picker / hover / placeholder affordances to Print** | Print is read-only by doctrine; affordances are not identity. |
| **Recolor the slug ink / change its typeface for recognition** | Out of scope — typeface family (R-2) and ink warmth (R-3) are Phase 0 concerns, explicitly excluded from this scene-heading audit. |
| **Treat "Flow and Print should look identical" as the goal** | The flow-continuous doctrine makes Flow a drafting surface and Print the page-truth surface; full visual parity is *not* the objective. The objective is letting *geometry-free identity* travel, not collapsing the two surfaces. |

---

## Stop Condition

Investigation complete. **Nothing implemented** — no CSS, no renderer, no
PageMap, no PDF, no settings, no screenshot, no architecture. The Print Truth
Doctrine was not reopened: every geometry-bound component (type-step, badge,
margins, letter-spacing-until-measured) is classified as non-travelling. This
audit decomposes scene-heading identity, ranks its recognition weight, classifies
its geometry, separates medium from product, and offers three scoped identity
packages (A minimal / B moderate / C maximum-doctrine-safe) — **as analysis, not
as an implementation recommendation.** Awaiting review.
