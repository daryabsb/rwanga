# Rwanga Editor — Recovery Bundle 2 §D Visual Debt Audit

**Date:** 2026-05-17
**Status:** AUDIT ONLY — no code changes, no fixes, no implementation plan.
**Scope:** sweep the seven surfaces named in the Bundle 2 §D brief, after Commits §A / §B / §C landed (`756623bc` / `ab72c49e` / `50497f03`).
**Suite at audit time:** 726 / 726 unit tests passing.

**Cross-reference:**
- `docs/editor-recovery-forensic-report.md`
- `docs/editor-recovery-checkpoint-review.md`
- `docs/recovery-bundle-1-plan.md`

---

## 0. Method

For each surface I read the CSS rules currently shipping plus the JS that emits the DOM, and compared the result against the "feels like a sibling of the app, not a placeholder" bar set by Bundle 1 §B + Bundle 2 §C. Visual debt = anything that would make a writer think "this surface is unfinished." Ranking:

- **P1** = visibly broken, debug-feeling, or out-of-system. Likely caught on every screenshot.
- **P2** = visible drift / minor inconsistency / token-drift item. Caught on careful inspection.
- **P3** = polish ideas / longer-running deferrals. Not blocking writer perception.

Surfaces with no remaining debt are listed clean.

---

## 1. Surface-by-surface

### 1.1 Scene Navigator — **clean (no remaining debt)**

Phase 2 §C3 + Bundle 2 §C established the row rhythm, dual-state separation, brand-pink current marker. Workspace + Outline now mirror it. No items.

### 1.2 Outline — **clean**

Bundle 2 §C closed the "no CSS at all" gap. Section headers, scene rows, progress rows, character rows all have rules consistent with the Scene Navigator standard. No items.

### 1.3 Workspace — **clean**

Bundle 2 §C closed the "no CSS at all" gap. Header + refresh button + category headings + file rows all aligned. No items.

### 1.4 Inspector — **3 items (1 × P2, 2 × P3)**

The Inspector has CSS in `renderer/css/components.css` (lines 700–760), but it uses a different vocabulary than the sidebar polish standard.

| ID | Severity | Item |
|---|---|---|
| INSP-1 | **P2** | **Inspector empty state uses a custom `.inspector-empty` class instead of the unified `.rga-shell-panel-empty` pattern from Bundle 1 §B.** Inspector's empty state shows icon + title + help text in its own DOM/CSS shape (lines 715–738 of components.css). Writers see one empty-state look in the sidebar and a different one in the Inspector. Fix: either (a) refactor Inspector empty path to call `Rga.Shell.Sidebar.renderEmpty` (works because the helper is DOM-pure), or (b) drop `.inspector-empty-icon` and align the visual to the sidebar pattern. Either way it stops being a one-off. |
| INSP-2 | **P3** | **Inspector section headers (`.inspector-title`, line 744) use `font-weight: 600` + bottom border with full opacity** while the sidebar's section headers (Outline, Workspace) use uppercase muted 10px. Two different "section header" voices coexist. Not wrong, but two patterns instead of one. |
| INSP-3 | **P3** | **`.inspector-header` (line 702) is `padding: 12px 16px`** which is denser than the sidebar's section-header rhythm. Consider unifying padding to match the sidebar header rhythm (`6px 8px 4px 8px`) or vice-versa. |

### 1.5 Bottom Panel — **2 items (1 × P2, 1 × P3)**

| ID | Severity | Item |
|---|---|---|
| BP-1 | **P2** | **`.bp-tab.active` uses `--tab-active-indicator` not `--accent-rwanga`.** The Scene Navigator current row uses `--accent-rwanga` (brand pink) as the "you are here" marker per Phase 2 §C3 + locked guard. The active tab in the Bottom Panel should arguably do the same — instead it uses a separate token that may render as a different colour entirely (defined in `tokens.css` to avoid the old `--accent-primary` blue-twin per VS9). Active-state language is inconsistent across the app. |
| BP-2 | **P3** | **`.bp-content` padding is `12px 16px` (components.css:574)** — close to but not matching Outline / Workspace panel content rhythm. Minor. |

### 1.6 Breadcrumb — **1 item (1 × P3)**

| ID | Severity | Item |
|---|---|---|
| BC-1 | **P3** | **Breadcrumb's "Scene S{N}" line is not clickable.** Clicking would naturally jump-to-scene (calls `Rga.Shell.SceneNavigator.scrollToScene`). Out of scope for Bundle 2 (the brief says "no new features"), but the writer's intuition will reach for it. Park as future small enhancement. |

### 1.7 Toolbar (Format Toolbar + Scene Toolbox) — **3 items (1 × P1, 1 × P2, 1 × P3)**

| ID | Severity | Item |
|---|---|---|
| TB-1 | **P1** | **`.scene-tb-select:focus` uses `--accent-primary` (the VS-Code blue) for its border colour** (editor-prosemirror.css:392). Per memory `VS4 — #status-bar background is NOT var(--accent-primary)` and `VS9 — .bp-tab.active indicator is NOT var(--accent-primary)`, the codebase has been deliberately moving off `--accent-primary` for chrome to break the VS-Code twinning. The Scene Toolbox's focused select still ships with it. Likely caught on a screenshot the first time someone Tabs through scene-block dropdowns. |
| TB-2 | **P2** | **Format toolbar buttons (`.format-btn`, in editor-prosemirror.css)** never got the same "use --bg-hover for hover bg" treatment that Bundle 2 §C codified for the sidebar rows. Need to grep + confirm — likely they use raw rgba or similar. Slight chrome-vocab drift. |
| TB-3 | **P3** | **Scene Toolbox header (`.scene-toolbox-header`)** uses raw `#888` fallback and `10px` literal font-size instead of `var(--font-size-xs)` + `var(--text-tertiary)`. Functional but inconsistent with the polish bar Bundle 2 §C set on the sidebar. |

---

## 2. Ranked debt list (across surfaces)

### P1 — visibly out-of-system (1 item)

1. **TB-1 — Scene Toolbox select focus uses `--accent-primary` (the deprecated VS-Code blue).** Single line of CSS to fix; conflicts with the deliberate VS4 / VS9 detoxification work. Highest visibility-per-fix-cost ratio in the report.

### P2 — visible drift on careful inspection (3 items)

2. **INSP-1 — Inspector empty state uses its own DOM/CSS instead of the unified `.rga-shell-panel-empty` pattern.** Sidebar feels unified after Bundle 1 §B; Inspector feels exempted from that unification.
3. **BP-1 — `.bp-tab.active` uses `--tab-active-indicator` instead of `--accent-rwanga`.** Two different "you are here" languages coexist (brand pink in Scene Navigator current, tab-indicator token in the bottom panel).
4. **TB-2 — Format toolbar buttons not aligned to the `--bg-hover` hover treatment Bundle 2 §C established.** Needs grep confirmation before action.

### P3 — polish / minor / longer-running (5 items)

5. **INSP-2 — Inspector section headers use a different voice than sidebar section headers.** Bold + full-opacity bottom border vs uppercase muted 10px.
6. **INSP-3 — Inspector header padding (12px 16px) is denser than sidebar (6px 8px 4px 8px).** Unify or document the intentional difference.
7. **BP-2 — `.bp-content` padding doesn't perfectly match Outline / Workspace content rhythm.** Cosmetic.
8. **BC-1 — Breadcrumb's "Scene S{N}" line is not clickable for jump-to-scene.** Future enhancement; the user's intuition will look for it.
9. **TB-3 — Scene Toolbox header uses raw `#888` + `10px` literals instead of tokens.** Token hygiene.

---

## 3. What is NOT in this list (deliberate omissions)

- Anything in `framework/`, `doc-types/`, `editor/` — off-limits per the brief's "no engine/* / no framework/* / no doc-types/* / no schema work" rules.
- Anything from `docs/editor-recovery-forensic-report.md` already addressed in Phases 1–3 or Bundle 1.
- C1(a) "true paged Flow DOM" — still gated on user verification per `docs/editor-recovery-checkpoint-review.md`.
- C8 / C9 — engine-touchability gated.
- Items deferred in the memory file `project_ide_vscode_refactor_queue.md` (tab-bar overflow with long filenames) and similar — not recovery items, deferred work.
- Anything that's a design preference rather than a debt signal (e.g., "the breadcrumb's `Rwanga` token in line 1 could be the logo glyph instead").

---

## 4. Next-step shape (informational, no action implied)

If the user wants a focused follow-up commit that bears no new feature load, the lowest-cost bundle is:

- **Bundle 2.5 (cosmetic only):** TB-1 + TB-3 + TB-2 → toolbar token-hygiene sweep (CSS-only, ~3 small edits, locks via guards in a single test file). Closes the only P1.
- **Bundle 3 (cross-surface unification):** INSP-1 + INSP-2 + INSP-3 + BP-1 → Inspector + Bottom Panel adopt the sidebar consistency standard. Mid-size, touches CSS in components.css; no JS / no DOM restructure.
- **Defer:** BC-1 (feature), BP-2 (cosmetic-only, not blocking perception).

None of these are required to declare Bundle 2 complete. They are the next visible items if Bundle 3 opens.

End of audit.
