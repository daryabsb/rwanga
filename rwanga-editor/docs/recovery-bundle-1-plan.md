# Rwanga Editor — Recovery Targeted Fix Bundle 1 (Plan)

**Date:** 2026-05-17
**Status:** PLAN ONLY — no code, no implementation. Investigation complete, awaiting user approval to execute.
**Scope:** Three scoped corrections surfaced during user verification.
**Cross-reference:**
- `docs/editor-recovery-forensic-report.md` — original pain inventory
- `docs/editor-recovery-checkpoint-review.md` — post-Phases-1–3 review
- `docs/editor-user-verification-checklist.md` — verification mode artifact

---

## 0. Contract (what Bundle 1 ships)

| Item | Deliverable shape | Out of scope (this bundle) |
|---|---|---|
| **A — View Mode ownership correction** | Flow / Draft / Print appear as labelled choices in (1) status-bar segment turned into a 3-option picker and (2) Electron native menu under View, each route calling the existing `Rga.ViewMode.set(mode)` SSOT. Esc-exits-Draft preserved unchanged. Current mode visually selected in both surfaces. No new mode system. | New views (Focus, Split). PrintPreview integration (it stays a separate command — Bundle 1 only covers Flow / Draft / Print as named in the brief). Style polish beyond "current is visibly selected". |
| **B — Sidebar shell consistency pass** | One empty-state DOM/CSS pattern (`.rga-shell-panel-empty`) replaces three current variants (`.rga-shell-panel-placeholder`, `.rga-shell-scene-navigator-empty`, `.rga-shell-workspace-empty`). Spacing normalized to existing tokens. Placeholder copy rewritten to writer-voice (not debug-voice). Panel header rhythm aligned. | Implementing missing features (Search / Characters / Revisions / Settings stay placeholder). New colors, new icons, panel restructure, sidebar redesign. |
| **C — Scene toolbox anchor correction** | Toolbox stops anchoring to `#editor-area`'s top-right viewport corner and instead anchors to the editor's writing-column area so it reads as attached to the page being written, not as floating global chrome. Existing controls / disabled state / Draft hiding all preserved. | New toolbox features, redesign, repositioning of controls within the toolbox, removal of the disabled-class behavior. |

**Single owner per concern (no duplicate logic):**
- View mode: `Rga.ViewMode.set()` is the only writer. Status-bar segment, menu IPC handler, and any future surface all route through it.
- Empty states: one class, one DOM shape, one CSS rule block.
- Toolbox positioning: one CSS rule block governs absolute geometry.

---

## 1. Investigation findings (ground truth)

### §A — View Mode

| What exists | Where |
|---|---|
| `Rga.ViewMode` (UX layer: persistence + Esc + listeners) | `renderer/js/view-mode.js` |
| `Rga.ViewManager` (framework: registry + body classes + mutual exclusion) | `renderer/js/framework/view-manager.js` |
| Status-bar segment shows current mode (single click cycles `['flow','draft','printPreview']`) | `renderer/js/shell/status-bar.js:46, 161-168` |
| Electron View menu has reload / devtools / zoom / fullscreen — **no Flow/Draft/Print entries** | `electron/menu.js:50-58` |
| Menu→renderer IPC plumbing already exists (`menu.action` event) | `electron/menu.js:72-76` + `electron/preload.js:65-69` + `renderer/index.html:836-845` |
| Renderer currently only handles `file.*` menu actions | `renderer/index.html:838-844` |

**User's four complaints, mapped:**
- "View switch only exists in status bar" — confirmed. No menu entries.
- "Switch behaves as one-way Draft entry" — confirmed. Status bar cycles via single click; no labelled choices.
- "No explicit choices" — confirmed. No dropdown surface anywhere.
- "No obvious way back except Esc/reload" — confirmed for the menu path (there is no menu path); confirmed-ish for status bar (click cycles, so user CAN return, but without labels the cycle is opaque).

**Key constraint:** the SSOT pair (`ViewMode` + `ViewManager`) already exists and is correct. Bundle 1 §A does NOT need a new mode system; it needs **two consumer surfaces** that both call the existing owner. This matches the user's rule "one owner only, no duplicate logic".

### §B — Sidebar consistency

**Seven registered sidebar panels:**

| Panel | File | Empty state class | `available` flag | Render shape |
|---|---|---|---|---|
| Scene Navigator | `renderer/js/shell/panels/scene-navigator.js` | `.rga-shell-scene-navigator-empty` | `true` | Full list (scenes) |
| Outline | `renderer/js/shell/panels/outline.js` | (none — always has data) | `true` | Collapsible sections |
| Script Workspace | `renderer/js/shell/panels/script-workspace.js` | `.rga-shell-workspace-empty` + `.rga-shell-workspace-error` | `true` | Categorised file list |
| Search | `renderer/js/shell/panels/search.js` | `.rga-shell-panel-placeholder` | `false` | Placeholder |
| Characters | `renderer/js/shell/panels/characters.js` | `.rga-shell-panel-placeholder` | `false` | Placeholder |
| Revisions | `renderer/js/shell/panels/revisions.js` | `.rga-shell-panel-placeholder` | `false` | Placeholder |
| Settings | `renderer/js/shell/panels/settings.js` | `.rga-shell-panel-placeholder` | `false` | Placeholder |

**Three distinct empty-state patterns** (the visible inconsistency):
- `.rga-shell-panel-placeholder` — used by 4 unavailable panels.
- `.rga-shell-scene-navigator-empty` — used by Scene Navigator on empty doc.
- `.rga-shell-workspace-empty` — used by Workspace on no-doc / empty folder.

**Placeholder copy reads as debug/developer voice:**
- *"Cross-script search arrives in 0.2. For now, find-in-script is on the editor's right-click menu."*
- *"Characters panel arrives in 0.2. For now, see the Breakdown tab in the Bottom Panel for tag-driven character listings."*
- *"Version history is coming in 0.2. For now, your scripts are auto-saved every 30 seconds — see Storage in Settings for autosaves."*
- *"Settings UI arrives in 0.2. Edit ~/.rwanga/settings.json directly to customize."*
- All four cite internal version targets ("0.2") and reference other internal surfaces in a release-notes register. That is the "reads as debug" symptom.

**Spacing tokens:** `.rga-shell-scene-navigator-empty` uses raw `24px 12px`. Other panels likely use other raw values. The token system exists in `tokens.css` (per Slice 9 confirmation) but isn't consistently consumed in panel CSS.

### §C — Scene Toolbox

| Fact | Source |
|---|---|
| DOM: `<aside id="scene-toolbox" class="scene-toolbox-vertical disabled">` lives directly inside `#editor-area`, NOT inside the scrolling `#editor-container` | `renderer/index.html:130-134` |
| CSS: `position: absolute; top: 32px; right: 16px` against the `#editor-area` containing block | `renderer/css/editor-prosemirror.css:255-269` |
| V1.1 fix 5 deliberately moved it out of `#editor-container` to prevent it disappearing on page scroll | HTML comment at `index.html:130-133`; `feedback_per_item_urls_must_use_safe_form.md` adjacent context |
| Disabled-class wiring lives in v3 plugins | `doc-types/screenplay/v3-*.js` — OFF-LIMITS (Runtime Stabilization LOCKED rules) |

**Tension to resolve:**
- V1.1 fix 5 wanted: toolbox doesn't vanish when user scrolls the page.
- User now reports: toolbox feels "physically fixed to viewport and disconnected from writing context".

The two signals are not contradictory — they point at a third resolution: the toolbox should remain visible at all times (V1.1 fix 5 invariant) but should anchor to the **editor's writing column** (the `.rga-page` rectangle's outer edge) rather than to the entire `#editor-area`'s viewport corner. This way scrolling doesn't lose it, but it reads as attached to the page rather than to the app frame.

---

## 2. Approach (per item)

### §A — View Mode ownership correction

**Files touched (exhaustive):**
- `electron/menu.js` — add `View` submenu entries for Flow / Draft / Print, each calling `sendMenuAction(mainWindow, 'view.flow' | 'view.draft' | 'view.print')`. Insert these at the top of the existing View submenu, before the reload/devtools/zoom block.
- `renderer/index.html` — extend the existing `window.rwanga.on.menuAction` switch (lines 838–844) with three new cases that call `Rga.ViewMode.set('flow' | 'draft' | 'print')`.
- `renderer/js/shell/status-bar.js` — replace the `_onViewModeClick` single-click cycle with a 3-option picker (dropdown or button group). When a choice is clicked, call `Rga.ViewMode.set(mode)`. Visually mark the current mode (per the existing `_renderViewMode` snapshot subscription).
- `renderer/css/shell.css` — small CSS block for the picker presentation (existing token system; no new colors).
- `tests/unit/shell/status-bar-*.test.js` — add a guard that the picker exists and that selecting each mode calls the SSOT (not ViewManager directly).
- `tests/unit/electron/menu.test.js` (new, small) — assert View submenu contains Flow / Draft / Print entries that route to `view.{flow,draft,print}` actions.

**Owner discipline:** all three surfaces (menu, status bar, command palette future) call `Rga.ViewMode.set(mode)`. NOT `Rga.ViewManager.activate(mode)` (that bypasses the UX layer). The existing `_syncFromViewManager` shim remains as a safety net but should not be the primary path.

**Esc-exits-Draft:** unchanged. Already registered via `KeyboardRegistry` in `view-mode.js:162-169`.

**Acceptance tests:**
- Open native menu → View → Draft → verify `document.body.classList.contains('view-draft-active')`.
- Click status-bar picker → Print → verify same.
- Esc inside Draft → verify body class removed and previous mode restored.
- Menu choice and status-bar picker stay in sync (subscribe to `Rga.ViewMode.onChange`).

**Risks:**
- Status-bar real-estate. The current segment is text-only; a 3-option picker takes more horizontal space. Mitigation: use a compact pill-group (e.g., `[ Flow | Draft | Print ]`) at the segment's existing width budget, or a labelled dropdown with arrow indicator.
- Linux/Windows menu activation order vs renderer boot. Menu actions might fire before `Rga.ViewMode` is initialized. Mitigation: the existing `wireViewMode()` runs before the menu handler subscription, but a defensive guard `if (Rga.ViewMode && typeof Rga.ViewMode.set === 'function')` is cheap.

### §B — Sidebar shell consistency pass

**Files touched (exhaustive):**
- `renderer/js/shell/panels/search.js`, `characters.js`, `revisions.js`, `settings.js` — each replaces its `<div class="rga-shell-panel-placeholder">` with the unified `.rga-shell-panel-empty` pattern (same DOM shape) and adopts writer-voice copy (see "copy revisions" below).
- `renderer/js/shell/panels/scene-navigator.js:101-106` — replace `_buildEmpty` body to use the unified pattern.
- `renderer/js/shell/panels/script-workspace.js:125-143` — replace `_emptyState` and `_errorState` to use the unified pattern (error keeps its Retry button but adopts unified container styling).
- `renderer/css/shell.css` — add one `.rga-shell-panel-empty` rule block (with `.rga-shell-panel-empty-title`, `.rga-shell-panel-empty-body`, `.rga-shell-panel-empty-hint` for visual rhythm); delete the three old empty-state class definitions.
- `tests/unit/shell/sidebar-empty-states.test.js` (new) — assert: exactly one `.rga-shell-panel-empty` rule block exists; each panel's empty state uses it; deleted classes are gone from CSS.

**Copy revision (writer-voice, no version numbers, no internal cross-references):**

| Panel | Current (debug-voice) | Proposed (writer-voice) |
|---|---|---|
| Search | "Cross-script search arrives in 0.2. For now, find-in-script is on the editor's right-click menu." | "Search across your scripts will live here. Try right-click → Find in this script for now." |
| Characters | "Characters panel arrives in 0.2. For now, see the Breakdown tab in the Bottom Panel for tag-driven character listings." | "Your characters will appear here as you write." |
| Revisions | "Version history is coming in 0.2. For now, your scripts are auto-saved every 30 seconds — see Storage in Settings for autosaves." | "Revisions will let you see every change you made. Your work is auto-saved while we build this." |
| Settings | "Settings UI arrives in 0.2. Edit ~/.rwanga/settings.json directly to customize." | "Settings will live here. (Power users can edit the settings file directly today.)" |
| Scene Navigator (no scenes yet) | "No scenes yet. Press Enter on the slug line to start one." | (Keep — already writer-voice.) |
| Workspace (no script saved yet) | "Open or save a script to see its workspace." | (Keep — already writer-voice.) |
| Workspace (empty folder) | "This workspace is empty. Drag in references, images, audio, or notes — or New Script (Cmd-N) to begin." | (Keep — already writer-voice.) |

**Open question:** are the copy revisions in scope, or should Bundle 1 only standardize the visual pattern and defer copy to a later pass? Recommend in-scope (it's the visible "debug surface" symptom), but flagged for user confirmation in §4.

**Spacing normalization:** use the existing `--space-*` tokens (per `tokens.css`). Empty-state padding becomes `var(--space-4) var(--space-3)` rather than raw `24px 12px`. Panel-header alignment uses the same token scale. No new tokens introduced.

**Risks:**
- Test count delta: deleting old empty-state class names could break any existing guard that asserts they exist. Mitigation: grep first, update or replace.
- Subtle visual shift across panels. Could read as a regression in any panel a user has muscle-memory of. Mitigation: the pattern is unification, not redesign; visual mass should stay close.

### §C — Scene Toolbox anchor correction

**Files touched (exhaustive):**
- `renderer/css/editor-prosemirror.css:255-269` — change the absolute-positioning containing block from `#editor-area`'s top-right to align with the `.rga-page` writing column's right edge. Approaches:
  - **(a) CSS-only:** position the toolbox using calc against the `.rga-page` 8.5in width and editor-area centering — e.g., `right: calc(50% - 4.25in - 96px)` or similar. Brittle if page width or padding changes.
  - **(b) Container restructure:** wrap the toolbox + `#editor-container` in a flex row inside `#editor-area`, with the toolbox in its own column flanking the page. Visually attached to the editor by adjacency, not by absolute positioning.
  - **(c) JS-anchored:** read `.rga-page` getBoundingClientRect() on scroll/resize, write the toolbox's `right` accordingly. New imperative wiring; least preferred (introduces a measurement loop where none existed).
- `renderer/index.html:130-134` — possibly move the `<aside id="scene-toolbox">` to a new sibling container if (b) is chosen.
- `tests/unit/editor/scene-toolbox-anchor.test.js` (new) — assert toolbox is NOT a child of `#editor-container` (preserves V1.1 fix 5); assert the chosen anchoring approach (CSS calc / flex sibling) is in place.

**Recommendation:** start with (a) CSS-only because it's the cheapest reversible change. If the calc proves brittle across themes / window widths, escalate to (b). DO NOT start with (c).

**Preserved invariants:**
- Toolbox is NOT a child of `#editor-container` (V1.1 fix 5 — must hold).
- Toolbox is hidden when `body.view-draft-active` (existing rule at `editor-prosemirror.css:237-240` — must hold).
- Toolbox `.disabled` class behavior is engine-side (v3 plugins) — must NOT touch.

**Risks:**
- Window-width fragility. Centered `.rga-page` shifts as the workspace flexes (sidebar resize, inspector resize). A naive `right: calc()` could leave the toolbox overlapping the page text at narrow widths. Mitigation: use `min-width` guard + a viewport-clamp.
- Print and Print Preview must not be affected. Both views use different `.rga-page` treatments. Mitigation: scope the new positioning rule to `#editor-container.view-flow ~ #scene-toolbox` or similar; verify Print / PrintPreview unchanged.

---

## 3. Stop-Point Register

Implementation MUST pause and request user input at any of these gates:

| Gate | Trigger | What to ask |
|---|---|---|
| **G-A1** | Status-bar picker design — pill-group vs labelled dropdown — affects how cramped the status bar reads | "Which presentation: `[ Flow | Draft | Print ]` pill-group (compact, all visible) OR `View ▾` labelled dropdown (least space, one click to see choices)?" |
| **G-B1** | Copy revisions per the proposed table — in scope or deferred | "Bundle 1 in-scope: rewrite the four placeholder copies as proposed? OR keep visual unification only and revisit copy later?" |
| **G-C1** | Toolbox anchoring approach (a) vs (b) — CSS calc vs container restructure | "Start with CSS-only `right: calc(...)` and escalate only if brittle? OR restructure to flex-sibling now for permanence?" |
| **G-C2** | If §C breaks Print or PrintPreview at any size, STOP — these are LOCKED views per memory `project_ide_print_draft_locked.md` | Report symptom + revert; no autonomous fix attempt that affects locked views. |
| **G-engine** | If any of §A/B/C investigation reveals the only fix path crosses `framework/`, `doc-types/`, `editor/`, schema, or v3 plugins — STOP | Per Runtime Stabilization LOCKED rules and `feedback_spec_must_stop_at_gaps.md`. |

---

## 4. Open questions (blocking implementation)

1. **G-A1** — Status-bar presentation: pill-group `[ Flow | Draft | Print ]` vs labelled dropdown `View ▾`?
2. **G-B1** — Copy rewrites: in-scope this bundle, or visual unification only?
3. **G-C1** — Toolbox anchoring approach: start with CSS calc, or commit to flex restructure now?
4. **Bundle ordering** — execute A → B → C as one commit, or three commits in order (smaller commits = safer revert, longer review)?
5. **Test budget** — current suite is 676 tests. Bundle 1 adds ~10 new guards across A/B/C. Acceptable?

These are the only blockers. Everything else (file targets, approach, risk mitigation) is decided.

---

## 5. Acceptance criteria (re-stated from brief)

**§A:**
- [ ] Flow ⇄ Draft ⇄ Print work from both menu and status bar.
- [ ] Status and menu stay synchronized (subscribed to one SSOT).
- [ ] No reload required to switch.
- [ ] Esc exits Draft (existing behaviour preserved).
- [ ] Current mode visibly selected in both surfaces.

**§B:**
- [ ] Scene Navigator / Search / Characters / Revisions / Workspace empty states use one CSS pattern.
- [ ] Placeholders no longer read as debug surfaces (copy revisions OR visual pattern alone, per G-B1).
- [ ] Spacing uses existing tokens (no new tokens, no raw `px` values in empty-state rules).
- [ ] No new colors, no new icons.

**§C:**
- [ ] Toolbox feels attached to the editor work area, not the viewport corner.
- [ ] Scrolling behavior feels natural (toolbox doesn't vanish — V1.1 fix 5 invariant holds).
- [ ] Existing controls preserved.
- [ ] Disabled-class behavior preserved (engine-side, untouched).
- [ ] Hidden in Draft view (preserved).

---

## 6. Non-goals

Stated explicitly so they are not silently bundled:

- New views (Focus, Split, etc.).
- PrintPreview integration into the picker (it stays separate).
- Implementing Search / Characters / Revisions / Settings features.
- Sidebar redesign beyond consistency pass.
- New tokens, colors, icons.
- New toolbox features.
- Any engine-side change.
- Any change to Flow / Print / Draft visual treatment from Phases 1–3 (those are LOCKED until user verification finishes).

End of plan.
