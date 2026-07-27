# Rwanga — Living Handoff

> Read this first. It is the index of *where we are* and *what's next*. Do not read the case
> archive to find the next action — it's here. Update this file at the end of every unit of work
> (see `PROTOCOL.md`). Keep it short; link detail, don't inline it.

- **Last updated:** 2026-07-27 · by: S3.1 in progress (12/13; blocked on user reboot)
- **Binding doctrine:** every agent MUST follow the 10-rule MASTERPLAN EXECUTION DOCTRINE in the
  root `CLAUDE.md` (one slice at a time · tick-as-you-go · §0.3 close ritual · push every slice commit).
- **HEAD:** `9e6c82cb` (tooling: `/rwanga` case command) · **last slice-close:** `f17b4730` (S3.1 WIP,
  12/13) · **Branch:** `main` · pushed. *(Update both SHAs at every §0.3 close.)*
- **Phase:** Stage 1 — Foundation (closing launch P0s). AI/Agent phase is **gated** (see Gates).

---

## ⭐ NEXT ACTION

**Start S3.2 — PF-02/03/05 lifecycle E2E specs.** Step 1: discover the dialog-free save seam in
`renderer/js/file-manager.js` + its IPC bridge (native dialogs can't be driven by Playwright);
then write three specs under `rwanga-editor/tests/e2e/lifecycle/` (new-save-reopen · open-from-disk ·
save-as-path-change), copying the launch harness from
`tests/e2e/filmustageation/print-contract.spec.js:21-46` rather than re-inventing it.
S3.1 is CLOSED: Windows launch matrix **13/13 PASS, 0 failures** (post-reboot launch confirmed by
user 2026-07-27) → PF-01 PARTIAL **(Windows-verified)**; the macOS matrix is deferred by Decision #1
(Mac arrives later), tracked on the PF-01 row.
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
RTL screenplay editor. **None** of the 26 open launch P0s is a feature to build — they are test
hygiene, an installer build, and QA sweeps. The launch checklist was **forensically verified honest
on 2026-07-02** (test numbers reproduce exactly; the "30 vs 36 reds" spin proven true).

Separately, the **Filmustageation AI vision is a much larger, later body of work.** The `.rga` is
agent-*readable* (a complete read-only Memory API) but **not agent-writable** — there is no
contribution/write API. That write API is the true technical prerequisite for the Agent harness.

---

## 🚦 Gates (why the AI/Agent harness cannot start yet)

1. **Launch gate** — no invention features until every launch-checklist **P0** is TRUE.
   Status: **34 TRUE · 20 PARTIAL · 5 UNKNOWN · 1 FALSE** (26 open; QG-01 + LR-01 flipped TRUE 2026-07-26). See `../RWANGA_IDE_LAUNCH_CHECKLIST.md`.
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
| PF-02/03/05/13 | Core lifecycle unverified (new/open/save-as E2E, console audit) — PF-01 now Windows-verified | OPEN — QA (S3.2, S3.3) | GO_LIVE Part A.1 #3 |
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
| Is the launch checklist honest/current? | **Yes — verified** | 3 latest commits are checklist-only; QG-01 = 1936/1899/36 reproduces; clean-fixture rerun = 40/40 → 30 reds all non-core |
| PP-D5 (RTL body-leading) | Closed (PP-16 TRUE) | Print-Truth-Unification; PTU-B 7/7 green (prior agent, 2026-06-10) |
| PDF export, RTL scene-heading map, persistence/recovery | TRUE, test-backed | in the 1899-pass unit set |

---

## The plan

- **Stage 1 (now):** close the launch gate — QG-01 → LR-01 → QA sweeps (RTL first) → QG-12. `../RWANGA_GO_LIVE_2026-07-02.md` Part A/D.
- **Stage 2 (bridge to AI):** breakdown-sheet render (VISION-1) + `Rga.Contribution` write API (VISION-2) + alias/profiles (VISION-5). Makes the `.rga` agent-writable portable memory.
- **Stage 3 (Filmustageation AI):** Agent harness on the platform seam + Filmustage-parity surfaces. GO_LIVE Part C.

*How to maintain this file: `PROTOCOL.md`. Checkpoint history: `CHECKPOINTS.md`.*
