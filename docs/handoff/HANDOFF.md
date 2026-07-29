# Rwanga — Living Handoff

> Read this first. It is the index of *where we are* and *what's next*. Do not read the case
> archive to find the next action — it's here. Update this file at the end of every unit of work
> (see `PROTOCOL.md`). Keep it short; link detail, don't inline it.

- **Last updated:** 2026-07-29 · by: **PHASE 4 CLOSED** — S4.4 bidi PASSED + S4.5 SW-23 verdict
- **Binding doctrine:** every agent MUST follow the 10-rule MASTERPLAN EXECUTION DOCTRINE in the
  root `CLAUDE.md` (one slice at a time · tick-as-you-go · §0.3 close ritual · push every slice commit).
- **HEAD:** `6d950487` (S4.5 SW-23 verdict — **Phase 4 closed**) · **last slice-close:**
  `6d950487` · **Branch:** `main` · pushed. *(Update both SHAs at every §0.3 close.)*
- **Phase:** Stage 1 — Foundation (closing launch P0s). AI/Agent phase is **gated** (see Gates).

---

## ⭐ NEXT ACTION

**Start S7.1 — UI-localisation architecture brief (writing only), opening Phase 7.**
**Phase 4 is CLOSED** (S4.1→S4.5 all ✅). Phase 7 comes next by design: it is a BUILD phase with a
long external lead time (native reviewers), while Phase 5 (geometry QA) is a short sweep that can
follow it. S7.1 is a design/writing slice — **no product code** — and its central rule is that
**UI direction and DOCUMENT direction are two separate axes**.

⚠ **NEW AND LAUNCH-BLOCKING — Phase 7: UI localisation + application RTL.** The user ruled
2026-07-28 that a Kurdish/Arabic *interface* is essential to launch ("this system will not be launched
without them"). Six P0 rows added (RTL-16…RTL-21); seven slices S7.1…S7.7 in the masterplan, placed
after Phase 4 and before Phase 5. Central rule of that phase: **UI direction and DOCUMENT direction are
two separate axes** — an English UI must hold an RTL script and vice versa.
⚠ **Waiting on the user (long lead, start now):** a named **Kurdish (Sorani) native reviewer** for
S7.5 — an external dependency that must not become the last blocker. Also open: GAP-4-1 (PDF text
layer), GAP-3-5 (Ctrl+Shift+S owner), and whether Arabic may ship post-launch if no reviewer is found.

**Phase 4 is COMPLETE** (S4.1 → S4.5 all closed). Its capstone finding: **the RTL layout is one
design mirrored, not a second implementation.** Flipping a document's direction to `ltr` returns the
*identical* magnitudes (2.0in character / 1.5in parenthetical / 1.0in dialogue) measured from the
other edge — every delta **0.000in** — and a brand-new Kurdish document gets the full convention with
no manual tweaking. Source confirms it: one direction-agnostic width table, logical-property CSS, no
RTL-only geometry constant. **SW-23 is PARTIAL, held there by GAP-4-1 alone** (the PDF text layer).
Evidence: `../plans/evidence/S4.5-sw23-verdict.md`.

**Phase 4 detail:** RTL-04…RTL-09 **TRUE** (page geometry measured correct), RTL-10 **TRUE**
(all 85 pages clean; the long-standing `overflow:hidden` clipping worry closed by measurement;
leading exactly 1.30), and **RTL-12 + RTL-13 TRUE** (S4.4 bidi audit: mixed Kurdish/Latin lines keep
their RTL base direction even when they START with a Latin token, Latin runs read LTR inside them, and
sentence-final punctuation sits at the reading-end and stays there across an edit — the two named bugs
do not occur; no gaps). **RTL-11 stays PARTIAL** — the PDF draws correctly but its text layer is
40% NUL, so the exported script is not searchable or copyable (**GAP-4-1**).
Evidence: `../plans/evidence/S4.2-rtl-alignment.md`, `S4.3-rtl-print-pdf.md`, `S4.4-bidi-audit.md`.

**Phase 3 is COMPLETE** (S3.1 → S3.2 → S3.2F → S3.3 all closed):
launch matrix **13/13** · lifecycle specs **3/3** (PF-02/03/05 **TRUE**) · console audit **0 errors /
0 page errors** (PF-13 **TRUE**) · **GAP-3-3 CLOSED** — the e2e quit path is fixed and the campaign
has its **first recorded e2e baseline: 363 tests · 357 pass · 6 fail · 11.7 min** (was 326 pass /
37 fail / 1.2 h), zero teardown hangs, zero orphaned Electron processes.
Two open cases came out of it: **GAP-3-4** (the 5 stable reds the baseline made visible) and
**GAP-3-5** (Ctrl+Shift+S claimed by both Save As and Scene Navigator — **needs a user ruling**).
Phases 1 & 2 COMPLETE (QG-01 TRUE, LR-01 TRUE — installer smoke 5/5).
⚠ A running Electron instance auto-migrates **any** fixture it opens — seen on
`playground-the-last-light.rga` (2026-07-26, twice) and `mysterious-guest-rtl.rga` (2026-07-27).
Check `git status` for fixture dirt before every commit; revert with
`git checkout -- rwanga-editor/tests/fixtures/`.

The whole launch-gate campaign is now a slice-by-slice executable plan with cross-session state:
**`../plans/2026-07-02-stage1-launch-gate-masterplan.md`** — read its §0 (survival protocol) first,
then work the first unchecked box of the active slice. Slice order:
S0.1 → S1.1…S1.5 (QG-01) → S2.x (LR-01 installer) → S3.x (lifecycle QA) → S4.x (RTL QA) →
**S7.x (UI localisation ⭐ — the build phase, placed here for its long external lead time)** →
S5.x (geometry QA) → S6.1 (QG-12 roll-up). Track SP.1 (Contribution-API design brief, writing only)
may interleave.

Background & rationale: **`../RWANGA_GO_LIVE_2026-07-02.md`** (Part A + Part D).

---

## Where we are (2-minute brief)

The editor is **~1–2 focused weeks of verification + packaging** away from being a launchable
RTL screenplay editor. **19** of the 21 open launch P0s are not features to build — they are test
hygiene, an installer build, and QA sweeps. The launch checklist was **forensically verified honest
on 2026-07-02** (test numbers reproduce exactly; the "30 vs 36 reds" spin proven true).

Separately, the **Filmustageation AI vision is a much larger, later body of work.** The `.rga` is
agent-*readable* (a complete read-only Memory API) but **not agent-writable** — there is no
contribution/write API. That write API is the true technical prerequisite for the Agent harness.

---

## 🚦 Gates (why the AI/Agent harness cannot start yet)

1. **Launch gate** — no invention features until every launch-checklist **P0** is TRUE.
   Status: **47 TRUE · 11 PARTIAL · 1 UNKNOWN · 7 FALSE** (19 open of **66**; QG-01 + LR-01 TRUE
   2026-07-26; PF-02/03/05 TRUE 2026-07-27; PF-13 + RTL-04…10 TRUE 2026-07-28; RTL-12 + RTL-13 TRUE
   2026-07-29). **+6 P0s added 2026-07-28**
   (RTL-16…RTL-21, UI localisation — user ruled launch-blocking). See `../RWANGA_IDE_LAUNCH_CHECKLIST.md`.
2. **Alive-App Phase 2 gate** — "No AI feature implementation may start before this phase is visually
   verified." Status: **every box unchecked.** See `../RWANGA_IDE_ALIVE_APP_CHECKLIST.md`.
3. **Technical prerequisite** — `.rga` agent-write API does not exist (Vision Gap #2).

---

## Open cases / gaps

| ID | Case | Status | Pointer |
|---|---|---|---|
| GAP-3-2 | Settings workspace sticky-search band layering broken (row paints above band; rows clipped) — user-reported with screenshot; needs Playwright geometry diagnostic + fix | OPEN — needs fix-slice | Masterplan §0.5 |
| GAP-2-1 | Flow view: New doc opens with a dead band above the page that only shrinks as you type (user-reported, long-standing, finally ticketed 2026-07-26) | OPEN — needs fix-slice | Masterplan §0.5 |
| GAP-2-2 | Packaged app shares userData with dev app → restored dev session, auto-opened the playground fixture on first launch | OPEN — decide appId split before launch | Masterplan §0.5 |
| GAP-3-4 | The **5 stable e2e reds** left standing by the first recorded baseline, now that no teardown noise hides them: scene-navigator marks report zero directional indent (RTL *and* LTR control); Settings tab doesn't hide the toolbar; Settings nav rail `overflow:hidden` (same family as GAP-3-2 — fix together); Settings General rows drifted from the registry. Plus 2 load-flakes recorded, not adjusted | OPEN — needs triage slice (stale-test vs real defect) | Masterplan §0.5 |
| GAP-4-2 | **The app's own interface has no RTL and no translations.** **USER RULED 2026-07-28: launch-blocking** — checklist amended with six new P0 rows (RTL-16…RTL-21) and a new **Phase 7** in the masterplan owns the work | RULED — build queued as Phase 7 (after Phase 4) | Masterplan Phase 7 / `docs/plans/evidence/GAP-4-2-ui-localization-audit.md` |
| GAP-4-1 | **The exported PDF's Kurdish text layer is ~40% unreadable** — 40.2% of script characters extract as NUL because the embedded font subset's ToUnicode CMap misses most shaped Kurdish forms. The page DRAWS correctly; the script is not searchable, not copyable, and reaches downstream tooling as garbage. LTR exports are unaffected. **Blocks RTL-11 and therefore the launch gate** | OPEN — needs a fix-slice; isolate font-vs-pipeline first | Masterplan §0.5 / `docs/plans/evidence/S4.3-rtl-print-pdf.md` |
| GAP-3-5 | **`Ctrl+Shift+S` is shipped as the default for BOTH "Save As" and "Scene Navigator"** — the registry is last-wins, so Scene Navigator takes the key and Save As has no working shortcut, while Settings still displays it. Two lesser collisions: Ctrl+Shift+E, Ctrl+Shift+F. Plus Electron's insecure-CSP warning to settle before launch | OPEN — needs a user ruling (which feature keeps which key) + a duplicate-defaults guard test | Masterplan §0.5 / `docs/plans/evidence/S3.3-console-audit.md` |
| PF-01 (macOS) | macOS launch matrix + `pack:mac` + smoke — the only half of PF-01 still open (Decision #1: Mac arrives later) | DEFERRED — needs hardware | Masterplan §0.5 / PF-01 row |
| SW-23 | PARTIAL — the convention IS verified (one resolver, two directions; profile-flip deltas all 0.000in). Its only remaining input is RTL-11, blocked by **GAP-4-1**; SW-23 flips TRUE the moment that PDF text layer is fixed | BLOCKED on GAP-4-1 | `../plans/evidence/S4.5-sw23-verdict.md` |
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
| GAP-3-1 (menus amputated on laptops) | **CLOSED — the Tools menu is back.** A `⋯` overflow item appears exactly when the responsive rules hide menus and carries their contents, grouped under headings; the narrow-mode rule no longer hides the overflow itself. At 1150px (the real laptop case) Settings, Export and Help are reachable again. Guard test asserts menu REACHABILITY at 1600/1150/900px — the thing the old tests missed by asserting command registration instead | `rwanga-editor/tests/e2e/settings/menubar-overflow.spec.js` (4/4) + `docs/plans/evidence/GAP-3-1-overflow-menu.png` |
| PF-13 clean console (S3.3) | **TRUE — 0 error-level console messages · 0 uncaught page errors** across 8 core flows (launch → new → all block types → save → reopen → Print Preview → Page Setup → undo/redo ×5). Typing, saving, reopening, page-setup and undo/redo are completely silent. Re-runnable audit spec, not a one-off observation | `docs/plans/evidence/S3.3-console-audit.md` + `S3.3-console-capture.json` |
| GAP-3-3 (e2e quit-path hangs) | **CLOSED — suite 1.2 h → 11.7 min, 37 reds → 6.** Two causes, both test hygiene, no product code touched: (a) the quit guard correctly waits for a human at the unsaved-changes modal, so `app.close()` never resolved — one shared `closeApp()` teardown across 60 specs / 124 sites; (b) force-kill specs killed only the main process, leaving Windows children holding Playwright's pipe — now kills the process tree. First e2e baseline recorded | `docs/plans/evidence/S3.2F-quit-path.md` + `S3.2F-e2e-baseline.txt` |
| PF-02/03/05 lifecycle round-trips (S3.2) | **TRUE — 3/3 specs green.** New→save→reopen proven across a second app instance; open-from-disk proven not to write the file back; Save As proven to re-point handle/name/origin/Recent | `docs/plans/evidence/S3.2-lifecycle-e2e.md` + `rwanga-editor/tests/e2e/lifecycle/*.spec.js` |
| SW-23 / Phase 4 close (S4.5) | **The RTL layout is a reflection, not a fork — proven.** `direction: rtl→ltr` on a copy returns identical magnitudes mirrored to the other edge (all deltas **0.000in**); a brand-new RTL doc gets the convention with zero tweaking; source carries one direction-agnostic width table + logical-property CSS and no RTL-only geometry constant. SW-23 PARTIAL, blocked only by GAP-4-1 | `docs/plans/evidence/S4.5-sw23-verdict.md`; spec `rtl-profile-drives-convention.spec.js` **3/3**, whole RTL folder **9/9** |
| RTL-12/13 bidi (S4.4) | **TRUE — both.** 24/24 sampled mixed Kurdish/Latin blocks keep RTL base direction in Flow *and* Print, including Latin-first lines (the classic base-direction bug is absent); Latin runs read LTR inside the RTL line; 0 U+FFFD; Print insets match the protocol to **0.000in**. 8/8 typed punctuation battery lines put `.` `؟` at the reading-end and mirror `( )` `« »` `[ ]` correctly, **unchanged after editing earlier in the line**. No gaps found | `docs/plans/evidence/S4.4-bidi-audit.md` + raw JSON measurements; spec `rwanga-editor/tests/e2e/rtl/rtl-bidi.spec.js` **2/2** |
| Is the launch checklist honest/current? | **Yes — verified** | 3 latest commits are checklist-only; QG-01 = 1936/1899/36 reproduces; clean-fixture rerun = 40/40 → 30 reds all non-core |
| PP-D5 (RTL body-leading) | Closed (PP-16 TRUE) | Print-Truth-Unification; PTU-B 7/7 green (prior agent, 2026-06-10) |
| PDF export, RTL scene-heading map, persistence/recovery | TRUE, test-backed | in the 1899-pass unit set |

---

## The plan

- **Stage 1 (now):** close the launch gate — QG-01 → LR-01 → QA sweeps (RTL first) → QG-12. `../RWANGA_GO_LIVE_2026-07-02.md` Part A/D.
- **Stage 2 (bridge to AI):** breakdown-sheet render (VISION-1) + `Rga.Contribution` write API (VISION-2) + alias/profiles (VISION-5). Makes the `.rga` agent-writable portable memory.
- **Stage 3 (Filmustageation AI):** Agent harness on the platform seam + Filmustage-parity surfaces. GO_LIVE Part C.

*How to maintain this file: `PROTOCOL.md`. Checkpoint history: `CHECKPOINTS.md`.*
