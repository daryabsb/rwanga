# Rwanga Stage 1 — Launch-Gate Masterplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended)
> or superpowers:executing-plans to implement this plan slice-by-slice. Steps use checkbox (`- [ ]`)
> syntax for tracking. **Tick boxes in THIS file as you complete them and commit the tick** — the
> checkboxes ARE the cross-session state.

**Goal:** Flip all 28 open launch-checklist P0s to TRUE so QG-12 ("no known P0/P1 bugs") closes and
Rwanga can launch as a trustworthy RTL screenplay editor.

**Architecture:** This is a *verification + packaging campaign*, not feature construction. Six phases,
strictly ordered on the critical path (test hygiene → installer → three QA sweeps → roll-up), plus one
parallel design-only track. Every slice ends with recorded evidence, a checklist flip, and a handoff
update — so any agent can resume from any point with zero re-discovery.

**Tech stack:** Node 20+ `node --test` (unit), Playwright + Electron (`npm run test:e2e`),
electron-builder (`npm run pack:win`), PowerShell/Windows 11.

---

## §0 CROSS-SESSION SURVIVAL PROTOCOL — read before doing anything

### §0.1 How to resume (any agent, any session)

1. Read `docs/handoff/HANDOFF.md`. Its **NEXT ACTION** names the active slice of this plan (e.g. "S1.2").
2. Open this file. Find that slice. The first unchecked `- [ ]` box is your next step.
3. Work the steps **in order**. Tick each box in this file as you complete it.
4. When the slice's last box is ticked, run the **SLICE CLOSE RITUAL** (§0.3). Then either continue
   to the next slice or end the session — the ritual guarantees the next agent resumes cleanly.

### §0.2 Hard rules (violating these corrupts the campaign state)

- **One slice at a time.** Never start slice N+1 with slice N's ritual unfinished.
- **Evidence, not assertion** (PROTOCOL.md Rule 2). Every flip of a checklist row needs a test name,
  commit SHA, or a recorded evidence file under `docs/plans/evidence/`.
- **Escalate, don't paper over.** If a QA step finds real product breakage (not a stale test), do NOT
  silently fix or skip it. Record it as a new gap `GAP-<phase>-<n>` in the ledger (§0.5), add it to
  HANDOFF.md Open cases, and — only if it blocks the slice — open a fix-slice using
  superpowers:systematic-debugging + test-driven-development.
- **Never commit `tests/fixtures/*.rga` changes.** Opening fixtures in the running app auto-migrates
  them and dirties the tree (this is exactly what inflated 30 reds to 36). Before every commit:
  `git status` must show no fixture modifications; if it does, `git checkout -- rwanga-editor/tests/fixtures/*.rga`.
- **Respect the gates** (PROTOCOL.md Rule 6): no AI/agent-harness feature code anywhere in this
  campaign. Track P is *design writing only*.
- **Run all npm commands from `rwanga-editor/`.** Git commands run from the repo root `E:\api\rwanga\`.
- **Two masters stay in sync** (PROTOCOL.md Rule 5): when you flip a P0, edit the row in
  `docs/RWANGA_IDE_LAUNCH_CHECKLIST.md` (status + evidence note) in the same commit.

### §0.3 SLICE CLOSE RITUAL (run at the end of every slice — no exceptions)

1. Tick the slice's row in the **State Ledger** (§0.5): `⬜ → ✅`, fill the Evidence column.
2. Edit `docs/handoff/HANDOFF.md`: set **NEXT ACTION** to the next slice ID + one-line description;
   update the Open-cases table if any status changed.
3. Append a checkpoint to `docs/handoff/CHECKPOINTS.md` (newest at top) using PROTOCOL.md's template —
   Did / Evidence / Status deltas / Gaps surfaced / Next action.
4. Verify no stray fixture edits: `git status` from `E:\api\rwanga\`.
5. Commit everything (plan ticks + evidence + checklist flips + handoff) with the slice's commit
   message given in the slice text.
6. **Push:** `git -C E:\api\rwanga push`. A slice-close commit that isn't pushed doesn't survive
   this machine — pushing is part of the ritual, not optional.

### §0.4 Evidence conventions

- Directory: `docs/plans/evidence/` (create on first use).
- Naming: `S<slice>-<short-name>.<ext>` — e.g. `S0.1-baseline-run.txt`, `S4.2-rtl-dialogue.png`.
- QA observations go in a per-slice markdown file (`S3.1-launch-matrix.md`) with: date, HEAD SHA,
  app version, steps performed, observed result, verdict per checklist ID.

### §0.5 State Ledger — THE campaign dashboard (update via §0.3 step 1)

| Slice | Phase | What | Status | Evidence |
|---|---|---|---|---|
| S0.1 | 0 Baseline | Revert fixtures, record clean 30-red baseline | ✅ | `docs/plans/evidence/S0.1-baseline-run.txt` — 1936 tests · 30 fail · 1 skipped (matches §Global-constraints baseline exactly) |
| S1.1 | 1 QG-01 | Enumerate + classify all 30 reds into triage table | ✅ | `docs/plans/evidence/S1.1-qg01-triage.md` — 27 A · 0 B · 2 C(i) · 1 D (GAP-1-1); parenthetical trio reclassified B→A (fix already shipped; stale helper regex) |
| S1.2 | 1 QG-01 | Re-point the ~24 stale shell/ownership snapshot tests | ✅ | All 27 Class-A tests re-pointed (15 files); full suite 1936 · **3 fail** (= 2 Class C + 1 Class D exactly) · 1 skipped; no assertion weakened, every re-point cites its doc/code source |
| S1.3 | 1 QG-01 | Quarantine-with-reason the parenthetical cosmetic (3 tests) | ✅ | NO-OP by S1.1 triage: trio was Class A, fixed in S1.2 (`declIn` logical-prop helper); suite 4/4 pass · 0 skipped — nothing quarantined, no GAP-1-1 reserved-name used for cosmetics |
| S1.4 | 1 QG-01 | Triage + resolve the 2 recovery-phase3 reds | ✅ | Both stale (triage rows 29–30): gutter test re-pointed to F1 rail tokens (+ dimmer regression guard kept); whitelist gained the 4 authorized modules w/ provenance. Suite file 12/12 pass |
| S1.5 | 1 QG-01 | Full green unit run → flip QG-01 TRUE | ✅ | `docs/plans/evidence/S1.5-green-run.txt`: **1936 · 1935 pass · 0 fail · 1 skipped** (exit 0, zero quarantines) at `90485776`; checklist QG-01 PARTIAL→TRUE |
| S2.1 | 2 LR-01 | Enable Dev Mode / elevated shell → `pack:win` succeeds | ✅ | User enabled Dev Mode (2026-07-26); `pack:win` exit 0 → `build\output\Rwanga Editor-Setup-0.1.0-alpha.0.exe` (76 MB, NSIS x64, unsigned). `docs/plans/evidence/S2.1-pack-win.txt` |
| S2.2 | 2 LR-01 | Install + smoke the built `.exe` → flip LR-01 TRUE | ✅ | `docs/plans/evidence/S2.2-installer-smoke.md` — user-performed smoke on installed app **5/5 PASS**; unsigned accepted (Decision #2, 2026-07-26); LR-01 UNKNOWN→TRUE; gaps GAP-2-1/GAP-2-2 opened (non-blocking) |
| S3.1 | 3 Lifecycle | PF-01 cold-start launch matrix (Windows) | ✅ | `docs/plans/evidence/S3.1-launch-matrix.md`: **Windows 13/13 PASS · 0 failures** — 10/10 cold starts (1.1–1.6 s), post-reboot launch PASS (user, 2026-07-27), focus-existing single-instance, no `.rga` assoc (observed, not failure). PF-01 → PARTIAL **(Windows-verified)**; macOS matrix deferred by Decision #1 (Mac later), tracked on the PF-01 row |
| S3.2 | 3 Lifecycle | PF-02/03/05 lifecycle E2E specs (new/open/save-as) | ✅ | `docs/plans/evidence/S3.2-lifecycle-e2e.md` — three specs under `rwanga-editor/tests/e2e/lifecycle/`, **3/3 PASS** (and green inside the full suite). Seam: main-process dialog stubs (real IPC path), not the `doc.handle` shortcut. PF-02/03/05 PARTIAL→TRUE. Full-suite run 326 pass/37 fail → all sampled failures proven PRE-EXISTING (**GAP-3-3**) |
| S3.3 | 3 Lifecycle | PF-13 clean-console audit across core flows | ⬜ | |
| S4.1 | 4 RTL ⭐ | RTL QA fixture + convention checklist prep | ⬜ | |
| S4.2 | 4 RTL ⭐ | Editor alignment sweep RTL-04…RTL-09 | ⬜ | |
| S4.3 | 4 RTL ⭐ | RTL Print Preview + PDF export (RTL-10, RTL-11) | ⬜ | |
| S4.4 | 4 RTL ⭐ | Bidi audit — mixed script + punctuation (RTL-12, RTL-13) | ⬜ | |
| S4.5 | 4 RTL ⭐ | SW-23 profile-convention verdict + flip all RTL rows | ⬜ | |
| S5.1 | 5 Geometry | Paper sizes + margins (MT-05, MT-06, PP-01, PP-03) | ⬜ | |
| S5.2 | 5 Geometry | Bottom-margin overflow + empty-line budget (MT-07, MT-10) | ⬜ | |
| S5.3 | 5 Geometry | Marker stability, heading edit, PDF page count (MT-02, SW-01, MT-04) | ⬜ | |
| S6.1 | 6 Roll-up | Reconcile checklist, flip QG-12, declare launch-gate closed | ⬜ | |
| SP.1 | P Design | `Rga.Contribution` write-API design brief (no code) | ⬜ | |

**Open gaps found during the campaign** (append rows; mirror in HANDOFF.md):

| Gap ID | Found in | Description | Status |
|---|---|---|---|
| GAP-1-1 | S1.1 | DOM-read-as-truth violation (H6, `0b024e24`): `settings-workspace.js:522` `_enterRebind()` gates on `classList.contains('is-disabled')` instead of `entry.requiresPro` (available in closure; correct idiom used at :584/:588). Caught by `source-audit.test.js` "audit (b)" — a standing guard, NOT stale. Fixed 2026-07-26: `_enterRebind` now gates on `entry.requiresPro \|\| _isPersistsOnly(entry)` — the exact states the CSS hook proxied (is-disabled applied for PERSISTS_ONLY via `_disableControlElement`). Evidence: source-audit 19/19; settings-workspace/applicators/reachability 67/67. | **CLOSED** |
| GAP-2-1 | S2.2 smoke | **Flow view opens a New doc with a large dead band** between top chrome and the page; it shrinks gradually as content is typed until the layout reaches its correct height. USER-REPORTED, long-standing, previously never ticketed (user has raised it before). Visual/layout defect in Flow initial geometry, packaged + dev alike. Screenshots in user report 2026-07-26. Does not block typing/structure. **Expected behavior (user-ratified):** a New doc's page renders at its FULL configured page size (A4/Letter per Page Setup) from the first paint — never a shrunken page that grows as content arrives. Needs its own fix-slice (systematic-debugging + failing test first). | OPEN |
| GAP-3-1 | user report post-S3.1 | **Compact mode amputates half the menubar with no overflow.** `shell.css:2357-2362` hides the Tags / Tools / Export / Help menus whenever `#app.mode-compact` (window < ~1412 CSS px = virtually every laptop under Windows display scaling; user's 1440px @ ~125% ≈ 1152px). Settings' only menu entry lives in Tools → **Settings disappears from the menu**, as do all Export/Help items; no "…" overflow, no relocation. Gear icon + Ctrl+, still reach Settings (why tests stay green — they assert command registration, not menu visibility). Root-caused 2026-07-26 (responsive.js `_decideMode` + compact CSS). Fix direction (own slice): overflow "…" menu or move Settings to a never-hidden menu; never hide a menu's ONLY route to a feature. | OPEN |
| GAP-3-2 | user report post-S3.1 | **Settings workspace scroll/sticky layering broken.** User screenshot 2026-07-26 (installed app, Page Setup section): a row (Orientation, segmented control) paints ABOVE the sticky search band; section title/description scroll out of sync with the band; first row clipped mid-control. Suspects: `.rga-settings-content` is the scroll container (`overflow-y:auto`, 24px top padding — settings-workspace.css:279-294) with the sticky `.rga-settings-content-header` (top:0, z-index:10, bg-mask — :321-346) pinning inside it; masking/pinning fails under real content. User states Settings area has had unfixed visual problems for a while. Diagnosis plan (own fix-slice): Playwright DOM-geometry spec over the Settings workspace scroll (per project rule "Playwright > screenshots for layout work"), then fix + regression test. | OPEN |
| GAP-3-3 | S3.2 Step 4 | **E2E suite: 37 reds, all sampled ones caused by `app.close()` hanging in `afterEach` — the app will not quit.** Full run 2026-07-27: **326 pass · 37 fail** (1.2 h). Signature on every sampled failure: `Test timeout of 60000ms exceeded while running "afterEach" hook` at `app.close()` — **the test bodies pass**; recovery/autosave/paper-view assert green and only teardown fails. Proven PRE-EXISTING and independent of S3.2: the same specs fail identically when run alone with S3.2's files absent (7 fail / 6 pass), and again after clearing 17 orphaned Electron processes (each hung close leaks a process tree). Working hypothesis for the fix-slice: specs that leave the doc **dirty** hit the unsaved-changes prompt on quit, which blocks `close()` under automation — consistent with `print-contract.spec.js` (`clearDirtyAndClose`) and the three new lifecycle specs (which clear dirty) passing, while `app-close.spec.js` ("closing with unsaved changes prompts") is itself failing. **Also surfaced: no e2e baseline has ever been recorded** (the campaign's baseline truth is the UNIT suite only) — record one the way S0.1 did, since QG-12 cannot honestly roll up over an unmeasured suite. Needs its own fix-slice (systematic-debugging; decide per-spec whether it is test hygiene or a real quit-path defect). | OPEN |
| GAP-2-2 | S2.2 smoke | **Installed app shares userData/workspace state with the dev app** (same app identity): first launch of the packaged build restored the dev session and auto-opened `tests/fixtures/playground-the-last-light.rga` — making the installed app another fixture-dirtier. Harmless for end users (no dev state), but decide before launch whether packaged builds should use a distinct appId/userData dir. | OPEN |

---

## Global constraints

- **Repo root:** `E:\api\rwanga\` (git root). **Editor:** `E:\api\rwanga\rwanga-editor\`.
- **Status of record:** `docs/RWANGA_IDE_LAUNCH_CHECKLIST.md`. Plan of record: `docs/RWANGA_GO_LIVE_2026-07-02.md`.
- **Baseline truth (verified 2026-07-02, HEAD `829faa74`):** clean checkout unit suite =
  **1936 tests · 30 fail · 1 skip**; every red is non-core (~24 stale shell/ownership snapshots +
  3 parenthetical print-cosmetic + 2 recovery-phase3).
- **Unit tests:** `npm run test:unit` (node --test over `tests/unit/**/*.test.js`).
- **E2E:** `npm run test:e2e` (Playwright, launches real Electron; build renderer first with
  `npm run build:renderer`).
- **Ratified RTL truth:** `rwanga-editor/docs/Filmustageation/redesign_campaign/RTL_SCREENPLAY_CONVENTION.md`
  (the Kurdish/RTL profile, "Rule 10" in checklist rows) — geometry/alignment verdicts are judged
  against it, not against taste.
- **Known-stale checklist notes:** MT-04 and RTL-11 rows still say "Blocked: PDF export non-functional".
  That is outdated — PDF export is TRUE and test-backed (GO_LIVE §A). Treat those two as runnable QA.
- **Commit style:** match repo history — `test(editor): …`, `fix(editor): …`, `build(editor): …`,
  `docs(editor): …`, `qa(editor): …`.

### Decisions the user must make (ask when the slice is reached, not before)

1. **macOS scope (S3.1, S6.1):** PF-01 says "Win/macOS". No Mac hardware is in evidence. Options:
   descope macOS from v1 launch (edit checklist row wording, note the decision) or provide a Mac.
   **DECIDED 2026-07-26 (user):** macOS stays IN scope — user will provide a Mac when needed.
   Windows matrix runs now; the macOS matrix is a deferred sub-task of PF-01 (and a `pack:mac` +
   smoke sub-task of LR-01's follow-up) executed when the Mac arrives. PF-01 may sit at
   PARTIAL (Windows-verified) until then.
2. **Code signing (S2.2):** `pack:win` without a certificate produces an unsigned installer.
   GO_LIVE already says "(+ signing later)" — confirm unsigned is acceptable for LR-01 TRUE.

---

## Phase 0 — Baseline reset

### Slice S0.1: Revert fixtures, record the clean 30-red baseline

**Files:**
- Revert: `rwanga-editor/tests/fixtures/mysterious-guest-rtl.rga`, `rwanga-editor/tests/fixtures/playground-the-last-light.rga`
- Create: `docs/plans/evidence/S0.1-baseline-run.txt`

**Interfaces:** Produces the red-count baseline (30) that S1.x slices burn down to 0.

- [x] **Step 1: Confirm the dirty fixtures are the only tree noise**

Run from `E:\api\rwanga\`: `git status --short`
Expected: `M rwanga-editor/tests/fixtures/mysterious-guest-rtl.rga` and
`M rwanga-editor/tests/fixtures/playground-the-last-light.rga` (plus untracked docs). If OTHER tracked
files are modified, STOP — record a gap in §0.5 and put it in HANDOFF before proceeding.

- [x] **Step 2: Revert the two fixtures**

```powershell
git -C E:\api\rwanga checkout -- rwanga-editor/tests/fixtures/mysterious-guest-rtl.rga rwanga-editor/tests/fixtures/playground-the-last-light.rga
git -C E:\api\rwanga status --short   # expect: no modified .rga files
```

- [x] **Step 3: Run the unit suite and capture the baseline**

```powershell
cmd /c "cd /d E:\api\rwanga\rwanga-editor && npm run test:unit > E:\api\rwanga\docs\plans\evidence\S0.1-baseline-run.txt 2>&1"
```
Expected in the tail of the file: `tests 1936 … fail 30 … skipped 1` (numbers must match; if fail ≠ 30,
STOP — the baseline moved; record actual numbers as a gap and update GO_LIVE assumptions in HANDOFF).

- [x] **Step 4: SLICE CLOSE RITUAL (§0.3)**

Commit message: `test(editor): restore clean fixture baseline; record 30-red QG-01 baseline (S0.1)`

---

## Phase 1 — QG-01 test hygiene (unblocks QG-12)

**Nature (from GO_LIVE A.1 #1):** test *maintenance*, not feature work. The ~30 reds are stale
expectations about ownership/DOM that moved during the v3 shell redesign, plus one deliberate
print-cosmetic deferral, plus 2 recovery-phase3 stragglers.

### Slice S1.1: Enumerate and classify every red

**Files:**
- Create: `docs/plans/evidence/S1.1-qg01-triage.md`

**Interfaces:** Produces the triage table that S1.2/S1.3/S1.4 execute against. Later slices trust its
classification; misclassification here is the campaign's biggest correctness risk — be rigorous.

- [x] **Step 1: Extract the failing test list from the S0.1 baseline capture**

Read `docs/plans/evidence/S0.1-baseline-run.txt`; grep for `✖` / `not ok` lines (node --test reporter).
List every failing test with its file path (`tests/unit/...`).

- [x] **Step 2: Classify each red into exactly one class**

For each failing test, read the test AND the code it exercises, then assign:

- **Class A — stale expectation:** the test asserts pre-redesign ownership/DOM (e.g. expects a
  selector, module boundary, or panel owner that the v3 shell moved). The *current product behavior is
  the documented intent* (check `rwanga-editor/docs/Filmustageation/redesign_campaign/` docs). → re-point in S1.2.
- **Class B — deliberate cosmetic deferral:** the parenthetical print-cosmetic trio. → quarantine in S1.3.
- **Class C — recovery-phase3:** the 2 recovery reds. → triage in S1.4.
- **Class D — real defect:** the test is right and the product is wrong. → gap row in §0.5 +
  HANDOFF Open cases; do NOT re-point or quarantine it.

Write `S1.1-qg01-triage.md` as a table: `| test name | file | class | current owner/behavior | action |`.
Expected totals: ~24 A · 3 B · 2 C · 0 D (if D > 0, that's a finding — escalate per §0.2 but continue
the slice; the gap is handled in its own fix-slice later).

- [x] **Step 3: SLICE CLOSE RITUAL (§0.3)**

Commit message: `test(editor): triage all QG-01 reds into re-point/quarantine/defect classes (S1.1)`

> **S1.1 outcome note (2026-07-26):** actual totals 27 A · 0 B · 2 C(i) · 1 D. The parenthetical trio
> is Class A (Density Slice 6 already shipped the cosmetic; only the test's `declIn()` regex predates
> the R1 logical-property rename) — so **S1.3 has nothing to quarantine** and closes as a verification
> no-op. Both Class C reds are stale (re-point in S1.4). The 1 Class D is GAP-1-1 (§0.5) and gets a
> fix-slice before S1.5.

### Slice S1.2: Re-point the stale shell/ownership snapshot tests (Class A)

**Files:**
- Modify: every Class-A test file listed in `docs/plans/evidence/S1.1-qg01-triage.md`

**Interfaces:** Consumes S1.1's triage table. Produces a suite where the only reds left are Class B + C.

- [x] **Step 1: Fix Class-A tests in batches of one suite (file) at a time**

For each file: update the assertion to the *current, documented* ownership/DOM. The new expected value
must be traceable to a redesign doc or the live module (cite it in a one-line comment above the
assertion, e.g. `// ownership per redesign_campaign/IMPLEMENTATION_MAP_PHASE1.md — settings panel owns page-setup rows`).
Never loosen an assertion to make it pass (no `toBeTruthy`-style weakening, no deleting the test).

- [x] **Step 2: Verify each batch as you go**

```powershell
cmd /c "cd /d E:\api\rwanga\rwanga-editor && node --test tests/unit/<the-suite>.test.js"
```
Expected: that file 100% pass.

- [x] **Step 3: Full-suite check**

Run `npm run test:unit`. Expected: fail count = 30 − (number of Class-A tests fixed) ≈ 5–6
(only Class B + C remain red).

> Actual (2026-07-26): fail = **3** (2 Class C + 1 Class D/GAP-1-1), since all 27 A-class reds — including
> the reclassified parenthetical trio — were fixed here. One transient 4th red appeared when
> `playground-the-last-light.rga` got dirtied mid-session (§0.2 known hazard); reverted, clean rerun
> confirms 3.

- [x] **Step 4: SLICE CLOSE RITUAL (§0.3)**

Commit message: `test(editor): re-point stale shell/ownership snapshots to current owners (QG-01, S1.2)`

### Slice S1.3: Quarantine the parenthetical print-cosmetic trio (Class B)

**Files:**
- Modify: the Class-B test file(s) from the triage table

**Interfaces:** Consumes S1.1's triage. Produces: those 3 tests reported as `skipped` with a reason.

> **CLOSED AS VERIFICATION NO-OP (2026-07-26).** S1.1 reclassified the trio B→A: the cosmetic shipped
> in Density Slice 6; the reds were a stale `declIn()` helper predating R1's logical-property rename,
> fixed in S1.2. Verified this slice: parenthetical-box-geometry suite **4/4 pass · 0 skipped**.
> Nothing quarantined; no gap row needed. Steps below are intentionally unticked — they never ran.

- [ ] **Step 1: Skip each of the 3 tests with an auditable reason**

node --test syntax — put the reason IN the skip so the runner output carries it:

```js
test('parenthetical print cosmetic — wrapped indent', {
  skip: 'QUARANTINE(QG-01, 2026-07-02): deliberate cosmetic deferral — parenthetical print polish. ' +
        'Tracked in docs/plans/2026-07-02-stage1-launch-gate-masterplan.md §0.5. Un-skip when the cosmetic lands.'
}, () => { /* body unchanged */ });
```

Do NOT delete the test bodies. Add the same three tests to a gap row `GAP-1-1` in §0.5 (status:
DEFERRED-COSMETIC) so they cannot be forgotten.

- [ ] **Step 2: Verify**

```powershell
cmd /c "cd /d E:\api\rwanga\rwanga-editor && node --test tests/unit/<the-parenthetical-suite>.test.js"
```
Expected: 0 fail, 3 skipped (reason visible in output).

- [ ] **Step 3: SLICE CLOSE RITUAL (§0.3)**

Commit message: `test(editor): quarantine parenthetical print-cosmetic trio with tracked reason (QG-01, S1.3)`

### Slice S1.4: Resolve the 2 recovery-phase3 reds (Class C)

**Files:**
- Modify: the Class-C test file(s) from the triage table

**Interfaces:** Consumes S1.1's triage. Produces: 0 unexplained reds in the suite.

- [x] **Step 1: Determine what recovery-phase3 asserts vs what shipped**

Read the 2 failing tests and `renderer/js/` recovery code they exercise. Note: commit `9693012d`
recently changed recovery-prompt behavior (same-session renderer reload) — check
`git log --oneline -5 -- rwanga-editor/renderer/js/*recovery*` for context. Decide: stale expectation
(→ re-point like S1.2) or unshipped phase-3 behavior (→ quarantine like S1.3 with reason
`QUARANTINE(QG-01, 2026-07-02): recovery phase-3 behavior not yet shipped — tracked as GAP-1-2`)
or real defect (→ Class D escalation per §0.2).

- [x] **Step 2: Apply the decided action and verify the suite file passes (0 fail)**

- [x] **Step 3: SLICE CLOSE RITUAL (§0.3)**

Commit message: `test(editor): resolve recovery-phase3 reds (QG-01, S1.4)`

> **S1.4 outcome (2026-07-26):** decision = stale expectation (S1.2-style re-point), both tests.
> The file guards UX-recovery (Flow gutter + Draft footer), not crash recovery — `9693012d` unrelated.
> Gutter: opacity mechanism superseded by F1/F6 rail tokens (`fd198a49`, LOCKED); test now asserts
> `--flow-rail-num`/`--flow-rail-bg` and keeps a conditional ≥0.7 guard against a reintroduced dimmer.
> Whitelist: added inspector.js (F1A.3), toolbar.js (F1A.6), page-setup-preview.js (S8),
> settings-migrations.js (H2) with provenance comments.

### Slice S1.5: Green run → flip QG-01

**Files:**
- Modify: `docs/RWANGA_IDE_LAUNCH_CHECKLIST.md` (QG-01 row)
- Create: `docs/plans/evidence/S1.5-green-run.txt`

- [x] **Step 1: Full clean run, captured**

```powershell
cmd /c "cd /d E:\api\rwanga\rwanga-editor && npm run test:unit > E:\api\rwanga\docs\plans\evidence\S1.5-green-run.txt 2>&1"
```
Expected: **fail 0** (skips = 1 pre-existing + the quarantined ones, each with a reason string).

- [x] **Step 2: Flip QG-01 in the launch checklist**

Edit the QG-01 row: status → TRUE; evidence note → `0 failing / 1936 tests at <new HEAD SHA>; quarantines carry QUARANTINE(QG-01) reasons; see docs/plans/evidence/S1.5-green-run.txt`.

- [x] **Step 3: SLICE CLOSE RITUAL (§0.3)** — status delta: `QG-01 PARTIAL→TRUE`

Commit message: `test(editor): QG-01 green — unit suite 0 reds, checklist flipped (S1.5)`

---

## Phase 2 — LR-01 installer build

**Nature (GO_LIVE A.1 #2):** environment, not code. `npm run pack:win` fails on a `winCodeSign`
symlink-privilege error; Windows Developer Mode (or an elevated shell) grants symlink rights.

### Slice S2.1: Unblock the environment and build

**Files:**
- Create: `docs/plans/evidence/S2.1-pack-win.txt`

- [x] **Step 1: Check whether Developer Mode is enabled**

```powershell
Get-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock' -Name AllowDevelopmentWithoutDevLicense -ErrorAction SilentlyContinue
```
`AllowDevelopmentWithoutDevLicense = 1` → enabled, go to Step 3. Otherwise Step 2.

- [x] **Step 2 (BLOCKING — needs the user or an elevated shell):** Enable Developer Mode — user toggled it via `ms-settings:developers` 2026-07-26 (recorded in evidence file)

This cannot be done from an unelevated agent shell. Ask the user to either run
`start ms-settings:developers` and toggle **Developer Mode** on, or provide an elevated
(Run-as-Administrator) terminal for the build. Record which path was taken in the evidence file.
If the user is unavailable, END THE SESSION cleanly via §0.3 with NEXT ACTION = "S2.1 Step 2 (user
action required: enable Windows Developer Mode)". That is a valid handoff.

- [x] **Step 3: Build** *(actual output dir: `build\output\`, per project config — not `dist\`)*

```powershell
cmd /c "cd /d E:\api\rwanga\rwanga-editor && npm run pack:win > E:\api\rwanga\docs\plans\evidence\S2.1-pack-win.txt 2>&1"
```
Expected: exit 0; a `.exe` installer under `rwanga-editor\dist\` (electron-builder default output).
If it still fails on winCodeSign after Dev Mode: delete the stale cache
`Remove-Item -Recurse -Force "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign"` and retry once;
a different error class = new gap row + escalate.

- [x] **Step 4: SLICE CLOSE RITUAL (§0.3)**

Commit message: `build(editor): pack:win succeeds under Dev Mode — installer produced (LR-01, S2.1)`
(Note: `dist/` output itself is NOT committed.)

### Slice S2.2: Install, smoke, flip LR-01

**Files:**
- Create: `docs/plans/evidence/S2.2-installer-smoke.md`
- Modify: `docs/RWANGA_IDE_LAUNCH_CHECKLIST.md` (LR-01 row)

- [x] **Step 1: Confirm the signing decision with the user** (Decision #2 in Global Constraints — unsigned OK for now?) — user accepted unsigned, 2026-07-26

- [x] **Step 2: Install and smoke the packaged app (the .exe, NOT `npm start`)** — silent install; user ran the 5-item smoke by hand: 5/5 PASS (GAP-2-1 + GAP-2-2 ticketed, non-blocking)

Run the installer from `rwanga-editor\dist\`. Launch the installed app. Perform and record in
`S2.2-installer-smoke.md`: (a) app opens to a usable editor; (b) File → New, type a scene heading +
action + dialogue; (c) Save to `%USERPROFILE%\Documents\smoke.rga`; (d) close app, relaunch, File →
Open recent `smoke.rga` → content intact; (e) Print Preview opens. Verdict per item: PASS/FAIL.
Any FAIL → gap row + escalate per §0.2 (packaged-app-only failures are exactly what this smoke exists to catch).

- [x] **Step 3: Flip LR-01** — status → TRUE; evidence note → `installer built (Dev Mode) + installed-app smoke 5/5 PASS, see docs/plans/evidence/S2.2-installer-smoke.md; signing deferred by decision <date>`.

- [x] **Step 4: SLICE CLOSE RITUAL (§0.3)** — status delta: `LR-01 UNKNOWN→TRUE`

Commit message: `build(editor): installed-app smoke passes — LR-01 flipped TRUE (S2.2)`

---

## Phase 3 — Lifecycle QA (PF-01, PF-02, PF-03, PF-05, PF-13)

### Slice S3.1: PF-01 cold-start launch matrix

**Files:**
- Create: `docs/plans/evidence/S3.1-launch-matrix.md`
- Modify: `docs/RWANGA_IDE_LAUNCH_CHECKLIST.md` (PF-01 row)

- [x] **Step 1: Resolve Decision #1 (macOS scope) with the user.** DECIDED 2026-07-26: macOS stays in
      scope; user provides a Mac when needed (see Global Constraints Decision #1). PF-01 sits at
      PARTIAL until the macOS matrix runs.

- [x] **Step 2: Run the Windows launch matrix on the INSTALLED app** — record each in the evidence file:
      10 consecutive cold starts (close fully between launches; measure roughly time-to-editor);
      1 launch immediately after reboot; 1 launch with a `.rga` double-clicked from Explorer (file
      association) if registered — if no association, note it as observed behavior, not a failure;
      1 launch while another instance is already running (expect: no data corruption — second instance
      or focus-existing are both acceptable, record which).
      Expected: 13/13 reach a usable editor with no error dialog.

- [x] **Step 3: Flip PF-01** (TRUE with evidence pointer, or PARTIAL + gap row if any launch failed).
      Done 2026-07-27: **13/13 PASS, 0 failures** → PF-01 row updated to PARTIAL **(Windows-verified)**
      with the evidence pointer. Not TRUE only because the row spans macOS (Decision #1 keeps it in
      scope, Mac arrives later); no gap row — nothing failed.

- [x] **Step 4: SLICE CLOSE RITUAL (§0.3)**

Commit message: `qa(editor): PF-01 cold-start launch matrix recorded — <verdict> (S3.1)`

### Slice S3.2: PF-02/03/05 lifecycle E2E specs

**Files:**
- Create: `rwanga-editor/tests/e2e/lifecycle/new-save-reopen.spec.js`
- Create: `rwanga-editor/tests/e2e/lifecycle/open-from-disk.spec.js`
- Create: `rwanga-editor/tests/e2e/lifecycle/save-as-path-change.spec.js`
- Modify: `docs/RWANGA_IDE_LAUNCH_CHECKLIST.md` (PF-02, PF-03, PF-05 rows)

**Interfaces:**
- Consumes: `Rga.FileManager = { newScript, openFromDialog, openFromContent, openRecent, getRecent, save, saveAs, setActive, getActive, notifyTitle }` (`renderer/js/file-manager.js:154`); `Rga.Doc.serialize(doc)`; `Rga.TabManager.activeDoc()`. The Playwright-Electron launch harness pattern lives in `tests/e2e/filmustageation/print-contract.spec.js:21-46` (`launchAndOpen`, `clearDirtyAndClose`) — copy it, don't re-invent it.
- Produces: three green specs cited as PF-02/03/05 evidence.

- [x] **Step 1: Discover the dialog-free save path** — SEAM CHOSEN (2026-07-27): stub
      `dialog.showSaveDialog` / `dialog.showOpenDialog` in the MAIN process via
      `app.evaluate(({ dialog }) => …)`, the idiom already used by
      `tests/integration/atomic-save.spec.js`. This is stronger than the skeleton's
      `doc.handle = p`: the REAL user path runs end to end (`saveAs()` → IPC
      `files.pickSaveAs` → `writeFileAtomic` → `Doc.rebindHandle` → `Doc.clearDirty`;
      `openFromDialog()` → IPC `files.pickOpen` → `Doc.deserialize`). Handle-bound
      `save()` is dialog-free by nature (`file-manager.js:66-91`). Gotcha recorded in
      each spec: `save()` reads the module-local `activeDoc` set by TabManager on tab
      activation (`tab-manager.js:148`), so specs wait on `FileManager.getActive()` first.

Native dialogs can't be driven by Playwright. Read `renderer/js/file-manager.js` (whole file) and the
preload/IPC bridge it calls (grep `electron/` for the channel names you find). Identify how to give a
doc a handle without a dialog — candidates visible in code: `openFromContent(handle, content)` sets a
handle on open; `save()` writes via IPC when `activeDoc.handle` exists (`file-manager.js:72-87`).
Record the chosen seam as a comment block at the top of each spec.

- [x] **Step 2: Write the three specs (failing first is satisfied by writing against the real app — run to see them fail only if the flow is actually broken; these are verification tests)**
      Written 2026-07-27 against the Step-1 seam (dialogs stubbed, real IPC path), not the
      `doc.handle` shortcut in the skeleton below. PF-02 reopens in a SECOND app instance with a
      fresh userData dir, so the assertion proves the bytes on disk — not renderer memory.
      PF-03/PF-05 use a temp COPY of `mysterious-guest-rtl.rga` instead of the repo fixture
      (§0.2 fixture law — that fixture is `rga_version` 3.0 and would auto-migrate on open).

`new-save-reopen.spec.js` — the skeleton (adapt the launch helper verbatim from print-contract.spec.js):

```js
// PF-02: new → type → save → reopen — content survives the round trip.
'use strict';
const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path'); const os = require('os'); const fs = require('fs');
const APP_ROOT = path.resolve(__dirname, '..', '..', '..');

test('PF-02 — new document round-trips through disk', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pf02-'));
  const savePath = path.join(userDataDir, 'pf02-roundtrip.rga');
  const app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const page = await app.firstWindow();
  await page.waitForFunction(() => !!(window.Rga && window.Rga.FileManager && window.Rga.TabManager
    && window.Rga.TabManager.activeDoc && window.Rga.TabManager.activeDoc()));
  // 1. new script + type into it via the editor view (real key events, not doc mutation)
  await page.evaluate(() => window.Rga.FileManager.newScript());
  await page.keyboard.type('INT. KITCHEN - NIGHT');
  await page.keyboard.press('Enter');
  await page.keyboard.type('A kettle whistles.');
  // 2. give the doc a handle, save without a dialog (seam confirmed in Step 1)
  const written = await page.evaluate(async (p) => {
    const doc = window.Rga.TabManager.activeDoc();
    doc.handle = p;                        // adjust to the Step-1 seam if handle is set differently
    return await window.Rga.FileManager.save();
  }, savePath);
  expect(fs.existsSync(savePath)).toBe(true);
  // 3. reopen from disk content and compare
  const content = fs.readFileSync(savePath, 'utf8');
  const roundTripped = await page.evaluate((args) => {
    window.Rga.FileManager.openFromContent(args.p, args.c);
    const doc = window.Rga.TabManager.activeDoc();
    return window.Rga.Doc.serialize(doc);
  }, { p: savePath, c: content });
  expect(roundTripped).toContain('KITCHEN');
  expect(roundTripped).toContain('kettle');
  await app.close();
});
```

`open-from-disk.spec.js` (PF-03): launch → `openFromContent(fixturePath, fs.readFileSync(fixture))`
with `tests/fixtures/mysterious-guest-rtl.rga` → assert `activeDoc()` scene count > 0 via
`window.Rga.Screenplay.Memory` and title bar/tab reflects the file name (`getActive()`), and that the
fixture file on disk is byte-identical after the session (no auto-migration write-back).

`save-as-path-change.spec.js` (PF-05): open fixture content under handle A (temp copy) → change one
line → set handle B (different directory) via the Step-1 seam → `save()` → assert file B exists with
the edit, file A unchanged, and `getActive()`/recent list now point at B.

- [x] **Step 3: Run them** — **3/3 PASS** first run (22.0 s / 4.8 s / 5.6 s); re-confirmed 3/3 on a
      cleaned machine. Evidence: `docs/plans/evidence/S3.2-lifecycle-e2e.md`.

```powershell
cmd /c "cd /d E:\api\rwanga\rwanga-editor && npm run build:renderer && npx playwright test tests/e2e/lifecycle --config=tests/integration/playwright.config.js"
```
Expected: 3/3 pass. A failure here is potentially a REAL lifecycle defect → §0.2 escalation.

- [x] **Step 4: Full e2e regression** — `npm run test:e2e`; expected: no new failures vs before this slice.
      RAN: **326 passed · 37 failed** (1.2 h); the three new specs are NOT among the failures.
      **No e2e baseline has ever been recorded** (the campaign's baseline is the UNIT suite), so
      "no new failures" was proven by measurement instead: (a) the failing specs run **alone**, with
      this slice's files absent, fail identically (7 failed / 6 passed); (b) after clearing 17
      orphaned Electron processes, lifecycle is 3/3 and the same specs still fail. Signature:
      `afterEach` `app.close()` 60 s timeout — **test bodies pass, the app will not quit**.
      Pre-existing and out of frozen scope → **GAP-3-3**. Full analysis in
      `docs/plans/evidence/S3.2-lifecycle-e2e.md`.

- [x] **Step 5: Flip PF-02, PF-03, PF-05** (evidence: the three spec names + green run). Done — all
      three PARTIAL→TRUE with per-row evidence notes in `docs/RWANGA_IDE_LAUNCH_CHECKLIST.md`.

- [x] **Step 6: SLICE CLOSE RITUAL (§0.3)** — status deltas: `PF-02/03/05 PARTIAL→TRUE`

Commit message: `test(editor): lifecycle E2E — new/open/save-as round-trips proven (PF-02/03/05, S3.2)`

### Slice S3.3: PF-13 clean-console audit

**Files:**
- Create: `docs/plans/evidence/S3.3-console-audit.md`
- Modify: `docs/RWANGA_IDE_LAUNCH_CHECKLIST.md` (PF-13 row)

- [ ] **Step 1: Scripted audit via Playwright console capture** — write a throwaway audit spec (do not
      commit it into the suite; keep it under `docs/plans/evidence/` as `S3.3-audit.spec.js` and point
      Playwright at it explicitly). It launches the app, subscribes `page.on('console')` +
      `page.on('pageerror')`, then walks the core flows: new → type all 6 block types → save →
      reopen → Print Preview open/close → Page Setup change → undo/redo ×5 → close. Assert zero
      `error`-level console messages; record every `warning` verbatim in the evidence file.
- [ ] **Step 2: Verdict** — 0 errors → flip PF-13 TRUE (UNKNOWN→TRUE). Any error → gap row per §0.2,
      PF-13 stays open, evidence file documents each error with its trigger.
- [ ] **Step 3: SLICE CLOSE RITUAL (§0.3)**

Commit message: `qa(editor): PF-13 console audit across core flows — <verdict> (S3.3)`

---

## Phase 4 — RTL visual + bidi QA ⭐ (RTL-04…13, SW-23) — highest product value

**Judging standard for every verdict in this phase:**
`rwanga-editor/docs/Filmustageation/redesign_campaign/RTL_SCREENPLAY_CONVENTION.md` (the ratified
Kurdish/RTL profile). Supporting audits already exist — read before starting:
`rwanga-editor/docs/Filmustageation/RTL_PRINT_PREVIEW_FORENSIC_AUDIT.md`,
`rwanga-editor/docs/Filmustageation/RTL_SCREENPLAY_DESIGNER_BRIEF.md`.

### Slice S4.1: Fixture + checklist prep

**Files:**
- Create: `docs/plans/evidence/S4.1-rtl-qa-protocol.md`

- [ ] **Step 1: Build the QA protocol document.** From RTL_SCREENPLAY_CONVENTION.md, extract into
      `S4.1-rtl-qa-protocol.md` one table row per checklist ID (RTL-04…RTL-13, SW-23) with: the exact
      convention rule (quoted), the fixture/scene that exercises it, and the pass criterion (measurable —
      e.g. "dialogue block right edge at X from page right edge ±1mm", not "looks right").
      Primary fixture: `tests/fixtures/mysterious-guest-rtl.rga` (open a COPY under `%TEMP%` — never the
      tracked fixture, see §0.2). Where the fixture lacks a case (mixed-script line, bidi punctuation,
      all 6 block types in RTL), script the additions to type during QA and list them in the protocol.
- [ ] **Step 2: SLICE CLOSE RITUAL (§0.3)**

Commit message: `qa(editor): RTL QA protocol — per-ID criteria extracted from ratified profile (S4.1)`

### Slice S4.2: Editor alignment sweep (RTL-04…RTL-09)

**Files:**
- Create: `docs/plans/evidence/S4.2-rtl-alignment.md` + one screenshot per ID (`S4.2-rtl-0X-<element>.png`)
- Modify: `docs/RWANGA_IDE_LAUNCH_CHECKLIST.md` (rows RTL-04…RTL-09)

- [ ] **Step 1:** In the installed app, open the temp copy of the RTL fixture. For each of: action
      (RTL-04), dialogue (RTL-05), character (RTL-06), parenthetical (RTL-07), transition (RTL-08),
      scene heading (RTL-09) — verify against the S4.1 criterion, screenshot, record verdict.
      RTL-09 note: checklist cites a known slug-in-action-block mapping bug via SW-08, but the handoff
      lists "RTL scene-heading map" as TRUE/test-backed — verify visually and trust what you see; if
      correct, note the stale cross-reference in the evidence file.
- [ ] **Step 2:** Flip each ID that passes (PARTIAL→TRUE, evidence = screenshot + protocol row).
      Failures → gap rows; the ID stays PARTIAL with the gap cited.
- [ ] **Step 3: SLICE CLOSE RITUAL (§0.3)**

Commit message: `qa(editor): RTL alignment sweep RTL-04..09 — <n>/6 TRUE (S4.2)`

### Slice S4.3: RTL Print Preview + PDF export (RTL-10, RTL-11)

**Files:**
- Create: `docs/plans/evidence/S4.3-rtl-print-pdf.md` + screenshots + the exported PDF
- Modify: `docs/RWANGA_IDE_LAUNCH_CHECKLIST.md` (RTL-10, RTL-11)

- [ ] **Step 1 (RTL-10):** Print Preview on the RTL fixture: every page visually correct, RTL block
      mirror per convention, **no clipped glyphs** (the checklist's known `overflow:hidden` concern —
      inspect line ends and page edges specifically; the Print-Truth-Unification work may have already
      fixed this: cross-check `rwanga-editor/docs/Filmustageation/redesign_campaign/PRINT_TRUTH_DOCTRINE_V1.md`).
- [ ] **Step 2 (RTL-11):** Export the fixture to PDF (checklist note "blocked" is stale — export works).
      Open the PDF: direction preserved, glyph shaping correct (no disconnected Arabic-script letters),
      page count matches Print Preview. Keep the PDF as evidence.
- [ ] **Step 3:** Flip / gap per verdict. **Step 4: SLICE CLOSE RITUAL (§0.3)**

Commit message: `qa(editor): RTL print preview + PDF export verified — <verdict> (RTL-10/11, S4.3)`

### Slice S4.4: Bidi audit (RTL-12, RTL-13)

**Files:**
- Create: `docs/plans/evidence/S4.4-bidi-audit.md` + screenshots
- Modify: `docs/RWANGA_IDE_LAUNCH_CHECKLIST.md` (RTL-12, RTL-13)

- [ ] **Step 1:** Using the S4.1 protocol's mixed-script cases, type into an RTL doc: a Kurdish action
      line containing a Latin name; a dialogue line with an English phrase mid-sentence; lines ending
      in `.` `!` `?` `:` and quotes around Latin runs; numbers (digits) inside RTL sentences. Verify in
      editor AND Print Preview: reading order sane, punctuation sits at the correct visual end, no
      mirrored/jumping brackets. Screenshot each case.
- [ ] **Step 2:** Flip RTL-12/13 (UNKNOWN→TRUE) or gap rows. **Step 3: SLICE CLOSE RITUAL (§0.3)**

Commit message: `qa(editor): bidi audit — mixed-script + punctuation <verdict> (RTL-12/13, S4.4)`

### Slice S4.5: SW-23 roll-up + phase close

**Files:**
- Create: `docs/plans/evidence/S4.5-sw23-verdict.md`
- Modify: `docs/RWANGA_IDE_LAUNCH_CHECKLIST.md` (SW-23)

- [ ] **Step 1:** SW-23 = "RTL profile drives correct RTL conventions" — it is the conjunction of
      S4.2–S4.4. Write the one-page verdict: table of RTL-04…13 outcomes, plus one check that the
      *profile switch itself* drives it (create a NEW doc with the Kurdish/RTL profile → confirm
      direction + conventions apply without manual tweaking).
- [ ] **Step 2:** Flip SW-23 if all inputs TRUE; else it stays PARTIAL citing the open gap rows.
- [ ] **Step 3: SLICE CLOSE RITUAL (§0.3)** — this checkpoint should list every RTL status delta.

Commit message: `qa(editor): SW-23 RTL convention verdict — phase 4 closed (S4.5)`

---

## Phase 5 — Page-geometry QA (MT-02/04/05/06/07/10, PP-01/03, SW-01)

**Risk note:** unlike phases 3–4, two rows here carry *measured* adverse evidence
(MT-07 "overflow 5 of 6", MT-10 "budget ~0.74× off"). Expect S5.2 to surface fix work. That does not
break the "no features" doctrine — bounded correctness fixes to make a P0 TRUE are launch work; follow
superpowers:systematic-debugging + TDD for any fix, in its own gap-slice.

### Slice S5.1: Paper sizes + margins (MT-05, MT-06, PP-01, PP-03)

**Files:**
- Create: `docs/plans/evidence/S5.1-sizes-margins.md` + screenshots
- Modify: checklist rows MT-05, MT-06, PP-01, PP-03

- [ ] **Step 1:** For each size (A4, Letter, Legal): set it in Page Setup → measure in Print Preview
      that the page box matches the physical ratio (A4 210:297, Letter 8.5:11, Legal 8.5:14 — measure
      the rendered px box) and that content reflows. Export one PDF per size and check the PDF page
      dimensions (open PDF properties, or `npx` a one-liner with the repo's `pdf-parse` dependency).
- [ ] **Step 2:** Margins: change top/bottom/left/right one at a time by a large delta (e.g. +20mm) →
      measure the rendered content-box shift in Print Preview matches the delta direction and rough
      magnitude; restore defaults after.
- [ ] **Step 3:** Flip the four rows per verdicts. **Step 4: SLICE CLOSE RITUAL (§0.3)**

Commit message: `qa(editor): paper sizes + margins verified render-correct — <verdict> (S5.1)`

### Slice S5.2: Bottom-margin overflow + empty-line budget (MT-07, MT-10)

**Files:**
- Create: `docs/plans/evidence/S5.2-overflow-budget.md`
- Modify: checklist rows MT-07, MT-10 (and possibly fix slices spawned)

- [ ] **Step 1: Re-run the density probe honestly.** Find the prior probe (grep
      `rwanga-editor/tests` and `docs/` for `density probe` / `overflow`) and re-execute the same
      scenario at today's HEAD: a page filled to the boundary — does the last line cross the bottom
      margin? Repeat with the 6 historical cases if documented. Record per-case PASS/FAIL.
- [ ] **Step 2: Empty-line budget check (MT-10):** page with N empty paragraphs interleaved — compare
      budgeted vs rendered height (the historical figure was 0.74×). Record the measured ratio.
- [ ] **Step 3: Verdict fork.** Both clean → flip TRUE. Defects reproduce → gap rows `GAP-5-*` with the
      measured numbers; each gets its own fix-slice (systematic-debugging + a failing unit test first —
      the pagination suites under `tests/unit/` are the home); after the fix lands green, re-run Step 1/2
      and flip.
- [ ] **Step 4: SLICE CLOSE RITUAL (§0.3)**

Commit message: `qa(editor): bottom-margin + empty-line budget probes — <verdict> (MT-07/10, S5.2)`

### Slice S5.3: Marker stability, heading edit, PDF page count (MT-02, SW-01, MT-04)

**Files:**
- Create: `docs/plans/evidence/S5.3-stability.md`
- Modify: checklist rows MT-02, SW-01, MT-04

- [ ] **Step 1 (MT-02):** In a multi-page doc: note every page-marker position → insert a paragraph
      mid-page-1 → delete it → undo ×2 → redo ×2 → markers must return to the noted positions with no
      drift/duplication. Repeat across a save/reopen.
- [ ] **Step 2 (SW-01):** Insert a scene heading mid-document (LTR and RTL docs); edit its text;
      confirm it stays a heading block, navigator updates, numbering stays consistent.
- [ ] **Step 3 (MT-04):** Export the multi-page doc to PDF → PDF page count == Print Preview page
      count == paper-size-appropriate. (Checklist "blocked" note is stale.)
- [ ] **Step 4:** Flip per verdicts. **Step 5: SLICE CLOSE RITUAL (§0.3)**

Commit message: `qa(editor): marker stability + heading edit + PDF page count — <verdict> (S5.3)`

---

## Phase 6 — Roll-up

### Slice S6.1: Reconcile, flip QG-12, declare the launch gate closed

**Files:**
- Modify: `docs/RWANGA_IDE_LAUNCH_CHECKLIST.md` (QG-12 + final count line)
- Modify: `docs/handoff/HANDOFF.md` (phase change: Stage 1 → Stage 2)
- Create: `docs/plans/evidence/S6.1-launch-gate-closed.md`

- [ ] **Step 1: Full reconciliation pass.** Walk every P0 row in the checklist: each must be TRUE with
      an evidence pointer, or explicitly descoped by a recorded user decision, or carried by an open
      gap row (in which case the gate is NOT closed — the gap's fix-slice is the NEXT ACTION instead).
- [ ] **Step 2: Fresh full verification run** — `npm run test:unit` (0 fail) + `npm run test:e2e`
      (0 fail) at final HEAD, captured to the evidence file, plus the P0 tally (target: 60 TRUE −
      descopes).
- [ ] **Step 3: Flip QG-12** TRUE with the tally as evidence.
- [ ] **Step 4: Rewrite HANDOFF.md for Stage 2:** phase → "Stage 2 — Make the memory writable + visible";
      NEXT ACTION → "Design review of the Rga.Contribution write-API brief (SP.1 output) → then
      VISION-1 breakdown-sheet render"; move launch items to Recently solved.
- [ ] **Step 5: SLICE CLOSE RITUAL (§0.3)** — the checkpoint here is the campaign's closing entry.

Commit message: `docs(editor): LAUNCH GATE CLOSED — QG-12 TRUE, Stage 1 complete (S6.1)`

---

## Track P (parallel, design-only — may run alongside any phase ≥ 1)

### Slice SP.1: `Rga.Contribution` write-API design brief

**Constraint:** WRITING ONLY. No code, no stubs, no schema edits — the gates forbid implementation
(GO_LIVE Part C). This is explicitly sanctioned by GO_LIVE Part D #5.

**Files:**
- Create: `rwanga-editor/docs/Filmustageation/RGA_CONTRIBUTION_API_BRIEF.md`

- [ ] **Step 1: Ground the brief in the audited seams.** Read: `renderer/js/doc-types/screenplay/memory.js`
      (the read-side to mirror), `renderer/js/scene-catalog.js`, the tag-write seams GO_LIVE B.3 #2
      names (`tags.applyTag`, `doc.addEntity`, `scene.attrs.metadata.references[]`), and
      `renderer/js/platform.js` (the boundary it must live behind).
- [ ] **Step 2: Write the brief** covering, at minimum: namespace + method surface
      (`Rga.Contribution.*` — proposed signatures with param/return types); write-kinds (tag, alias,
      confirmed reference, insight, scene note/flag) and their `.rga` v5.x persistence; provenance model
      (who wrote it: user vs agent vs tier, confidence); undo/history integration (ProseMirror
      transactions vs registry writes); conflict rules (agent write vs concurrent user edit); validation
      + rejection semantics; versioning/migration; what Stage 3's harness consumes. Include a "explicitly
      NOT in v1" list (YAGNI).
- [ ] **Step 3: SLICE CLOSE RITUAL (§0.3)** — HANDOFF Open cases: VISION-2 gains "design brief written,
      pending review".

Commit message: `docs(editor): Rga.Contribution write-API design brief (VISION-2 prerequisite, SP.1)`

---

## Execution order summary

```
S0.1 → S1.1 → S1.2 → S1.3 → S1.4 → S1.5 → S2.1 → S2.2 → S3.1 → S3.2 → S3.3
     → S4.1 → S4.2 → S4.3 → S4.4 → S4.5 → S5.1 → S5.2 → S5.3 → S6.1
SP.1 may interleave anywhere after S0.1 (it is pure writing, zero code risk).
Gap fix-slices are inserted immediately after the slice that surfaced them, before the next phase.
```
