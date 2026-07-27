---
description: Operate the Rwanga editor case (Stage-1 launch-gate masterplan) by its slice ledger. Modes — start (default) · end/handoff · status.
---

# /rwanga — the Rwanga Editor case command

**Territory (focus lock):** the repo `E:\api\rwanga` on branch `main` — this is the **git root and the
production tree of its OWN repo**. The editor lives in the subfolder `E:\api\rwanga\rwanga-editor\`
(all `npm` commands run from there; all `git` commands run from `E:\api\rwanga\`). The `rwanga-*`
Django folders are the platform — touch them only when a slice says so. **This case has NOTHING to do
with the hud2 ERP**; `E:\api\hud2` and its `main` are another project's property and are off-limits.

**The machine (five artifacts, already built):**
| Artifact | Path |
|---|---|
| Master plan + slice ledger | `E:\api\rwanga\docs\plans\2026-07-02-stage1-launch-gate-masterplan.md` |
| The board / front door | `E:\api\rwanga\docs\handoff\HANDOFF.md` |
| Append-only history | `E:\api\rwanga\docs\handoff\CHECKPOINTS.md` (never read at START) |
| Maintenance rules | `E:\api\rwanga\docs\handoff\PROTOCOL.md` (read once, reference only) |
| Status of record | `E:\api\rwanga\docs\RWANGA_IDE_LAUNCH_CHECKLIST.md` (open per-row, never whole) |

**Mode from `$ARGUMENTS`:** empty / `start` / `continue` → **START** · `end` / `handoff` /
`close` → **END** · `status` → **STATUS**.

---

## Session hygiene rules (all modes) — Darya's standing laws

### Rule 1 — Clear context between UNRELATED board tasks
When a slice box is `[x]`/`✅` and the **next** step is **not related** (different files/scope, no
carried context), run the END-mode close (§0.3 ritual + commit + push) so the next `/rwanga start`
reopens lean. **Exception:** if the next step **is related** (shared files, continuity, builds on what
was just done), keep the context. Relatedness = does the next step need the working memory this one built.

### Rule 2 — Blocked on Darya → STOP and wait (NEVER arm a timer)
When blocked waiting on Darya (a decision, an elevated shell, a reboot, a physical smoke test, a live
walk): **STOP and wait silently.** Do **NOT** arm any `ScheduleWakeup`, `/loop`, cron, or timer of any
kind — a self-firing wakeup re-invokes this command behind Darya's back and can fire long after the
shop is closed (the bug Darya killed 2026-07-09). There is no auto-close: an idle session costs
nothing. It resumes when Darya replies, or closes when he types `end`/`handoff`. Never spin, never
re-ask, never schedule a fallback. Masterplan §0 calls this "blocked ≠ stuck" — a clean close whose
NEXT ACTION names the exact blocking step is a VALID handoff; improvising around the block is not.

### Rule 3 — Context ~60–70% used → close & restart
At ~60–70% context-window usage: dispatch nothing new, drain in-flight workers, run END mode, restart
fresh. Never close pre-emptively on a PREDICTION ("the next slice looks big") — heavy work goes to
workers with their own windows, so it cannot blow yours.

### Rule 4 — Worker model routing (every dispatch sets `model` EXPLICITLY)
`haiku` = doc-reading / research / scouting · `sonnet` = code building / fixing / test-writing ·
`opus` = two-stage reviews, quality gates, approvals. The orchestrator stays on the session's model.
**Every brief carries THE MONITOR BAN verbatim:** "Run every test/command FOREGROUND and BLOCKING.
Never wait on a 'monitor', task notification, or background watcher — none exists for you. When your
last command returns, report and exit."

### Rule 5 — Scope freeze (masterplan §0.2 "escalate, don't paper over")
The active slice's scope froze when it opened. A QA finding that is real product breakage becomes a
**`GAP-<phase>-<n>` row in the masterplan §0.5 gap ledger + an Open case in HANDOFF.md**, owned by a
FUTURE fix-slice. It enters the ACTIVE slice only if it BLOCKS that slice, or if Darya rules it P0.
**Weakening, quarantining, or deleting a test to get green is forbidden.**

### Rule 6 — The board stays lean
`HANDOFF.md` is an INDEX, not a report — keep it short, link detail into `docs/…`. History goes to
`CHECKPOINTS.md` (newest at top), which is **never on the START read list**. The masterplan's §0.5
State Ledger is the campaign dashboard; long-form evidence lives in `docs/plans/evidence/`.

### Rule 7 — THE PRODUCTION LAW (Darya, 2026-07-15) — SEPARATE-REPO variant
`E:\api\rwanga` is its **own** repo; its production is its own `main`, which is also where this
campaign is executed. Consequences: (1) never `git checkout`/`git switch` a tree out from under
yourself — if a slice needs a branch, it says so and gets its own worktree; (2) `E:\api\hud2` (the
ERP production tree) is **off-limits to this case entirely** — never commit, merge, or read-modify
there; (3) **push every slice-close commit** (`git -C E:\api\rwanga push`) — masterplan §0.3 step 6:
cross-session survival includes surviving this machine.

### Rule 8 — THE FIXTURE LAW (case-specific, masterplan §0.2 — it has bitten twice)
**Never commit `rwanga-editor/tests/fixtures/*.rga`.** A running Electron instance auto-migrates any
fixture it opens and dirties the tree (this is what inflated 30 reds to 36). **Before every commit**
run `git -C E:\api\rwanga status`; if fixtures are modified:
`git -C E:\api\rwanga checkout -- rwanga-editor/tests/fixtures/*.rga`.

### Rule 9 — THE GATES STAY SHUT
No AI / Agent-harness **code** anywhere in this campaign — the launch gate (every launch-checklist P0
TRUE) and the Alive-App Phase 2 gate are both still open. Track SP.1 is **design writing only**; an
agent writing `Rga.Contribution` code during Stage 1 is violating doctrine, full stop.

---

## START

1. **Focus lock:** `git -C E:\api\rwanga status -sb` must show branch `main` and **no
   `rwanga-editor/tests/fixtures/*.rga` modifications**. If the branch is wrong, STOP and tell Darya
   before touching anything. If fixtures are dirty, revert them first (Rule 8) and **say so in your
   announcement** — never silently. If the line reads `[ahead N]`, a previous slice-close skipped
   §0.3 step 6: push it now and note it (Rule 7 — an unpushed slice-close doesn't survive this machine).
2. **Read, IN ORDER, and NOTHING else to orient** (the LEAN READ LIST):
   1. `E:\api\rwanga\docs\handoff\HANDOFF.md` — the board: NEXT ACTION · Gates · Open cases.
   2. `E:\api\rwanga\docs\plans\2026-07-02-stage1-launch-gate-masterplan.md` — the **head of the
      file through the Decisions block**: §0 survival protocol (§0.1–0.4) + the §0.5 State Ledger +
      gap ledger + Global constraints + "Decisions the user must make" (currently ~lines 1–135; if
      the head has grown, read to the first `## Phase` heading and stop).
   3. The **active slice's section** of that same file, named by HANDOFF's NEXT ACTION (e.g.
      "### Slice S3.2"). Its first unchecked `- [ ]` box is your next step. **To locate it you MAY
      run exactly one in-file heading search** (`Grep` for `^### Slice ` in that file) — that is not
      "exploring", it is an index lookup, and it is cheaper than reading the 756-line plan whole.
      Read that ONE section, not its neighbours.
   **Reconcile box vs prose before you act:** HANDOFF's NEXT ACTION may describe finer granularity
   than the checkboxes carry (e.g. "S3.1 item 13" when the slice has 4 boxes and the 13 items live
   inside one box's prose + the §0.5 Evidence column). The **ledger row + evidence file are the
   truth for partial progress**; never re-run work the Evidence column says is already recorded.
   Everything else — `RWANGA_GO_LIVE_2026-07-02.md`, `RWANGA_IDE_LAUNCH_CHECKLIST.md`,
   `PROTOCOL.md`, `CHECKPOINTS.md`, the `Filmustageation/` docs — is REFERENCE, opened per-task,
   never whole at START.
3. **ANNOUNCE position to Darya** in plain words: active phase · active slice ID · the exact next
   unchecked box and what you will do this session · any `🟡`/blocked row waiting on him. Then work
   the board.
4. **Work the slice, in order, one slice at a time.** Tick each `- [ ]` box **in the masterplan file
   itself** as you complete it — the checkboxes ARE the cross-session state. Never skip, reorder, or
   open slice N+1 while slice N's close ritual is unfinished. If you find a slice half-done without
   its ritual, **finish the ritual FIRST**.
5. **Evidence before flips** (§0.2/§0.4): no launch-checklist row changes status without a test name,
   a commit SHA, or a file under `docs/plans/evidence/` named `S<slice>-<short-name>.<ext>`. When you
   flip a P0, edit its row in `docs/RWANGA_IDE_LAUNCH_CHECKLIST.md` **in the same commit** (two
   masters stay in sync).
6. **HARD STOP on anything outside an agent's power** — an elevated/Dev-Mode shell, a reboot, a Mac,
   a certificate, a licence, a device, or a product decision: full stop, ask Darya, and create the
   physical sub-tasks together with him. Never mock, fake, or stub past a physical gate.
7. **INVALID STATE = STOP, never improvise.** If HANDOFF's NEXT ACTION contradicts the §0.5 ledger,
   or names a slice that has no section, or a slice step names a file that doesn't exist: STOP and
   tell Darya the machine is in an invalid state. Do **NOT** write yourself a plan or invent a slice.
8. If Darya says `end` / `handoff` at ANY point, switch to END mode immediately. **"Switch to END"
   means BEGIN the close sequence — it does NOT mean kill in-flight workers** (see END step 1).
9. **Context budget:** heavy lifting lives in WORKERS (fresh window each); the orchestrator stays lean.
   A filling orchestrator context is never a reason to kill or skip workers — the move is self-drain:
   dispatch nothing new, drain, run END.

**Commands** (from `E:\api\rwanga\rwanga-editor\`): `npm run test:unit` (node --test) ·
`npm run build:renderer && npm run test:e2e` (Playwright + real Electron) · `npm run pack:win`
(electron-builder; needs Dev Mode / elevated shell). Git runs from `E:\api\rwanga\`.
**Baseline truth:** clean-checkout unit suite is now **1936 · 0 fail · 1 skip** (S1.5, `90485776`) —
any red is a regression, not baseline noise. Commit style: `test(editor):` · `fix(editor):` ·
`build(editor):` · `docs(editor):` · `qa(editor):`.

## END (closing the shop — every step, in order, also on interrupt)

1. **Let running workers FINISH — `end` is LAST CALL, never a kill switch.** Acknowledge at once:
   "Last call — N workers in flight; nothing new dispatched; draining them, then closing." Wait for
   every in-flight worker to complete and report, then gate its result. A killed worker's task is
   re-done next session at full price; a draining worker costs almost nothing (its own context
   window). If one is genuinely hung, tell Darya and let HIM decide. **Hard stop only on the explicit
   words `end now` / `abort` / `kill`** — then mark each task `[~]`/`🟡` with exactly where it stopped.
2. **Stop your own work cleanly:** anything YOU have in flight stays unchecked, with one line in the
   slice text saying exactly where it stopped.
3. **Run the SLICE CLOSE RITUAL (masterplan §0.3) — all six steps, no exceptions:**
   1. Tick the slice's row in the §0.5 **State Ledger** (`⬜ → ✅`, or `🟡 <n>/<m>` if partial) and
      fill its Evidence column. Append any new `GAP-<phase>-<n>` rows to the gap ledger.
   2. Edit `docs\handoff\HANDOFF.md`: rewrite **⭐ NEXT ACTION** (next slice ID + one line, or the
      exact blocking step if blocked on Darya); update the Open-cases table and Gates counts if any
      status changed. Keep it an index, not a report.
   3. Append a checkpoint to `docs\handoff\CHECKPOINTS.md` (**newest at top**) with PROTOCOL.md's
      template — Did / Evidence / Status deltas / Gaps surfaced / Next action.
   4. **Fixture check (Rule 8):** `git -C E:\api\rwanga status` must show no
      `rwanga-editor/tests/fixtures/*.rga` modifications; revert any that appear.
   5. Commit everything together — plan ticks + evidence files + checklist flips + handoff +
      checkpoint — with the slice's commit message, **explicit paths only, never `git add -A`**.
   6. **Push:** `git -C E:\api\rwanga push`. A slice-close commit that isn't pushed doesn't survive
      this machine.
4. **Report to Darya in plain words** — what shipped, what flipped (with evidence), what's blocked on
   him and why, and the exact next step. Failures said plainly, nothing buried.

## STATUS

Read ONLY `E:\api\rwanga\docs\handoff\HANDOFF.md` and the **§0.5 State Ledger** section of the
masterplan. Report: phase · active slice · the exact next unchecked box · gate counts (P0s TRUE /
PARTIAL / UNKNOWN / FALSE) · any open `GAP-*` and anything waiting on Darya. **Change nothing.**
