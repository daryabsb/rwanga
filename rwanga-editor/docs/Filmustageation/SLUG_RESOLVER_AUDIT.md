# Slug Resolver Audit

**Date:** 2026-06-01
**Phase:** Filmustageation — Slug Resolver Audit (against `SLUG_TRUTH_DOCTRINE_V1`)
**Status:** INVESTIGATION ONLY. No implementation, no refactor, no schema change,
no UI change, no renderer change. Branch `main`, HEAD `6e2077f9`, single
worktree, clean (only known untracked noise). Truth discovery only.

**Question this audit answers:** the doctrine rules that *the document owns slug
truth, the slug is a structured record, Flow and Print are projections, and there
must be one canonical slug resolver.* **Does the codebase obey this law today —
or do multiple slug resolvers exist?**

**Short answer:** the *storage* already obeys the law (the slug is structured
end-to-end: schema-v3 attrs + content → normalizer `{setting, location, time}`).
The *projection* does not: there are **four live composition sites** plus **one
dead legacy composer**, not one canonical resolver. Three of the four live
composers already agree on the convention order; **only Flow diverges**, and
Flow's composer is categorically different (it assembles interactive DOM, not a
string).

---

## 1. Executive Summary

A scene heading's structured truth (`setting` + `time` in `sceneHeading.attrs`,
`location` in its inline content) is already the single stored representation —
no surface stores a flat slug string. To that extent the doctrine's foundation is
*already real in the document.*

But **composition (turning the record into a visible slug) is duplicated across
five places**, four live and one dead:

| # | Site | Order produced | Live? |
|---|---|---|---|
| 1 | **Flow** NodeView (`v3-node-views.js`) | `SETTING — TIME / LOCATION` | ✅ live |
| 2 | **Print** renderer (`print-renderer.js`) | `SETTING LOCATION — TIME` | ✅ live (PDF inherits) |
| 3 | **PageMap** engine, measurement (`pagemap-engine.js`) | `SETTING LOCATION — TIME` | ✅ live |
| 4 | **Nav-index** display (`nav-index.js`) | `SETTING LOCATION — TIME` | ✅ live (feeds 5 surfaces) |
| 5 | **Studio-panel** current-scene publisher (`studio-panel.js`) | `NUMBER — LOCATION` | ⚠️ **dead** (reads v2-era DOM v3 no longer emits) |

**The sharpest finding:** sites 2, 3, and 4 **already agree** on the
screenplay-convention order (`SETTING LOCATION — TIME`). The doctrine's named
divergence is therefore not "Flow vs Print vs Nav vs everyone" — it is
effectively **Flow vs. the convention the other three already share.** And Flow's
divergence is structural in kind: it is not a string composer at all; it lays out
a flex row of pickers + a content span, so its "order" is DOM order, not a
join order. Converging Flow is thus a different (larger) act than unifying three
duplicate string-join functions.

**Two latent risks surfaced** (truth, not recommendations): (a) the three string
composers each carry their **own copy** of the join logic — sites 2 and 4
**hardcode** the separators (`' '`, `' — '`) while site 3 reads them from the
**layout profile** (`layout-profile.js`); they coincide today but are not a single
source, so a customized profile could desync PageMap length from Print display →
pagination drift. (b) Site 5 is a stale composer reading obsolete v2 DOM.

---

## 2. Resolver Inventory

Every location that composes `setting` / `location` / `time` into a visible (or
measured) slug. References are to HEAD `6e2077f9`.

### Site 1 — Flow (the NodeView DOM assembly)
- **File / fn:** `renderer/js/doc-types/screenplay/v3-node-views.js:97–143`,
  `SceneHeadingNodeView` constructor.
- **Responsibility:** renders the editable Flow slug as a flex row of five DOM
  children **in order**: setting `<select>` · literal ` — ` · time `<select>` ·
  literal ` / ` · location `contentDOM`. → visible **`SETTING — TIME / LOCATION`**.
- **Inputs:** `node.attrs.setting`, `node.attrs.time` (pickers), PM inline content
  (location). Vocabulary from `_vocab()` (doc/constants).
- **Kind:** **DOM composer**, not a string composer. Order = DOM child order;
  separators are literal text nodes (`v3-node-views.js:120,135`).

### Site 2 — Print (display string)
- **File / fn:** `renderer/js/framework/print-renderer.js:212–220`,
  `_appendHeadingDisplay(el, heading)`.
- **Responsibility:** composes the read-only Print slug:
  `parts=[setting, location].join(' ')`, then `+= ' — ' + time`. → visible
  **`SETTING LOCATION — TIME`**.
- **Inputs:** `block.heading = {setting, location, time}` from the RenderModel
  (`render-model.js:91–92`), which carries the normalizer's structured heading.
- **Separators:** **hardcoded** (`' '` and `' — '`).
- **Downstream:** **PDF export inherits this** — `pdf-export.js:127–143`
  (`_sheetsHTML`) calls `PrintRenderer.render(model, tmp)` and serializes the same
  DOM; there is no separate export-time slug composition.

### Site 3 — PageMap engine (measurement-only string)
- **File / fn:** `renderer/js/framework/pagemap-engine.js:64–77`,
  `_composeHeadingForMeasure(heading, spec)`.
- **Responsibility:** synthesises a **length-only** string to count display lines
  for pagination: `setting + sep.settingLocation + location + sep.locationTime +
  time`. With default separators → **`SETTING LOCATION — TIME`** (matches Print).
- **Inputs:** normalizer's structured `heading`; separators from
  `spec.separators` (the layout profile).
- **Separators:** **profile-supplied** — `layout-profile.js:181–188`
  (`settingLocation: ' '`, `locationTime: ' — '`).
- **Note:** the normalizer explicitly refuses to compose a display string and
  delegates this measurement composition to the engine
  (`screenplay-normalizer.js:41–47`). This is the **geometry-coupled** composer:
  its *output length* (not its appearance) drives page breaks.

### Site 4 — Nav-index (navigation/context display string)
- **File / fn:** `renderer/js/framework/nav-index.js:192, 204–210`,
  `_composeHeadingDisplay(setting, locationText, time)`.
- **Responsibility:** builds `scene.headingDisplay` for the scene index:
  `[setting, location].join(' ')` then `+ ' — ' + time`. → **`SETTING LOCATION —
  TIME`** (matches Print). Also stores the raw `setting`, `locationText`, `time`
  separately on each scene entry (`nav-index.js:193–195`).
- **Inputs:** `heading.attrs.setting/time` + `_textOf(heading)` (location),
  read in `_buildSceneEntry` (`nav-index.js:175–202`).
- **Separators:** **hardcoded** (`' '` and `' — '`).

### Site 5 — Studio-panel current-scene publisher (LEGACY / DEAD)
- **File / fn:** `renderer/js/shell/studio-panel.js:415–430`.
- **Responsibility (intended):** compose a current-scene label as
  `NUMBER + ' — ' + LOCATION`.
- **Why dead:** it walks the DOM for `el.dataset.blockType === 'scene-header'`
  and reads `.sh-number` / `.sh-location` — these are **v2-era DOM classes**. The
  v3 NodeViews emit `.rga-scene-heading-v3` / `.rga-scene-v3-num` /
  `.rga-scene-heading-v3-location` and `data-block-type` values, not
  `scene-header`/`sh-*`. The `while` walk therefore never matches under v3 → no
  composition occurs. Flagged as a stale composer, not a live divergence.

### Not composers (structured-record handlers — listed to bound the inventory)
- **`screenplay-normalizer.js:124–129`** — *extracts* `{setting, location, time}`
  from the PM node; explicitly **never composes** a string (`:41`).
- **`render-model.js:91–92`** — passes `heading` through unchanged.
- **`migrations/v1-to-v2.js:28–36`** — moves `sceneLine.attrs.location` → inline
  content; `setting`/`time` stay structured attrs. *Storage transform, not
  composition.*
- **`migrations/v2-to-v3.js:147–156, 224–251`** — maps `sceneLine` → `sceneHeading`
  preserving structured `setting`/`time` attrs + location content. *Storage
  transform.* No flat-string→fields re-parse exists anywhere.
- **`layout-profile.js:181–188`** — *owns* the separator vocabulary consumed by
  Site 3. Not a composer itself, but the canonical home of the separator tokens.

---

## 3. Divergence Map

| Surface | Composer site | Order | Setting↔Location sep | →Time sep | Sep source |
|---|---|---|---|---|---|
| **Flow** | 1 (DOM) | `SETTING — TIME / LOCATION` | ` / ` (before location) | ` — ` (before time, time precedes location) | literal DOM text nodes |
| **Print** | 2 | `SETTING LOCATION — TIME` | ` ` (space) | ` — ` | hardcoded |
| **Pagination (measure)** | 3 | `SETTING LOCATION — TIME` | ` ` (profile) | ` — ` (profile) | **layout profile** |
| **Outline / Navigator / Catalogue / Breadcrumb** | 4 (nav-index) | `SETTING LOCATION — TIME` | ` ` | ` — ` | hardcoded |
| **Studio panel** (dead) | 5 | `NUMBER — LOCATION` (no setting/time) | — | ` — ` | hardcoded |

**Variations observed:**
1. **Order:** Flow places **TIME before LOCATION** and uses a **slash** before the
   location; every other live surface places **LOCATION before TIME** with a
   **space**, time last after an em dash. This is the doctrine's named divergence
   — and it is **Flow-only.**
2. **Composer kind:** Flow is a DOM assembly (pickers + content span); Sites 2–4
   are string joins. Categorically different mechanisms.
3. **Separator source split:** Site 3 reads separators from the **profile**; Sites
   2 and 4 **hardcode** identical literals. They agree *by coincidence of default
   values*, not by shared source.
4. **No localization anywhere:** every composer emits the raw vocabulary token
   (`INT.`, `DAY`) verbatim; none localizes for RTL (`داخلي`, `ليل`). (Matches the
   fidelity audit's PP-R3.) There is no localization seam in any current composer.
5. **Dead variant:** Site 5 composes a different shape entirely (`NUMBER —
   LOCATION`) but is unreachable under v3.

---

## 4. Canonical Ownership Analysis

*(Identifying likely ownership points only — no redesign, no recommendation.)*

The doctrine locates truth in **the document** (the `.rga` record). In code, that
truth already exists at two settled layers:

- **The record itself:** `sceneHeading.attrs.setting`, `sceneHeading.attrs.time`,
  and the node's inline content (`location`) — schema-v3 (LOCKED). This is the
  structured slug the doctrine calls canonical; it is already the only stored
  form.
- **The structured extraction:** `screenplay-normalizer.js` already converts the
  PM node into the canonical `{setting, location, time}` and is explicitly
  documented to **refuse display composition** — it hands parts to renderers. It
  is the existing chokepoint where the record becomes a surface-neutral structure.

The **composition rule** (order + separators +, eventually, localization) is what
is currently *not* singly owned. The places where a single composition rule would
most naturally already belong, observed from the code as it stands:

- **`layout-profile.js` / `ManuscriptGeometry`** already owns the separator
  vocabulary (`separators.settingLocation`, `.locationTime`) and is described in
  the codebase as *the single page-truth resolver* (Law 12). It is the only place
  that already parameterizes slug punctuation.
- **The normalizer's output** (`{setting, location, time}`) is the surface-neutral
  structure every string composer (Sites 2–4) already consumes downstream — i.e.
  the three string composers already share an input; they only diverge in the
  *join*.

So the **convergence surface** is small for the three string composers (they
share input and already agree on output) and large for Flow (a DOM composer that
shares the input record but renders it through an entirely different mechanism —
and one bound to the LOCKED picker/authoring model). This audit identifies those
as the ownership/convergence points; it does **not** design the resolver.

---

## 5. Consumer Map

Which systems consume scene-heading data, and from which composer:

| Consumer | Reads | From |
|---|---|---|
| **Flow editor surface** | live slug (editable) | Site 1 (its own DOM) |
| **Print Preview** | slug display string | Site 2 |
| **PDF export** | slug display string | Site 2 (via `PrintRenderer.render` in `pdf-export.js`) |
| **PageMap / pagination** | slug *length* | Site 3 |
| **Outline panel** (`outline.js:193`) | `headingDisplay` | Site 4 |
| **Document outline** (`document-outline.js:67`) | `headingDisplay` | Site 4 |
| **Scene Navigator** panel + **search filter** (`scene-navigator.js:276–277, 316`) | `headingDisplay` (display + case-insensitive search) | Site 4 |
| **Scene Catalogue** (`scene-catalog.js:207`) | `headingDisplay` → `bundle.title` | Site 4 |
| **Breadcrumb** (`index.html` `wireBreadcrumb` ~1062) | `currentScene.headingDisplay` | Site 4, via `ScriptSession._deriveCurrentScene` (`script-session.js:149–161`, which reads `Rga.Nav.getIndex().scenes[].headingDisplay`) |
| **Search (scene)** | `headingDisplay` substring | Site 4 (Navigator filter; no independent index) |
| **Future Filmustageation surfaces** (breakdown, scheduling, stripboard, location/INT-EXT/day-night grouping) | structured **fields** (`setting`/`location`/`time`) — per doctrine §5 | the record / normalizer directly (none built today) |
| **Studio panel** current-scene label | (intended `NUMBER — LOCATION`) | Site 5 — **dead path, consumes nothing under v3** |

**Observation:** the entire navigation/context family (outline, document-outline,
navigator, catalogue, breadcrumb, scene search) consumes **one** upstream —
Site 4's `headingDisplay`. That family is already single-sourced. PDF is already
single-sourced to Print. The only display surfaces with their *own* composition
are Flow (Site 1) and Print (Site 2); PageMap (Site 3) is a length consumer.

---

## 6. Risk Assessment

*If the doctrine were enforced (single canonical resolver, all surfaces project
from it) — factual blast-radius, not a plan.*

**Areas that would be AFFECTED:**
- **Flow NodeView (Site 1)** — the largest change. Converging to convention order
  means reordering interactive `<select>` pickers vs. the location `contentDOM`,
  or decoupling the picker (input) from the composed slug (projection) as the
  doctrine §3 describes. This touches the **LOCKED script framework / picker
  model** (memory: `project_ide_script_framework_locked`, `project_ide_flow_view_locked`)
  — high sensitivity; not a string edit.
- **Print (Site 2), Nav-index (Site 4), PageMap (Site 3)** — three duplicated
  join implementations that would collapse to one resolver call. Mechanically
  small (they already agree), but it touches three framework modules.

**Areas that are SAFE:**
- **Migrations** (`v1-to-v2`, `v2-to-v3`) — already structure-preserving; no
  string composition to change.
- **PDF export** — inherits Print automatically; transparent.
- **Nav-index consumers** (outline, document-outline, navigator, catalogue,
  breadcrumb, scene search) — they read `headingDisplay` opaquely; they receive
  whatever the upstream composer emits without their own logic to change.
- **The stored record / schema-v3** — already canonical; untouched.

**Areas that appear COUPLED:**
- **PageMap (Site 3) ↔ pagination geometry.** Site 3's *output length* drives page
  breaks, and today its order/separators equal Print's. Pagination is therefore
  calibrated to the `SETTING LOCATION — TIME` string (LTR and RTL, per the density
  campaign). A canonical resolver that **preserves that order and character
  count** is geometry-neutral; one that changes the composed length would require
  RTL/LTR pagination recalibration (`project_density_campaign`). Flow converging is
  geometry-neutral for page truth (Flow is continuous, not paginated —
  `project_flow_continuous_doctrine`), but is the framework-sensitive item above.
- **Separator-source split (profile vs hardcoded).** Sites 2/4 hardcode what Site
  3 reads from the profile. They agree only on default values; unifying onto one
  source is the convergence, and verifying Print/Nav still equal the profile is a
  precondition for staying break-neutral.
- **Localization (PP-R3).** No composer localizes tokens today; a single resolver
  is the natural (and currently absent) localization seam. Enforcing the doctrine
  centralizes a capability that does not exist yet — a coupling to note, not a
  defect.
- **Studio-panel (Site 5).** Dead v2-DOM composer; coupled to obsolete classes.
  Enforcing the doctrine would orphan it entirely — but it must be *verified
  unreachable* (not merely assumed) before it is relied upon to be inert.

**Geometry verdict (factual):** enforcement is **low geometry risk** *iff* the
canonical composition keeps today's Print/PageMap order and separator lengths
(`SETTING LOCATION — TIME`, ` ` / ` — `). The single high-blast item is Flow's DOM
convergence, which is page-truth-neutral but framework-locked.

---

## 7. Findings

1. **The codebase does NOT yet obey the single-resolver law for *projection*.**
   There are **four live composition sites** (Flow, Print, PageMap-measure,
   Nav-index) plus **one dead legacy composer** (studio-panel). The law is not in
   force at the rendering layer.

2. **The codebase ALREADY obeys the law for *truth/storage*.** The slug is stored
   only as a structured record (schema-v3 `attrs.setting`/`attrs.time` + content
   location); the normalizer extracts `{setting, location, time}` and explicitly
   refuses to compose a string. No surface stores a flat slug. **The doctrine's
   foundation ("slug is structure, not a sentence") is already real in the
   document** — what is duplicated is the projection, not the truth.

3. **Three of the four live composers already agree** on the screenplay-convention
   order `SETTING LOCATION — TIME` (Print, PageMap-measure, Nav-index). The
   doctrine's named divergence reduces to **Flow vs. that shared convention.**

4. **Flow's composer is categorically different** — a DOM assembly of interactive
   pickers + a content span, not a string join. Its order is DOM order; its
   separators are literal text nodes. Converging it is bound to the LOCKED
   picker/authoring model, not a join-string edit.

5. **Separator vocabulary is doubly-sourced** — profile-owned in PageMap (Site 3),
   hardcoded in Print (Site 2) and Nav-index (Site 4). They coincide only on
   default values; this is a latent desync risk (custom profile → PageMap length ≠
   Print display → pagination drift).

6. **PDF export is already single-sourced to Print**, and the entire
   navigation/context family (outline, document-outline, navigator, catalogue,
   breadcrumb, scene search) is already single-sourced to Nav-index. These two
   families do not multiply the divergence.

7. **PageMap measurement is the geometry coupling.** It composes for *length*, and
   its order/separators equal Print's today, so pagination is calibrated to the
   convention string. Any future single resolver is geometry-neutral only while it
   preserves that composed length.

8. **No composer localizes** the vocabulary tokens for RTL; there is no
   localization seam in any current composition path (consistent with PP-R3).

9. **Site 5 (studio-panel) is stale** — it reads v2-era DOM (`.sh-location`,
   `data-blockType='scene-header'`) the v3 NodeViews no longer emit, so it composes
   nothing under v3. A latent dead path, not a live divergence.

---

## Stop Condition

Truth discovery complete. **No implementation, no recommendation, no fix.** This
audit maps where slugs are composed/rendered/measured/reconstructed today, shows
the codebase obeys the doctrine in *storage* but not in *projection* (4 live + 1
dead composer), and assesses the blast-radius of enforcement. Schema-v3 (LOCKED),
single-resolver page truth (Law 12), `.rga` portability (Law 11), the RTL
convention, the Print Truth Doctrine, and the Slug Truth Doctrine were the ground
this stood on and were not reopened. The next decision belongs to the user.
