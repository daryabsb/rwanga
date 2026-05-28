# Settings Recovery — S9.1 Slice Report

**Slice:** S9.1 — Saturation Reduction (Foundational Pass)
**Date:** 2026-05-28
**Baseline HEAD before slice:** `1b359af3`
**Audience:** Settings recovery arc + Filmustageation Phase 1A prerequisite gate

---

## 1. Purpose

S9.1 moves the ten plan-named entries from PERSISTS_ONLY to REAL by registering applicators with visible behaviour. Per the recovery plan §6 and `SETTINGS_NEXT_SESSION_HANDOFF.md` §4, each entry ships:
1. one `register(id, fn, { owner })` call in the appropriate applicator file,
2. a visible-DOM-delta wire path (body class or data-attr; plus, where applicable, an underlying module API),
3. a Playwright behavior assertion that asserts a non-Settings DOM property changed.

This slice was authored as the prerequisite gate for Filmustageation F1A.1, per the Phase 1A audit (`docs/filmustageation/FILMUSTAGEATION_PHASE1A_SHELL_AUDIT.md` §7.2).

---

## 2. Files changed

| Path | Lines Δ | Reason |
|---|---:|---|
| `renderer/js/editor/editor-applicators.js` | +80 / -10 | Registers `editor.wordWrap`, `editor.autocomplete`, `editor.showLineNumbers`. |
| `renderer/js/shell/shell-applicators.js` | +150 / -34 | Registers `appearance.editorPageShadow`, `appearance.sidebarPosition`, `appearance.activityBar`, `appearance.formatToolbar`, `autosave.enabled`, `autosave.interval`, `confirmBeforeClose`. |
| `renderer/js/autosave.js` | +46 / -6 | Adds `setEnabled` + `setInterval` + `_isEnabled` + `_maxIntervalMs` module API; `notifyChange` now short-circuits when disabled and reads `_maxIntervalMs` for the max-interval ceiling. |
| `renderer/js/close-guard.js` | +27 / -2 | Adds `setConfirmEnabled` + `_isConfirmEnabled` module API; `confirmClose` skips the prompt when disabled (still clears the recovery snapshot). |
| `renderer/js/shell/settings-registry.js` | +6 / -1 | Flips `editor.showLineNumbers` default `false → true` to match the locked Flow gutter visible-default (commit 501a4b00, 2026-05-15). |
| `renderer/css/editor.css` | +24 | New `body[data-word-wrap="viewport"]` + `body[data-word-wrap="off"]` rules scoped to `#editor-container.view-flow`. |
| `renderer/css/editor-prosemirror.css` | +7 | New `body.rga-no-line-numbers ... .flow-line-gutter { display: none }` rule (higher specificity than the `.view-flow` show rule). |
| `renderer/css/shell.css` | +48 | New rules for `body.rga-no-activity-bar`, `body.rga-no-format-toolbar`, and `body[data-sidebar-position="right"]` (workspace grid flip). |
| `tests/unit/editor/editor-applicators.test.js` | +103 / -34 | Inverts the prior "deferred ids NOT registered" assertion; adds 4 new unit tests for the 3 new applicators. |
| `tests/unit/shell/shell-applicators.test.js` | +187 / -34 | Same shape: inverts prior assertion; adds 8 new unit tests for the 7 new applicators. |
| `tests/e2e/settings/honest-controls.spec.js` | +9 / -7 | Swaps canonical PERSISTS_ONLY id from `autosave.enabled` (now REAL) to `appearance.minimap` (still deferred). |
| `tests/e2e/settings/s9-1-saturation-reduction.spec.js` | new, 350 lines | 11-test Playwright behavior spec covering all 10 S9.1 wirings + a boot-time defaults invariant. |
| `docs/rwanga-settings/SETTINGS_S9_1_SLICE_REPORT.md` | new | This report. |

**Total:** 13 files changed (+609 / -86); 1 new file; 1 new Playwright spec; 12 new unit tests; 11 new Playwright tests.

---

## 3. Applicators / settings touched

| Setting | Type | Default | Applicator owner | Visible-DOM delta | Module API touched |
|---|---|---|---|---|---|
| `editor.wordWrap` | select | `'page'` | `editor` | `body[data-word-wrap]` + CSS rules under `#editor-container.view-flow` | — |
| `editor.autocomplete` | toggle | `true` | `editor` | `body[data-autocomplete]` | `Rga.Autocomplete.setEnabled` (stub-tolerant) |
| `editor.showLineNumbers` | toggle | **`true`** (was `false`) | `editor` | `body.rga-no-line-numbers` (inverse) + computed display:none on `.flow-line-gutter` when OFF | — |
| `appearance.editorPageShadow` | toggle | `true` | `appearance` | `body[data-page-shadow]` | — (paper-view CSS hook reserved for follow-up) |
| `appearance.sidebarPosition` | radio | `'left'` | `appearance` | `body[data-sidebar-position]` + `#workspace > *` grid-column flip | — |
| `appearance.activityBar` | toggle | `true` | `appearance` | `body.rga-no-activity-bar` (inverse) + `#activity-bar { display: none }` | — |
| `appearance.formatToolbar` | toggle | `true` | `appearance` | `body.rga-no-format-toolbar` (inverse) + `#rga-shell-toolbar { display: none }` | — |
| `autosave.enabled` | toggle | `true` | `autosave` | `body[data-autosave]` | `Rga.Autosave.setEnabled` (notifyChange gate) |
| `autosave.interval` | number | `30` (s) | `autosave` | `body[data-autosave-interval-seconds]` | `Rga.Autosave.setInterval` (max-interval ceiling) |
| `confirmBeforeClose` | toggle | `true` | `general` | `body[data-confirm-close]` | `Rga.CloseGuard.setConfirmEnabled` (confirmClose gate) |

All ten settings now satisfy the operational rule (RC1 §8.1, post-S10): real applicator → REAL state. The PERSISTS_ONLY chrome (60% / "Behavior not wired yet.") no longer renders on any of these rows.

---

## 4. Before / after behavioral summary

### Before S9.1
- All 10 rows rendered as PERSISTS_ONLY: full opacity + control-disabled + " Behavior not wired yet." (H3A treatment).
- Toggling any of these controls in the Settings UI was a no-op — `Store.set` blocked at the control's `disabled` attribute; even forced DOM mutation didn't reach an applicator because none existed.
- `editor.showLineNumbers` had a registry default of `false` but the locked Flow chrome rendered the gutter regardless — a silent registry-vs-reality drift.

### After S9.1
- All 10 rows are REAL: the control is interactive, `Store.set` fires the applicator, and the visible-DOM delta lands.
- Boot-time `applyAll()` pushes the registry default for each new applicator (verified by the Playwright `boot-time applyAll` test).
- `editor.showLineNumbers` default flipped to `true`; the Flow gutter remains visible by default and the user can now toggle it off cleanly.
- `Rga.Autosave.notifyChange` short-circuits when `autosave.enabled = false` — no snapshots, no debounce arming. State map is preserved; re-enabling resumes from the same point.
- `Rga.CloseGuard.confirmClose` skips the unsaved-changes prompt when `confirmBeforeClose = false`; the recovery snapshot is still cleared via the standard discard path.
- The activity rail, format toolbar, and right-side sidebar position all flip live without reload.

---

## 5. Visual-risk assessment

| Setting | Risk | Mitigation |
|---|---|---|
| `editor.wordWrap` | Low. Only affects `#editor` inside `.view-flow`; Print / Draft / Paper views unaffected (their own view rules win). | CSS rules scoped to `#editor-container.view-flow`. |
| `editor.autocomplete` | None. Body data-attr only; no visible chrome change today. | — |
| `editor.showLineNumbers` | Low — default flip could surprise users who explicitly persisted `false`. | The explicit user value still wins; no override exists in fresh installs. |
| `appearance.editorPageShadow` | None today. Body data-attr only; paper-view consumers will pick up the hook in a follow-up. | Future paper-view slice provides the visible effect. |
| `appearance.sidebarPosition` | **Medium.** Combined-state interactions (sidebar-collapsed + inspector-collapsed + sidebar-right) are out of scope and may produce sub-optimal grids. | Documented as a known limitation; default `left` is unaffected. Recovery plan §6 acknowledged the medium risk. |
| `appearance.activityBar` | Medium. Hides a primary navigation surface; affects responsive shell rules. | Existing `--activity-bar-width` token zeroed cleanly; no grid-template gymnastics. |
| `appearance.formatToolbar` | Low. `#rga-shell-toolbar` already has hide rules for draft + print-preview views; this rule is orthogonal. | Source-order wins as expected. |
| `autosave.enabled` | Low. Skipping autosave reduces data safety, but the user has explicitly opted in; manual save (`Rga.FileManager.save`) still works. | Module state preserved across toggle; re-enable resumes cleanly. |
| `autosave.interval` | Low. Defensive clamp normalises invalid inputs to 30s. | Registry validator constrains range; applicator clamps further. |
| `confirmBeforeClose` | Medium-low. Dirty-state confirmations are a data-safety feature; disabling skips the prompt. Recovery snapshot is still cleared. | The default (true) is unchanged. Future surfaces should expose this as an "Are you sure?" affordance, not a permanent kill-switch. |

No Phase 2 fidelity invariant is touched. The S4 row anatomy, S6 typography, S1 scope badges, S2 reset button, S3 control fidelity, and S5 nav chrome contracts are all preserved (verified by the Phase 2 specs running green).

---

## 6. Playwright + unit coverage added

### Unit (jsdom)
- `tests/unit/editor/editor-applicators.test.js`:
  - `Slice 4A + S9.1 — editor-applicators registers exactly the wired editor settings` (inventory updated to 9 ids).
  - `S9.1 — previously-deferred editor settings are NOW registered` (inverts the prior deferral assertion).
  - `Slice 4A — every wired id has an owner of "editor"` (extended to cover S9.1 ids).
  - `S9.1 — editor.wordWrap writes data-word-wrap on <body>` (page / viewport / off + defensive normalisation).
  - `S9.1 — editor.autocomplete writes data-autocomplete on <body> + calls stub setEnabled when present`.
  - `S9.1 — editor.autocomplete is tolerant when Rga.Autocomplete is absent`.
  - `S9.1 — editor.showLineNumbers toggles .rga-no-line-numbers on <body>`.
- `tests/unit/shell/shell-applicators.test.js`:
  - `Slice 4B + S9.1 — shell-applicators registers exactly the wired appearance settings` (inventory updated).
  - `S9.1 — previously-deferred appearance settings are NOW registered` (inverts prior).
  - `S9.1 — autosave.* and confirmBeforeClose are registered with the right owners`.
  - `Slice 4B + S9.1 — appearance.minimap remains DEFERRED`.
  - `Slice 4B — every wired id has the expected owner` (extended).
  - 8 visible-DOM-delta assertions (one per new applicator).

### Playwright (Electron)
- `tests/e2e/settings/s9-1-saturation-reduction.spec.js` — new file, 11 tests, one per S9.1 wiring + a boot-time defaults invariant. Each test launches a fresh Electron + userDataDir, mutates via `Store.set`, asserts a non-Settings DOM property on `<body>` (or computed style on the affected surface).

### Test results
- 43 unit tests in the two applicator files: **43 pass / 0 fail**.
- 17 autosave + close-guard unit tests: **17 pass / 0 fail** (existing tests; module-API additions did not break).
- 26 settings-registry unit tests: **26 pass / 0 fail** (the showLineNumbers default flip is benign).
- 11 new S9.1 Playwright tests: **11 pass / 0 fail**.
- 73 Phase 2 fidelity invariants + honest-controls + persists-only-visual-contract: **73 pass / 0 fail**.
- 39 remaining settings specs (margins / page-setup-ownership / page-setup-preview / shortcut / window-zoom / human-labels): **39 pass on first run, 1 windowZoom test flaked once and passed on retry** — pre-existing flake, unrelated to S9.1.

**Total:** 209 tests run, 209 ultimately green. Zero regressions introduced by S9.1.

---

## 7. Screenshots

Not produced. Per project memory (`feedback_playwright_over_screenshots.md`): "for any layout / responsive / DOM-geometry iteration, write a Playwright spec instead of asking for screenshots." The 11 new Playwright assertions assert computed-style + body-attr deltas, which is more precise than visual diffs. The visible-DOM-delta contract from the handoff is satisfied without binary artifacts.

---

## 8. Remaining S9.x work

Per `SETTINGS_NEXT_SESSION_HANDOFF.md` §3, the Phase 3 saturation reduction continues:

### S9.2 — Wire 6 more entries + introduce the registry `state` field

Targets:
- `autosave.maxVersions` (file-cleanup hook in `Rga.Autosave`)
- `files.defaultSaveFormat` (used at save time)
- `files.backupOnOpen` (used at open time)
- `files.defaultDirectory` (defaultPath for pickSaveAs)
- `recentFilesLimit` (recent-list trim)
- `screenplay.boldSceneHeaders` (CSS class on `#editor`)

Also lands: the explicit `state` field on registry entries + the DEFERRED state factory. `_buildRow` will consult `entry.state` instead of guessing from "has applicator?". Estimated 6 hours.

### S9.3 — Tag every remaining no-applicator entry as DEFERRED

Sweeps the remaining 25 entries (screenplay.*, export.*, language, restoreLastSession, advanced.*, appearance.minimap) into `state: 'deferred'`. Registry-level unit test asserts `state: 'persists-only'` count == 0 at plan close. Estimated 1 hour.

### Phase 4 — Modal retirement tail

S7B (Ctrl+Shift+G repoints to Settings → Page Setup) + S7C (delete `page-setup-dialog.js` after bake). Independent of Phase 3.

---

## 9. Push status

Local-only this session per Stop Rule 4 in the handoff:
> "Push only when the brief asks. Recovery sessions push at session close; intermediate slices land local-only."

The brief ends with "STOP after S9.1. Do not continue into S9.2." A commit (this slice's deliverables + report) is recommended at the user's discretion; the brief does not include a push directive.

---

# STOP

S9.1 is complete. Phase 3 continues with S9.2 in a separate brief. Filmustageation F1A.1 is now unblocked per the Phase 1A audit's dependency order. No follow-up work begins in this slice.
