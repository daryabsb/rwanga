# Rwanga — Checkpoint Log

Append-only. Newest at top. Never rewrite past entries (correct with a new one).
Template & rules: `PROTOCOL.md`.

---

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
