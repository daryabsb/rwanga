# Rwanga — Living Handoff

> Read this first. It is the index of *where we are* and *what's next*. Do not read the case
> archive to find the next action — it's here. Update this file at the end of every unit of work
> (see `PROTOCOL.md`). Keep it short; link detail, don't inline it.

- **Last updated:** 2026-07-28 · by: S3.2F closed (GAP-3-3 fixed; first e2e baseline recorded)
- **Binding doctrine:** every agent MUST follow the 10-rule MASTERPLAN EXECUTION DOCTRINE in the
  root `CLAUDE.md` (one slice at a time · tick-as-you-go · §0.3 close ritual · push every slice commit).
- **HEAD:** `0e257f0d` (S3.2F — e2e quit-path fix + first e2e baseline) · **last slice-close:**
  `0e257f0d` · **Branch:** `main` · pushed. *(Update both SHAs at every §0.3 close.)*
- **Phase:** Stage 1 — Foundation (closing launch P0s). AI/Agent phase is **gated** (see Gates).

---

## ⭐ NEXT ACTION

**Start S4.1 — Phase 4 RTL QA prep (fixture + convention checklist).** Phase 4 is the highest-value
QA phase; judge every verdict against
`rwanga-editor/docs/Filmustageation/redesign_campaign/RTL_SCREENPLAY_CONVENTION.md`.
⚠ Two of GAP-3-4's reds are RTL scene-navigator failures — fold them into the Phase-4 sweep rather
than opening a separate slice.

**Phase 3 is COMPLETE** (S3.1 → S3.2 → S3.2F → S3.3 all closed):
launch matrix **13/13** · lifecycle specs **3/3** (PF-02/03/05 **TRUE**) · console audit **0 errors /
0 page errors** (PF-13 **TRUE**) · **GAP-3-3 CLOSED** — the e2e quit path is fixed and the campaign
has its **first recorded e2e baseline: 363 tests · 357 pass · 6 fail · 11.7 min** (was 326 pass /
37 fail / 1.2 h), zero teardown hangs, zero orphaned Electron processes.
Two new open cases came out of it: **GAP-3-4** (the 5 stable reds the baseline made visible) and
**GAP-3-5** (Ctrl+Shift+S claimed by both Save As and Scene Navigator — needs a user ruling).
Phases 1 & 2 COMPLETE (QG-01 TRUE, LR-01 TRUE — installer smoke 5/5).
⚠ A running Electron instance auto-migrates **any** fixture it opens — seen on
`playground-the-last-light.rga` (2026-07-26, twice) and `mysterious-guest-rtl.rga` (2026-07-27).
Check `git status` for fixture dirt before every commit; revert with
`git checkout -- rwanga-editor/tests/fixtures/`.

The whole launch-gate campaign is now a slice-by-slice executable plan with cross-session state:
**`../plans/2026-07-02-stage1-launch-gate-masterplan.md`** — read its §0 (survival protocol) first,
then work the first unchecked box of the active slice. Slice order:
S0.1 → S1.1…S1.5 (QG-01) → S2.x (LR-01 installer) → S3.x (lifecycle QA) → S4.x (RTL QA ⭐) →
S5.x (geometry QA) → S6.1 (QG-12 roll-up). Track SP.1 (Contribution-API design brief, writing only)
may interleave.

Background & rationale: **`../RWANGA_GO_LIVE_2026-07-02.md`** (Part A + Part D).

---

## Where we are (2-minute brief)

The editor is **~1–2 focused weeks of verification + packaging** away from being a launchable
RTL screenplay editor. **None** of the 23 open launch P0s is a feature to build — they are test
hygiene, an installer build, and QA sweeps. The launch checklist was **forensically verified honest
on 2026-07-02** (test numbers reproduce exactly; the "30 vs 36 reds" spin proven true).

Separately, the **Filmustageation AI vision is a much larger, later body of work.** The `.rga` is
agent-*readable* (a complete read-only Memory API) but **not agent-writable** — there is no
contribution/write API. That write API is the true technical prerequisite for the Agent harness.

---

## 🚦 Gates (why the AI/Agent harness cannot start yet)

1. **Launch gate** — no invention features until every launch-checklist **P0** is TRUE.
   Status: **38 TRUE · 17 PARTIAL · 4 UNKNOWN · 1 FALSE** (22 open; QG-01 + LR-01 TRUE 2026-07-26;
   PF-02/03/05 TRUE 2026-07-27; PF-13 TRUE 2026-07-28). See `../RWANGA_IDE_LAUNCH_CHECKLIST.md`.
2. **Alive-App Phase 2 gate** — "No AI feature implementation may start before this phase is visually
   verified." Status: **every box unchecked.** See `../RWANGA_IDE_ALIVE_APP_CHECKLIST.md`.
3. **Technical prerequisite** — `.rga` agent-write API does not exist (Vision Gap #2).

---

## Open cases / gaps

| ID | Case | Status | Pointer |
|---|---|---|---|
| GAP-3-1 | Compact mode hides Tags/Tools/Export/Help menus with no overflow → Settings has no menu route on laptops (root-caused: responsive thresholds + shell.css:2357) | OPEN — needs fix-slice | Masterplan §0.5 |
| GAP-3-2 | Settings workspace sticky-search band layering broken (row paints above band; rows clipped) — user-reported with screenshot; needs Playwright geometry diagnostic + fix | OPEN — needs fix-slice | Masterplan §0.5 |
| GAP-2-1 | Flow view: New doc opens with a dead band above the page that only shrinks as you type (user-reported, long-standing, finally ticketed 2026-07-26) | OPEN — needs fix-slice | Masterplan §0.5 |
| GAP-2-2 | Packaged app shares userData with dev app → restored dev session, auto-opened the playground fixture on first launch | OPEN — decide appId split before launch | Masterplan §0.5 |
| GAP-3-4 | The **5 stable e2e reds** left standing by the first recorded baseline, now that no teardown noise hides them: scene-navigator marks report zero directional indent (RTL *and* LTR control); Settings tab doesn't hide the toolbar; Settings nav rail `overflow:hidden` (same family as GAP-3-2 — fix together); Settings General rows drifted from the registry. Plus 2 load-flakes recorded, not adjusted | OPEN — needs triage slice (stale-test vs real defect) | Masterplan §0.5 |
| GAP-3-5 | **`Ctrl+Shift+S` is shipped as the default for BOTH "Save As" and "Scene Navigator"** — the registry is last-wins, so Scene Navigator takes the key and Save As has no working shortcut, while Settings still displays it. Two lesser collisions: Ctrl+Shift+E, Ctrl+Shift+F. Plus Electron's insecure-CSP warning to settle before launch | OPEN — needs a user ruling (which feature keeps which key) + a duplicate-defaults guard test | Masterplan §0.5 / `docs/plans/evidence/S3.3-console-audit.md` |
| PF-01 (macOS) | macOS launch matrix + `pack:mac` + smoke — the only half of PF-01 still open (Decision #1: Mac arrives later) | DEFERRED — needs hardware | Masterplan §0.5 / PF-01 row |
| RTL-04…13, SW-23 | RTL visual + bidi QA vs ratified Kurdish/RTL profile (**highest product value**) | OPEN — QA | GO_LIVE Part A.1 #4 |
| MT-02/04/05/06/07/10, PP-01/03, SW-01 | Page-geometry QA (sizes/margins/overflow) | OPEN — QA | GO_LIVE Part A.1 #5 |
| QG-12 | Roll-up "no known P0/P1 bugs" — flips when the above close | OPEN (auto) | Launch checklist §15 |
| VISION-1 | Breakdown sheets: data + UI stub exist, no JS renders them (~1–2 days) | OPEN (Stage 2) | GO_LIVE Part B.3 #1 |
| VISION-2 | **Agent contribution/write API** — `.rga` is read-only to agents (harness prerequisite) | OPEN (Stage 2) | GO_LIVE Part B.3 #2 / B.4 |
| VISION-3 | Stripboard / schedule / call sheets / reports — absent entirely | OPEN (Stage 3) | GO_LIVE Part B.3 #3 |
| VISION-4 | Mention recognizer / autocomplete (tier-1 deleted; tier-2/3 unbuilt) | OPEN (Stage 2/3) | GO_LIVE Part B.3 #4 |
| VISION-5 | Alias resolver + profile fields (schema-ready, unimplemented) | OPEN (Stage 2) | GO_LIVE Part B.3 #5 |

## Recently solved (verified)

| Case | Result | Evidence |
|---|---|---|
| QG-01 (30 test reds) | **TRUE — suite fully green** (1936 · 0 fail · 1 skip; zero quarantines; 1 real defect GAP-1-1 found & fixed) | `docs/plans/evidence/S1.1-qg01-triage.md` + `S1.5-green-run.txt`; commits `09382fd6`→`90485776` |
| LR-01 (installer) | **TRUE — built under Dev Mode + installed-app smoke 5/5 PASS** (unsigned accepted; signing deferred) | `docs/plans/evidence/S2.1-pack-win.txt` + `S2.2-installer-smoke.md` |
| PF-01 Windows launch matrix (S3.1) | **13/13 PASS · 0 failures** — 10/10 cold starts 1.1–1.6 s, post-reboot PASS, single-instance focus-existing, no `.rga` assoc (observed) | `docs/plans/evidence/S3.1-launch-matrix.md` |
| PF-13 clean console (S3.3) | **TRUE — 0 error-level console messages · 0 uncaught page errors** across 8 core flows (launch → new → all block types → save → reopen → Print Preview → Page Setup → undo/redo ×5). Typing, saving, reopening, page-setup and undo/redo are completely silent. Re-runnable audit spec, not a one-off observation | `docs/plans/evidence/S3.3-console-audit.md` + `S3.3-console-capture.json` |
| GAP-3-3 (e2e quit-path hangs) | **CLOSED — suite 1.2 h → 11.7 min, 37 reds → 6.** Two causes, both test hygiene, no product code touched: (a) the quit guard correctly waits for a human at the unsaved-changes modal, so `app.close()` never resolved — one shared `closeApp()` teardown across 60 specs / 124 sites; (b) force-kill specs killed only the main process, leaving Windows children holding Playwright's pipe — now kills the process tree. First e2e baseline recorded | `docs/plans/evidence/S3.2F-quit-path.md` + `S3.2F-e2e-baseline.txt` |
| PF-02/03/05 lifecycle round-trips (S3.2) | **TRUE — 3/3 specs green.** New→save→reopen proven across a second app instance; open-from-disk proven not to write the file back; Save As proven to re-point handle/name/origin/Recent | `docs/plans/evidence/S3.2-lifecycle-e2e.md` + `rwanga-editor/tests/e2e/lifecycle/*.spec.js` |
| Is the launch checklist honest/current? | **Yes — verified** | 3 latest commits are checklist-only; QG-01 = 1936/1899/36 reproduces; clean-fixture rerun = 40/40 → 30 reds all non-core |
| PP-D5 (RTL body-leading) | Closed (PP-16 TRUE) | Print-Truth-Unification; PTU-B 7/7 green (prior agent, 2026-06-10) |
| PDF export, RTL scene-heading map, persistence/recovery | TRUE, test-backed | in the 1899-pass unit set |

---

## The plan

- **Stage 1 (now):** close the launch gate — QG-01 → LR-01 → QA sweeps (RTL first) → QG-12. `../RWANGA_GO_LIVE_2026-07-02.md` Part A/D.
- **Stage 2 (bridge to AI):** breakdown-sheet render (VISION-1) + `Rga.Contribution` write API (VISION-2) + alias/profiles (VISION-5). Makes the `.rga` agent-writable portable memory.
- **Stage 3 (Filmustageation AI):** Agent harness on the platform seam + Filmustage-parity surfaces. GO_LIVE Part C.

*How to maintain this file: `PROTOCOL.md`. Checkpoint history: `CHECKPOINTS.md`.*
