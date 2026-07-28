# Rwanga — Checkpoint Log

Append-only. Newest at top. Never rewrite past entries (correct with a new one).
Template & rules: `PROTOCOL.md`.

---

## 2026-07-28 · S3.2F CLOSED — GAP-3-3 fixed (e2e quit path) · FIRST e2e baseline recorded
- **Did:** Root-caused and fixed the hanging app-close, on the user's instruction to do it before
  S3.3. Two distinct causes, **both test hygiene — no product code was touched**:
  (a) the quit guard is correct and deliberate (`electron/main.js:99` intercepts the close →
  `renderer/index.html:1577` → `Rga.CloseGuard.confirmAppClose()` → `#unsaved-modal`), and it waits
  for a **human**; under Playwright nobody clicks, the verdict never arrives, and main aborts the
  close rather than force-quit over unsaved work — so `app.close()` never resolved. Fixed with one
  shared teardown helper (`tests/helpers/app-teardown.js` → `closeApp`), generalising the repo's
  existing `clearDirtyAndClose` idiom to ALL tabs and sweeping it across **60 spec files / 124 call
  sites**. (b) The force-kill specs (`autosave`, `recovery`) SIGKILLed only the Electron **main**
  process; on Windows the surviving GPU/renderer children keep Playwright's pipe open, so Playwright
  never saw the app die — it blocked 60 s at WORKER teardown and orphaned the children. Fixed by
  killing the process **tree** (`taskkill /T /F`); `killApp` now lives beside `closeApp`.
  Then recorded the campaign's first e2e baseline.
- **Evidence:** `docs/plans/evidence/S3.2F-quit-path.md` + `S3.2F-e2e-baseline.txt`.
  **E2E BASELINE: 363 tests · 357 pass · 6 fail · 11.7 min · 0 teardown hangs · 0 orphans**
  (before: 326 pass · 37 fail · 1.2 h). Spot proofs: `app-close.spec.js` 1.4 min hang → 2/2 in 7.9 s;
  `autosave.spec.js` 1.3 min → 3/3 in 13.3 s; `autosave` + `recovery` 6/6 in 33.1 s.
- **Status deltas:** S3.2F ✅ (new slice, authorized by the user 2026-07-28). GAP-3-3 OPEN →
  **CLOSED**. No launch-checklist row flipped — this slice fixed the measuring instrument, not a P0.
  Gate counts unchanged (37 TRUE · 17 PARTIAL · 5 UNKNOWN · 1 FALSE).
- **Gaps/risks surfaced:** **GAP-3-4** — the 5 stable reds the fix left visible, all assertion
  failures in test bodies with no teardown noise to hide behind, none yet triaged: scene-navigator
  marks report zero directional indent (RTL **and** its LTR control); Settings tab fails to hide the
  toolbar (`display:grid`, expected `none`); Settings nav rail `overflow:hidden` expected `auto`
  — **same family as GAP-3-2**, fix together; Settings General rows drifted from the registry. Two
  load-dependent flakes recorded rather than adjusted (`page-setup-preview` 116.7 ms vs a 100 ms
  budget; `theme-applicator` theme-across-reopen, 3/3 green in isolation). Nothing was weakened,
  skipped, quarantined, or deleted. Also self-caught: the sweep first appended a `require` at the
  bottom of `tag-plugin-ownership.spec.js`, producing 8 `ReferenceError` reds in the very first
  baseline run — fixed, with a placement check now green 60/60.
- **Next action:** S3.3 — PF-13 clean-console audit across core flows.

---

## 2026-07-27 · S3.2 CLOSED — PF-02/03/05 TRUE (lifecycle E2E 3/3) · GAP-3-3 opened
- **Did:** Wrote the three lifecycle specs under `rwanga-editor/tests/e2e/lifecycle/`. Step-1 seam
  chosen by reading the code: stub `dialog.showSaveDialog`/`showOpenDialog` in the MAIN process
  (the `atomic-save.spec.js` idiom) instead of the plan's `doc.handle = p` shortcut — the real
  path then runs end to end (`saveAs()` → IPC `files.pickSaveAs` → atomic write → `rebindHandle` →
  `clearDirty`). PF-02 reopens in a SECOND app instance with a fresh userData dir, so content is
  proven on disk. PF-03/05 use a temp COPY of the RTL fixture (§0.2 fixture law — it is v3.0 and
  would auto-migrate). Ran the full e2e suite and then proved the failures are not ours.
- **Evidence:** `docs/plans/evidence/S3.2-lifecycle-e2e.md` — lifecycle **3/3 PASS** (first run and
  again on a cleaned machine); full suite **326 pass · 37 fail**, new specs not among the failures;
  isolation run with our files absent fails identically (7 fail / 6 pass).
- **Status deltas:** S3.2 ⬜ → ✅. **PF-02, PF-03, PF-05 PARTIAL → TRUE** (per-row evidence in the
  checklist). Gate counts 34/20/5/1 → **37 TRUE · 17 PARTIAL · 5 UNKNOWN · 1 FALSE** (23 open).
- **Gaps/risks surfaced:** **GAP-3-3** — e2e suite 37 reds, every sampled one an `app.close()` hang
  in `afterEach` (test bodies pass; the app will not quit; 17 orphaned Electron processes were
  cleared). Pre-existing, out of frozen scope. Hypothesis: dirty-doc quit prompt blocks close.
  Second finding: **no e2e baseline has ever been recorded** — QG-12 cannot honestly roll up over an
  unmeasured suite.
- **Next action:** S3.3 (PF-13 clean-console audit) — but first decide with the user whether GAP-3-3
  is fixed before it, since the audit runs over the same flows.

## 2026-07-27 · S3.1 CLOSED — PF-01 Windows launch matrix 13/13 · `/rwanga` case command built
- **Did:** (1) Built the missing artifact-4 of the master-plan process: the `/rwanga` case command
  (START / END / STATUS over this ledger), deployed to `~/.claude/commands/` + version-controlled at
  `.claude/commands/rwanga.md` on `main` (`.gitignore` negated for `.claude/commands/*.md`).
  Tested cold with two fresh subagents: END passed; START failed (no way to locate the active slice's
  section in a 756-line plan) → fixed (one permitted `^### Slice ` lookup, self-healing head-read,
  box-vs-prose reconcile rule, `status -sb` focus lock) → re-tested PASS. (2) Corrected three stale
  HANDOFF lines the tests surfaced (HEAD SHA, "28"→26 open P0s, fixture warning generalised).
  (3) Recorded S3.1 matrix row 13 (post-reboot launch, user-performed 2026-07-27) → slice closed.
- **Evidence:** `docs/plans/evidence/S3.1-launch-matrix.md` — Windows **13/13 PASS · 0 failures**
  (10/10 cold starts 1.1–1.6 s · post-reboot PASS · single-instance focus-existing · no `.rga`
  association, observed not failure). Commands: `9e6c82cb`; HANDOFF fixes pushed same day.
- **Status deltas:** S3.1 ⬜/🟡 → ✅. PF-01 PARTIAL → PARTIAL **(Windows-verified, evidence-backed)**
  — not TRUE because the row spans macOS. Gate counts unchanged (34 TRUE · 20 PARTIAL · 5 UNKNOWN ·
  1 FALSE).
- **Gaps/risks surfaced:** none new. Standing: PF-01's macOS half is deferred on hardware
  (Decision #1); GAP-2-1/2-2/3-1/3-2 remain OPEN, owned by future fix-slices.
- **Next action:** Start S3.2 — PF-02/03/05 lifecycle E2E specs; Step 1 is discovering the
  dialog-free save seam in `renderer/js/file-manager.js` + its IPC bridge.

## 2026-07-26 · Two user-reported Settings defects root-caused/ticketed (GAP-3-1, GAP-3-2)
- **Did:** Investigated the user's report "Settings is gone from the menu + the Settings area has
  never-fixed problems." (1) **GAP-3-1 root-caused:** the Settings menu entry lives ONLY in the
  Tools menu, and `#app.mode-compact` (shell.css:2357-2362) hides Tags/Tools/Export/Help outright —
  compact starts below ~1412 CSS px (responsive.js derived thresholds), which under Windows display
  scaling is virtually every laptop; no overflow "…" menu exists. Gear icon + Ctrl+, remain the only
  routes. (2) **GAP-3-2 ticketed:** user screenshot shows the Settings workspace's sticky search
  band failing — a row paints above the band, rows clip mid-control; suspects documented
  (settings-workspace.css:279-346); diagnosis plan = Playwright DOM-geometry spec.
- **Evidence:** code citations in the §0.5 gap rows; user screenshots in-session.
- **Status deltas:** §0.5 + HANDOFF gain GAP-3-1, GAP-3-2 (both OPEN). No checklist rows changed.
- **Gaps/risks surfaced:** the launch-checklist Settings band + responsive-shell rows likely
  overstate health — the S5/S6 reconciliation should re-check them against these gaps.
- **Next action:** unchanged — finish S3.1 item 13 (user reboot + one launch), then fix-slices for
  the open gaps can be inserted before S3.2 per the plan's gap rule.

## 2026-07-26 · S3.1 (in progress) — Windows launch matrix 12/13, blocked on user reboot
- **Did:** Decision #1 resolved by user: **macOS stays in scope, Mac provided when needed** (plan
  annotated; PF-01 will sit PARTIAL until the macOS matrix). Ran the scripted Windows matrix on the
  installed app: **10/10 cold starts** reach a window in 1.1–1.6 s (user observing, no error
  dialogs); **second-instance launch** → single-instance lock, focus-existing, no corruption;
  **`.rga` association**: none registered by the installer (plan: observed behavior, not a failure;
  candidate `fileAssociations` config improvement).
- **Evidence:** `docs/plans/evidence/S3.1-launch-matrix.md` (12/13, 0 failures).
- **Status deltas:** ledger S3.1 → 🟡 12/13. PF-01 not yet flipped (pending reboot item + macOS).
- **Gaps/risks surfaced:** none (the no-association note is an observation, not a gap).
- **Next action:** USER: reboot → launch installed app once → report. Then close S3.1 and open S3.2
  (lifecycle E2E specs — agent-only work, no user needed).

## 2026-07-26 · S2.2 — installed-app smoke 5/5 PASS; LR-01 flipped TRUE (Phase 2 complete)
- **Did:** User accepted the unsigned installer (Decision #2). Silent-installed the packaged build
  (`%LOCALAPPDATA%\Programs\rwanga-editor`); the USER performed the 5-item smoke by hand on the
  installed app: open / new+type / save / close+reopen / print preview — **5/5 PASS**. Flipped LR-01
  UNKNOWN→TRUE in the launch checklist.
- **Evidence:** `docs/plans/evidence/S2.2-installer-smoke.md` (+ user screenshots in-session).
- **Status deltas:** ledger S2.2 ⬜→✅; **LR-01 UNKNOWN→TRUE**. Launch P0s: 34 TRUE · 20 PARTIAL ·
  5 UNKNOWN · 1 FALSE. QG-12's remaining blockers = the QA sweep clusters only.
- **Gaps/risks surfaced (both ticketed in §0.5, non-blocking for LR-01):**
  - **GAP-2-1:** New doc renders a dead band above a shrunken page that grows as content arrives;
    user-ratified expected behavior = full configured page size from first paint. Long-standing,
    user-reported repeatedly, now formally tracked.
  - **GAP-2-2:** packaged app shares userData with the dev app (restored dev session; auto-opened
    the playground fixture). Decide appId/userData split before launch.
  - Print Preview: user notes "needs improvement later, but pass as feature" (no new gap row;
    existing print-polish backlog).
- **Next action:** S3.1 — PF-01 launch matrix; Step 1 = user Decision #1 (macOS scope).

## 2026-07-26 · S2.1 — pack:win succeeds under Dev Mode; installer produced
- **Did:** User enabled Windows Developer Mode (via `ms-settings:developers`; verified
  `AllowDevelopmentWithoutDevLicense = 1`). `npm run pack:win` then completed with exit 0 — the
  winCodeSign symlink-privilege blocker is gone, no elevated shell needed, no cache purge needed.
- **Evidence:** `docs/plans/evidence/S2.1-pack-win.txt` (env note + full log).
  Artifact: `rwanga-editor\build\output\Rwanga Editor-Setup-0.1.0-alpha.0.exe` (76 MB, NSIS x64,
  oneClick, **unsigned** — no cscInfo). NOTE: output dir is `build\output\` per project config,
  not the plan-assumed `dist\` (plan annotated).
- **Status deltas:** ledger S2.1 ⬜→✅. LR-01 still open pending S2.2 (install + smoke + flip).
- **Gaps/risks surfaced:** none. (dist/ artifacts not committed, per plan.)
- **Next action:** S2.2 — Step 1 is a user decision: accept unsigned installer for LR-01
  (Decision #2), then install + 5-item smoke.

## 2026-07-26 · S1.5 — QG-01 GREEN: unit suite 0 reds, checklist flipped TRUE (Phase 1 complete)
- **Did:** Full clean unit run captured to `docs/plans/evidence/S1.5-green-run.txt`; flipped QG-01
  PARTIAL→TRUE in `docs/RWANGA_IDE_LAUNCH_CHECKLIST.md` (old 2026-06-10 triage note kept for the
  record). Phase 1 of the masterplan (S0.1→S1.5 + GAP-1-1 fix-slice) is complete in one session.
- **Evidence:** **1936 tests · 1935 pass · 0 fail · 1 skipped** (exit 0) at HEAD `90485776`.
  Zero quarantines added — the suite is green on real assertions.
- **Status deltas:** ledger S1.5 ⬜→✅; **QG-01 PARTIAL→TRUE** (launch P0s now 33 TRUE · 20 PARTIAL ·
  6 UNKNOWN · 1 FALSE; QG-12's remaining named blockers: LR-01 + QA sweeps).
- **Gaps/risks surfaced:** none new. Standing: the running Electron instance auto-migrates
  `playground-the-last-light.rga` — keep the pre-commit fixture check.
- **Next action:** S2.1 — LR-01 installer: check Dev Mode; if disabled, blocked on user
  (enable Dev Mode or elevated shell).

## 2026-07-26 · GAP-1-1 fix-slice — DOM-read-as-truth violation resolved
- **Did:** Fixed the one real defect from the QG-01 triage. `_enterRebind()` in
  `renderer/js/shell/workspaces/settings-workspace.js` no longer reads
  `classList.contains('is-disabled')` as state truth; it gates on
  `entry.requiresPro || _isPersistsOnly(entry)` — exactly the states the CSS hook proxied
  (`is-disabled` is applied by `_disableControlElement` for PERSISTS_ONLY rows; requiresPro was the
  other non-interactive case, previously guarded only at the click/keydown call sites). Behavior
  identical; the belt-and-suspenders guard is now sourced from state.
- **Evidence:** TDD red→green: `source-audit.test.js` **19/19** (was 18/19); neighbors
  `settings-workspace` + `settings-applicators` + `settings-reachability` **67/67**.
- **Status deltas:** §0.5 GAP-1-1 OPEN→**CLOSED**.
- **Gaps/risks surfaced:** none.
- **Next action:** S1.5 — full clean run captured to evidence, flip QG-01 TRUE.

## 2026-07-26 · S1.4 — recovery-phase3 reds resolved (both stale, re-pointed)
- **Did:** Verdict = stale expectations (sub-case i), both tests in
  `tests/unit/editor/editor-recovery-phase3.test.js` (the file guards UX-recovery — Flow gutter +
  Draft footer — NOT crash recovery; `9693012d` unrelated). Gutter test re-pointed from the retired
  opacity mechanism to the F1/F6 rail tokens (`--flow-rail-num` + `--flow-rail-bg`,
  editor-prosemirror.css:146-158, commit `fd198a49` LOCKED), keeping a conditional ≥0.7 guard so a
  reintroduced dimmer still fails. Whitelist test gained the 4 authorized modules (inspector.js
  F1A.3 · toolbar.js F1A.6 · page-setup-preview.js S8 · settings-migrations.js H2) with provenance
  comments in the file's established pattern.
- **Evidence:** suite file **12/12 pass** (was 10/12).
- **Status deltas:** ledger S1.4 ⬜→✅. Unit suite now **1936 · 1 fail · 1 skipped** — the only red
  is GAP-1-1's source-audit "audit (b)".
- **Gaps/risks surfaced:** root cause of the recurring fixture dirt identified: a RUNNING Electron
  instance (started 22:03 local) keeps auto-migrating `playground-the-last-light.rga`. Reverted
  again this session; user advised to close the app. Check fixture state before every commit.
- **Next action:** GAP-1-1 fix-slice — replace the `classList.contains('is-disabled')` gate at
  `settings-workspace.js:522` with `entry.requiresPro`; the red source-audit test is the TDD test.

## 2026-07-26 · S1.3 — closed as verification no-op (nothing to quarantine)
- **Did:** Verified the S1.1 reclassification held: the parenthetical print-cosmetic trio needs no
  quarantine because the cosmetic shipped (Density Slice 6) and S1.2's `declIn()` logical-property
  helper fix made the tests green on the real values.
- **Evidence:** `node --test tests/unit/framework/parenthetical-box-geometry.test.js` = **4/4 pass ·
  0 skipped** (no QUARANTINE strings introduced anywhere).
- **Status deltas:** ledger S1.3 ⬜→✅ (NO-OP annotation; slice's original steps intentionally unticked).
- **Gaps/risks surfaced:** none.
- **Next action:** S1.4 — re-point the 2 recovery-phase3 reds (triage rows 29–30).

## 2026-07-26 · S1.2 — all 27 Class-A stale tests re-pointed; suite down to 3 known reds
- **Did:** Re-pointed every Class-A red from the S1.1 triage across 15 test files (4 parallel edit
  passes, disjoint files): F1A.6 scene-tools → screenplay plugin, Slice-5A Cmd-,/Settings-workspace
  moves, F1A.4 status-bar split, H2B theme-SSOT reroute, F1/F6 rail-side P## marker, 4 authorized
  module-whitelist amendments (×3 guards), scene-navigator density values (`16273947`), and the
  parenthetical `declIn()` logical-property fix (R1). Every changed assertion carries a one-line
  citation; several guards came out stronger (exact seam guard `height: 0`, cross-boundary negative
  checks in slice5/slice7, exactly-once command registration).
- **Evidence:** full unit suite from clean fixtures: **1936 · 1932 pass · 3 fail · 1 skipped**;
  the 3 = exactly the 2 Class-C recovery-phase3 reds + the 1 Class-D source-audit red (GAP-1-1).
- **Status deltas:** ledger S1.2 ⬜→✅.
- **Gaps/risks surfaced:** one transient 4th red appeared mid-session when
  `playground-the-last-light.rga` got dirtied (known §0.2 hazard; reverted; clean rerun = 3 fails,
  fixture stays clean through a full run — no test writes it; keep checking `git status` per ritual).
  Observation: `memory.test.js` "full-bundle" test fails under `--test-name-pattern` isolation —
  possible in-file order dependence; benign in normal runs, noted for a future hygiene pass.
- **Next action:** S1.3 — verification no-op close (Class B = 0, nothing to quarantine), then S1.4.

## 2026-07-26 · S1.1 — all 30 QG-01 reds triaged; 1 real defect surfaced (GAP-1-1)
- **Did:** Classified every red from the S0.1 baseline via 4 parallel research passes (each failing
  test read against the renderer code + redesign docs it references). Wrote the binding triage table
  `docs/plans/evidence/S1.1-qg01-triage.md` (30 rows, per-test citation + action).
- **Evidence:** the triage file. Verdict: **27 Class A · 0 B · 2 C(i) · 1 D.**
- **Status deltas:** ledger S1.1 ⬜→✅; gap row **GAP-1-1** added to §0.5 + HANDOFF Open cases.
- **Gaps/risks surfaced:**
  - **GAP-1-1 (real defect, low severity):** `settings-workspace.js:522` reads
    `classList.contains('is-disabled')` as state truth (H6 regression); fix = read
    `entry.requiresPro` from closure. Fix-slice due before S1.5.
  - **Plan deviation:** parenthetical trio is A, not B — the cosmetic shipped in Density Slice 6;
    tests red only because `declIn()` predates R1's `padding-left`→`padding-inline-start` rename.
    S1.3 therefore closes as a verification no-op (nothing to quarantine).
  - Class C duo is stale (F1 Flow-rail tokens + 4 legitimate post-Phase-3 modules) → re-point in S1.4.
  - pdf-export.test.js + settings-applicators.test.js appear in the capture incidentally (0 fails).
- **Next action:** slice S1.2 — re-point the 27 Class-A tests (batch per suite, verify per file,
  full-suite check expects fail = 3: the 2 Class C + 1 Class D).

## 2026-07-26 · S0.1 — clean fixture baseline restored + 30-red baseline recorded
- **Did:** Executed masterplan slice S0.1. Verified the only tracked-tree noise was the 2 dirty
  fixtures; reverted `mysterious-guest-rtl.rga` + `playground-the-last-light.rga`; ran the full unit
  suite and captured it to `docs/plans/evidence/S0.1-baseline-run.txt`.
- **Evidence:** `S0.1-baseline-run.txt` tail: **1936 tests · 1905 pass · 30 fail · 1 skipped** —
  exactly the plan's predicted clean baseline (30 reds, all non-core).
- **Status deltas:** ledger S0.1 ⬜→✅. No checklist rows flipped (baseline slice).
- **Gaps/risks surfaced:** none — numbers matched prediction exactly.
- **Next action:** slice S1.1 — enumerate + classify all 30 reds into
  `docs/plans/evidence/S1.1-qg01-triage.md` (expected ~24 Class A · 3 B · 2 C · 0 D).

## 2026-07-02 · Binding execution doctrine codified · HEAD `2f20ae2f`
- **Did:** Codified a strict, session-independent MASTERPLAN EXECUTION DOCTRINE (10 rules) in the
  root `CLAUDE.md`, mirrored in `rwanga-editor/CLAUDE.md`, added as PROTOCOL.md Rule 7, and extended
  the plan's §0.3 SLICE CLOSE RITUAL with a mandatory `git push` step. Any agent in any future
  session is now bound to: masterplan-only Stage-1 work, one slice at a time in ledger order,
  tick-as-you-go in the plan file, close ritual + push per slice, evidence before flips, escalate
  (never paper over), never commit fixture .rga files, end cleanly when blocked on the user.
- **Evidence:** this commit (doctrine text in CLAUDE.md ×2, PROTOCOL.md Rule 7, plan §0.3 step 6).
- **Status deltas:** none (process hardening only).
- **Gaps/risks surfaced:** none.
- **Next action:** execute masterplan slice S0.1 (revert fixtures, record clean 30-red baseline) —
  user will start this in a fresh session.

## 2026-07-02 · Stage-1 launch-gate masterplan authored · HEAD `829faa74`
- **Did:** Converted GO_LIVE Part A/D into an executable, cross-session masterplan:
  `docs/plans/2026-07-02-stage1-launch-gate-masterplan.md` — 6 phases · 21 slices · checkbox tasks,
  with a survival protocol (§0: resume procedure, state ledger, slice-close ritual, evidence
  conventions) so any agent can pick up mid-campaign with zero re-discovery. Also committed the
  previously-untracked memory system itself (CLAUDE.md ×2, docs/handoff/, GO_LIVE, Alive-App checklist)
  so it survives beyond this working tree.
- **Evidence:** the plan file (self-reviewed: all 28 open P0 IDs mapped to slices — QG-01→S1.x,
  LR-01→S2.x, PF→S3.x, RTL/SW-23→S4.x, MT/PP/SW-01→S5.x, QG-12→S6.1; E2E task code grounded in the
  real `Rga.FileManager` surface at `renderer/js/file-manager.js:154` and the Playwright-Electron
  harness in `tests/e2e/filmustageation/print-contract.spec.js`).
- **Status deltas:** none flipped (planning only). Fixtures still dirty — reverting is S0.1 Step 2.
- **Gaps/risks surfaced:**
  - Handoff/memory docs were untracked (would not survive a clone) → fixed by committing them.
  - Two user decisions embedded in the plan: macOS scope for PF-01 (Decision #1, hits at S3.1) and
    unsigned-installer acceptability for LR-01 (Decision #2, hits at S2.2).
  - MT-07 / MT-10 carry measured adverse evidence (overflow 5/6, budget 0.74×) — S5.2 may spawn fix
    slices (bounded launch fixes, not features).
- **Next action:** execute masterplan slice S0.1 (revert fixtures, record clean 30-red baseline).

## 2026-07-02 · Forensic re-verification + memory system stood up · HEAD `829faa74`
- **Did:** Verified the launch checklist against live reality after weeks away; audited the
  Filmustageation vision gap against code; created the consolidated go-live doc; stood up this
  in-repo handoff/checkpoint memory system (`CLAUDE.md` at parent + `rwanga-editor/CLAUDE.md` +
  `docs/handoff/{HANDOFF,CHECKPOINTS,PROTOCOL}.md`).
- **Evidence:**
  - Checklist currency: 3 latest repo commits (`a27e9dce`, `aa5b08aa`, `829faa74`) are checklist-only;
    no code changed since → checklist describes HEAD.
  - QG-01: fresh `npm run test:unit` = **1936 tests · 1899 pass · 36 fail · 1 skipped** (matches doc).
  - "30 vs 36" honesty: stashed the 2 dirty fixtures, re-ran the 6 suspect suites → **40/40 pass**
    → clean checkout = exactly 30 reds, all non-core (≈24 stale shell + 3 parenthetical + 2 recovery-phase3).
  - Vision audit: `docs/RWANGA_GO_LIVE_2026-07-02.md` Part B (file paths cited).
- **Status deltas:** none flipped. Confirmed launch P0 = 32 TRUE · 21 PARTIAL · 6 UNKNOWN · 1 FALSE (28 open).
  Recorded VISION-1…5 as tracked gaps (Stage 2/3, not launch P0s).
- **Gaps/risks surfaced:**
  - 2 working-tree fixtures are dirty (auto-migrated by an old e2e run) → +6 spurious test fails; revert them.
  - `.rga` is agent-readable but **not agent-writable** (no contribution API) — the true prerequisite for the Agent harness (VISION-2).
- **Next action:** `git checkout -- rwanga-editor/tests/fixtures/*.rga`, then run the QG-01 test-hygiene
  slice (re-point stale shell tests + quarantine the parenthetical cosmetic) to green the suite and unblock QG-12.
