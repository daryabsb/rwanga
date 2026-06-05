# Playground Script Modernization — Audit & Cleanup

**Status:** Audit + low-risk cleanup performed. No production code changed; no
features redesigned; no engine capability added.
**Date:** 2026-06-05
**Branch/HEAD at audit:** `main` @ `bbadf4ca` (origin/main in sync).

> **Decisive finding:** there is **no in-app sample loader and no `samples/`
> directory** — every `.rga` lives in `tests/fixtures/`, and **nearly all of them
> are version-pinned or content-pinned to tests.** "Playground" exists only as the
> *name* of one fixture. Modernizing the existing files in place would break the
> migration, registry-identity, RTL-calibration, and page-break suites. The
> correct move is **replacement-by-addition**: a small, clean **v4 demo set** that
> exercises the modern editor (incl. the Semantic Entity Layer), leaving the
> pinned fixtures exactly as the tests require.

> **On "warnings":** investigated and **no literal runtime warnings exist** — old
> files migrate silently (v1→…→v4) and load through `schema.nodeFromJSON` without
> logging. The real staleness is **version + coverage**: all 13 fixtures predate
> `.rga` v4, and **none exercise aliases (S0/S1)**. That is the gap the new demos
> close.

---

## 1. Method

For each `.rga` I recorded version + byte size, then mapped which test/spec/
diagnostic files reference it (so "stale" is never confused with "load-bearing").
Candidate demo files were read structurally; the new demos were authored against
the verified v3/v4 body shape (`tests/fixtures/v3-sample-hand-authored.rga`) and
**proved to load through the real deserialize pipeline** by a new unit test
(`tests/unit/doc-types/screenplay/playground-demos.test.js`).

---

## 2. Per-script audit

| Script | Ver | Purpose | Referenced by | Verdict | Issues / rationale |
|---|---|---|---|---|---|
| `playground-the-last-light.rga` | 3.0 | General editing / registry demo | `registry-identity`, `registry-merge-api`, `memory`, `page-break-stability`, `scene-chrome` | **KEEP (pinned)** | The "3 curated + 3 historical duplicate NALI = 6 characters" fixture. Tests assert exact character counts, marks, and page geometry. Modernizing breaks them. |
| `mysterious-guest-rtl.rga` | 3.0 (564 KB) | RTL + density + page-break stress | `rtl-profile-calibration`, `page-break-stability`, `scene-navigator-tags` (e2e), `responsive-shell`, `scene-chrome`, 6 diagnostics | **KEEP (pinned)** | The RTL calibration + stress reference. Already serves the "Stress Demo (D)" role. (NB: shows as modified in the working tree from a **prior** session — untouched here.) |
| `sample-the-last-light.rga` | 2.0 | v2→v3 migration source | `v2-to-v3`, `select-schema`, `mount-v3-activation` | **KEEP (pinned @ v2.0)** | Must stay v2.0 — it is the *input* to the migration test. Upgrading it defeats its purpose. |
| `v3-sample-hand-authored.rga` | 3.0 | Hand-authored v3 schema reference | `select-schema`, `mount-v3-activation` | **KEEP (pinned)** | `select-schema` asserts title `"v3 Hand-Authored Sample"` + node-by-node load. Content-frozen. Reused here as the structural template for the new demos. |
| `sample-v10.rga` | 1.0 | v1.0 read/migration artifact | (loaded by version probes) | **KEEP (pinned @ v1.0)** | Version artifact. Its value *is* being old. |
| `sample-v11.rga` | 1.1 | v1.1 read/migration artifact | (version probes) | **KEEP (pinned @ v1.1)** | As above. |
| `v2.0–v2.5-sample.rga` (6 files) | 2.0 | v2.x structural variants | (migration/probe corpus) | **KEEP (pinned @ 2.x)** | Each captures a v2 structural variant for the migration corpus. |
| `corrupt.rga` | — | Invalid JSON | `doc.test` "rejects corrupt" | **KEEP (pinned)** | Deliberately malformed; deleting it removes negative coverage. |

**Net:** all 13 existing fixtures are **KEEP**. None is a free demo that can be
modernized without breaking tests. The "staleness" is real but is a **coverage
gap**, not a fixable-in-place defect.

---

## 3. Why replacement-by-addition (not modification)

- **Modification is high-risk.** Every existing file is asserted on by a suite
  (exact entity counts, marks, page geometry, version, or malformed-ness). The
  mission's own rule — *only perform updates that are straightforward and
  low-risk* — rules in-place modernization out.
- **The gap is additive.** What is missing is a *clean v4 demo that exercises the
  modern feature set*, especially aliases. That is best served by **new** files,
  not by mutating pinned ones.
- **New demos can be guarded.** The new set ships with a load-and-resolve test, so
  they stay valid as the schema evolves — something the ad-hoc fixtures never had.

New demos live in a dedicated home — **`tests/fixtures/playground/`** — separate
from the pinned top-level fixtures, so the two never get confused.

---

## 4. The modern v4 demo set (created + verified)

| Demo | File | Exercises | Verified |
|---|---|---|---|
| **A — Writer Demo** | `playground/demo-writer.rga` | 3 scenes, dialogue, parentheticals, shot, 4 transition presets (CUT/DISSOLVE/FADE OUT), **scene notes**, a **revision flag** (`flag_log` + `revisionFlag:"open"`), **multiple entity types** (2 characters, 1 prop, 1 location). Print-preview ready. | loads→v4; ≥2 chars; prop/location; flag; scene note ✓ |
| **B — Semantic Entity Demo** | `playground/demo-semantic-entities.rga` | **Canonical names + aliases + repeated references.** NALI tagged canonically and via **two aliases** (`The Teacher`, `The Poet`); BABAN with alias `The Butcher`. Every alias surface resolves to **one** entity id. | loads→v4; `ent-nali.aliases=[The Poet,The Teacher]`; `findOrCreateEntity('The Teacher'\|'the poet'\|'Nali')→ent-nali`; `isAliasSurface` alias=true / canonical=false; ≥3 Nali mentions ✓ |
| **C — RTL Demo** | `playground/demo-rtl.rga` | **RTL screenplay** (`screenplayProfile.direction:"rtl"`, language `ku`): Kurdish title/action/character cues/dialogue/parenthetical, transitions, plus an RTL alias (`مامۆستا` → `نالی`). Print-preview ready. | loads→v4; `direction==="rtl"`; ≥1 scene ✓ |

All three are proven valid by `tests/unit/doc-types/screenplay/playground-demos.test.js`
(7 tests), which runs them through the **real** `Rga.Doc.deserialize` → migrate →
v3 schema → `nodeFromJSON` path and checks alias resolution + entity coverage.

### Script D — Stress Demo (decision: NOT hand-authored)
A genuine large/RTL stress document **already exists** —
`mysterious-guest-rtl.rga` (564 KB) — and is the calibration/page-break/navigation
stress reference. Hand-authoring a second giant `.rga` would be high-effort,
error-prone, and low-value (duplicating an existing asset). **Recommendation:**
keep `mysterious-guest-rtl.rga` as the Stress Demo; if a *clean v4* stress doc is
ever wanted, generate it programmatically through the real serializer rather than
by hand. No Script D file created.

---

## 5. New semantic-entity coverage added

- A reusable **demo that shows the S0/S1 payoff**: "Nali / The Teacher / The Poet"
  as one identity, with the editor's alias resolver and derived dotted-underline
  marker both exercised by the body's tagged cues.
- The **first fixture authored at `.rga` v4** with **populated `aliases`** —
  previously every fixture was pre-v4 with no alias data.
- A **living guard test** so the demos cannot silently rot as the schema moves.

---

## 6. STOP

Audit complete; low-risk cleanup performed (3 new verified demos + 1 guard test +
this doc). No pinned fixture was modified; no production code touched; no feature
redesigned. Not started: Inspector, Timeline, AI, Pronoun Resolution.
