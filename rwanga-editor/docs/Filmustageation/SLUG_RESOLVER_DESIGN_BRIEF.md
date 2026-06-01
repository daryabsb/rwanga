# Slug Resolver Design Brief

**Date:** 2026-06-01
**Phase:** Filmustageation — Slug Resolver Design Brief
**Status:** DESIGN ONLY. No implementation, no refactor, no schema change, no UI
change, no renderer change. Branch `main`, HEAD `6e2077f9`, single worktree,
clean. This brief designs the boundary of a single canonical slug resolver; it
does **not** build it and does **not** redesign Flow.

**Grounded in:** `SLUG_TRUTH_DOCTRINE_V1.md` (accepted), `SLUG_RESOLVER_AUDIT.md`
(four live composers; storage already structured; only Flow diverges in visible
order; separators doubly-sourced), `PRINT_TRUTH_DOCTRINE_V1.md`, schema-v3
(LOCKED), Law 11 (`.rga` portability), Law 12 (single page-truth resolver),
`RTL_SCREENPLAY_CONVENTION.md`, the density campaign (pagination calibration).

---

## 1. Executive Summary

The audit established the precise problem: the slug's **truth** is already a
single structured record, but its **projection** is composed in four live places
(Flow DOM, Print string, PageMap measurement string, Nav-index string), three of
which already agree on the convention order and one of which (Flow) does not. The
separator vocabulary is owned twice — once in the layout profile (consumed by
PageMap), once hardcoded (Print, Nav).

This brief proposes the **smallest boundary that makes the projection obey the
doctrine**: one pure, surface-neutral function — `Rga.SlugResolver.compose` —
that takes the structured heading record plus a convention spec and returns a
composed slug (text + ordered tokens). Every string consumer (Print, PageMap,
Nav-index) routes through it; the convention (order + separators + future
localization) is owned in **one** place — the layout profile's scene-heading
convention, extended from "separators only" to "order + separators."

The design's keystone safety property: **Print display and PageMap measurement
call the same resolver with the same convention, so the measured length is, by
construction, the displayed length.** This eliminates the doubly-sourced-separator
desync risk *and* guarantees zero pagination drift — provided the default
convention equals today's (`SETTING LOCATION — TIME`, separators `' '` / `' — '`),
which a golden test pins.

Flow is explicitly **out of scope for construction** here. The resolver is
designed *first*; Flow's eventual convergence (picker DOM + contentDOM reorder)
consumes the resolver's `tokens` contract but is a separate, sensitive slice. §7
records the notes that make Flow's later convergence cheap, without designing it.

---

## 2. Resolver Boundary

**Proposed home:** a new pure framework module
`renderer/js/framework/slug-resolver.js`, exposing `Rga.SlugResolver`, sited
beside `screenplay-normalizer.js` (both are surface-neutral framework code: the
normalizer produces the structured heading; the resolver composes it).

**Why a dedicated module and not folded into `ManuscriptGeometry`/layout-profile:**
- The slug projection serves **non-geometry** consumers too (Flow, Nav-index,
  breadcrumb, search). `ManuscriptGeometry` is page-truth/geometry-scoped (Law
  12); composition is broader than the page.
- The **convention data** (order + separators + localization) *does* belong with
  the profile (it already owns separators and is the single page-truth resolver).
  So: **convention data lives in the profile; the composition function lives in
  `SlugResolver`.** Data and behavior split along their existing ownership lines.

**Purity contract (binding):** `SlugResolver.compose` must be a pure function —
no DOM, no ProseMirror, no `Store`, no `TabManager`, no I/O, no global reads. It
receives everything it needs as arguments and returns a value. This is what lets
Print, PageMap, Nav, and (eventually) Flow all call it identically, and what makes
it trivially testable.

**Boundary diagram (conceptual, not a plan):**

```
schema-v3 record ──► screenplay-normalizer ──► { setting, location, time }
layout profile  ──► sceneHeading.convention ──► { order, separators, localize? }
                                                        │
                          ┌─────────────────────────────┴──────────────┐
                          ▼                                            
            Rga.SlugResolver.compose(heading, convention) ──► { text, tokens, length }
                          │
        ┌─────────────────┼─────────────────┬─────────────────────────┐
        ▼                 ▼                 ▼                         ▼
   Print (.text)   PageMap (.length)   Nav-index (.text)     Flow (.tokens — later)
```

---

## 3. Input Contract

`compose(heading, convention)` accepts exactly two arguments:

### 3.1 `heading` — the structured record (surface-neutral)

```
{
  setting:  string,   // controlled-vocab token, e.g. "INT." (may be "")
  location: string,   // freeform location text (may be "")
  time:     string    // controlled-vocab token, e.g. "DAY" (may be "")
}
```

This is **exactly** the normalizer's `heading` shape
(`screenplay-normalizer.js:124–129`) and the `render-model` pass-through
(`render-model.js:91–92`). Nav-index's `{setting, locationText, time}`
(`nav-index.js:193–195`) maps by renaming `locationText → location` at the call
site — no new extraction.

**Rules:**
- All three fields optional; empty/absent fields are omitted and their adjacent
  separators collapse (matches every current composer's empty-guarding).
- The resolver never reads attrs or DOM; the caller supplies the already-extracted
  record. (Storage stays the single truth; the resolver never re-parses.)

### 3.2 `convention` — the projection spec (owned by the profile)

```
{
  order:      ['setting', 'location', 'time'],   // token sequence
  separators: { settingLocation: ' ', locationTime: ' — ' },
  // future, additive, OFF by default in V1:
  // localize?:  (token, kind) => string,         // RTL vocab seam (PP-R3)
  // transform?: 'upper' | null                   // casing, if ever moved here
}
```

- `order` is **new** — today the profile carries `separators` only
  (`layout-profile.js:186–189`) and order is implicit in each composer. The
  profile's own comment already anticipates an order switch; this brief names
  `order` as the field that makes it explicit and single-owned.
- `separators` is the **existing** profile field, reused verbatim.
- The convention object is produced by the layout profile
  (`ManuscriptGeometry.resolveFrom`), which Print and PageMap already resolve;
  Nav-index would resolve the same (see §6).
- **V1 default convention === today's behavior**: `order =
  [setting, location, time]`, separators `' '` / `' — '`, no localize, no
  transform. This is the invariant that holds pagination steady.

---

## 4. Output Contract

`compose` returns a single object:

```
{
  text:   string,                 // the composed slug, e.g. "INT. KITCHEN — DAY"
  tokens: [                       // ordered, typed pieces — for structural consumers
    { kind: 'setting',  value: 'INT.'   },
    { kind: 'sep',      value: ' '      },
    { kind: 'location', value: 'KITCHEN'},
    { kind: 'sep',      value: ' — '    },
    { kind: 'time',     value: 'DAY'    }
  ],
  length: number                  // === text.length (single source for PageMap)
}
```

**Why richer than a bare string:**
- **`text`** is mandatory and is all Print/Nav need today (drop-in for both
  current joins).
- **`length`** is derived from `text` and is what PageMap consumes — guaranteeing
  *measured length === displayed length* (the desync killer). PageMap never
  composes its own string again.
- **`tokens`** is additive and forward-serving, justified by two already-named
  needs: (a) Flow's eventual convergence lays out its DOM children in
  `tokens` order (the contract Flow consumes — §7); (b) the Print Recognition
  Bundle (Phase 0/1) wants to scope the brand-pink underline to the slug —
  token spans make geometry-free identity addressable without re-splitting the
  string. `tokens` is **not** consumed in V1 by Print/PageMap/Nav (they use
  `text`/`length`); it exists so later slices need no new resolver.

**Determinism:** identical `(heading, convention)` → byte-identical `text` and
`length`. No randomness, no locale-from-environment; localization is an explicit
convention input, never ambient.

---

## 5. Separator Ownership

**Single owner: the layout profile's scene-heading convention.**

- Today: separators live in `layout-profile.js:186–189` (consumed by PageMap)
  **and** are hardcoded independently in `print-renderer.js:217–218` and
  `nav-index.js:208–209`. They coincide only on default values.
- Design: Print and Nav-index **stop hardcoding** and read the *same* convention
  object the profile produces (the one PageMap already uses). The resolver is the
  only code that reads `convention.separators`; the profile is the only code that
  *defines* them.
- `order` joins `separators` in that same convention object, so order and
  punctuation are owned together, in one place, per language/direction.
- **Localization (PP-R3) seam:** localized separators/order for RTL
  (`...داخلي`, mirrored order) are supplied by the *RTL* convention object the
  profile already differentiates by `direction`. The resolver applies whatever
  convention it is handed; it does not contain a language switch. V1 ships the
  seam **unused** (passthrough), so behavior is unchanged.

Net: the audit's "separator ownership is split" finding is closed *by
construction* — there is exactly one definition site (profile) and one consumer
(resolver).

---

## 6. Consumer Integration Map

How each live string consumer routes through the resolver. (Integration is
described for design clarity only — not implemented here.)

| Consumer | Today | Through the resolver |
|---|---|---|
| **Print** (`print-renderer.js:212–220`) | `_appendHeadingDisplay` does its own join | calls `SlugResolver.compose(block.heading, convention).text`; convention from the layout profile PrintRenderer already resolves. **Output text byte-identical to today** → zero visible change, zero geometry change. |
| **PageMap** (`pagemap-engine.js:64–77`) | `_composeHeadingForMeasure` joins with `spec.separators` | calls `SlugResolver.compose(heading, convention).length` (or `.text` then `.length`), **same convention object** Print uses. Measured length === Print displayed length by construction. Default convention preserved → calibration unchanged. |
| **Nav-index** (`nav-index.js:192, 204–210`) | `_composeHeadingDisplay` does its own join | `headingDisplay = SlugResolver.compose({setting, location: locationText, time}, convention).text`. Still also stores raw `setting/locationText/time`. Downstream consumers (outline, document-outline, scene-navigator + its search, scene-catalogue, breadcrumb via `ScriptSession`) are unchanged — they read `headingDisplay` opaquely and transparently receive resolver output. |
| **PDF export** (`pdf-export.js`) | inherits Print | unchanged — already single-sourced to Print's render path; inherits the resolver automatically. |
| **Flow** (`v3-node-views.js`) | DOM assembly, divergent order | **NOT integrated in V1** — see §7. The resolver's `tokens` is the contract it will consume later. |
| **Studio-panel** (`studio-panel.js:415–430`) | dead v2-DOM composer | **NOT integrated** — stale/unreachable under v3; retiring it is a separate cleanup (§9), not part of this boundary. |

**Convention-source note:** PrintRenderer and PageMap already obtain the layout
profile via `ManuscriptGeometry.resolveFrom` (`pagemap-engine.js:432–434`). Nav-
index would resolve the same profile (it already reaches the active doc's
settings/profile lazily, `nav-index.js:456–469`). One profile → one convention →
one resolver call shape across all three.

---

## 7. Flow Convergence Notes

*(Notes only. Per the constraint, Flow is NOT redesigned here.)*

- **Doctrine principle to honor (SLUG_TRUTH_DOCTRINE §3):** the **picker remains
  the input**; the composed slug is a **projection**. Flow must *display*
  convention order (`SETTING LOCATION — TIME`) to match Print, while the writer
  still authors through structured fields.
- **The contract Flow will consume:** the resolver's `tokens` array (kind +
  order). Flow's NodeView would lay out its interactive children in `tokens`
  order rather than its current hardcoded picker order. The resolver makes the
  *order* a single source; Flow becomes a projection of it.
- **Why this is the sensitive part (and deferred):** in Flow, `location` is
  editable **contentDOM** (ProseMirror-owned) while `setting`/`time` are
  **pickers** (attrs). Convention order `SETTING LOCATION — TIME` places the
  editable contentDOM *between* a picker and a separator+picker. Reordering
  interactive `<select>` chrome around a PM contentDOM is a NodeView concern bound
  to the **LOCKED script framework / Flow-view-locked** decisions
  (`project_ide_script_framework_locked`, `project_ide_flow_view_locked`). It is
  not a string edit and must not be improvised.
- **Geometry note:** Flow is a continuous drafting surface (not paginated —
  `project_flow_continuous_doctrine`), so Flow's eventual reorder is **page-truth-
  neutral**; the risk is framework/UX sensitivity, not pagination.
- **Sequencing this brief assumes:** resolver lands and Print/PageMap/Nav converge
  first (geometry-safe, invisible). Flow convergence is a *later* slice that (a)
  consumes the now-stable `tokens` contract, (b) gets its own UX/design pass for
  picker↔contentDOM ordering, (c) is verified visually. This brief deliberately
  stops at defining the contract Flow will consume.

---

## 8. Test Strategy

Tests that would *prove* single-resolver compliance (described, not written):

1. **Resolver unit tests (pure function):** order application; separator
   application; empty-field collapse (each of setting/location/time absent, and
   combinations); all-empty → `''`; `tokens`/`text`/`length` mutual consistency
   (`length === text.length`; `tokens` concatenation === `text`); RTL/localized
   convention input produces localized output (seam exercised even though unused
   in production V1).

2. **Keystone invariant — measure === display:** for a representative set of
   headings (LTR + RTL, with/without each field), assert
   `Print _appendHeadingDisplay output === PageMap measured string === resolver
   .text`, and `PageMap length === resolver.length`. This is the proof that no
   geometry drift can occur: the measured and displayed strings are the same
   object of truth.

3. **Golden-length pin (calibration guard):** composed `length` for canonical
   LTR and RTL sample headings equals the **current** values (snapshot taken
   before integration). Any change to order/separators that would move a page
   break fails this test loudly. Protects the density-campaign calibration.

4. **Single-resolver compliance (static guard):** assert that no module *other
   than* `slug-resolver.js` composes a scene-heading slug — i.e. Print, Nav-index,
   and PageMap no longer contain their own `[setting, location].join(...) + ' — '
   + time` logic, and `convention.separators` has exactly one reader (the
   resolver). A source-scan/grep-style test makes "one composer" mechanically
   enforceable, not just asserted in prose.

5. **Consumer parity:** Nav-index `headingDisplay`, Print slug text, and
   breadcrumb text (via `ScriptSession`) all equal `resolver.compose(record,
   convention).text` for the same record — proving the navigation/context family
   and Print share one truth.

6. **Flow compliance — PENDING, explicitly skipped in V1:** a test asserting
   Flow's rendered order matches `resolver.tokens` order exists but is marked
   pending/skipped until the Flow convergence slice, documenting that Flow is the
   known, deliberate exception during the resolver-first phase. (No silent gap.)

---

## 9. Explicit Non-Goals

- **No Flow redesign / no picker or contentDOM reorder** (the constraint). Only
  the `tokens` contract Flow will later consume is defined.
- **No schema change** — schema-v3 is LOCKED; the record shape is reused as-is.
- **No visible change to Print, Nav, PageMap output** — composed text and
  measured length must be byte-identical to today (default convention held).
- **No RTL leading / pagination recalibration** (PP-D5) — separate truth slice.
- **No Recognition Bundle work** (slug underline / Courier Prime / warm ink) —
  separate; the resolver merely *enables* later underline-scoping via `tokens`.
- **No RTL vocabulary localization content** (PP-R3 — داخلي/ليل/قطع) — the
  resolver provides the localization **seam**; the actual mapping is a separate
  localization slice and ships **off** in V1.
- **No production scene-numbering** — deferred feature, untouched.
- **No studio-panel dead-code removal** — the stale composer (`studio-panel.js`)
  is out of this boundary; retiring it is a separate verify-then-remove cleanup.
- **No new persistence** — the resolver is pure; nothing it produces is stored
  (Law 11: structure is the durable memory, the composed string is ephemeral).

---

## 10. Risks

| Risk | Nature | Mitigation in the design |
|---|---|---|
| **Pagination drift** if default convention ≠ today's | geometry / truth | V1 default convention === current (`order=[setting,location,time]`, seps `' '`/`' — '`); golden-length pin (Test 3) + measure-===-display invariant (Test 2). |
| **Separator/order move from hardcoded → profile changes behavior** | correctness | Verify profile defaults equal the current hardcoded literals (they do today: `' '`, `' — '`); parity test (Test 5). |
| **Flow convergence touches LOCKED framework** | UX / framework sensitivity | Resolver-first sequencing; Flow deferred to its own slice (§7); only the contract is fixed now. |
| **`tokens` over-engineering (YAGNI)** | scope | `text`/`length` are mandatory and sufficient for V1 consumers; `tokens` is additive and justified by two *named* downstream needs (Flow order, recognition underline). If neither materializes, `tokens` is inert, not harmful. |
| **Load-order / namespace coupling** | integration | `SlugResolver` is a framework module that Print/PageMap/Nav depend on; it must load before them (same discipline as `nav-index`/`normalizer`). Purity means no circular deps. |
| **Profile must gain an `order` field** | data-shape addition | This is a runtime profile-object addition (NOT schema, NOT `.rga` persistence); additive and defaulted, so older callers and tests that omit it get today's order. |
| **RTL convention not yet exercised in production** | latent | Seam ships unused (passthrough); resolver tested with RTL convention input so the path is proven before PP-R3 turns it on. |
| **Hidden consumer not in the audit** | completeness | The audit enumerated consumers; the static compliance test (Test 4) catches any *new or missed* independent composer by failing if more than one composition site exists. |

---

## Stop Condition

Design brief complete. **No implementation, no refactor, no schema/UI/renderer
change.** This defines the canonical slug resolver's boundary, input/output
contracts, separator ownership, consumer integration map, Flow-convergence notes
(without redesigning Flow), test strategy, non-goals, and risks. Schema-v3
(LOCKED), the Print/Slug Truth Doctrines, Law 11/12, the RTL convention, and the
density calibration were the ground this stood on and were not reopened. The next
decision — authorize building the resolver (Print/PageMap/Nav convergence first,
Flow deferred), amend the contract, or hold — belongs to the user.
