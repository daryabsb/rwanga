# Rwanga — Living Handoff

> Read this first. It is the index of *where we are* and *what's next*. Do not read the case
> archive to find the next action — it's here. Update this file at the end of every unit of work
> (see `PROTOCOL.md`). Keep it short; link detail, don't inline it.

- **Last updated:** 2026-07-26 · by: S1.1 execution (QG-01 triage)
- **Binding doctrine:** every agent MUST follow the 10-rule MASTERPLAN EXECUTION DOCTRINE in the
  root `CLAUDE.md` (one slice at a time · tick-as-you-go · §0.3 close ritual · push every slice commit).
- **HEAD:** see latest commit on `main` (S0.1 slice-close) · **Branch:** `main`
- **Phase:** Stage 1 — Foundation (closing launch P0s). AI/Agent phase is **gated** (see Gates).

---

## ⭐ NEXT ACTION

**Execute masterplan slice S1.2** — re-point the 27 Class-A stale tests per the triage table
(`docs/plans/evidence/S1.1-qg01-triage.md`). S1.1 verdict: **27 A · 0 B · 2 C(i) · 1 D**.
Notable: the parenthetical trio is A, not B (fix shipped in Density Slice 6; only the `declIn()`
test-helper regex predates R1's logical-property rename) → S1.3 closes as a no-op. The 1 Class D
is **GAP-1-1** (DOM-read-as-truth at `settings-workspace.js:522`) — fix-slice before S1.5.

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
RTL screenplay editor. **None** of the 28 open launch P0s is a feature to build — they are test
hygiene, an installer build, and QA sweeps. The launch checklist was **forensically verified honest
on 2026-07-02** (test numbers reproduce exactly; the "30 vs 36 reds" spin proven true).

Separately, the **Filmustageation AI vision is a much larger, later body of work.** The `.rga` is
agent-*readable* (a complete read-only Memory API) but **not agent-writable** — there is no
contribution/write API. That write API is the true technical prerequisite for the Agent harness.

---

## 🚦 Gates (why the AI/Agent harness cannot start yet)

1. **Launch gate** — no invention features until every launch-checklist **P0** is TRUE.
   Status: **32 TRUE · 21 PARTIAL · 6 UNKNOWN · 1 FALSE** (28 open). See `../RWANGA_IDE_LAUNCH_CHECKLIST.md`.
2. **Alive-App Phase 2 gate** — "No AI feature implementation may start before this phase is visually
   verified." Status: **every box unchecked.** See `../RWANGA_IDE_ALIVE_APP_CHECKLIST.md`.
3. **Technical prerequisite** — `.rga` agent-write API does not exist (Vision Gap #2).

---

## Open cases / gaps

| ID | Case | Status | Pointer |
|---|---|---|---|
| QG-01 | 30 reds fully triaged: 27 stale-A + 2 stale-C + 1 real defect (GAP-1-1) | OPEN — S1.2 next | `docs/plans/evidence/S1.1-qg01-triage.md` |
| GAP-1-1 | DOM-read-as-truth: `settings-workspace.js:522` gates rebind on `classList.contains('is-disabled')` instead of `entry.requiresPro` (H6 regression, low severity) | OPEN — fix-slice before S1.5 | Masterplan §0.5 |
| LR-01 | Installer build fails (winCodeSign symlink privilege) — needs Win Dev Mode / elevated shell | OPEN | GO_LIVE Part A.1 #2 |
| PF-01/02/03/05/13 | Core lifecycle unverified (launch matrix, new/open/save-as E2E, console audit) | OPEN — QA | GO_LIVE Part A.1 #3 |
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
| Is the launch checklist honest/current? | **Yes — verified** | 3 latest commits are checklist-only; QG-01 = 1936/1899/36 reproduces; clean-fixture rerun = 40/40 → 30 reds all non-core |
| PP-D5 (RTL body-leading) | Closed (PP-16 TRUE) | Print-Truth-Unification; PTU-B 7/7 green (prior agent, 2026-06-10) |
| PDF export, RTL scene-heading map, persistence/recovery | TRUE, test-backed | in the 1899-pass unit set |

---

## The plan

- **Stage 1 (now):** close the launch gate — QG-01 → LR-01 → QA sweeps (RTL first) → QG-12. `../RWANGA_GO_LIVE_2026-07-02.md` Part A/D.
- **Stage 2 (bridge to AI):** breakdown-sheet render (VISION-1) + `Rga.Contribution` write API (VISION-2) + alias/profiles (VISION-5). Makes the `.rga` agent-writable portable memory.
- **Stage 3 (Filmustageation AI):** Agent harness on the platform seam + Filmustage-parity surfaces. GO_LIVE Part C.

*How to maintain this file: `PROTOCOL.md`. Checkpoint history: `CHECKPOINTS.md`.*
