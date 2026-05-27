# Settings Recovery — Next Session Handoff

**Written:** 2026-05-27
**Latest pushed commit at write time:** `bebd9cd6` (S5 nav chrome / Phase 2 complete) on `origin/main`
**Audience:** the next agent or engineer picking up Settings work
**Companion docs:** `SETTINGS_RECOVERY_EXECUTION_PLAN.md`, `SETTINGS_DESIGNER_UPDATE_REPORT.md`, `H8_SETTINGS_FORENSIC_REPORT.md`, `DESIGNER_SETTINGS_DRIFT_REPORT.md`, `RWANGA_SETTINGS_DESIGN_CONSTITUTION.md` (RC1)

---

## §0 — Read this first

Phases 1 and 2 of the Settings Recovery are complete and on `origin/main`. **Do not redo any of the shipped slices.** The recovery plan's order — truth → shape → expansion — has cleared the truth (Phase 1) and the shape (Phase 2). The next major arc is expansion: **Phase 3 — Saturation Reduction**.

---

## §1 — Current project state

### Latest pushed commit
`bebd9cd6` — *S5: Settings nav chrome — RC1 §3.3 header / items / footer with Reset All (no Save)*

### Recovery commit history (newest first)
```
bebd9cd6 — S5 nav chrome (Phase 2 §S5)
cb249cd2 — S3 control fidelity: toggle / radio / number (Phase 2 §S3)
90482c93 — S2 per-row reset button (Phase 2 §S2)
8b05c9d8 — S1 scope badges (Phase 2 §S1)
ea26b36a — S6 typography + content geometry (Phase 2 §S6)
ddae3b73 — S4 row anatomy (Phase 2 §S4)
03f5b427 — S8 Page Setup live preview + single-resolver page truth (Phase 1 §S8)
6fc78145 — S12 legacy paths cleanup (Phase 1 §S12)
b48be1d3 — S7 Stage 1 Page Setup ownership (Phase 1 §S7)
9937b0f6 — S10 doctrine alignment (Phase 0 §S10)
293718cd — docs(settings): recovery forensic reports + execution plan (pre-recovery; already pushed)
```

### Test gates at handoff time
- **Full settings Playwright suite:** 113/113 pass.
- **Owned + immediate-neighbor unit tests:** 177/177 pass.
- **Full unit suite:** 1358 tests, 1346 pass, 12 pre-existing failures (none introduced by recovery).

### Push state
`origin/main` is at `bebd9cd6`. All recovery work is published.

---

## §2 — Completed phases

### Phase 0 — Doctrinal clear
- **S10** (`9937b0f6`) — RC1 amendments to §8.1.2 (PERSISTS_ONLY full opacity), §3.3 (Reset All only, no Save), §8.1 (operational PERSISTS_ONLY vs DEFERRED rule). H3A test renamed to `persists-only-visual-contract.spec.js`.

### Phase 1 — Ownership correction
- **S7 Stage 1** (`b48be1d3`) — `Settings.Store.set` auto-routes by `entry.persistsTo`; legacy Page Setup modal rewired to write through Store; `LayoutProfile._resolveMargins` and `manuscript-geometry.applyPreset` migrated. Document-scope settings now persist per-document.
- **S12** (`6fc78145`) — Theme `localStorage` write retired; `units` + `editor.scriptLanguage` promoted to the registry with applicators; categorical exemptions documented in RC1 §1A.6; drift guard expanded to enforce by owner-file category.
- **S8** (`03f5b427`) — `Rga.LayoutProfile.compose` extended with orientation, page numbering, header/footer; new `Rga.PageSetupPreview` module mounts a 240px live miniature when the Page Setup section is active; preview-notifier applicators replace the H7 orphan `--page-margin-*` writes; single-resolver truth rule holds.

### Phase 2 — Visual fidelity
- **S4** (`ddae3b73`) — Row anatomy: flat grid `1fr auto` with single bottom separator; card chrome retired.
- **S6** (`ea26b36a`) — Typography: section title 16/600, row label 13/500, helper 11/400, content padding 24/32, max-width 680px.
- **S1** (`8b05c9d8`) — Scope badges: every row, RC1 §7.1 anatomy with the four scope colours.
- **S2** (`90482c93`) — Per-row reset: ↺ visible only when value !== default, restores via `Store.set` + S7 routing.
- **S3** (`cb249cd2`) — Toggle / Radio / Number controls rebuilt to RC1 §5.2.
- **S5** (`bebd9cd6`) — Nav chrome: header + items (icon + 2-line text + count) + footer with Reset All.

---

## §3 — Remaining phases

### Phase 3 — Saturation Reduction (next major arc)

Three slices, strictly sequential:

- **S9.1** — Wire 10 easy boolean toggles / simple values to REAL. Each is one applicator + one behavior test + one fidelity test. Targets per the recovery plan: `editor.wordWrap`, `editor.autocomplete`, `editor.showLineNumbers`, `appearance.editorPageShadow`, `appearance.sidebarPosition`, `appearance.activityBar`, `appearance.formatToolbar`, `autosave.enabled`, `autosave.interval`, `confirmBeforeClose`. Estimated 6 hours; medium risk per slice (one applicator per setting; impacts many surfaces).
- **S9.2** — Wire 6 more (`autosave.maxVersions`, `files.defaultSaveFormat`, `files.backupOnOpen`, `files.defaultDirectory`, `recentFilesLimit`, `screenplay.boldSceneHeaders`) + introduce the registry `state` field + DEFERRED state factory. Estimated 6 hours.
- **S9.3** — Tag every remaining no-applicator entry as `state: 'deferred'`. Final saturation: 0% PERSISTS_ONLY (no slice ≤ 2 ahead is named), 40% DEFERRED, 60% REAL. Estimated 1 hour.

### Phase 4 — Modal retirement tail (after Phase 3 + bake)

- **S7B** — Ctrl+Shift+G repoints from the legacy `page-setup-dialog.js` to `Rga.SettingsWorkspace.open({ section: 'pageSetup' })`. Modal stays in code but has no entry point; debug API kept for QA. Transitional notice on first use.
- **S7C** — After ≥ 1 release cycle with no Settings-UI Page Setup bug reports, delete `page-setup-dialog.js`, modal CSS, debug API, transitional notice.

---

## §4 — Next recommended slice: S9.1

Open `SETTINGS_RECOVERY_EXECUTION_PLAN.md` Section 6 / S9.1 for the full spec. Brief summary:

**Goal:** Move 10 entries from PERSISTS_ONLY → REAL by registering applicators with visible behavior.

**Per-entry pattern:**
1. Add one `register('<id>', fn, { owner: '<owner>' })` call in the appropriate applicator file (`shell-applicators.js` for `appearance.*` + general; `editor-applicators.js` for `editor.*`; new file may be needed for `autosave.*` and `confirmBeforeClose`).
2. Wire the handler to a visible surface (CSS class toggle on `#editor`, body class, beforeunload handler, etc.). No orphan CSS-variable writes — the S8 lesson holds.
3. Add a Playwright behavior spec proving the visible effect: the test must assert a non-Settings DOM property changed, not just that `Store.set` was called.
4. Add a fidelity assertion if a control surface changed (most won't — these are pre-existing controls being wired).

**Sequencing within S9.1:** prefer toggles that affect already-wired CSS (`editor.wordWrap` → max-width on `#editor`; `appearance.editorPageShadow` → class on `.rga-editor-page`) before the responsive-shell ones (`appearance.sidebarPosition`, `.activityBar`, `.formatToolbar`) which touch the shell grid.

**Stop condition (per the recovery plan):** 10 entries transitioned to REAL; S9.2 + S9.3 targets carry explicit `state: 'persists-only'` per the operational rule; per-setting behavior tests pass.

---

## §5 — Stop rules (apply to S9.1 and any Phase 3 slice)

1. **Slice scope is binding.** Do not bundle S9.2 work into S9.1. Do not bundle Phase 4 modal-retirement work into Phase 3.
2. **Stop after the slice.** Each brief ends with "STOP after S<N>". Honor it.
3. **Test scope: owned + immediate neighbors.** Run the slice's spec + the prior Phase 2 invariant specs + any unit tests in the same file you touch. Full suite is reserved for foundation / merge / release moments (the brief will say so explicitly).
4. **Push only when the brief asks.** Recovery sessions push at session close; intermediate slices land local-only.
5. **Stage by path, never `git add .` / `git add -A`.** The standing noise list (Python pycache, `docs/RWANGA_IDE_ALIVE_APP_CHECKLIST.md`, `rwanga-editor/tests/diagnostics/visual-drift/`) must not be accidentally staged.
6. **`feedback_authorization_messages_require_execution`** — the verbatim brief is binding authorization. Execute; do not return silence even if the brief ends with "proceed".
7. **`feedback_complete_package_delivery`** — one slice = one shippable deliverable. Don't slice further into mini-edits + verification gates.

---

## §6 — Playwright requirement

Every Phase 3 wiring slice ships a Playwright spec under `tests/e2e/settings/` proving the visible effect. The required shape:

```js
// tests/e2e/settings/<setting-id>-behavior.spec.js
test('S9.x — <setting-id> applicator drives a visible DOM change', async () => {
  // 1. Launch app + open settings (boilerplate matches existing specs).
  // 2. Capture the pre-change state of the visible surface (a non-
  //    Settings element — the editor, the shell, a body class).
  // 3. Mutate the setting via Store.set or by clicking the control.
  // 4. Assert the visible-surface state moved.
  // 5. Reset to default; assert it moved back.
});
```

The H8 forensic lesson: H5/H6/H7 specs that proved only `Store.set` was called (not that the visible surface changed) made green tests non-protective. Phase 3 specs must assert a visible-surface delta.

---

## §7 — No visual redesign rule

Phase 3 is **wiring**, not redesign. The S4/S6/S1/S2/S3/S5 invariants are locked. Any change that touches row anatomy, typography, scope badge anatomy, reset behavior, control fidelity, or nav chrome requires either:
1. A new explicit slice brief naming the change, OR
2. An RC1 amendment per §14.3.

The Phase 2 fidelity specs (`row-layout-fidelity`, `typography-fidelity`, `scope-badges-fidelity`, `row-reset-fidelity`, `control-fidelity`, `navigation-fidelity`) are the guard against drift. Every Phase 3 slice must keep them green.

---

## §8 — Current known debt (not blocking Phase 3)

Carried from the recovery plan Appendix B.1 and the designer drift report; flagged here so the next agent knows they exist.

1. **Flat → nested compatibility bridge** in `settings-store.js` `_scriptValue` and the script-tier write path. Read-only legacy support for old `.rga` shapes. Remove after the migration window closes (enough release cycles for every active install to have booted post-S7).
2. **Legacy `localStorage('rga-theme')` read** in `settings-migrations.js`. One-shot migration shim. Remove once every active install has booted post-S12 at least once.
3. **Matching-default migration guard** in `_migrateTheme`. Defensive shim from pre-S12 era; no longer load-bearing. Remove with the same cleanup sweep as #2.
4. **§10.2 description copy** — document-scope sections (Screenplay, Page Setup, Print/Export) need "for this document" / "for the current script" phrasing in their section descriptions. Currently generic.
5. **§3.2 tab indicator** — `⚙ Settings` + modified-count badge on the Settings tab. Out of recovery plan scope; queued.
6. **§6.5 Kurdish labels** — `labelKu` field on every registry entry. Data prep named in S9.2.
7. **§11 full responsive table** — S5 added a minimal 900/600 collapse; the full 5-breakpoint table in RC1 §11 is out of recovery scope.
8. **`page-setup-ownership.spec.js` test #5** was flaky on baseline `b48be1d3` (worker teardown timeout). It now passes consistently on `bebd9cd6` but the underlying cause was never root-caused. Watch for re-flake in future runs.

---

## §9 — Push status

- **Local HEAD:** `bebd9cd6`
- **`origin/main`:** `bebd9cd6`
- **Branch in sync:** yes
- **Recovery commits remaining to push:** none

The working tree carries the standing noise (Python pycache, untracked `docs/RWANGA_IDE_ALIVE_APP_CHECKLIST.md` + `rwanga-editor/tests/diagnostics/visual-drift/`) per the original handoff's don't-touch list. The session-close commit that lands this handoff + the designer update report will be on top of `bebd9cd6` and pushed alongside.

---

*End of handoff. Next slice: S9.1. Plan section reference: `SETTINGS_RECOVERY_EXECUTION_PLAN.md` §6 — Frozen Saturation Reduction Strategy.*
