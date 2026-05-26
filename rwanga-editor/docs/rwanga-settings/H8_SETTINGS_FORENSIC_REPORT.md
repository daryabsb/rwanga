# H8 — Settings Forensic Investigation Report

**Date:** 2026-05-26
**Baseline:** HEAD `14f20fb9` (after H7)
**Mode:** Investigation only. No fixes implemented.
**Tone:** Harsh. No defence of prior slices.

---

## 1. Executive Verdict

The Rwanga Settings system at HEAD `14f20fb9` **is not a constitutional implementation of the Settings Design Constitution RC1.** It is a **parallel, test-green form renderer** that fulfils a narrow subset of RC1 (control types, registry shape, language rules) while:

- **Ignoring the designer's prototype architecture** at `docs/rwanga-settings/settings-*.jsx`. Those files are not sketches — they are executable React source for the entire Settings UI. The current implementation rebuilds the same surface from scratch in imperative DOM, missing 9+ mandatory visual elements that the prototype ships.
- **Routing Document-scope settings to the wrong tier.** `pageSetup.*`, `screenplay.*`, and `export.*` per RC1 §10 MUST write to document metadata; the current Store routes them to user-tier prefs.
- **Shipping 41 of 62 settings (66%) as disabled placeholders.** The user's perception of "75% frozen" is **empirically accurate**. Four entire sections (Screenplay, Print/Export, Autosave, Advanced) are **0% functional**.
- **Carrying a Page Setup ownership conflict identical in shape to the pre-H2B Theme conflict.** A legacy `page-setup-dialog.js` writes `doc.settings.pageSetup` directly. `LayoutProfile` reads `doc.settings.pageSetup` only. Settings.Store writes a parallel value that **nothing in the behavior code reads**. The H7 margins applicator writes CSS variables that **no consumer references**.
- **Passing tests while the product is incorrect.** H5/H6/H7 Playwright specs verify the wire path fires (Store.set called, CSS variable set, KR.register invoked) but never assert that the user-visible surface actually changes. H5 never measures the zoomed UI; H6 never presses the rebound combo via the real keyboard event path; H7 margins never re-layouts a page preview (because no page preview exists).

**The user's three observations are all justified:**

1. *"Implementation feels far from the original designer intent"* — **TRUE.** The designer's component library (`settings-controls.jsx`, `settings-nav.jsx`, `settings-app.jsx`, `settings-page-setup.jsx`, `settings-json.jsx`) was not used as a build target. The renderer at `renderer/js/shell/workspaces/settings-workspace.js` is a parallel reimplementation that drops scope badges, per-row reset, nav icons, nav count badges, modified count, page preview, and the doctrine banner.
2. *"Visual drift keeps returning after every slice"* — **TRUE and predictable.** Drift is structural, not accidental. The slices have been wiring single behaviors against an incorrect shell shape, never reconciling the shell against the prototype. Drift cannot stop until the shell matches the prototype.
3. *"75% appear frozen / non-interactive"* — **TRUE (66% measured).** 41/62 rows are PERSISTS_ONLY with disabled controls and "Behavior not wired yet." appended. Critical sections are 100% frozen.

**Verdict:**
- Constitutionally correct? **NO.** §1A.3 violated by 1 BLOCKER + 5 MAJOR parallel paths. §10.3 violated by tier routing. §7.1 violated by missing scope badges.
- Visually faithful to designer? **NO.** 9+ mandatory shell/row elements absent.
- Behaviorally wired through correct ownership? **NO.** Page Setup is a two-track architecture with no merge rule.
- Free of hidden legacy/parallel gates? **NO.** Confirmed parallel paths: Rga.Theme localStorage, units, view-mode, script-language, workspace-state, page-setup-dialog.
- Ready for future feature wiring? **NO.** The shell shape is wrong; new settings would inherit the same gaps.

---

## 2. Blockers

These six issues must be acknowledged in writing before any further Settings code lands. They block the Alive App phase per the user's memory.

### B1 — Page Setup is Theme again (multi-gate ownership)

`pageSetup.*` has TWO independent writers and TWO independent readers, mirroring the pre-H2B Theme problem the user already paid to fix once.

- **Writer A (legacy):** `renderer/js/editor/page-setup-dialog.js:93-99` writes `doc.settings.pageSetup.margins = {...}` directly. No call to `Rga.Settings.Store.set`.
- **Writer B (current Settings UI):** `_makeMargins` → `_wireControl.onChange` → `Rga.Settings.Store.set('pageSetup.margins', obj, { tier: 'user' })`. Default tier is `'user'`, not `'script'`. Value lands in `window.rwanga.prefs`.
- **Reader A (behavior code):** `renderer/js/framework/layout-profile.js:224-232` `_resolveMargins(settings)` reads `settings.pageSetup.margins` from the doc, not from Settings.Store. `manuscript-geometry.js:79` writes back to `doc.settings.pageSetup.margins` for presets.
- **Reader B (H7 applicator):** `shell-applicators.js:401-418` sets `--page-margin-{top,right,bottom,left}` on `documentElement`. **No CSS rule, no JS reader, and no preview engine consumes these variables.** The applicator is an orphan.

Net effect: editing margins in the Settings UI writes the user-tier prefs file. The page geometry does not change. Editing margins via Tools → Page Setup writes the doc. Both paths "work" in their own bubble. The Settings UI is theatrical.

Five of seven `pageSetup.*` settings (`orientation`, `pageNumbers`, `pageNumberPosition`, `headerText`, `footerText`) have **no UI control in the page-setup-dialog at all** and **no applicator** — they are unreachable from either path.

Severity: **BLOCKER**.

### B2 — Document-scope settings routed to user tier

RC1 §10.3 mandates: *"Application preferences MUST read from and write to the user preferences store. Document preferences MUST read from and write to the active document's metadata."*

`Settings.Registry` declares `persistsTo: 'script'` on `pageSetup.*`, `screenplay.*`, and (effectively) `export.*` entries. `Settings.Store.set` defaults to `tier: 'user'` and writes the value into `_userValues` + `window.rwanga.prefs.write`. There is **no auto-routing on `persistsTo`**. The `_wireControl` factory does not consult `entry.persistsTo` to pick the tier.

Consequence: a "Document Preference" persists per-user, not per-document. Switching documents does not change the displayed value. Two scripts cannot have different margins. The constitution's central distinction (§10) is broken in code.

Severity: **BLOCKER**.

### B3 — Scope badges absent (every row, RC1 §7.1)

RC1 §7.1: *"Every settings row displays exactly one scope badge."* RC1 §4.4: *"Every row MUST have a scope badge."* Implementation Checklist Section C: *"Scope badges use correct colors (Flow=gold, Print=blue, Export=teal, All=grey)."*

`renderer/js/shell/workspaces/settings-workspace.js` `_buildRow()` does not render a scope badge. Grep for `scope` in the workspace returns one hit — and it is a comment about H6 conflict detection, not a render path. The designer's `ScopeBadge` component in `settings-controls.jsx:7-27` (dot + label + container + colors per `SCOPE_META`) was never ported.

Every row in the current Settings UI fails RC1 §4.4.

Severity: **BLOCKER**.

### B4 — Per-row reset button (↺) absent (RC1 §4.1, §4.4, §12.7)

RC1 §4.1: *"Reset button: `↺` glyph, 11px, `var(--text-tertiary)`, appears only when value differs from default (opacity transition)."* RC1 §4.4: *"The reset button appears ONLY when the current value differs from the default."* RC1 §12.7 lists the reset-appear opacity transition as a required animation.

`settings-workspace.js` has no reset-button code. Grep for `reset`, `isModified`, or the `↺` glyph in the workspace file returns zero matches.

The H5/H6/H7 Playwright specs prove "reset restores default" by calling `Store.set(Registry.getDefault(id))` programmatically. **No UI affordance exists for the user to do this.**

Severity: **BLOCKER**.

### B5 — Direct DOM mutation outside applicator (`app-shell.js:33`)

RC1 §1A.3 forbids: *"Direct DOM mutations for configuration state (e.g., `document.documentElement.setAttribute('data-theme', ...)`)."*

`renderer/js/app-shell.js:33` calls `document.documentElement.setAttribute('data-theme', theme)` **inside `Rga.Theme.apply`**, not inside the theme applicator at `shell-applicators.js:221`. The applicator delegates back to `Rga.Theme.apply` (line 163), which performs the forbidden mutation.

This is the same shape of bypass the user paid to fix at H2B (the H2B drift guard at `tests/unit/shell/ownership-stab-slice2.test.js` covers the `Rga.Theme.apply/toggle` callers but does not assert that `setAttribute('data-theme', ...)` happens only inside `Rga.Theme.apply` — i.e. it does not catch that `Rga.Theme.apply` itself is the bypass).

Severity: **BLOCKER** per §1A.3 plain text.

### B6 — H5/H6/H7 tests pass while the product is wrong

The three most recent Playwright specs verify implementation details, not user-visible behavior.

- **H5 `window-zoom.spec.js`** asserts `window.rwanga.window.getZoomFactor()` returns the right number. **It never asserts that the UI visibly zoomed.** Native range step snapping was the only "visible" thing the test caught. A stubbed `webFrame.setZoomFactor` that does nothing would still pass every assertion.
- **H6 `shortcut-controls.spec.js`** binds Ctrl+Alt+J then calls `KeyboardRegistry.invokeCommand('view.toggleSidebar')` directly, bypassing the keydown layer. **It never presses Ctrl+Alt+J through the real event dispatcher.** A broken Electron IPC keyboard path would still pass.
- **H7 `margins-and-color.spec.js`** asserts the `--editor-bg` and `--page-margin-*` custom properties are set on `documentElement`. **It never verifies the editor desk visibly repaints or that any page geometry recomputes.** The margins applicator is an orphan (B1), and the test green-lights it.

The H2B drift guard test is the only one in the H2-H7 chain that asserts a constitutional rule. The rest are wire-path traces.

Severity: **BLOCKER** because they make "green tests" non-protective.

---

## 3. Major Issues

### M1 — 66% of settings are disabled placeholders

| Section | REAL | PERSISTS_ONLY_DISABLED | % Frozen |
|---|---|---|---|
| General | 2 | 4 | 67% |
| Editor | 5 | 4 | 44% |
| **Screenplay** | **0** | **7** | **100%** |
| Page Setup | 1 (orphan, see B1) | 6 | 86% |
| **Print / Export** | **0** | **7** | **100%** |
| **Autosave & Files** | **0** | **5** | **100%** |
| Appearance | 3 | 4 | 57% |
| Keyboard Shortcuts | 10 | 0 | 0% |
| **Advanced** | **0** | **4** | **100%** |
| **TOTAL** | **21** | **41** | **66%** |

Four entire sections are 0% wired. A user opening Settings, browsing the nav, sees: General → click → 4 frozen rows. Screenplay → click → 7 frozen rows. Page Setup → click → 6 frozen rows. Print/Export → click → 7 frozen rows. Autosave → click → 5 frozen rows. Advanced → click → 4 frozen rows.

The "Behavior not wired yet." text appears 41 times. The product reads as a half-finished demo, not a shipping settings page.

H3A's "interaction-layer-only" disabled rendering (no row fade) was designed to be honest, but at 66% saturation it now reads as broken instead of incomplete. The H3A correction was correct in isolation; it does not solve the underlying problem (which is the wiring backlog, not the visual treatment).

### M2 — Five parallel persistence paths bypass Settings.Store

Confirmed bypasses outside the Settings.Store contract:

| Path | File | Storage | Setting affected | In Registry? |
|---|---|---|---|---|
| Rga.Theme legacy | `app-shell.js:25, 33, 34` | `localStorage('rga-theme')` + `data-theme` attr | `theme` | YES — but bypass writes from outside applicator |
| Units | `units.js:27, 34` | `localStorage('rga-default-units')` + `doc.settings.units` | `units` | **NO** — no registry entry |
| View Mode | `view-mode.js:27, 36` | `localStorage('rga-view-mode')` | view mode | **NO** |
| Script Language | `script-language.js:35, 45, 80` | `localStorage('rga-script-lang')` | script language | **NO** |
| Workspace State | `workspace-state.js:67, 83, 90, 120` | `localStorage('rga-workspace-layout')` + legacy keys | sidebar/panel visibility | **NO** |
| Page Setup dialog | `page-setup-dialog.js:65-127` | `doc.settings.pageSetup` | all `pageSetup.*` | YES — but dialog bypasses Store |

The drift guard at `tests/unit/shell/ownership-stab-slice2.test.js` only covers `Rga.Theme.apply/toggle` callers. It misses all five bypasses above.

### M3 — Designer prototype files were not used as build target

`docs/rwanga-settings/` contains 1,894 lines of executable JSX:

- `settings-app.jsx` (333 lines) — entire shell composition
- `settings-controls.jsx` (317 lines) — every control component
- `settings-nav.jsx` (167 lines) — left nav with icons + count badges
- `settings-page-setup.jsx` (129 lines) — live page preview component
- `settings-json.jsx` (80 lines) — JSON preview panel
- `settings-data.jsx` (238 lines) — schema with Kurdish labels (`labelKu`)
- `tweaks-panel.jsx` (530 lines) — density / theme tweaks
- `Settings UI.html` (268 lines) — mount file with full token catalogue

The current implementation re-implements only `settings-controls.jsx` (vanilla DOM factories) and `settings-data.jsx` (registry). The remaining 5 files were not ported. The result is a Settings UI that has the same control palette as the prototype but a different shell, no nav chrome, no page preview, and no scope badges.

This is the proximate cause of "drift keeps returning": the prototype is the spec, and the implementation is not matched against it.

### M4 — Mandatory shell/row elements absent

Cross-referenced against RC1 §3, §4, §7, Implementation Checklist Section C:

| RC1 rule | Designer prototype | Current implementation | Match |
|---|---|---|---|
| §3.2 — Tab shows `⚙ Settings` + modified count badge | `settings-app.jsx:170-183` | No icon, no count | ❌ |
| §3.3 — Nav header: gear icon + "Settings" title | `settings-nav.jsx:97-103` | Absent | ❌ |
| §3.3 — Nav items have icon + label + count | `settings-nav.jsx:135-164` | Label only, no icon, no count | ❌ |
| §3.3 — Nav active state: 2px left border + `--bg-active` | `settings-nav.jsx:144` | 2px `--accent-primary` left border present, but no `--bg-active` background (uses `--surface-selected` fallback) | ⚠ Partial |
| §3.3 — Nav footer: Reset All + Save | `settings-nav.jsx:115-130` | Absent | ❌ |
| §3.4 — Page Setup side-by-side preview | `settings-app.jsx:213-233`, `settings-page-setup.jsx` (full component) | Absent | ❌ |
| §3.6 — Status bar at bottom: "Settings • N modified" | `settings-app.jsx:269-281` | Settings tab uses the editor's status bar (chrome inherited) | ❌ |
| §4.1 — Row has scope badge | `settings-controls.jsx:62-77` | Absent | ❌ |
| §4.1 — Row has per-row reset button | `settings-controls.jsx:73` | Absent | ❌ |
| §4.4 — Reset appears only when modified, opacity transition | `settings-controls.jsx:54-60` | Absent | ❌ |
| §7.1 — Scope badge: dot + label + 8% alpha bg | `settings-controls.jsx:7-27` | Absent | ❌ |
| §8.1.1 — DEFERRED state at 40% opacity + "coming soon" | not in prototype, in RC1 | Not implemented (no row uses DEFERRED today) | ⚠ Latent |
| §8.1.2 — PERSISTS_ONLY at 60% opacity | Original RC1 rule | Overridden by H3A — full opacity, control-only | ⚠ Doctrinal conflict |
| §8.1.3 — Conditional disabled at 40% opacity | RC1 rule + uses `entry.dependencies` | `entry.dependencies` declared but never enforced at render time | ❌ |
| §12.3 — Density toggle (comfortable/compact) | `settings-app.jsx:9, 285-298` | Single density only | ❌ |
| §10.2 — Document-scope sections include "for this document" in description | RC1 rule, e.g. "for the current script" | Generic descriptions only | ❌ |

### M5 — H3A doctrine conflicts with RC1 §8.1.2

The user's memory records the H3A correction: *"drop row-level fade — PERSISTS_ONLY signals belong to the interaction layer only."* This is in tension with RC1 §8.1.2: *"PERSISTS_ONLY settings render at 60% opacity. Helper text appended with 'Behavior not wired yet.'"*

The H3A pivot was made when the row-level fade looked broken at 60% opacity. The pivot to full-opacity solved the local visual ugliness but did not address why 41 rows needed to be faded in the first place. At today's saturation (66%), the H3A version reads to the user as "Settings is broken" because so many controls are disabled with no visible explanation other than tiny helper text.

This is a **doctrinal conflict that needs to be resolved before the next slice**, not silently inherited. Options:
- Reinstate the 60%-opacity rule (RC1-compliant) and accept that 66% of Settings looks like a roadmap.
- Keep H3A and aggressively reduce PERSISTS_ONLY saturation by wiring or removing entries.
- A third option (e.g. collapse all PERSISTS_ONLY rows behind a "Show coming soon" toggle) — requires a constitution amendment first per RC1 §14.3.

### M6 — Drift guard scope is too narrow

`tests/unit/shell/ownership-stab-slice2.test.js` is the only guard against parallel write paths. It enforces "only the two H2B owner files call `Rga.Theme.apply/toggle`." It does **not** assert:

- `setAttribute('data-theme', ...)` happens only inside `Rga.Theme.apply`.
- `documentElement.style.setProperty('--editor-bg', ...)` happens only inside the `appearance.editorDeskColor` applicator.
- `webFrame.setZoomFactor` is called only inside the `windowZoom` applicator.
- `KR.register(...)` for `kb.*` combos happens only inside the H6 applicator block.
- No new `localStorage('rga-*')` keys are added outside `Settings.Store`.

Every new applicator should have appended its bypass-exit-points to this guard. None did.

---

## 4. Design Fidelity Table

Full audit. RC1 reference column cites the binding section/rule. `Match?` column is harsh.

| # | Area | RC1 rule | Current implementation | Match? | Severity | Evidence |
|---|---|---|---|---|---|---|
| 1 | Shell — tab bar | §3.2 — `⚙ Settings` + modified-count badge | Settings tab shows label "Settings" only (icon may be the editor TabManager's generic icon); no modified-count badge | ❌ NO | MAJOR | `settings-workspace.js:1015-1022` registers `title: 'Settings'`, no modified-count code anywhere |
| 2 | Shell — nav header | §3.3 — gear icon + "Settings" title at `--font-size-lg`, weight 600 | Nav opens directly with section list, no header | ❌ NO | MAJOR | `_buildSkeleton` at `settings-workspace.js:920-985`, no header element |
| 3 | Shell — nav search position | §3.3 — search BELOW header | Search rendered ABOVE section list, no header above | ⚠ Partial | MINOR | `_buildSkeleton` line ~944, search input renders first |
| 4 | Shell — nav search | §3.3 — `Search settings...` placeholder, `--font-size-sm` | Placeholder `Search settings`, font inherited | ⚠ Partial | MINOR | Line ~948 — close but placeholder text differs from RC1 |
| 5 | Shell — nav items | §3.3 — icon (18×18) + label + count badge | Label only | ❌ NO | MAJOR | `settings-workspace.js:1027-1037` — `item.textContent = section.label` |
| 6 | Shell — nav active state | §3.3 — `--bg-active` + 2px `--accent-primary` left border | 2px left border present; background uses `--surface-selected` fallback, not `--bg-active` | ⚠ Partial | MINOR | `settings-workspace.css:58-64` |
| 7 | Shell — nav footer | §3.3 — Reset All + Save buttons | Absent | ❌ NO | MAJOR | No nav footer code |
| 8 | Shell — content max-width | §3.4 — 680px | Not set; uses parent width minus padding | ⚠ Partial | MAJOR | `settings-workspace.css:66-78` only sets padding, no max-width |
| 9 | Shell — content padding | §3.4 — 24px 32px comfortable | `0 40px 32px` | ⚠ Different | MINOR | `settings-workspace.css:71` |
| 10 | Shell — Page Setup preview | §3.4 — 240px panel on right, `--bg-secondary`, border-left | Absent | ❌ NO | MAJOR (B1-related) | No PageSetupPreview component |
| 11 | Shell — status bar | §3.6 — 24px Settings status bar | Absent — inherits editor's status bar | ❌ NO | MAJOR | No status bar in workspace |
| 12 | Row — grid | §4.1 — `grid-template-columns: 1fr auto`, 8px gap | Row is `article` element with flex children, no grid layout | ⚠ Different | MAJOR | `settings-workspace.css:160-165` |
| 13 | Row — scope badge | §4.1, §4.4, §7.1 — mandatory, every row | Absent | ❌ NO | BLOCKER | See B3 |
| 14 | Row — reset button | §4.1, §4.4, §12.7 — mandatory, appears when modified | Absent | ❌ NO | BLOCKER | See B4 |
| 15 | Row — label hierarchy | §4.1 — label at 13px/500 + scope badge inline + helper at 11px/400 | Label at 13px/600 in `h2`, no scope badge, helper at 12px (not 11px) | ⚠ Off-spec | MINOR | `settings-workspace.css:178-219` |
| 16 | Row — helper max-width | §4.1 — 480px | 60ch (`settings-workspace.css:219`) | ⚠ Different | MINOR | Spec uses px, impl uses ch — close but unverified |
| 17 | Row — vertical padding | §4.2 — 14px comfortable | 14px 16px | ✓ Match | OK | `settings-workspace.css:160-161` |
| 18 | Row — separator | §4.2 — 1px solid `--border-secondary` bottom | 1px solid `--border-subtle` + 4px radius + bg | ⚠ Different | MINOR | `settings-workspace.css:160-165` — RC1 expects flat separator, impl uses card style |
| 19 | Row — pro marker | §7.2 — status badge, gold text on 12% bg | Present, gold styling | ✓ Match | OK | `settings-workspace.css:188-198` |
| 20 | Row — restart marker | §7.2 — warning text on warning bg | Present | ✓ Match | OK | `settings-workspace.css:238-248` |
| 21 | Type chip | §7.3 — FORBIDDEN | Absent (correctly retired in H3) | ✓ Match | OK | H3 commit |
| 22 | Control — toggle | §5.2.1 — 36×20 track, 16×16 thumb | Native checkbox at 16×16 with accent-color, not a custom track | ❌ NO | MAJOR | `settings-workspace.css:250-260` — uses native checkbox |
| 23 | Control — radio | §5.2.2 — segmented button group with shared border | Native `<input type="radio">` + label in flex row | ❌ NO | MAJOR | `settings-workspace.css:301-326` — uses radio buttons, not segmented control |
| 24 | Control — select | §5.2.3 — 5px 28px 5px 8px padding, chevron SVG | min-width 180px, padding 6px 10px, native chevron | ⚠ Different | MINOR | `settings-workspace.css:262-275` |
| 25 | Control — number | §5.2.4 — input with − and + buttons, 56px width | Plain `<input type="number">` at 100px, no decrement/increment buttons | ❌ NO | MAJOR | `settings-workspace.css:277-280`, `_makeNumber` lacks +/- buttons |
| 26 | Control — slider | §5.2.5 — 120px track, 14px thumb, value label min-width 40px end-aligned | 120px track, 14px thumb, value label min-width 40px end-aligned | ✓ Match | OK | H5 |
| 27 | Control — text | §5.2.6 — 200–280px min/max, 5px 8px padding | min-width 280px, padding 6px 10px | ⚠ Different | MINOR | `settings-workspace.css:282-286` |
| 28 | Control — color | §5.2.7 — 24px circles, 6px gap, active 1.1 scale + text-primary border | Implemented per spec | ✓ Match | OK | H7 |
| 29 | Control — shortcut | §5.2.8 — key caps 22×22, 2px 6px padding, bg-tertiary, border-primary | Implemented per spec | ✓ Match | OK | H6 |
| 30 | Control — margin group | §5.2.9 — 2-col grid, 32px label min-width, 48px input, 12px font, bg-secondary | Implemented per spec | ✓ Match | OK | H7 |
| 31 | Density toggle | §12.3 — comfortable/compact modes | Single mode | ❌ NO | MINOR | RC1 §3.5 explicitly notes tweaks panel is dev-only, but density itself is mandatory; current code doesn't even ship the density tokens |
| 32 | Section description — doc scope | §10.2 — must include "for this document" / "for the current script" | Generic descriptions only | ❌ NO | MAJOR | `settings-layout.js` section descriptions |
| 33 | Kurdish labels (`labelKu`) | §6.5 — mandatory on every entry | Registry has only `label`, no `labelKu` field | ❌ NO | MAJOR | `settings-registry.js` REQUIRED_FIELDS list has no labelKu |
| 34 | Disabled state (PERSISTS_ONLY) | §8.1.2 — 60% opacity, pointer-events:none on control | Full opacity, pointer-events:none on value column, control disabled | ⚠ H3A pivot | MAJOR (doctrinal) | See M5 |
| 35 | Disabled state (DEFERRED) | §8.1.1 — 40% opacity + "coming soon" | Not implemented | ❌ NO | MINOR (no entries use it) | `settings-workspace.js` only handles PERSISTS_ONLY |
| 36 | Disabled state (CONDITIONAL) | §8.1.3 — 40% opacity when dependency unmet, transition on satisfy | `entry.dependencies` declared in registry but never enforced at render time | ❌ NO | MAJOR | `_buildRow` doesn't consult dependencies |
| 37 | Reset opacity transition | §12.7 — opacity transition on reset-button appear | No reset button exists | ❌ NO | BLOCKER | See B4 |
| 38 | Section descriptions match RC1 canonical text | §2.3 — exact canonical text per section | Match for most; "for this document" suffix missing on doc-scope sections | ⚠ Partial | MINOR | `settings-layout.js` |
| 39 | Section ordering | §2.1 — General, Editor, Screenplay, Page Setup, Print/Export, Autosave, Appearance, Shortcuts, Advanced | Matches | ✓ Match | OK | `settings-layout.js` |
| 40 | Responsive — breakpoints | §11.1 — 5 breakpoints | Not implemented (single layout) | ❌ NO | MAJOR | No media queries for nav collapse |

**Drift cause breakdown (origin of each ❌):**

- CSS gaps: rows 8, 9, 17 (offset), 18, 22-27, 31, 34, 38
- DOM-structure gaps: rows 1, 2, 5, 7, 10, 11, 12, 13, 14, 32, 33, 36, 37, 40
- Data-shape gaps: rows 32, 33 (Kurdish), 36 (dependencies)
- Legacy shell composition: rows 11 (status bar inherited), 32 (descriptions), 40 (responsive)

**Verdict: Engineers built a parallel renderer.** The designer's component library was either not read or treated as optional reference. The implementation file `settings-workspace.js` is 1071 lines of imperative DOM construction that re-derives a Settings UI from registry data. The designer's `settings-controls.jsx`, `settings-nav.jsx`, `settings-app.jsx`, and `settings-page-setup.jsx` describe the same UI in 946 lines of declarative React. **None of the designer code is referenced or ported.** The two implementations agree on control types and registry shape but diverge on shell composition, badges, reset, nav chrome, page preview, density, and disabled-state visuals.

---

## 5. Frozen-Settings Reality Count

**Method:** Walk every entry in `settings-registry.js`. Look up applicator presence in `shell-applicators.js` + `editor-applicators.js`. Classify per the brief.

**Result:**

- **REAL (interactive, applicator wired, visible effect):** 21
  - General: 2 (theme, windowZoom)
  - Editor: 5 (fontFamily, fontSize, lineHeight, spellcheck, highlightCurrentLine)
  - Page Setup: 1 (margins — applicator is **ORPHAN**, see B1; classify as "wired but no effect")
  - Appearance: 3 (statusBar, editorDeskColor, plus theme-side effects)
  - Shortcuts: 10 (all kb.* — applicators registered, but 7 of 10 target commands that are not yet wired in KR)

- **PERSISTS_ONLY_DISABLED (editable type, no applicator, control disabled):** 41
  - General: 4 (language, recentFilesLimit, confirmBeforeClose, restoreLastSession)
  - Editor: 4 (autocomplete, showLineNumbers, wordWrap, [highlightCurrentLine is REAL])
  - Screenplay: 7 (all)
  - Page Setup: 6 (everything except margins — and margins is a fake REAL per B1)
  - Print / Export: 7 (all)
  - Autosave & Files: 5 (all)
  - Appearance: 4 (sidebarPosition, activityBar, minimap, editorPageShadow, formatToolbar — minus statusBar/editorDeskColor which are REAL)
  - Advanced: 4 (all)

- **READONLY_FALLBACK:** 0 (post-H7 — every type has a control factory)
- **DEFERRED:** 0 (no entry currently uses the 40% opacity DEFERRED state — though `editor.aiAssist` would qualify per RC1 §15.7 example)
- **CONDITIONALLY_DISABLED:** 0 (registry declares dependencies like `screenplay.sceneNumberPosition` depends-on `screenplay.sceneNumbering`, but the renderer does not honour them; classify under PERSISTS_ONLY_DISABLED above)
- **BROKEN_INTERACTIVE:** 1 (the H7 `pageSetup.margins` — interactive, applicator registered, but the applicator's effect is an orphan CSS variable that no consumer reads. Counts as "REAL" in the constitution's letter, "BROKEN" in spirit.)
- **BROKEN_DISABLED:** 0

**Percentages:**

- **Interactive: 21/62 = 33.9%**
- **Frozen (PERSISTS_ONLY_DISABLED): 41/62 = 66.1%**
- **Effectively functional (excluding orphan margins and Pro-pending Shortcuts → 11 REAL + 10 Shortcuts that may not have commands): 11–20 of 62 = 18–32%**

**User's "75% frozen" perception: ACCURATE.** Measured rate is 66%, and 7 of 10 Shortcut rows have inert commands → real "things that change behavior visibly today" is closer to **18% of Settings**.

**Frozen sections:** Screenplay (100%), Print/Export (100%), Autosave (100%), Advanced (100%), Page Setup (86%), General (67%), Appearance (57%). **Only Editor and Keyboard Shortcuts have a majority working surface, and Shortcuts is hollow at runtime.**

**Does the UI clearly explain why?** No. The user sees:
- A disabled checkbox / select / number input next to a label
- The helper text 60% size with " Behavior not wired yet." appended
- No visual distinction between "Pro-gated", "depends on parent", "intentionally deferred", "applicator missing"
- No visible roadmap / category banner / explanation

The H3A interaction-layer-only approach is honest in isolation but produces an unmoored "what is going on with this app" reaction at scale. **"Behavior not wired yet." appears 41 times in a single Settings UI. That damages product trust.**

---

## 6. Page Setup Ownership Map

| Setting | Registry default | Store tier (current) | RC1-mandated tier | Settings applicator | Owner service | DOM/CSS target | Other readers | Other writers | Conflict risk |
|---|---|---|---|---|---|---|---|---|---|
| `pageSetup.paperSize` | `'letter'` | `user` (default in `_wireControl`) | `script` (§10) | **none** | `LayoutProfile._resolvePageSize` reads `doc.settings.pageSetup.paperSize`, not Store | none (no behavior reads Store value) | `layout-profile.js:208`, `constants.js:36-40` (hardcoded PAPER_SIZES) | `page-setup-dialog.js:93` writes `doc.settings.pageSetup.paperSize` | **LEGACY_BYPASS + HARDCODED_FALLBACK** |
| `pageSetup.orientation` | `'portrait'` | `user` | `script` | **none** | none (LayoutProfile never reads orientation) | none | none | **NO_BEHAVIOR** |
| `pageSetup.margins` | `{top:1, bottom:1, left:1.5, right:1}` | `user` | `script` | **registered** at `shell-applicators.js:401-418` (owner: pageSetup) | applicator sets `--page-margin-{top,right,bottom,left}` on documentElement | **no CSS rule reads these vars** | `LayoutProfile._resolveMargins` reads `doc.settings.pageSetup.margins`; `manuscript-geometry.js:79-96` writes `doc.settings.pageSetup.margins` directly | `page-setup-dialog.js:94-99` writes `doc.settings.pageSetup.margins` | **LEGACY_BYPASS + ORPHAN_APPLICATOR** |
| `pageSetup.pageNumbers` | `true` | `user` | `script` | **none** | none | none | none | **NO_BEHAVIOR** |
| `pageSetup.pageNumberPosition` | `'top_right'` | `user` | `script` | **none** | none | none | none | **NO_BEHAVIOR** |
| `pageSetup.headerText` | `''` | `user` | `script` | **none** | none | none | none | **NO_BEHAVIOR** |
| `pageSetup.footerText` | `''` | `user` | `script` | **none** | none | none | none | **NO_BEHAVIOR** |

**For each id, the specific verdict (per the brief's checklist):**

1. **Does `pageSetup.margins` only write CSS variables but not affect actual page truth?**
   **YES.** The H7 applicator sets `--page-margin-*`. `LayoutProfile._resolveMargins` does not read these CSS variables — it reads `doc.settings.pageSetup.margins`. The Settings UI does not write `doc.settings.pageSetup.margins`. Therefore margins set via Settings UI do not affect page truth.
2. **Does Print Preview ignore Settings?**
   **YES (no Print Preview ships, and the geometry layer that would feed one ignores Settings.Store for `pageSetup.*`).**
3. **Does Export ignore Settings?**
   **YES.** All `export.*` settings have no applicator (M1 table). The export code (`renderer/js/export/`, where present) reads `doc.settings.export` or hardcoded fallbacks, not Store.
4. **Does PageMap have independent defaults?**
   **YES.** `manuscript-geometry.js:79-96` `applyPreset()` writes margins into `doc.settings.pageSetup.margins` from preset tables. `constants.js:36-40` carries hardcoded `PAPER_SIZES` independent of registry.
5. **Does document metadata shadow user/session values incorrectly?**
   **PARTIALLY.** `settings-store.js:_scriptValue` correctly refuses to shadow user-tier entries with `persistsTo: 'user'`. But for `pageSetup.*` (persistsTo: 'script'), the script-tier read does take precedence — except the Settings UI never WRITES to script tier, so the script-tier value comes from the legacy dialog only.
6. **Do old script defaults override registry?**
   **NO direct override**, but the legacy dialog's writes coexist with Store writes for the same id — and the legacy writes are the ONLY ones the geometry layer reads. So in effect, legacy defaults always win.
7. **Is page setup UI pretending to control page truth when it only controls local CSS?**
   **YES.** The Settings UI surfaces `pageSetup.margins` as if changing it affects page geometry. It does not. The user-visible margin-change effect today is zero. Severity: **BLOCKER** (see B1).

---

## 7. Store SSOT Map

(From the parallel Explore investigation; deduplicated and severity-graded.)

| Path | File:line | Reads/Writes | Setting | Allowed? | Reason |
|---|---|---|---|---|---|
| `documentElement.setAttribute('data-theme', theme)` | `app-shell.js:33` | Write | `theme` (DOM) | NO | Outside applicator; direct DOM mutation forbidden by §1A.3. **BLOCKER B5.** |
| `localStorage.setItem('rga-theme', theme)` | `app-shell.js:34` | Write | `theme` (legacy persist) | NO | Outside applicator. Migrated once at boot via `settings-migrations.js:27`, but still active on every Rga.Theme.apply call. **MAJOR.** |
| `localStorage.getItem('rga-theme')` | `app-shell.js:25` | Read | `theme` (legacy persist) | MIGRATION | Documented one-shot at boot; acceptable as legacy bootstrap. **MINOR.** |
| `localStorage` / `doc.settings.units` writes | `units.js:27, 34` | Write | `units` (not in registry) | NO | Not in `Settings.Registry`. No applicator. Parallel persistence. **MAJOR.** |
| `localStorage('rga-view-mode')` | `view-mode.js:27, 36` | Read/Write | view mode (not in registry) | NO | Not in `Settings.Registry`. No applicator. **MAJOR.** |
| `localStorage('rga-script-lang')` + direct apply | `script-language.js:35, 45, 80` | Read/Write/Apply | script language (not in registry) | NO | Not in `Settings.Registry`. Direct DOM apply in `script-language.js:80`. **MAJOR.** |
| `localStorage('rga-workspace-layout')` | `workspace-state.js:67, 83, 90, 120` | Read/Write/Remove | sidebar/panel visibility (not in registry) | NO | Not in `Settings.Registry`. Bypasses Store. **MAJOR.** |
| `doc.settings.pageSetup.*` writes from `page-setup-dialog.js` | `page-setup-dialog.js:93-99` | Write | `pageSetup.paperSize`, `pageSetup.margins` | NO | These ARE in registry (persistsTo: 'script'). Dialog should call `Settings.Store.set` with `tier:'script'` instead. **BLOCKER (B1).** |
| `localStorage('rga-default-units')` | `units.js` | Read/Write | units (not in registry) | NO | Same as above. **MAJOR.** |
| `localStorage('recent-files-list')` | `file-manager.js:125-139` | Read/Write | recent files (not config) | YES | UI/data state, not configuration. **ACCEPTABLE.** |
| `localStorage` session tabs | `tab-manager.js:465, 470` | Read/Write | session tabs (not config) | YES | Session state, not configuration. **ACCEPTABLE.** |
| `body.classList.toggle('rga-no-status-bar')` | `shell-applicators.js:128` | Write | `appearance.statusBar` | YES | Inside applicator. **ACCEPTABLE.** |
| `documentElement.style.setProperty('--editor-bg')` | `shell-applicators.js:118` | Write | `appearance.editorDeskColor` | YES | Inside applicator. **ACCEPTABLE.** |
| `documentElement.style.setProperty('--page-margin-*')` | `shell-applicators.js:401-418` | Write | `pageSetup.margins` | YES (allowed write) but NO (orphan) | Inside applicator; constitutional. But target is unread → **MAJOR (orphan applicator, see B1).** |
| `el.style.setProperty('--editor-font-size')` | `editor-applicators.js:82` | Write | `editor.fontSize` | YES | Inside applicator. **ACCEPTABLE.** |
| `KR.register(...)` for `kb.*` | `shell-applicators.js:371+` | Write | `kb.*` | YES | Inside H6 applicator block. **ACCEPTABLE.** |
| `Rga.Theme.apply(...)` from H2 inverse-sync | `shell-applicators.js:163` | Write | `theme` (DOM via Theme.apply) | YES (owner code) | Inside applicator; Theme.apply is the owner service. **ACCEPTABLE** — but Theme.apply itself does the forbidden `setAttribute('data-theme')`. The chain `applicator → Rga.Theme.apply → setAttribute` keeps the DOM write inside owner code, **but the SAME chain is also driven from `app-shell.js:30-35` outside any applicator** (B5). |

**Aggregate counts:**

- **BLOCKER:** 2 (B1 — page-setup-dialog bypass; B5 — app-shell.js:33 direct setAttribute)
- **MAJOR:** 6 (units, view-mode, script-language, workspace-state, Rga.Theme localStorage write, orphan margins applicator)
- **MINOR:** 1 (settings-migrations one-shot read)
- **ACCEPTABLE:** 11+ (all owner-code writes inside applicators)
- **FALSE_ALARM:** 4 (cursor reflow, view-mode CSS classes, etc.)

**Answers (per the brief):**

1. **Are there settings controlled outside Store?** YES — at least 5 (units, view-mode, script-language, workspace-state, plus pageSetup via legacy dialog).
2. **Are command/status/menu paths bypassing Store?** YES — Rga.Theme.apply is called outside applicator from `app-shell.js`; the legacy page-setup-dialog routes directly to `doc.settings`.
3. **Orphaned applicators?** YES — `pageSetup.margins` (writes CSS vars that no consumer reads). `appearance.editorDeskColor` was orphaned pre-H7 (the inventory says so verbatim); H7 surfaced it.
4. **Settings with no applicator but interactive?** NO at the workspace level — the `_isPersistsOnly` check disables them. BUT 41 of 62 are non-interactive for this reason.
5. **Applicators with no visible control?** Pre-H7: editorDeskColor was orphaned (no control). Post-H7: no longer the case. BUT 5 of the 7 `pageSetup.*` entries have NO behavior at all (no applicator, no dialog UI, no reader).
6. **Duplicate defaults outside registry?** YES — `Rga.Constants.PAPER_SIZES` (paper-size table), `manuscript-geometry.js` preset tables, hardcoded `1` defaults in `_makeMargins` fallback paths, hardcoded `'dark'` defaults in `Rga.Theme.toggle`.

---

## 8. Test Honesty Map

| Test file | Claim (file header / brief) | Actually proves | Blind spots | Severity |
|---|---|---|---|---|
| `honest-controls.spec.js` (H3) | PERSISTS_ONLY rows are disabled, helper text appended, type chip absent | Class markers, ARIA attributes, helper-text suffix, instrumented Store.set never fires from disabled controls | Does not verify visible click-through is blocked at the CSS level (only HTML disabled attribute). Does not verify RC1 §4.1 row layout. **No scope-badge check.** | MAJOR |
| `visual-contract-h3a.spec.js` (H3A) | PERSISTS_ONLY rows have identical visual treatment to REAL rows except the disabled control | Computed style snapshots: opacity, color, font-size, font-weight, line-height, padding, margin, border, ARIA. Disabled-attribute check. | No screenshot diff. No pointer-event verification. No "what does this look like compared to RC1's mandated 60% opacity?" check — the test enforces the **H3A pivot** which directly contradicts §8.1.2 written rule. The test enforces the engineering pivot, not the original constitution. | MAJOR (doctrinal — see M5) |
| `human-labels.spec.js` (H4) | No enum values, no internal IDs, no control-type words visible | Exact-match against `FORBIDDEN_ENUM_TEXT`, regex against `FORBIDDEN_INTERNAL_IDS`, language options spell English/Kurdish/Arabic, reload preserves, inventory file post-H7 shape | Only checks the Settings workspace innerText. Doesn't check toast messages, error dialogs, debug overlays. **No scope-badge presence check.** **No Kurdish label test (registry has no `labelKu`).** | MINOR |
| `window-zoom.spec.js` (H5) | Slider renders, drag updates Store, applicator zooms the renderer, reset restores, out-of-range clamps | DOM shape (min/max/step), Store.set instrumentation, `webFrame.getZoomFactor()` matches expected factor, pref persistence | **CRITICAL: never measures the actual visible zoom.** A stubbed `webFrame.setZoomFactor` that does nothing would still pass. No screenshot. No `getBoundingClientRect()` of a known element before/after. | **BLOCKER (B6)** |
| `shortcut-controls.spec.js` (H6) | Shortcut control renders, click enters rebind, key capture writes Store, behavior takes effect immediately, conflict toast, persistence, reset | DOM shape, `is-rebinding` class, Store.set fires, `KR._all()` shows new combo, `invokeCommand('view.toggleSidebar')` toggles sidebar | **CRITICAL: invokeCommand bypasses the keyboard dispatcher entirely.** Test never presses Ctrl+Alt+J via `page.keyboard.press`. A broken Electron IPC keyboard path would still pass. The test verifies KR registration, NOT keydown → command flow. | **BLOCKER (B6)** |
| `margins-and-color.spec.js` (H7) | Margin group renders, edit updates Store, persists, reset, clamps. Color swatches render, click writes Store, --editor-bg repaints visibly, persists, reset. Inventory updated. | DOM shape, Store.set instrumentation, `--editor-bg` and `--page-margin-*` CSS custom property reads, pref persistence | **CRITICAL: never asserts visible margin or color change.** `--page-margin-*` is orphan (no CSS reads it). `--editor-bg` is read by the workspace background (technically visible), but the test queries the property string, not the rendered colour. No print-preview re-layout assertion (no print preview exists). No screenshot diff. | **BLOCKER (B6)** |

**Final verdict on test suite as a Settings product protector: NO.**

H2B drift-guard is the only test that asserts a constitutional rule. The H3 / H3A tests assert internal shape only. H4 is honest for its narrow scope. H5 / H6 / H7 are wire-path traces that pass while the visible product surface is wrong. There is no test that:

- Verifies the per-row reset button appears (because it doesn't exist).
- Verifies scope badges appear (because they don't exist).
- Verifies nav icons + count badges appear (because they don't exist).
- Verifies the Settings tab shows `⚙ Settings` with a modified count badge (because it doesn't).
- Verifies a margin change reaches the page-geometry layer (because nothing reads the CSS variable the applicator sets).
- Verifies a zoom change visibly scales the renderer (only that the API returns the requested factor).
- Verifies a rebound shortcut fires through the real Electron keydown path.
- Verifies the Document-vs-Application scope tier routing matches §10.3.

---

## 9. Drift Root Causes

Ranked 1 (most damaging) → 10 (least).

### 1. Designer prototype treated as documentation, not source

- **Evidence:** `docs/rwanga-settings/settings-*.jsx` (1,894 lines of executable React) exists but is not loaded, not ported, not pinned by tests. The engineers re-wrote the same surface in imperative DOM and diverged from it. M3, M4, the entire Section 4 table.
- **Responsible files:** `renderer/js/shell/workspaces/settings-workspace.js` (the parallel renderer), `tests/e2e/settings/*.spec.js` (no test compares against prototype).
- **Prevention strategy:** Either (a) treat the JSX prototype as **acceptance criteria** — each Playwright test takes a screenshot and compares against the prototype's rendered HTML; or (b) port the prototype into the renderer as a build target (React, or a transpilation step). The current "vanilla DOM reimplementation" is the proximate cause of every Section 4 ❌.

### 2. Tests verify wire path, not visible behaviour

- **Evidence:** B6, the test-honesty table in Section 8. Every test from H5/H6/H7 checks "Store.set fired" or "CSS variable was set" instead of "the user sees a different surface".
- **Responsible files:** `tests/e2e/settings/window-zoom.spec.js`, `shortcut-controls.spec.js`, `margins-and-color.spec.js`.
- **Prevention strategy:** Add a Visual Behaviour Assertion contract: every Playwright spec must include at least one assertion that reads the **visible** surface (screenshot diff, `getBoundingClientRect` change, `getComputedStyle` of a non-Settings element). Wire-path traces are fine in addition, not in replacement.

### 3. PERSISTS_ONLY is a permanent state, not a wiring lane

- **Evidence:** M1. 41 of 62 settings have lived as PERSISTS_ONLY for 4+ slices. The Inventory doc treats this as acceptable because "applicator not yet registered" is documented. But the constitution treats PERSISTS_ONLY as a TEMPORARY bridge during wiring (§8.1.2 talks about "until behavior is wired"). At 66% saturation, "temporary" has become "default."
- **Responsible files:** `settings-registry.js` (declares 62 entries), `shell-applicators.js` + `editor-applicators.js` (register only 21).
- **Prevention strategy:** Treat every NEW setting added to the registry as a wiring obligation. PRs that add a registry entry without a matching applicator must be rejected (or the entry must be opt-in DEFERRED per §8.1.1, with 40% opacity + "coming soon"). Add a CI gate: count of PERSISTS_ONLY entries must not grow per PR.

### 4. Store tier-routing doesn't honour `persistsTo`

- **Evidence:** B2. `Settings.Store.set` defaults to `tier:'user'` regardless of `entry.persistsTo`. The `_wireControl` factory never passes `opts:{tier:'script'}` for document-scope entries.
- **Responsible files:** `settings-store.js:141-197` (defaults to 'user'); `settings-workspace.js _wireControl` (~line 480, calls `Store.set(id, value)` with no tier).
- **Prevention strategy:** Either auto-route in `Store.set` based on registry `persistsTo`, or have `_wireControl` look up `entry.persistsTo` and pass the right tier explicitly. Add a unit test that round-trips every entry to the tier the registry says.

### 5. No drift guard for new applicators or DOM-write classes

- **Evidence:** M6. The single drift guard `ownership-stab-slice2.test.js` covers only `Rga.Theme.apply/toggle` callers. Five parallel persistence paths (units, view-mode, script-language, workspace-state, page-setup-dialog) are not detected. The H5/H6/H7 applicators' DOM-write call sites (`setZoomFactor`, `setProperty('--page-margin-*')`, `setProperty('--editor-bg')`, `KR.register` for kb.*) are not constrained — anything outside the applicator could write them and the guard wouldn't catch it.
- **Responsible files:** `tests/unit/shell/ownership-stab-slice2.test.js` (too narrow); no equivalent for the H5/H6/H7 surface area.
- **Prevention strategy:** Every new applicator slice ships with an ownership guard test asserting the applicator file is the only caller of the relevant API.

### 6. H3A pivot is a constitutional fork that was never reconciled

- **Evidence:** M5. RC1 §8.1.2 says PERSISTS_ONLY = 60% opacity. The H3A doctrine (in user memory) says full opacity, interaction-layer only. The doctrine drove a Playwright test (`visual-contract-h3a.spec.js`) that enforces the pivot. RC1 was never amended.
- **Responsible files:** `RWANGA_SETTINGS_DESIGN_CONSTITUTION.md` (§8.1.2 still says 60%); `visual-contract-h3a.spec.js` (asserts the opposite).
- **Prevention strategy:** Either amend RC1 §8.1.2 to match H3A (constitution-as-code), or revert H3A. Constitutional pivots **must update the constitution document** before becoming code.

### 7. Two-track architecture coexistence (legacy + new) never reconciled

- **Evidence:** B1. `page-setup-dialog.js` was written before `Settings.Store` existed. When Settings.Store landed, the dialog was not migrated. The two paths coexist with no merge rule.
- **Responsible files:** `page-setup-dialog.js` (legacy), `settings-workspace.js` (new), `layout-profile.js` (reads only legacy).
- **Prevention strategy:** When a new SSOT-bearing system lands (Store, KeyboardRegistry, etc.), every pre-existing callsite that writes the same data must be migrated in the same PR or explicitly deprecated. Add a "legacy callsite registry" doc and a CI check.

### 8. Designer's component naming vs file naming mismatch

- **Evidence:** Designer code references components (`ToggleControl`, `SelectControl`, `MarginGroupControl`, etc.). RC1 §5.2 names the same controls (`Toggle`, `Select`, `Margin Group`). Implementation names them (`_makeToggle`, `_makeSelect`, `_makeMargins` — internal factories). The renaming is not destructive but it obscures whether the implementation faithfully covers the prototype.
- **Responsible files:** `settings-workspace.js` factory naming.
- **Prevention strategy:** Implementation function names should match RC1 component names 1:1. `_makeMargins` should be `_makeMarginGroupControl` (RC1 §5.2.9 says "Margin Group" / "MarginGroupControl"). Naming alignment helps audits find drift.

### 9. Engineers fill RC1 gaps with judgement instead of escalating

- **Evidence:** Implementation Checklist Section F lists forbidden patterns, including "Custom row layouts that differ from the standard two-column grid." The current row implementation uses an `article` with flex children, not the `grid-template-columns: 1fr auto` grid. RC1 §4.1 mandates the grid. Engineers made a CSS choice without escalation.
- **Responsible files:** `settings-workspace.css:160-225`.
- **Prevention strategy:** Add a constitutional compliance check (linter or test) for the mandatory RC1 patterns: grid-template-columns on rows, scope badge per row, reset button per row, etc. The "judgement call when RC1 is silent" path must escalate, per §14.3.

### 10. Designer prototypes still ship alongside production code

- **Evidence:** `docs/rwanga-settings/Settings UI.html` is a standalone fully-rendered React app sitting in the design docs folder. The renderer at runtime does not load it, but its presence creates ambiguity ("which one is authoritative?"). The prototype's existence is good (it's the spec); its location alongside non-spec docs is confusing.
- **Responsible files:** `docs/rwanga-settings/` mixed-folder.
- **Prevention strategy:** Split the design docs folder: `docs/rwanga-settings/spec/` for the constitution + checklist + library + skill (text rules); `docs/rwanga-settings/prototype/` for the executable JSX + Settings UI.html (visual reference). The prototype folder is read-only acceptance material.

---

## 10. Recommended Next Slices

These are **surgical**, not a megareite. Each has exact scope, files likely touched, mandatory Playwright proof, and a stop condition. Per the user's brief: "Do NOT propose a mega rewrite. Do NOT say 'fix all settings'."

### H8A — Page Setup SSOT correction (HIGHEST PRIORITY)

**Scope:** Eliminate the two-track architecture for `pageSetup.*`. Make `Settings.Store` the single source. Route `pageSetup.*` writes through tier='script' so they land in `doc.settings.pageSetup`. Migrate `LayoutProfile._resolveMargins` and `_resolvePageSize` to read from `Settings.Store.effective(id)` instead of `doc.settings.pageSetup.<key>` directly. Decide whether `page-setup-dialog.js` is kept (and rewritten to call Store) or retired in favour of the Settings UI (recommended: retire).

**Files likely touched:**
- `renderer/js/shell/settings-store.js` — `set()` auto-routes `tier='script'` when `entry.persistsTo === 'script'` AND an active doc exists (fallback to 'user' or warning when no doc)
- `renderer/js/shell/workspaces/settings-workspace.js` — `_wireControl` passes `{tier}` derived from `entry.persistsTo`
- `renderer/js/framework/layout-profile.js` — `_resolveMargins`, `_resolvePageSize` read Settings.Store first, doc.settings as legacy fallback
- `renderer/js/editor/page-setup-dialog.js` — either rewrite to call Settings.Store OR remove and route Tools → Page Setup menu to Settings UI's Page Setup section
- `renderer/js/framework/manuscript-geometry.js` — `applyPreset` writes through `Settings.Store.set(id, val, {tier:'script'})`
- `renderer/js/shell/shell-applicators.js` — retire orphan `--page-margin-*` writes OR make them genuinely consumed (probably retire — page geometry should not be CSS-variable-driven)

**Playwright proof:**
- `tests/e2e/settings/page-setup-truth.spec.js`:
  1. Open script. Edit `pageSetup.margins` in Settings UI. Open Print Preview (or measure manuscript-geometry's computed page rect via a debug API). Assert the printed page geometry reflects the new margins.
  2. Open the legacy Page Setup modal (if kept). Edit margins. Verify Settings UI shows the new values immediately.
  3. Switch to a second script. Verify margins are PER-DOCUMENT (script.A margins != script.B margins).
  4. Reload. Verify margins survive.
  5. The 5 currently-NO_BEHAVIOR settings (orientation, pageNumbers, pageNumberPosition, headerText, footerText) either gain real wiring (preferred) or are marked DEFERRED with the 40% opacity + "coming soon" treatment.

**Stop condition:** All 7 `pageSetup.*` rows are either REAL with page-truth verification OR explicitly DEFERRED with consistent visual treatment. `LayoutProfile` reads Settings.Store. No write to `doc.settings.pageSetup.*` happens outside Settings.Store's tier='script' path. **STOP after H8A.**

### H8B — Settings visual fidelity correction (mandatory shell + row elements)

**Scope:** Add the missing visual elements that RC1 mandates and the designer prototype ships. NO new settings, NO new behavior — just the shell shape.

**Specifically add:**
1. Scope badges on every row (per RC1 §7.1 — dot + label + 8% alpha bg, four scope colours)
2. Per-row reset button (`↺`) that appears when value differs from default (RC1 §4.1 + §4.4)
3. Nav icons + per-section count badges (RC1 §3.3, designer's `settings-nav.jsx:135-164`)
4. Nav header: gear icon + "Settings" title (RC1 §3.3)
5. Modified count badge on the Settings tab (RC1 §3.2)
6. Settings status bar showing modified count (RC1 §3.6)
7. Row CSS migration from card style to grid + bottom separator (RC1 §4.2)

**Files likely touched:**
- `renderer/js/shell/workspaces/settings-workspace.js` — `_buildRow` adds scope badge + reset button; `_buildSkeleton` adds nav header, icons, count badges; new modified-count tracking
- `renderer/css/settings-workspace.css` — scope badge CSS, reset button CSS, nav chrome CSS, row grid layout
- `renderer/js/shell/tab-manager.js` (or equivalent) — Settings tab shows `⚙ Settings` + modified count badge
- `renderer/js/shell/status-bar.js` — Settings-specific status bar when Settings workspace is active

**Playwright proof:**
- `tests/e2e/settings/visual-fidelity.spec.js`:
  1. Every row carries `.rga-settings-row-scope-badge` with one of the four colours.
  2. Modifying a row makes the reset button appear (opacity transition).
  3. Clicking the reset button restores the registry default.
  4. Nav items have icon SVG + label + count pill.
  5. Settings tab carries `⚙` icon and a modified-count badge when any setting differs from default.
  6. Status bar shows "Settings • N modified" when Settings workspace is active.

**Stop condition:** All 7 visual elements present, all Playwright assertions green, snapshot diff against `docs/rwanga-settings/Settings UI.html` rendered output shows <5% deviation. **STOP after H8B.**

### H8C — Test hardening: assert visible product behaviour

**Scope:** Retrofit the existing H5/H6/H7 specs so every behaviour test asserts visible product effect, not just wire path.

**Specifically:**
1. H5 window-zoom: add `getBoundingClientRect` measurement of a known element before/after zoom — element must visibly scale.
2. H6 shortcut: add a real `page.keyboard.press('Control+Alt+J')` after rebinding, verify the command fires through the keydown dispatcher.
3. H7 margins: depends on H8A landing — once `LayoutProfile` reads Store, test that the measured page width changes when margins change.
4. H7 color: take a screenshot of the editor desk surface (NOT the Settings workspace) before and after, assert pixel colour at known coords.

**Files likely touched:**
- `tests/e2e/settings/window-zoom.spec.js`
- `tests/e2e/settings/shortcut-controls.spec.js`
- `tests/e2e/settings/margins-and-color.spec.js`

**Playwright proof:**
- Above-listed retrofits land. Run all Settings specs. All must still pass.

**Stop condition:** Each behaviour test asserts at least one visible-surface property. No new tests beyond what RC1 §14.4 requires. **STOP after H8C.**

### H8D — Legacy parallel paths cleanup

**Scope:** Either migrate or formally exempt the 5 parallel persistence paths (units, view-mode, script-language, workspace-state, Rga.Theme bypass).

**Decision branch (must be made before code):**
- For each of the 5 paths: is it a configuration value (per §1A.1) or a UI-state value (exempt)? `units` and `script-language` are clearly configuration. `view-mode` and `workspace-state` are arguably UI state.
- Configuration ones get a registry entry + applicator + remove the parallel path.
- UI-state ones get a documented exemption in §1A and the ownership-stab drift guard adds them to its allow-list.

**Files likely touched:**
- `renderer/js/units.js`
- `renderer/js/view-mode.js`
- `renderer/js/shell/script-language.js`
- `renderer/js/shell/workspace-state.js`
- `renderer/js/app-shell.js` (theme bypass)
- `renderer/js/shell/settings-registry.js` (new entries for promoted configuration values)
- `tests/unit/shell/ownership-stab-slice2.test.js` (broaden the drift guard)

**Playwright proof:**
- For each promoted config: render test + persistence test + scope test per RC1 §14.4.
- Drift guard: assert no `localStorage` keys outside an allow-list, no `documentElement.setAttribute('data-theme', ...)` outside `shell-applicators.js`, no `style.setProperty` on theme tokens outside the appearance applicator.

**Stop condition:** Drift guard passes with the new asserts. All 5 paths are either Store-routed or exempt with documentation. **STOP after H8D.**

### H8E — PERSISTS_ONLY saturation reduction (NOT all-at-once)

**Scope:** Drop the PERSISTS_ONLY count from 41 to ≤ 15 by wiring or moving entries. This is the antidote to "75% frozen."

**Method (one section at a time, one slice per section):**
- H8E.1 — Wire all 4 General PERSISTS_ONLY entries: `language`, `recentFilesLimit`, `confirmBeforeClose`, `restoreLastSession`. Real applicators.
- H8E.2 — Wire all 4 Editor PERSISTS_ONLY entries (`autocomplete`, `showLineNumbers`, `wordWrap`, others) OR convert to DEFERRED with 40% opacity if no engine is shippable this quarter.
- H8E.3 — Wire all 7 Screenplay entries OR convert to DEFERRED.
- H8E.4 — Wire all 7 Print/Export entries OR DEFERRED.
- H8E.5 — Wire all 5 Autosave entries OR DEFERRED.
- H8E.6 — Wire all 4 Appearance PERSISTS_ONLY entries OR DEFERRED.
- H8E.7 — Wire all 4 Advanced entries OR DEFERRED.

**Files likely touched:** Per slice: 1 applicator file, 1 Playwright spec.

**Playwright proof:** Per slice: RC1 §14.4 Checklist B (render, interaction, persistence, reset, behavior, revert).

**Stop condition:** Per slice, the section's PERSISTS_ONLY_DISABLED count drops to 0. Total PERSISTS_ONLY saturation drops below 25%. **STOP after EACH H8E.X.** Do NOT batch slices.

### H8F — Constitutional reconciliation (H3A vs RC1 §8.1.2)

**Scope:** Resolve the doctrinal conflict between the H3A pivot (full opacity, interaction-only) and RC1 §8.1.2 (60% row opacity). Pick one. Amend either the constitution or the H3A doctrine. Update the visual-contract test to enforce the chosen one.

**Decision required from the user, not from engineering.** Cannot proceed without explicit constitution amendment per RC1 §14.3.

**Stop condition:** RC1 §8.1.2 either (a) reverted to original 60%-opacity rule with a memory update + revert of H3A code, OR (b) amended to match H3A. Visual-contract test enforces the chosen rule. **STOP after H8F.**

---

## Appendix — Investigation methodology

- Primary references read in full: RC1 Design Constitution (1456 lines), Implementation Checklist (243 lines), Component Library (869 lines partial), Unsupported Control Inventory.
- Designer prototype read in full: `settings-app.jsx` (333), `settings-controls.jsx` (317), `settings-nav.jsx` (167), `settings-page-setup.jsx` (129), `settings-json.jsx` (80), `settings-data.jsx` (238), `Settings UI.html` (268). Not read: `tweaks-panel.jsx` (530 — dev tool per §3.5, excluded from production constitution).
- Current code read: `settings-workspace.js` (1071 lines), `settings-workspace.css` (full), `settings-registry.js`, `settings-store.js`, `settings-validators.js`, `settings-applicators.js`, `shell-applicators.js`, `editor-applicators.js`, `keyboard-registry.js`, `page-setup-dialog.js`, `layout-profile.js` (selected sections), `manuscript-geometry.js` (selected sections), `app-shell.js`.
- Playwright specs read: `honest-controls.spec.js`, `visual-contract-h3a.spec.js`, `human-labels.spec.js`, `window-zoom.spec.js`, `shortcut-controls.spec.js`, `margins-and-color.spec.js`.
- Two parallel Explore-agent investigations: Page Setup ownership map (Part 3) and Store SSOT bypass audit (Part 4). Synthesized into this report.
- Total settings classified: 62. Total file references cited: 30+. Total RC1 rule citations: 40+.

---

*End of H8 SETTINGS FORENSIC REPORT.*
*Investigation only. No fixes implemented. Stopping per the brief.*
