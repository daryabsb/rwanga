# Rwanga — Visual Stabilization Slice V1 — Implementation Plan

Author: shell maintainer  
Created: 2026-05-16  
Status: PLAN ONLY (no implementation)  
Predecessor: `docs/rwanga-shell-visual-debt-after-slice2.md` (revised)  
Successor: Slice 3 planning (gated behind this slice's acceptance)

---

## 1. Goal

Make the running app **visually coherent and non-embarrassing** before
adding new shell features. Resolve the six P1 visual debts catalogued
in the revised debt report. Stop there.

Success = a first-time viewer opens the app and does not read it as
"broken" or "unfinished placeholder UI". That is the bar — not
"beautiful", not "branded", not "redesigned".

---

## 2. Non-goals (binding)

Per the user's explicit scope rules, this slice **does not**:

- Introduce new features.
- Touch the editor engine (`renderer/js/framework/*`,
  `renderer/js/doc-types/*`, `renderer/js/editor/*` PM-internal code).
  Engine is locked since Phase 9.
- Touch pagination (page-map / layout-profile / print-renderer).
- Modify the Script Workspace panel (`panels/script-workspace.js`).
- Modify the Outline panel (`panels/outline.js`).
- Add Pro / account / identity functionality.
- Touch the command palette.
- Introduce a theme system / theme picker / new design tokens framework.
- Perform a broad redesign — every change is a **targeted P1 fix**.
- Resolve any compatibility-inventory entry (#2 / #5 / #6 stay open;
  this slice is layered alongside, not on top of, those removals).

Any temptation to "while I'm here, also…" → STOP. Park it for Slice 3.

---

## 3. Investigation findings (already complete)

The six P1 targets and their visible symptoms are documented in
`docs/rwanga-shell-visual-debt-after-slice2.md` items 1, 2, 3, 5, 6, 7.
Three additional findings landed during this plan's pre-investigation:

1. **Status-bar blue source** — `#status-bar` in `renderer/css/shell.css`
   line 359 sets `background: var(--accent-primary)`. `--accent-primary`
   is `#007acc` (the VS Code blue token used for action accents). The
   same token is reused for: the rail active indicator, the bottom-panel
   active-tab underline, and the in-page selection accent. The status
   bar adopted an action-accent token as a surface colour. This is the
   single root cause of items #2 and #7's accidental colour twinning.

2. **Scene Navigator DOM is already structured correctly** — the panel
   already emits separate `<span>` elements with classes
   `.rga-shell-scene-navigator-num`, `.rga-shell-scene-navigator-heading`,
   `.rga-shell-scene-navigator-page`, etc. The "mashed-together" rendering
   is purely a missing-CSS symptom; **no DOM changes required**.

3. **Scene toolbox geometry** — toolbox is `position: sticky` inside the
   editor-container flex flow with `width: 96px; margin-left: 24px;`. It
   lives in-flow after the `.rga-page` element, so when the inspector
   column eats the right side of the workspace the toolbox is clipped
   under it. The clipping is a layout topology issue, not a sizing one.

These findings shape Section 5's per-target plan.

---

## 4. Touch surface (files this slice is allowed to modify)

| Category | Files |
|---|---|
| Renderer CSS (primary surface) | `renderer/css/shell.css`, `renderer/css/tokens.css` (add scoped tokens only — no global restructure), `renderer/css/components.css` (only for bottom panel + inspector), `renderer/css/editor-prosemirror.css` (only for the toolbox-positioning fix) |
| Renderer HTML | `renderer/index.html` (delete legacy `#menu-bar` block in full; possibly move toolbox under page-row; inspector empty-state copy) |
| Main process | **None.** The earlier draft listed `main.js` for a `Menu.setApplicationMenu(null)` call; that change was rejected in the 2026-05-17 review correction. Native Electron menu stays. No main-process edits in V1. |
| Inspector panel content | `renderer/index.html`'s `#inspector-panel` block (placeholder copy + ARIA only); **do not** introduce new inspector behaviour or wiring. |
| Tests | `tests/unit/shell/css-layout.test.js` (extend), `tests/unit/shell/visual-stabilization.test.js` (new — guard tests) |

**Off-limits files** (no edits, period):

- Anything under `renderer/js/framework/`
- Anything under `renderer/js/doc-types/`
- Anything under `renderer/js/editor/`
- `renderer/js/shell/panels/script-workspace.js`
- `renderer/js/shell/panels/outline.js`
- `renderer/js/app-shell.js` (command palette + theme manager live here)
- Any panel JS not explicitly required for a P1 fix

Scene Navigator JS is **read-only** for this slice — the panel's DOM
shape is fine; only CSS is added.

---

## 5. Per-target implementation plan

### T1 — Chrome stack: 4 strips → 3 strips, native-first

> **Review correction (2026-05-17).** The earlier T1 draft proposed
> `Menu.setApplicationMenu(null)` (commit-1 of the original sequence)
> and a "two-strip merged custom band" target. That proposal is
> **rejected**. The native Electron application menu **stays**.
> The reasons (verbatim from the correction): preserve OS conventions,
> preserve keyboard expectations, preserve accessibility, avoid owning
> menu behaviour too early. The Slice 1 titlebar stays as the single
> Rwanga-owned chrome surface. Advanced actions migrate to a future
> command palette, not into a hand-rolled menu bar.

**Current state (4 strips, top → bottom):**
1. Native OS title bar (real window controls + filename)
2. Native Electron application menu (`File · Edit · View · Help`)
3. Slice 1 titlebar (`.rga-shell-titlebar` — `Rwanga • {script} *` +
   placeholder avatar)
4. Legacy custom menu bar (`#menu-bar` — `Rwanga` logo + 7 menu items +
   fake window controls)

**Target state (V1 scope — 3 strips, native-first):**

- **Strip A: native OS title bar.** Stays. OS-owned; provides the real
  window controls and the filename.
- **Strip B: native Electron application menu.** Stays. Source of truth
  for `File · Edit · View · Help`. OS-conventional placement, OS-managed
  keyboard shortcuts (Alt-F on Win/Linux; Cmd-shortcuts on macOS), OS
  accessibility integration. Zero custom code.
- **Strip C: Slice 1 titlebar** (`.rga-shell-titlebar` — single
  Rwanga-owned chrome surface). Renders `Rwanga • {activeScript} *`,
  identity / script context, placeholder avatar slot. Kept.

The legacy `#menu-bar` is **deleted in full** from the DOM. There is
no second custom menu strip in V1 (or planned for V2). All advanced
actions that would have lived in custom menus migrate to a future
command palette — out of scope for V1.

**Why native-first and not frameless:** preserving the native title bar
+ native application menu is the lowest-risk, highest-accessibility
posture. Frameless plus custom menus would have required owning
drag-regions, window-control wiring, menu-keyboard semantics, and
OS-platform variance — all out of scope. Native-first defers all of
that until a real product reason appears.

**Concrete changes:**

1. **Delete the entire `#menu-bar` element** from `renderer/index.html`
   (the `<header id="menu-bar">…</header>` block). This single deletion
   removes:
   - the duplicate `Rwanga` logo (`#app-logo`),
   - the second `File · Edit · View · Script · Tags · Export · Help`
     menu titles,
   - the dead `Script` / `Tags` / `Export` items specifically,
   - the fake window controls (`#win-minimize` / `#win-maximize` /
     `#win-close` and their wrapper `.menu-window-controls`),
   - all in-renderer click-binding for those fake controls.
2. **Slice 1 titlebar stays unchanged behaviourally.** It already
   renders `Rwanga • {activeScript} *` and tracks dirty state via
   `Rga.Shell.TitleBar`. No new content added to the titlebar this
   slice (no migrated menu items, no app-logo move, no avatar wiring).
3. **Native Electron menu stays as source of truth.** No
   `Menu.setApplicationMenu(...)` change. No menu template edits.
4. **`#app` grid retracts to three rows** in `shell.css` — drop the
   `var(--menu-bar-height)` track that the deleted `#menu-bar`
   occupied. The runtime-repair guard in
   `tests/unit/shell/css-layout.test.js` already asserts
   track-count ≥ child-count, so the deletion + grid retraction must
   land in the same commit or the guard fails.
5. **CSS cleanup.** Remove the now-dead rules in `shell.css` that
   targeted `#menu-bar`, `.menu-title`, `.menu-item`,
   `.menu-window-controls`, `.menu-window-btn`, `.menu-spacer`,
   `#app-logo`. (Dead-CSS removal counts as part of the same commit
   to avoid orphan rules. Selectors that the future command palette
   may re-use stay; nothing in the deleted set is reused.)
6. **`#app-logo` icon injection removed** from the init block in
   `index.html` (the `injectIcons()` line that targets `#app-logo`).
   Same for any of the window-control icon injections
   (`#win-minimize` / `#win-maximize` / `#win-close`). Pure cleanup,
   no behaviour change.

**Result:** the user sees ONE OS title strip, ONE OS menu strip, ONE
Rwanga-owned identity strip. Three `Rwanga` labels → one (titlebar
only — the OS title still says "filename — Rwanga" but that is OS
chrome, not duplicated Rwanga branding). Two `File·Edit·View` menus
→ one (the native one). Two sets of window controls → one (the OS
ones). The custom chrome footprint shrinks from ~60px to ~28px.

---

### T2 — Status bar: remove saturated blue, align to palette

**Root cause:** `#status-bar { background: var(--accent-primary); }`
where `--accent-primary` is `#007acc`. An action-accent token used as a
surface fill.

**Concrete changes:**

1. **Introduce one scoped surface token** in `tokens.css`:
   `--statusbar-bg` (warm grey, aligned to the existing chrome palette,
   roughly the same family as `--bg-tertiary`). One token in each theme
   block (dark / light) — not a new theme system.
2. **Repoint** `#status-bar` from `var(--accent-primary)` to
   `var(--statusbar-bg)`. Also update the `[data-theme="light"]
   #status-bar` override to use the light-mode value.
3. **Deliberate segment spacing** — add `gap: 18px` to the
   `.rga-shell-statusbar` container and a one-pixel vertical separator
   (`border-left: 1px solid var(--border-subtle)`) on segments
   `viewMode`, `language`, `offline` (the right-side tool-context
   group), so writer-context and tool-context read as two visual blocks
   not seven loose words.
4. **View-mode segment affordance** — give the clickable viewMode
   segment a hover background and an underline on hover; cursor stays
   `pointer` (already set inline). One-rule change.
5. **Text colour** — set `.rga-shell-status-segment` colour to
   `--text-secondary`. The current colour is whatever `accent-primary`
   chose to pair with (white) and reads thin on the new grey.

**Visual result:** a calm grey status bar with seven legible segments,
two visual groups, and one clearly-clickable mode toggle.

**Note on bottom-panel underline (item #7 colour twinning):** the
bottom-panel active tab uses the same `--accent-primary`. T2 doesn't
change `--accent-primary` itself — the status-bar simply stops using it.
The bottom-panel underline issue is addressed in T6.

---

### T3 — Scene Navigator: readable at first glance

The DOM already separates `num` / `heading` / `page` / `indicators`
into discrete `<span>` elements (see §3 finding #2). Pure-CSS slice.

**Concrete changes** (all in `shell.css`, new ruleset block):

1. **List container** `.rga-shell-scene-navigator-list`:
   reset `ul` margins/padding, no bullets.
2. **Row** `.rga-shell-scene-navigator-row`:
   - `display: grid; grid-template-columns: 28px 1fr auto; gap: 8px;`
     (num | heading | page badge).
   - `padding: 6px 10px;`
   - `cursor: pointer;`
   - `border-radius: 4px;`
   - `min-height: 28px;`
   - hover state: subtle background change.
3. **Number** `.rga-shell-scene-navigator-num`:
   - right-aligned monospace, muted colour, fixed-width column.
4. **Heading** `.rga-shell-scene-navigator-heading`:
   - `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`
     — single line, clipped with ellipsis (no mid-phrase wrap).
   - title attribute already would help (DOM JS read-only this slice;
     if the panel doesn't already set `title=`, we accept no tooltip
     in V1).
5. **Page badge** `.rga-shell-scene-navigator-page`:
   - right-aligned, muted, smaller font, single-line chip
     (subtle background, `padding: 0 6px;`).
6. **Current scene mark**
   `.rga-shell-scene-navigator-row-current`:
   - 2px left accent border (using a calm accent — not the bright blue;
     use `--text-primary` or a new `--accent-soft`).
7. **Selected (keyboard focus)**
   `.rga-shell-scene-navigator-row-selected`:
   - subtle background fill (no border). Distinct from current.
8. **Current + selected on same row** — both visual marks coexist
   (border + fill); they are still visually separable.
9. **Empty state** `.rga-shell-scene-navigator-empty`:
   - centred, muted, `padding: 24px 12px;`.

**Acceptance check for T3:** scene rows render as
`[ 1 ]  EXT. OLD HOUSE — ROSE GARDEN — DAWN…           [ p.1 ]`
with the number, heading (ellipsised), and page badge in three distinct
columns. Current and selected states render as different visual marks.

---

### T4 — Scene toolbox: make controls accessible

**Root cause:** toolbox is `position: sticky` inside `#editor-container`
flex flow, after `.rga-page`. With the inspector column claiming the
right side of the workspace, the 96px toolbox overflows beyond the
page-row and is clipped under the inspector.

**Concrete change (single layout-topology fix):**

- Move the toolbox from "after .rga-page in the flex flow" to
  "positioned inside the editor-desk safe zone", anchored to the page's
  right edge with a known offset. Implementation: switch toolbox
  position model from `sticky` (post-page flex item) to
  `position: absolute` relative to a newly-introduced
  `position: relative` wrapper around the page-row that respects the
  editor-container's actual content box.
- Alternative if absolute positioning is fragile: reduce toolbox width
  (96px → 64px) AND give `#editor-container` a known
  `padding-right: 88px` so the toolbox always has reserved space, with
  the inspector still claiming its own column outside that padding.

Implementation decision: try option A (absolute inside a relative
wrapper) first because it doesn't touch page width. If it turns out to
fight RTL or print-preview, fall back to option B.

**No new toolbox features.** Same controls (block-type select, ✎ Note,
⚑ Flag, ＋ Tag). Just visible and clickable.

---

### T5 — Inspector: calmer contextual empty state

**Current state:** right-rail inspector shows `INSPECTOR` (all caps)
header + literal sentence "Select a tag or scene header to view
details."

**Concrete changes (HTML + CSS only):**

1. Rename header text in `#inspector-panel` from `Inspector`
   (rendered all-caps by current CSS) → `Inspector` (title case),
   and drop the `text-transform: uppercase` rule from
   `.inspector-header`.
2. Reduce header font weight (current is bold; switch to medium) and
   add a thin bottom border using `--border-subtle`.
3. Replace the body placeholder block with a calmer empty-state:
   - A small muted icon (existing `Rga.Icons` library — pick one of
     the inspector / info glyphs; **no new icon design**).
   - One short line in `--text-tertiary`: "No details to show.".
   - One supporting line in `--text-disabled`: "Select a tag or
     a scene heading to inspect it."
   - Centred, ~16px gap, vertically centred in the panel.
4. Add `aria-label="Inspector"` to the panel and `aria-live="polite"`
   to the body for when real content lands later.

**No inspector wiring or behaviour changes.** Just visual calm-down.

---

### T6 — Bottom panel visual cleanup

**Current state:** active-tab underline uses `--accent-primary`
(same bright blue as the old status bar) → accidental twinning. The
disabled `Notes` textarea fills most of the panel and looks broken.

**Concrete changes:**

1. **Active-tab indicator** — switch the `.bp-tab.active` underline
   colour from `var(--accent-primary)` to a calmer token:
   `var(--text-primary)` (a subtle bottom-border) or a new
   `--tab-active-indicator` scoped token (one line in `tokens.css`).
   This breaks the accidental status-bar twinning.
2. **Inactive-tab colour** — bring inactive tabs from full text-primary
   down to text-tertiary so the active tab actually stands out.
3. **Disabled textarea — empty state** — when `Notes — No scene selected`
   is shown, the textarea currently fills ~120px of the panel. Replace
   the disabled-textarea visual with a single muted line "Select a
   scene to add notes." centred in the panel content area. The
   textarea element itself stays in the DOM (so the wiring that enables
   it on scene selection still works) — only its visual presentation
   collapses to a centred message via a CSS rule keyed off the
   `disabled` attribute or off an empty-state class.
   **Implementation note:** if collapsing via CSS-attribute-selector is
   fragile, allow one tiny edit to the existing legacy wiring to
   toggle an `.empty` class on the textarea wrapper when no scene is
   selected. This is the ONE permitted JS edit outside scope-limited
   files in this slice; size limit: ≤ 5 lines.
4. **Close button** (`#btn-close-bottom-panel`) — calmer hover state
   (currently no hover).

**No new tabs. No new wiring.** Same five legacy tabs.

---

## 6. Open questions (must answer before implementation)

- **OQ-1: Frameless vs framed window?** **DECIDED — framed.** Plus
  native OS title bar + native Electron menu both retained per the
  2026-05-17 T1 correction. No frameless work in V1 and none planned
  for V2 visual stabilization either.
- **OQ-2: ~~`Menu.setApplicationMenu(null)` macOS shortcuts?~~**
  **OBSOLETE.** The 2026-05-17 correction removes the
  `setApplicationMenu(null)` change entirely; the native menu stays
  on all platforms. macOS Cmd-Q / Cmd-W and Win/Linux Alt-F etc. are
  preserved automatically. No OS-conditional code.
- **OQ-3: Toolbox positioning — option A vs option B (§T4).** Decide
  during implementation after testing the absolute-positioning path
  against RTL and print-preview.
- **OQ-4: Does the bottom-panel empty-state CSS rule need the one
  permitted JS edit (T6.3)?** Try CSS-only first
  (`textarea[disabled] + .empty-state-msg` adjacent-sibling pattern).
  Only fall back to the ≤5-line JS edit if pure CSS can't reach.

Two OQs remain (OQ-3 and OQ-4). OQ-1 is decided; OQ-2 is obsolete.

---

## 7. Commit sequence

Slice ships as a small numbered sequence. Each commit is independently
revertable and leaves the app in a working state.

| # | Title | Files | Size |
|---|---|---|---|
| 1 | `chore(shell): delete legacy #menu-bar (chrome stack T1 — native-first)` | renderer/index.html, renderer/css/shell.css | ~60 lines deleted (HTML block + dead CSS rules + #app grid retraction) |
| 2 | `style(statusbar): replace accent-primary fill with calm grey + segment spacing + view-mode hover (T2)` | tokens.css, shell.css | ~30 lines |
| 3 | `style(scene-navigator): grid row layout, ellipsis heading, page badge chip, current/selected states (T3)` | shell.css | ~80 lines |
| 4 | `style(editor): reposition scene toolbox to stay inside editor safe zone (T4)` | editor-prosemirror.css, index.html | ~25 lines |
| 5 | `style(inspector): calmer header + contextual empty state (T5)` | index.html, components.css | ~30 lines |
| 6 | `style(bottom-panel): break accent-primary twinning + collapse disabled-state textarea (T6)` | components.css, tokens.css | ~25 lines |
| 7 | `test(shell): visual-stabilization guard tests` | tests/unit/shell/visual-stabilization.test.js | ~80 lines |

The earlier 9-commit sequence collapses to 7 commits because the
rejected `Menu.setApplicationMenu(null)` change is gone (was commit 1),
and the prior commits 2 + 3 (separate "delete fake controls" and
"visually unify" steps) merge into the single deletion commit 1 — there
is no second custom strip to unify any more.

**Ordering invariants:**
- Commit 1 is atomic: the HTML deletion, the dead-CSS removal, AND the
  `#app` grid track-count retraction must land in the same commit, or
  the runtime-repair guard in `tests/unit/shell/css-layout.test.js`
  fails between commits.
- Commit 2 must land before commit 6 so the bottom-panel twinning fix
  can verify the new `--statusbar-bg` is in use.
- Commit 7 lands last; it asserts the prior 6 stuck.

---

## 8. Tests

New file: `tests/unit/shell/visual-stabilization.test.js`. Guard tests
(structural / token / CSS rule presence — no visual regression
snapshots in V1):

| ID | Assertion |
|---|---|
| VS1 | `index.html` contains **no** `#menu-bar` element (T1 — legacy custom menu fully deleted) |
| VS2 | `index.html` contains **no** `#win-minimize` / `#win-maximize` / `#win-close` / `#app-logo` elements (T1 — fake window controls and duplicate logo gone with the menu bar) |
| VS3 | `index.html` contains exactly **one** element whose id includes `titlebar-title` (T1 — Slice 1 titlebar is the only Rwanga-owned identity surface) |
| VS4 | `shell.css` `#status-bar` rule's `background` value is NOT `var(--accent-primary)` (T2 root cause guard) |
| VS5 | `tokens.css` defines `--statusbar-bg` in both `[data-theme="dark"]` and `[data-theme="light"]` blocks (T2) |
| VS6 | `shell.css` contains a rule for `.rga-shell-scene-navigator-row` with `display: grid` (T3) |
| VS7 | `shell.css` contains separate rules for `.rga-shell-scene-navigator-row-current` and `.rga-shell-scene-navigator-row-selected` with **different** background/border declarations (T3 separation invariant) |
| VS8 | Editor CSS contains a `position: absolute` or `padding-right` declaration on the toolbox container path (T4 — one of the two options landed) |
| VS9 | `components.css` (or `shell.css`) `.bp-tab.active` indicator declaration is NOT `var(--accent-primary)` (T6 twinning guard) |
| VS10 | `index.html` `#inspector-panel`'s `.inspector-header` text is `Inspector` (title-case, not `INSPECTOR`) AND no stylesheet applies `text-transform: uppercase` to `.inspector-header` (T5) |
| VS11 | **Native-menu-preserved guard**: `main.js` (or `main/index.js`) does NOT call `Menu.setApplicationMenu` — protects the 2026-05-17 correction from a future drift back into renderer-owned menus |

The **11** guard tests + the existing 538 tests must all pass before
merging this slice.

**No new test infra introduced** — node:test + jsdom + plain file reads,
same as `tests/unit/shell/css-layout.test.js`.

---

## 9. Acceptance gate

V1 is shippable when **all** of these are true:

1. ✅ App boots; commit `229336fc`'s workspace-restored state is preserved.
2. ✅ A script loads and is visible in the editor.
3. ✅ Three chrome strips visible, no duplication: (1) native OS title
   bar, (2) native Electron `File · Edit · View · Help` menu, (3) Slice 1
   Rwanga titlebar. The legacy `#menu-bar` is gone. No duplicate
   `Rwanga` labels in custom chrome. No duplicate File/Edit/View menu.
   No fake window controls.
4. ✅ Status bar background is calm grey, not saturated blue. Segment
   spacing is deliberate. The clickable view-mode segment has a
   hover/affordance cue.
5. ✅ Scene Navigator: scene number, heading (ellipsised single-line),
   page badge render in three visually distinct columns. Current scene
   and selected row are independently visible.
6. ✅ Scene toolbox: all four controls (block-type, Note, Flag, Tag)
   visible and clickable simultaneously, with the inspector still
   open at its default width.
7. ✅ Inspector: title-case header, calm contextual empty state, no
   ALL-CAPS shouting.
8. ✅ Bottom panel: active-tab indicator no longer twins with the
   status bar. Disabled / no-scene-selected state does not look broken.
9. ✅ All tests green: 538 existing + 11 new guards.
10. ✅ Visual debt report items #1, #2, #3, #5, #6, #7 reclassify to
    P3 or RESOLVED. P2 items remain (out of scope). P1 count = 0.

Visual verification = the maintainer opens the app, takes one
screenshot, side-by-sides it against the 2026-05-16 23:15 reference
screenshot. If the new screenshot does not read as "broken" or
"placeholder", V1 ships.

---

## 10. Explicit out-of-scope (will not be touched in V1)

- Editor page paper feel (debt item #8) — P2, deferred.
- Activity rail emoji icons (debt item #4) — P2, deferred.
- Shell spacing beyond what the 6 P1 targets touch (debt item #9) — P2,
  deferred.
- All P3 items in the debt report (#10 series) — deferred.
- Compatibility inventory entries #2 / #5 / #6 — those are removal
  slices owned by Slice 3, not visual fixes.
- Format toolbar redesign.
- Tab bar redesign.
- Editor empty-state recent-files wiring.
- Toast positioning relative to status bar.

Any of these can be picked up in a Visual Stabilization V2 slice if the
maintainer judges them P1 after V1 lands. They are not P1 today.

---

## 11. Risks

- **R1 — ~~Menu shortcuts lost on macOS~~** **OBSOLETE** after the
  2026-05-17 T1 correction. Native Electron menu stays on every
  platform; no shortcut loss is possible.
- **R2 — Toolbox absolute positioning breaks RTL or print-preview.**
  Mitigation: fallback option B in T4; run RTL + print smoke before
  shipping commit 4 (was commit 6 in the prior sequence).
- **R3 — `--accent-primary` is referenced by ~5 other rules.**
  Mitigation: T2 only changes the status-bar; T6 only changes the
  bottom-panel; the other 3 consumers (rail active indicator, in-page
  selection accent, etc.) keep the token. We are NOT renaming or
  removing `--accent-primary`.
- **R4 — Bottom-panel empty-state CSS-only collapse fails.** Mitigation:
  the ≤5-line JS edit budget already named in T6.3.
- **R5 — Future drift back into renderer-owned menus.** The next
  contributor sees "no custom menu strip" and is tempted to "add a
  proper File menu" in the renderer (re-introducing the legacy
  problem). Mitigation: guard test VS11 asserts no
  `Menu.setApplicationMenu` call in the main process; the native menu
  stays the source of truth. Anyone who wants to add menu actions edits
  the main-process menu template — not the renderer.

---

## 12. Stop conditions

If during implementation any of the following happens, **stop and
report** before continuing:

- Any change requires touching a file in the §4 off-limits list.
- Any P1 fix turns out to require an engine change.
- Any commit pushes the test suite below 538 passing.
- Frameless / window-frame architecture turns out to be required to
  resolve the chrome stack (per OQ-1) — V1 commits to native-first; if
  that breaks, escalate before improvising.
- Any change requires `Menu.setApplicationMenu` or any other
  main-process menu edit — escalate; the 2026-05-17 correction binds
  V1 to leave the native menu untouched.
- Three or more "while I'm here" temptations appear in one commit —
  abort that commit and re-plan that target.

---

End of plan.
