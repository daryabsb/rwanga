# Flow Slug Convergence Audit

**Date:** 2026-06-01
**Phase:** Filmustageation — Flow Convergence Investigation
**Status:** INVESTIGATION ONLY. No code, no schema, no PageMap, no Print, no Flow
redesign. Branch `main`, HEAD `3a197fd8`, single worktree, clean (only known
untracked noise). Investigates *how* Flow could consume SlugResolver tokens while
preserving the LOCKED picker/contentDOM authoring model. Proposes a slice
boundary; implements nothing.

**Grounded in:** `SLUG_TRUTH_DOCTRINE_V1` (accepted), `SLUG_RESOLVER_AUDIT`,
`SLUG_RESOLVER_DESIGN_BRIEF` §7 (Flow notes), the shipped SlugResolver V1
(`728b53c4`), and the LOCKED framework/Flow decisions (memory:
`project_ide_script_framework_locked` @ `64e49140`, `project_ide_flow_view_locked`).

---

## Executive Summary

The doctrine direction is fixed: **Flow's composed slug moves to screenplay-
convention order (`SETTING LOCATION — TIME`) to match Print, while the picker
stays the authoring input.** The shipped resolver already owns that order and
separators; three surfaces (Print, PageMap, Nav) consume it. Flow is the last
divergent surface.

The crux is mechanical and narrow: **Flow's `SceneHeadingNodeView` builds its DOM
children in a fixed order with the editable `contentDOM` (location) LAST and the
separators hardcoded** (`v3-node-views.js:97–143`). Converging means (a) **moving
the `contentDOM` into the middle** (between the setting picker and the time
picker) and (b) **sourcing the separators from the convention** instead of the
hardcoded ` — ` / ` / `. Both are legal in ProseMirror — a NodeView may place its
`contentDOM` anywhere among non-editable chrome siblings. **No schema change, no
attr change, no PageMap/Print contact.**

The risk is not structural — it is **behavioral**: the LOCKED slug Enter-flow,
Tab-cycle, and caret/selection model were frozen with `contentDOM` last. Moving
it changes DOM traversal order, which is what caret/Tab/Enter navigation follow.
The convergence slice is therefore **behavior-gated**: prove the frozen
keyboard/caret behavior is unchanged before touching anything visual.

A precise note that shapes everything below: **Flow consumes the token *order +
separator* convention, NOT the resolver's composed string and NOT its empty-field
collapse.** Flow maps token *kinds* to DOM widgets (setting/time → `<select>`,
location → `contentDOM`, sep → span) and must always render every widget (the
authoring surface can never collapse an empty field away — the writer must be
able to fill it).

---

## 1. Current NodeView Structure

`SceneHeadingNodeView` (`renderer/js/doc-types/screenplay/v3-node-views.js:97–143`)
builds `this.dom` (`div.rga-scene-heading-v3`, a flex row) with **five children,
in this fixed constructor order**:

| # | Child | Class | Editable? | Source | Notes |
|---|---|---|---|---|---|
| 1 | setting `<select>` | `.rga-scene-heading-v3-setting` | chrome (`CE=false`) | `node.attrs.setting` | picker; `change` → `_setAttr('setting')` |
| 2 | `' — '` span | `.rga-scene-heading-v3-sep` | chrome | **hardcoded literal** (`:120`) | em-dash |
| 3 | time `<select>` | `.rga-scene-heading-v3-time` | chrome (`CE=false`) | `node.attrs.time` | picker; `change` → `_setAttr('time')` |
| 4 | `' / '` span | `.rga-scene-heading-v3-sep` | chrome | **hardcoded literal** (`:136`) | slash |
| 5 | location `contentDOM` | `.rga-scene-heading-v3-location` | **PM-editable** | inline content | `this.contentDOM`; **LAST** |

→ Flow visible order today: **`SETTING — TIME / LOCATION`**.

Supporting behavior already in place:
- `_setAttr(key, value)` (`:145–155`) mutates attrs via `setNodeMarkup` — the
  picker is a pure input affordance; truth stays on the node.
- `update(node)` (`:157–168`) refreshes picker values on external attr change
  (undo/paste). It does **not** rebuild the DOM or re-read any order/separator.
- `stopEvent` (`:170–177`) and `ignoreMutation` (`:178–180`) isolate the two
  `<select>` elements **by element identity** (`event.target === this._settingSelect`),
  not by position — so they survive a reorder unchanged.
- Separators are **literal text nodes**, not sourced from any convention.
- Vocabulary (`_settingOptions`/`_timeOptions`/`_sceneWord`) is read lazily from
  the active doc (`_vocab()`, `:220`) — there is **no convention (order/separator)
  read** anywhere in the NodeView today.

The canonical resolver contract Flow would consume (shipped `728b53c4`):
`Rga.SlugResolver.compose(heading, convention)` → `{ text, tokens, length }`,
where `tokens` is an ordered list of `{ kind: 'setting'|'location'|'time'|'sep',
value }`; `Rga.SlugResolver.DEFAULT_CONVENTION = { order:['setting','location',
'time'], separators:{ settingLocation:' ', locationTime:' — ' } }`; and the layout
profile owns `blocks.sceneHeading.{order,separators}` (the same object Print/
PageMap use).

---

## 2. Picker / contentDOM Constraints

**ProseMirror NodeView rules (what is and isn't allowed):**
- A NodeView with a `contentDOM` must render the node's content into exactly that
  one element. The `contentDOM` **may be nested anywhere** inside `dom`, including
  *between* non-editable chrome siblings — placement among siblings is just DOM
  order; PM does not require it to be first or last. **→ Moving location to the
  middle is legal.**
- Chrome siblings must be `contentEditable=false` (they are) and their mutations
  ignored via `ignoreMutation` (they are, by element identity). Reorder does not
  break this because the guards key on identity, not position.
- There must be exactly **one** `contentDOM`. Convergence keeps exactly one
  (location); it only moves it.

**The real (non-PM) constraints — the LOCKED authoring model:**
- **Caret/selection follow DOM order, not visual order.** With `contentDOM` last
  today, "click into the slug / type the location" lands at the natural end of the
  row. With `contentDOM` in the middle, the editable region sits between two
  `<select>` widgets — caret entry, arrow-key traversal across the pickers, and
  click-to-edit targeting all change traversal context.
- **The frozen slug Enter-flow** (Enter from the slug → next block) and **Tab
  cycle** (action↔character↔dialogue↔shot) were frozen at `64e49140` with this
  DOM shape. They depend on the cursor being in the location `contentDOM`; the
  behavior must be **identical** after the reorder, not merely similar.
- **Pickers are `<select>` widgets that show a VALUE**, so Flow cannot render the
  setting/time *token text* as characters — it places the *picker* where the
  token sits and the picker displays the value. Only the `location` token maps to
  editable text; `sep` tokens map to separator spans. **→ Flow consumes token
  KIND + ORDER + the sep strings, never the composed `.text`.**
- **No empty-collapse.** The string resolver omits an empty field and collapses
  its separator. Flow must NOT: a picker always has a value, and the location
  `contentDOM` must always exist (even empty, showing the `Location` placeholder
  via `:empty::before`) so the writer can type. Flow's projection rule is
  "always render every widget," distinct from the string rule.
- **No schema/attr change is needed or allowed:** setting/time remain attrs,
  location remains inline content. Convergence is **DOM-assembly order +
  separator source only**.

---

## 3. Token-Consumption Options

Four ways Flow could consume the convention. Each preserves attrs-as-truth and
schema; they differ in how/whether DOM order changes.

### Option A — Convention-driven DOM assembly *(principled; recommended direction)*
The NodeView reads the **order + separators** (the same convention the resolver
consumes) and builds its children by iterating the order: for each kind, render
the matching widget — `setting`/`time` → its `<select>`; `location` → the
`contentDOM`; insert the convention separator between adjacent widgets. Result:
`[setting picker][" "][location contentDOM][" — "][time picker]` → visible
`SETTING LOCATION — TIME`.
- **Truth:** unchanged (pickers→attrs, location→content).
- **Order:** single-sourced; Flow becomes a genuine projection of the convention.
- **Separators:** sourced from the convention (the hardcoded ` — `/` / ` retire).
- **Cost:** the `contentDOM` moves to the middle → the LOCKED caret/Tab/Enter
  behavior must be re-verified (the crux risk).

### Option B — Static reorder to match the convention *(simplest; less principled)*
Hard-reorder the constructor to `[setting][" "][location contentDOM][" — "][time]`
without reading the convention dynamically (mirror the V1 default by hand).
- Same visual + same `contentDOM`-in-middle risk as A, but **order is duplicated**
  (Flow hardcodes what the convention already states) — re-opening the very
  multi-source problem the resolver closed. Lower effort, weaker doctrine fit.

### Option C — CSS visual reorder only (flex `order`), DOM unchanged *(rejected)*
Use `order:` on the flex children to *visually* place location between the
pickers while leaving DOM order untouched.
- **Fails the goal:** caret/Tab/selection follow DOM, not visual order → keyboard
  traversal would run visually backwards (a known a11y/UX anti-pattern), and the
  literal separator spans would sit in the wrong logical places. It also does not
  actually *consume* tokens — it is a visual trick over an unchanged divergent
  model. Documented and rejected.

### Option D — Dual representation (read-only composed slug + reveal-on-focus editor) *(rejected for this scope)*
Render a resolver-composed read-only slug as the presentation, expose pickers/
contentDOM only on focus.
- Two representations risk the "drafts against a presentation that quietly lies"
  failure if they drift; it is a **Flow redesign**, explicitly out of scope, and
  far larger than convergence requires. Rejected here (could be revisited only as
  a deliberate Flow UX redesign, not as slug convergence).

**Where Flow gets the convention (sub-decision for A/B):**
- (i) `SlugResolver.DEFAULT_CONVENTION` — always available, simplest, but ignores
  any per-doc/profile override.
- (ii) the layout profile's `blocks.sceneHeading.{order,separators}` — single-
  sourced with Print/PageMap, but couples the *continuous* Flow surface to the
  *page* profile (Flow uses nothing else from it).
- (iii) a tiny dedicated convention accessor shared by the profile + Flow.
This is a real choice the slice must make; **(i) is the smallest safe start**
(Flow inherits the same default the resolver ships), with (iii) as the clean
long-term home if per-doc convention overrides ever ship.

---

## 4. Risks

| # | Risk | Severity | Why |
|---|---|---|---|
| R1 | **LOCKED caret / Tab-cycle / Enter-flow behavior changes** when `contentDOM` moves to the middle | **HIGH** | These were frozen at `64e49140` with `contentDOM` last; DOM traversal order drives them. Must be proven identical, not "similar." |
| R2 | **Click-to-edit / caret entry into location** with pickers on both sides | Medium | Entering the editable region between two `<select>` widgets is a new selection context; edge cases (empty location, caret at boundaries). |
| R3 | **Separator change is design-visible** (` — `/` / ` → ` `/` — `; slash disappears) | Medium | It is the intended convergence, but the exact Flow rendering is a **designer call** under the design freeze — not engineer-invented. |
| R4 | **Empty-location layout** — contentDOM in the middle with empty location + trailing time picker | Low–Med | The `Location` placeholder + flex gaps must read cleanly (no stray `  — ` gap); a visual detail to verify. |
| R5 | **RTL** flex direction + future localized order/separators | Low–Med | Flow already overrides font for RTL; the reorder must not break RTL flow, and the convention may later localize order (kept OUT of this slice). |
| R6 | **Convention availability at construction** | Low | The NodeView builds synchronously; the convention source (Option-A (i)/(ii)/(iii)) must be present, with `DEFAULT_CONVENTION` as the safe fallback. |
| R7 | **`stopEvent`/`ignoreMutation` after reorder** | Low | Guards key on element identity, not position → expected to survive, but re-test. |
| — | PageMap / Print / PDF / pagination | **None** | Flow is continuous (not paginated) — `project_flow_continuous_doctrine`. Reorder is page-truth-neutral; no PageMap/Print/PDF contact. |
| — | Schema / `.rga` storage | **None** | setting/time stay attrs, location stays content; convergence is DOM-assembly order only. |

---

## 5. Recommended Future Slice Boundary

**Slice name (proposed):** *Flow Slug Convergence (Option A, behavior-gated).*

**In scope (and only this):**
- Rework **only** `SceneHeadingNodeView`'s DOM assembly so children render in the
  convention **order** with the **location `contentDOM` placed per the order**
  (middle), and separators **sourced from the convention** (retire the hardcoded
  ` — ` / ` / `). Consume the convention via `SlugResolver.DEFAULT_CONVENTION`
  (Option-A(i)) as the smallest safe start.
- Pickers remain attrs-driven input affordances; `update`/`stopEvent`/
  `ignoreMutation` adjusted only as needed to keep their identity-based isolation.
- Flow keeps its **always-render-every-widget** rule (no empty-collapse).

**Explicitly OUT of scope:**
- Any schema/attr change; any `.rga` change.
- PageMap / Print / PDF / pagination (untouched; page-truth-neutral).
- RTL vocabulary localization (PP-R3) and any localized order/separators.
- Recognition Bundle items (underline already shipped for Print; not part of this).
- Flow redesign beyond the slug row (Options C/D rejected).
- Per-doc convention overrides (defer; would motivate Option-A(iii) later).

**Binding gates (behavior-first, then visual):**
1. **Behavior regression gate (the hard gate):** a Playwright keyboard spec that
   proves, against the frozen behavior, that after the reorder: caret enters the
   location field correctly; the slug **Enter-flow** still creates the next block;
   the **Tab cycle** is unchanged; arrow/selection traversal across the row is
   sane. This must be green **before** any visual sign-off.
2. **Visual convergence check:** a computed-style/DOM spec asserting Flow now reads
   `SETTING LOCATION — TIME` (order + separators match the convention/Print),
   plus LTR + RTL screenshots.
3. **Designer sign-off** on the separator change (R3) under the design freeze —
   engineers wire the order; the designer owns how the separators present.
4. **No-regression:** existing v3 NodeView / editing / Flow tests stay green; the
   resolver's skipped "Flow compliance" test (in `slug-resolver-parity.test.js`)
   is un-skipped and made to assert Flow's order matches the resolver tokens.

**Sequencing:** behavior gate (1) → visual (2) + designer (3) → flip the pending
Flow-compliance test (4). The slice is **page-truth-neutral and schema-neutral by
construction**; its entire risk budget is the LOCKED keyboard/caret model, which
gate (1) exists to protect.

---

## Stop Condition

Investigation complete. **Nothing implemented** — no code, schema, PageMap, Print,
or Flow change. This maps the current NodeView, the ProseMirror + LOCKED-behavior
constraints, four token-consumption options (Option A recommended; C/D rejected),
the risks (R1 the caret/Tab/Enter behavior being the sole high one), and a
behavior-gated slice boundary. The LOCKED framework/Flow decisions and the design
freeze are the ground this stands on and were not reopened. The next decision —
authorize the convergence slice (Option A, behavior-gated), amend it, or hold —
belongs to the user.
