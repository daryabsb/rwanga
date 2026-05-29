# Filmustageation — Scenes Sidebar Catalogue — Engineering Slice Plan

> **Plan only. No implementation, no code edits, no CSS edits, no commits beyond authoring this doc.**
> Created: 2026-05-29 · HEAD: `bca4cbf0` (origin/main in sync).
> Inputs: designer UX direction (`rwanga-editor/docs/Filmustageation/SCENE_SIDEBAR_CATALOGUE_UX_DIRECTION.md`), Phase 0 audit + UX spec (`docs/filmustageation/SCENES_SIDEBAR_CATALOGUE_PHASE0.md`), post-F1A review (`docs/filmustageation/FILMUSTAGEATION_POST_F1A_REVIEW.md`), Core/Plugin Doctrine, and the current shell at HEAD `bca4cbf0`.
> Code grounding: `rwanga-editor/renderer/js/shell/panels/scene-navigator.js` (363 lines, SN.1 already integrated), `rwanga-editor/renderer/css/shell.css` lines 1499–1697, `rwanga-editor/tests/unit/shell/scene-navigator.test.js` (30+ tests), `rwanga-editor/tests/e2e/filmustageation/scene-navigator-autoscroll.spec.js` (SN.1's spec).

This document translates the designer's UX Direction into safe engineering slices grounded in the post-F1A.7 + SN.1 shell. It is the bridge between direction (designer + Phase 0 spec) and implementation (a future authorised slice brief). It selects no implementation; it only enumerates and orders candidates and recommends the safest next one.

The binding moratoria from the parent specs are **inherited as constraints, not re-debated**: nav-index moratorium (`framework/nav-index.js` is off-limits), contamination triad moratorium (`Rga.Doc.tagRegistry`, `Rga.Doc.addEntity`, `schema.marks.tag` are off-limits), and Plugin relocation (S7) deferred until a second doc-type or contract-test arc lands.

---

## 1. Designer Decisions Accepted

Each item below is treated as **implementation direction** for the slices in §3. They have been ratified by the designer in the UX Direction document and are consistent with the Phase 0 audit, the post-F1A review, the Doctrine, and the current code's shape. They are not re-litigated by any slice unless the designer reopens them in writing.

### 1.1 The row is a label, not a card (UX Direction §1, §13)

Single line. Always. `min-height: 28px` is the calm default. No leading per-row icon, no per-row button, no drag handle, no checkbox, no color swatch. The reserved-track signal margin already preserves no-reflow on indicator presence/absence (grid `26px 1fr auto auto`). Hover is a whisper — no chrome reveal. **Implementation impact:** every slice in §3 inherits this as a structural rule; the row's grid + classes are baseline, not redesigned.

### 1.2 Current vs selected separation invariant (UX Direction §2)

`.rga-shell-scene-navigator-row-current` (brand-pink left rail, source: `ScriptSession.currentScene.nodeId`) and `.rga-shell-scene-navigator-row-selected` (soft fill + outline ring, source: `_selectedNodeId`) are two distinct states that may coexist. Current owns the inline-start edge; selected owns the row interior. Never collapsed, never promoted to a louder treatment. **Implementation impact:** SN.1 already added a third concern (auto-scroll on current change) without disturbing this; every subsequent slice must preserve both visual states and their 30+ unit-test assertions.

### 1.3 Three-zone row anatomy is the right skeleton (UX Direction §1)

Index gutter (number) · heading (location-led slug, ellipsised, flexes) · signal margin (notes + revision marks, reserved width) · page hint (reserved width). The current grid already expresses this. **Implementation impact:** no slice rebuilds the grid. SN.3 (slug sub-treatment) operates inside the heading zone. SN.2 (Lucide indicators) operates inside the signal margin. Both keep the grid intact.

### 1.4 No emoji in chrome (UX Direction §6, §7, §8)

`📝` and `🚩` are platform-dependent font-fallback glyphs and read as debug-noise against the "instrument labeling" voice. Replace with Lucide marks. Distinct **shape** between notes and revision (not color alone — colorblind-safe). Marks live in the reserved signal track. **Implementation impact:** SN.2 is the direct executor of this call.

### 1.5 Drop the decorative `#` from scene numbers (UX Direction §4)

**Already true in code.** `scene-navigator.js:152` is `num.textContent = String(scene.sceneNumber)` — no `#` is rendered today. The designer call is preventive, not corrective. **Implementation impact:** no slice needed; if any future redesign tries to re-add a `#`, this section says no. Listed here as a discipline guard, not a task.

### 1.6 Numbers from `nav-index` only — never compute (UX Direction §4)

`scene.sceneNumber` is the engine's contract; the catalogue is a presenter. Gutter must tolerate ~3–4 mono characters (`A1`, `12`, `12A`) gracefully now so it never has to be relaid out for production numbering later. **Implementation impact:** this affects the gutter width if SN.3 is bundled with a typography revisit, but the current `26px` track is already wide enough for `999`; widening to ~32px to fit `A12B` would be a cosmetic refinement bundled with SN.3 if designer requests it. **No slice owns this in isolation.**

### 1.7 Page hint is presence-only, single number, no fallback noise (UX Direction §5)

Show `p.N` when `PageMap` has the scene; show empty when it doesn't (no `p.?`). Right-aligned in the reserved page track, monospaced, dim. **Implementation impact:** matches current code (`_pageNumberForScene` returns `null` → `''` text). No slice changes this.

### 1.8 No location color-coding, no location chip (UX Direction §5)

Location is text inside the heading; never a separate pill, swatch, or tint. The heaviest token already lives in the slug — duplicating it as a color is breakdown-panel territory. **Implementation impact:** rules out a tempting SN.3 sub-direction (location-tinted gutter). Not a task; a no.

### 1.9 Header is identity + at most one figure (UX Direction §9)

Quiet section identity matching `.sidebar-section-header` voice. **At most one** awareness figure (scene count) — used with caution; if it reads as inventory rather than orientation, drop it. **No button strip.** **Implementation impact:** SN.4 implements; whether the count appears is the one designer-input decision SN.4 needs.

### 1.10 Find, not query (UX Direction §10)

A single progressive find field that substring-matches the visible slug + number. Transient (Escape clears). No facets, no saved views, no tag filters. **Two Escapes:** first clears filter, second clears selection. **Implementation impact:** SN.6 implements; the Escape precedence rule is locked here so SN.6 doesn't have to re-argue it.

### 1.11 Empty-state direction (UX Direction §11)

Two empties: **no scenes yet** (calm sentence about what the catalogue will show) and **no results** (find query matched nothing — with a one-tap clear-filter affordance). Doc-type-neutral tone — no screenplay-mechanic copy in CORE-frame UI. No illustration, no CTA button, no hero. **Implementation impact:** SN.5 owns the "no scenes" copy refresh. The "no results" branch is part of SN.6 (it doesn't exist until find ships).

### 1.12 Auto-scroll current row was the spine (UX Direction §14, Closing §3 — SN.1)

**Already shipped at `88bf8fd2`.** The instant alignment (`behavior: 'auto'`, `block: 'nearest'`), the change-gated trigger via `_lastCurrentNodeId`, and the no-fight-with-manual-scroll discipline are all in place. **Implementation impact:** SN.1's `_lastCurrentNodeId` cleanup paths in `_render`'s empty branch + `unmount` + `_reset` are existing invariants. Any slice that consolidates `_render` must preserve them (the empty-branch reset is the easiest to forget — flag in slice briefs).

### 1.13 Keyboard model is correct (UX Direction §13)

ArrowUp/Down move selection (not cursor); Home/End jump first/last; Enter bridges selected → cursor; Escape clears selection. **Implementation impact:** SN.6 inherits this and must adjudicate the Escape precedence with the find filter (locked in §1.10).

### 1.14 The motion budget is zero theatre (UX Direction §6, §13)

All slices use instant transitions (`behavior: 'auto'`) for scroll, `var(--transition-fast, 0.1s ease)` for hover, no decorative animation on row appearance/disappearance. **Implementation impact:** SN.2 must avoid icon morph/fade; SN.6 must avoid result-set list animation.

### 1.15 What lives in the inspector instead (UX Direction §15)

Notes content (the catalogue shows a presence mark; the inspector shows text). Tagged-entities-for-this-scene (future scene-detail inspector panel). Revision history. Scene-level metadata editing (rename location, change time-of-day). Scene-level AI observations. Estimated duration. **Implementation impact:** no slice may make a row editable, expandable, or show content from these surfaces.

### 1.16 What lives in breakdown mode instead (UX Direction §16)

The category accordion (`CAST (5)`, `PROPS (8)`, `STUNTS (14)`) and any per-category CMS verbs. Cross-scene production queries. Bulk operations, stripboard, status tracking. **Implementation impact:** explicit non-goal for every slice. The breakdown surface lives in a rail-switched mode the writer enters deliberately, not in the writing catalogue.

---

## 2. Designer Decisions Needing Confirmation

Items the designer named with multiple acceptable resolutions, or the implementer cannot pick without product-side ratification. Each is named here so the corresponding slice's brief can carry an explicit "designer Q to resolve before slice begins" block.

| ID | Question | Resolution affects | Why not implementer's call |
|---|---|---|---|
| **C1** | Exact Lucide glyph for "has notes" — `notebook-pen` vs `sticky-note` vs `square-pen` vs other? | SN.2 | UX Direction §6 names "Lucide flag mark" by family but does not pin the specific glyph; the choice is a voice/identity call, not a code call. |
| **C2** | Exact Lucide glyph for "has revision flag" — `flag` vs `flag-triangle-right` vs other? **Must shape-distinguish from C1.** | SN.2 | Shape distinction is named (§7) but the specific glyph is unselected; SN.2 cannot ship without it. |
| **C3** | Indicator color stance — "calm neutral" (e.g., `--text-tertiary`) vs the gold accent (`--accent-gold`)? UX Direction §6 says "calm neutral or the gold accent — never a colored tile." | SN.2 | Either is permissible per direction; the consistency call (do both marks share the same color, or does revision get a slightly different tone?) is designer's. |
| **C4** | Indicator size — current is text-glyph `font-size: 10px`. Lucide inline SVG typically wants 12–14px to feel balanced at this row weight. Designer call: pixel size + line-height. | SN.2 | Visual rhythm in the signal track; affects `shell.css` `.rga-shell-scene-navigator-indicator` rule. |
| **C5** | Header shows scene count (`Scenes · 24`) or label only (`Scenes`)? UX Direction §9: "if it reads as a tally rather than a glance, it should be dropped." | SN.4 | The "tally-vs-glance" judgment is the designer's voice call; engineer should not pick. |
| **C6** | Header treatment — reuse Outline's `.rga-shell-outline-section-header` voice (small uppercase wide-tracked), or a Scene-Navigator-specific subclass with slightly different rhythm? | SN.4 | Reuse preserves sibling-panel rhythm but ties SN.4 to Outline's future evolution; subclass gives independence at the cost of design surface area. |
| **C7** | Empty-state body copy — designer-final sentence. UX Direction §11 calls for doc-type-neutral, calm, single-sentence ("Scenes will appear here as you write" is a candidate, not a directive). | SN.5 | Voice. Pure copywriting decision. Also: keep title `"Scenes"` (matches panel identity)? Confirm. |
| **C8** | Find field — placeholder copy, leading search icon (yes/no, Lucide glyph if yes), focus-state chrome (border, background, ring weight). | SN.6 | Input chrome at this scale is a stack of small design decisions the engineer cannot pick from direction alone. |
| **C9** | Find field collapse-on-blur behavior — does the input stay rendered when not focused, or collapse to a discreet glyph that expands on click/focus? | SN.6 | UX Direction §10: "collapsed/understated by default; expands on focus." This permits two interpretations: always-visible-but-small, or icon-only-until-clicked. |
| **C10** | "Find with no results" empty-state copy — sentence + "Clear filter" affordance treatment (text link, button, icon-button)? | SN.6 | UX Direction §11 names a clear-filter affordance but does not pin its shape. |
| **C11** | Slug sub-treatment scope — location-only-bold vs location-only-color-stronger vs location-only-and-modifier-opacity? Single separator glyph (em-dash today vs middle-dot vs no separator)? | SN.3 | Multiple acceptable visual treatments; UX Direction §3, §3.8 give the principle ("instrument labeling — precise, small, subordinate") without pinning typography numbers. |
| **C12** | Gutter color — UX Direction §4 calls for `--accent-gold` on the scene number. The current CSS uses `--text-tertiary` for the number cell. Is the gold migration part of SN.3, a standalone SN.G, or deferred until a typography pass? | SN.3 (if bundled) | The accent-gold call affects identity; bundling with slug sub-treatment is a designer-collaboration moment, not an engineer-incremental one. |

**Bundling note.** C1+C2+C3+C4 are tightly coupled — they ship together in SN.2. C5+C6 ship together in SN.4. C7 is standalone for SN.5. C8+C9+C10 ship together in SN.6. C11+C12 should be debated together in SN.3 (if SN.3 is authorised; see §3).

---

## 3. Proposed Slice Sequence

Each slice below carries: slice id · purpose · files likely touched · risk class · designer dependency · Playwright coverage required · unit coverage required · stop condition (the explicit "do not do this in this slice" guard).

Order is roughly "safest visible improvement, lowest design ambiguity first." All slices honor the inherited moratoria (no nav-index, no contamination triad, no plugin relocation).

### SN.2 — Lucide marks replace emoji indicators

**Purpose.** Replace the `📝` and `🚩` `textContent` indicators with inline Lucide SVG marks. Distinct shapes (notes glyph ≠ revision glyph) so the difference reads colorblind-safe. Keep size, color stance, and tooltip semantics consistent with the existing `aria-label` contract.

**Files likely touched.**
- `rwanga-editor/renderer/js/shell/panels/scene-navigator.js` — `_indicator(glyph, label)` (lines 178–185) becomes `_indicator(glyphName, label)` and emits `Rga.Icons.Lucide(name)` (or whatever the established API is — confirm at slice start). `_buildRow` (lines 162–163) passes glyph names instead of emoji strings.
- `rwanga-editor/renderer/css/shell.css` lines 1614–1624 — `.rga-shell-scene-navigator-indicators` font-size + `.rga-shell-scene-navigator-indicator` line-height rules need to adapt to inline SVG sizing per C4. Preserve `opacity: 0.7` calibration unless C3 changes it.

**Risk.** Low. Cosmetic; isolated to the signal track. No row-grid change, no state-class change. The `Rga.Icons.Lucide` plumbing is already used by the activity rail (`clapperboard` etc.), so the path is established.

**Designer dependency.** **Yes — C1, C2, C3, C4 all must be answered in the brief before the slice begins.** Without these the slice cannot start.

**Playwright coverage required.** New spec — `rwanga-editor/tests/e2e/filmustageation/scene-navigator-indicators.spec.js`. Asserts: (a) when a scene has notes, the row's `.rga-shell-scene-navigator-indicators` contains an `<svg>` element (not a text glyph); (b) when a scene has a revision flag, a *different* `<svg>` element renders (shape-distinct check via tag/attr); (c) when neither, the signal track is empty but its grid width is reserved (no reflow). Sample fixture with one of each.

**Unit coverage required.**
- The existing unit tests at `tests/unit/shell/scene-navigator.test.js` include assertions that the indicator span has the matching `aria-label` ("Has notes" / "Has revision flag"). Those continue to pass — `_indicator` keeps the `aria-label`.
- Existing tests that check `indicators.textContent === '📝'` or `.includes('📝')` (if any — verify at slice start) **must be migrated** to check for SVG presence + correct aria-label. Slice report must list each migrated assertion.
- New test: `_indicator` emits an `<svg>` child when the platform provides `Rga.Icons.Lucide`, falls back gracefully (text glyph or empty) when it doesn't (graceful-degrade per Doctrine Law 11).

**Stop condition.** This slice does NOT: (a) touch the scene-number column color (that is C12, an SN.3 concern), (b) introduce a new icon for any row state beyond notes + revision, (c) add a row-leading icon for INT./EXT. or time-of-day (UX Direction §8 forbids), (d) animate icon appearance/disappearance, (e) touch any test outside the scene-navigator unit + the new Playwright spec.

---

### SN.4 — Quiet section header (identity + optional count)

**Purpose.** Add a small, calm header above the list — section identity (`Scenes`) and at most one awareness figure (scene count, if C5 lands "yes"). Match the existing sibling-panel rhythm (Outline panel has `.rga-shell-outline-section-header` at `shell.css:1708+` per Phase 0 spec §1.8). No buttons, no toolbar — header is identity only.

**Files likely touched.**
- `rwanga-editor/renderer/js/shell/panels/scene-navigator.js` — `_render` (after `wrapper` creation, before the empty/list branches) appends a header div. The count, if C5=yes, reads `scenes.length`. No nav-index extension needed.
- `rwanga-editor/renderer/css/shell.css` — either reuse `.rga-shell-outline-section-header` (C6=reuse) or add `.rga-shell-scene-navigator-section-header` (C6=subclass) matching the Outline's voice but scene-navigator-namespaced.

**Risk.** Low. Additive only. Header is visible in both populated and empty states (or empty branch only — designer call could split this; default per spec §1.9: present in both, since identity is identity regardless of content).

**Designer dependency.** **Yes — C5 (show count or not) + C6 (reuse vs subclass).** Header treatment otherwise inherits Phase 0 spec §3 + UX Direction §9 calibration.

**Playwright coverage required.** New spec — assert `.rga-shell-scene-navigator-section-header` (or chosen class) exists, contains the label `"Scenes"`, and (if C5=yes) shows the count matching the scene fixture size. Assert no button or interactive element inside the header.

**Unit coverage required.**
- New tests: header rendered with empty list (identity persists), header rendered with N scenes (count = N if C5=yes), header position in DOM (above the list, inside the wrapper).
- Existing empty-state tests must continue to pass — header rendering must not regress the empty-state assertions.

**Stop condition.** This slice does NOT: (a) add a button or affordance to the header (no sort, no group, no options — UX Direction §9 forbids), (b) animate count updates, (c) introduce a secondary metric (page-count, average scene length — Tier-3-and-below per UX Direction §3), (d) make the header sticky-with-shadow (a sticky-pinned header is in the spec; a *shadowed* sticky header is a designer-input addition deferred).

---

### SN.5 — Empty-state copy refresh (doc-type-neutral)

**Purpose.** Replace the screenplay-mechanic copy (`"No scenes yet. Press Enter on the slug line to start one."`) with a calm, doc-type-neutral sentence about what the catalogue will show. Title stays `"Scenes"`. No illustration, no CTA button, no zero-state hero.

**Files likely touched.**
- `rwanga-editor/renderer/js/shell/panels/scene-navigator.js` — `_buildEmpty` (lines 125–132). Single string change inside the `Rga.Shell.Sidebar.renderEmpty` opts.

**Risk.** Very low. One string update. No structural change.

**Designer dependency.** **Yes — C7 (final sentence, voice ratification).**

**Playwright coverage required.** Update the F1A.2 empty-state regression if it checks exact copy (verify at slice start). Otherwise no new Playwright spec needed; existing unit tests cover the surface.

**Unit coverage required.**
- The existing `tests/unit/shell/scene-navigator.test.js` test "mount with no scenes renders the empty state" includes `assert.match(empty.textContent, /No scenes yet/)`. The regex must be updated to the new copy.
- Verify no other test in the repo asserts the old copy string (slice brief includes a grep step).

**Stop condition.** This slice does NOT: (a) add a CTA action button, (b) change the title from `"Scenes"`, (c) introduce an illustration or hero block, (d) touch the `renderEmpty` helper itself (it is CORE-owned), (e) preempt the "no results" empty branch (that ships with SN.6).

---

### SN.3 — Slug sub-treatment (location lead, setting+time as quieter modifiers)

**Purpose.** Render setting/time as quieter modifiers without changing row height. Bring the slug closer to UX Direction §3.8 "instrument labeling" voice while preserving single-line ellipsis. Optionally bundle the `--accent-gold` migration on the scene-number column (C12) if designer authorises in the brief.

**Files likely touched.**
- `rwanga-editor/renderer/js/shell/panels/scene-navigator.js` — `_buildRow` (lines 155–158): replace the single `<span class="rga-shell-scene-navigator-heading">` with two segments — primary (location text + optional setting prefix) and secondary (time-of-day + optional setting if not in primary). The exact split depends on C11.
- `rwanga-editor/renderer/css/shell.css` — `.rga-shell-scene-navigator-heading` sub-rules (new): `.rga-shell-scene-navigator-heading-primary` and `.rga-shell-scene-navigator-heading-secondary` with opacity/weight per C11. Possibly `.rga-shell-scene-navigator-num` color migration to `--accent-gold` per C12.

**Risk.** **Medium.** This breaks the existing unit-test assertion that `.rga-shell-scene-navigator-heading.textContent === scene.headingDisplay`. The slice brief must call out every affected test and migrate them. Also: the ellipsis behavior changes — today the whole slug ellipsises; under sub-treatment, the primary segment is what truncates while the secondary segment stays visible (or vice versa, per C11). This is a calibration call the brief must pin.

**Designer dependency.** **Yes — C11 (sub-treatment shape) + C12 (gutter color migration scope).** This is the highest-design-ambiguity slice in the candidate set.

**Playwright coverage required.** New spec — assert both segments render in the documented order, widths within row constraint, ellipsis on long location strings. Visual-fidelity check for the opacity/weight values (use `getComputedStyle` rather than visual snapshots to avoid platform-rendering drift).

**Unit coverage required.**
- Migrate every existing assertion that reads `.rga-shell-scene-navigator-heading.textContent` to check the combined text across the two segments (slice brief must enumerate these).
- New tests: primary segment carries the location text, secondary segment carries setting/time per the agreed split, missing fields (no time-of-day) collapse the secondary segment without leaving an empty separator.

**Stop condition.** This slice does NOT: (a) add a new icon or chip alongside the slug, (b) make any segment editable, (c) introduce hover-revealed full-slug tooltips beyond the OS title attribute (it is already what hover does — see UX Direction §13), (d) change `headingDisplay`'s composition in `nav-index.js` (this is plugin-side rendering only; the source string stays as `nav-index` provides it).

---

### SN.6 — Lightweight find/filter (substring match + transient lens)

**Purpose.** Add a single progressive find field at the panel top. Substring matches `headingDisplay` + `sceneNumber`. Filter is transient; Escape clears it. Adds a "no results" empty-state branch. Establishes the Escape precedence: first Escape clears filter, second Escape clears selection.

**Files likely touched.**
- `rwanga-editor/renderer/js/shell/panels/scene-navigator.js` — new module-level `_filterText` state, new input element in `_render` (after header per SN.4, before list), new filter-application in the scene loop, new "no results" branch in `_buildEmpty` (or a sibling `_buildNoResults`), Escape handler in `_onKeydown` rewritten to honour precedence.
- `rwanga-editor/renderer/css/shell.css` — new `.rga-shell-scene-navigator-find` rule for the input chrome (per C8).

**Risk.** **Medium.** Three coupling points: (a) Tab routing — the input must accept focus without breaking the list's keyboard nav (today the container has `tabindex="0"`; a focused input changes the focus model). (b) Escape precedence — must be a single, documented rule, not split between filter and list. (c) The "no results" branch needs to coexist with the existing "no scenes" branch — two different empties, same surface.

**Designer dependency.** **Yes — C8, C9, C10.** The biggest stack of unanswered design questions among the candidates.

**Playwright coverage required.** New spec — type a substring, assert filtered row count; ESC clears filter (rows reappear); second ESC clears selection (selected row's outline gone); Tab into input, Tab out cycles to list; "no results" copy renders on impossible query with clear-filter affordance; clear-filter affordance restores list.

**Unit coverage required.**
- New tests: filter applies to `headingDisplay` substring; filter applies to scene-number string match; filter is case-insensitive (or case-sensitive — designer call, default insensitive); Escape precedence rule explicit; no-results branch renders when filter applied with no matches; clear-filter restores list state.
- Existing tests for keyboard nav must continue to pass — input focus must not regress Arrow/Home/End/Enter on the list.

**Stop condition.** This slice does NOT: (a) add facets, tag filters, or saved views (UX Direction §10 forbids), (b) persist the filter state across mounts, (c) add a "scenes with notes" presence toggle (UX Direction §10 names this as optional; explicit non-goal for SN.6 unless the slice brief authorises), (d) replace or compete with the command palette (Cmd+P) — find is its discoverable sibling, not a replacement.

---

### Summary table

| Slice | Risk | Designer-input items | Files | Owned moratorium violation? |
|---|---|---|---|---|
| **SN.2** Lucide indicators | Low | C1, C2, C3, C4 | `scene-navigator.js` `_indicator` + `_buildRow` + `shell.css` indicator rules | None — pure plugin-side cosmetic |
| **SN.4** Quiet header | Low | C5, C6 | `scene-navigator.js` `_render` + `shell.css` new header rule | None — uses `scenes.length`, no new per-scene data |
| **SN.5** Empty-state copy | Very low | C7 | `scene-navigator.js` `_buildEmpty` (1 string) | None — single string update |
| **SN.3** Slug sub-treatment | Medium | C11, C12 | `scene-navigator.js` `_buildRow` heading + `shell.css` heading sub-rules + possibly `.num` color | None — uses `scene.setting`/`scene.locationText`/`scene.time` already in `nav-index` |
| **SN.6** Find/filter | Medium | C8, C9, C10 | `scene-navigator.js` filter state + input + render branch + Escape rewrite + `shell.css` input chrome | None — filter is on cached in-memory `nav-index` data |

---

## 4. Recommended Next Implementation Slice

**SN.2 — Lucide marks replace emoji indicators.**

### Why SN.2 first

1. **Lowest design ambiguity among visible-impact slices.** SN.2 has four designer-input items (C1–C4) but each is a discrete pick (one of N) rather than a calibration spectrum (opacity values, sub-treatment shapes). Once the brief answers C1–C4, implementation is mechanical.
2. **Highest visible payoff per unit of risk.** The emoji glyphs are the most obvious "this is unfinished chrome" element in the panel — they read as debug-noise against the surrounding instrument-labeled type. Replacing them lifts the surface's professional tone immediately, without touching the row grid, the state classes, or any other surface.
3. **Pure plugin-side cosmetic.** Touches `scene-navigator.js` + `shell.css` only. No `nav-index.js`. No schema. No contamination triad. No `index.html` script-tag changes. The blast radius is bounded.
4. **The Lucide plumbing is already established** — `Rga.Icons.Lucide` is the activity-rail's pattern. SN.2 inherits a working contract rather than introducing one.
5. **Preserves SN.1, the separation invariant, keyboard nav, click-to-jump, and the empty state.** None of these surfaces is touched. The slice's blast radius is one helper function (`_indicator`) and one CSS rule block.
6. **It is the safest test of the SN.x designer-collaborated rhythm.** SN.1 was an implementer-only slice. SN.2 is the first slice that needs designer input to start; getting the brief → designer-Q → ratification → implementation handshake right on a low-risk slice de-risks the same pattern for SN.3 and SN.6 later.

### Why not SN.5 (the smallest possible slice)

SN.5 has the lowest absolute risk (one string change), but the visible payoff is tiny — the empty state appears only when no scenes exist, which is a small slice of session time. SN.2 is small enough to ship safely and large enough to matter every time the panel is open.

### Why not SN.4

SN.4 is also low-risk but introduces a header that the panel does not have today — that is a more visible change than swapping two glyphs, and ratifying header voice / count-or-not (C5, C6) is a larger conversation than picking two Lucide names. Defer until after SN.2 lands and the SN.x designer rhythm is grooved.

### Why not SN.3 or SN.6

Both are medium-risk and carry the largest designer-input stacks. Best held until after at least one designer-collaborated slice (SN.2) has been ratified end-to-end.

### What SN.2 unlocks next

Once SN.2 lands, the natural progression is:
1. **SN.5** (empty-state copy refresh) — quick win in the same designer rhythm.
2. **SN.4** (quiet header) — adds identity + optional count.
3. **SN.3** (slug sub-treatment) — the typography pass, bundled with C12 (`--accent-gold` migration) if designer authorises.
4. **SN.6** (find/filter) — the last and largest. Brings the "no results" empty branch needed by §1.11.

This ordering is recommendation, not commitment — the user chooses each next slice in writing.

---

## 5. Explicit Non-Goals

The following are **explicitly not in scope** for any slice in this plan. They must not appear in any SN.x brief without a new strategy session and a fresh authorising brief that names them by ID.

### 5.1 Inherited moratoria (binding across all SN.x)

- **No `framework/nav-index.js` changes.** No new fields on the `scenes[]` shape, no extension of `idx.pages[]`, no new index-side method. Every slice in this plan reads the existing `nav-index` contract without modifying it.
- **No `framework/screenplay-normalizer.js` changes.** Domain naming is a separate framework-neutrality arc.
- **No contamination-triad changes.** `Rga.Doc.tagRegistry`, `Rga.Doc.addEntity`, `schema.marks.tag` are off-limits.
- **No plugin relocation (S7) — `shell/panels/scene-navigator.js` stays where it is.** That's a separate ownership-recovery arc deferred until Option E (from the post-F1A review §6) or a second doc-type lands.

### 5.2 Data-model creep (off-limits, deferred)

- **No per-scene duration calculation** (S8 from Phase 0 spec). Requires PageMap-eighths math in `nav-index.js`. Deferred.
- **No per-scene tag-mention counts or summaries** (S9). Requires per-scene tag aggregation in `nav-index.js`. Deferred. UX Direction §3 Tier-below-the-line explicitly forbids.
- **No act / sequence / structural grouping** (S10). Requires schema + nav-index extension. Deferred. Memory: `project_production_scene_numbering_deferred`.
- **No transition labels (CUT TO:), continuity markers, or block counts on rows.** UX Direction §3 Tier-below-the-line forbids. Stays in the inspector when a scene is inspected.

### 5.3 Dashboard creep (off-limits, design rejection)

- **No counts in row chrome.** No `(5)`-style parenthetical-count interface anywhere in the catalogue. UX Direction §1, §3, §9, §16 reject this pattern by name.
- **No saved filters, saved views, or persistent filter state.** SN.6's filter is transient. UX Direction §10.
- **No faceted filter UI** (all night exteriors, every scene with this character). UX Direction §10 routes these to breakdown mode.
- **No drag-to-reorder, no drag handles.** UX Direction §14. Reordering is a structural edit, not a navigation gesture.
- **No location color-coding or location tinting** at the row, gutter, or any other level. UX Direction §5.
- **No production inventory** in the writing sidebar. CAST/PROPS/STUNTS/etc. live in breakdown mode. UX Direction §16.
- **No completion checkboxes, status toggles, "mark as done," or color-by-status.** UX Direction §14.
- **No assignment, ownership, or scheduling on rows.** Same.
- **No "this scene needs work" / health indicators.** Same.

### 5.4 Workflow-state coupling (off-limits, locked phase order)

- **No Workflow-state SSOT** (`Rga.Shell.Mode` or equivalent) introduced or wired in this arc. Memory: `project_settings_to_alive_phase_order` — RTL-V1 → mechanical E2E → Alive App → AI; SN.x lives inside the Scenes Sidebar Catalogue surface, not the workflow-state cross-cutting arc.
- **No AI surface, AI affordance, or AI gating** in this arc. Alive App entry gate is closed. Memory: `project_alive_app_checklist`.

### 5.5 Cross-surface scope guards

- **No inspector changes** triggered by SN.x. The catalogue answers "which scene?"; the inspector answers "what's inside?". SN.5's "no scenes" empty does not redirect to the inspector; SN.6's "no results" does not surface scene content.
- **No bottom-panel changes** triggered by SN.x. The Scene tab / Breakdown tab in `#bottom-panel` are not in this arc's scope.
- **No `studio-panel.js` changes** (the DOM walker for `dataset.blockType === 'scene-header'` named in the post-F1A review §1.5 stays untouched). That seam is a separate Filmustageation-2 concern.
- **No menu-bar changes** (the screenplay-named `Script` + `Tags` menus in `renderer/index.html`). Cosmetic, separate arc.
- **No activity-rail changes** (panel ids stay hard-coded; rail-icons untouched). Memory: phase order locks Settings → RTL → Alive App before any rail neutrality work.

### 5.6 Cosmetic creep guards

- **No new row-state class beyond `current` / `selected` / hover.** No `recently-visited`, no `pinned`, no `bookmarked`, no `dirty`.
- **No row animation on appear/disappear, on indicator add/remove, on selection change.** UX Direction §6 motion budget.
- **No tooltip cards on hover.** Only the OS title attribute. UX Direction §13.
- **No row right-click context menu** in this arc. Power actions are a future, gated by a separate brief. UX Direction §13.
- **No second slot in the toolbar contribution surface.** That is a CORE toolbar arc, not Scenes Sidebar.

---

# Closing

## 1. What this plan does

Converts the designer's UX Direction for the Scenes Sidebar Catalogue into five candidate engineering slices (SN.2 through SN.6) grounded in the post-F1A.7 + SN.1 shell. Each slice carries explicit files, risk, designer-input items, test coverage requirements, and a stop condition. The slices preserve the SEPARATION INVARIANT, the no-reflow grid, and SN.1's auto-scroll. They honor every inherited moratorium (nav-index, contamination triad, plugin relocation).

## 2. What this plan does NOT do

It does not implement anything. It does not commit. It does not pre-empt the user's brief for the next slice. It does not invent any visual or behavioral detail beyond the designer direction. It does not authorise SN.2 — it recommends it. The decision to begin SN.2 (or to pivot to SN.5, SN.4, SN.3, SN.6, or back to Option E from the post-F1A review §6) belongs to the user.

## 3. What the user needs from the designer before SN.2 can begin

The C1–C4 block from §2: notes glyph, revision glyph, color stance, indicator pixel size. Each is a discrete pick. The slice brief for SN.2 should carry the designer's four answers in line so the implementer has no decisions to invent.

## 4. STOP

This is a plan, not a slice. No code has been edited. No commit has been created. No designer input has been requested. The next decision — whether to authorise SN.2 (or amend, defer, or reject this plan) — belongs to the user, not to this document.
