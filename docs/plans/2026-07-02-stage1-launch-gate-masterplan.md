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
| S3.2F | 3 Lifecycle | GAP-3-3 fix — e2e quit path + FIRST recorded e2e baseline | ✅ | `docs/plans/evidence/S3.2F-quit-path.md` + `S3.2F-e2e-baseline.txt`. **E2E BASELINE: 363 tests · 357 pass · 6 fail · 11.7 min · 0 teardown hangs · 0 orphaned processes** (was 326 pass · 37 fail · 1.2 h). Two causes, both test hygiene, zero product code touched: shared `closeApp()` teardown swept over 60 specs / 124 call sites, and process-TREE kill for the force-kill specs. 5 stable reds + 1 load-flake remain → **GAP-3-4** |
| S3.1F | 3 Lifecycle | GAP-3-1 fix — menubar overflow (Settings reachable on laptops) | ✅ | `docs/plans/evidence/GAP-3-1-overflow-menu.png`; spec `rwanga-editor/tests/e2e/settings/menubar-overflow.spec.js` **4/4**. A `⋯` overflow item appears exactly when the responsive rules hide menus and carries their contents, grouped under headings. Verified at 1600/1150/900px: every one of the 8 menus stays reachable; at the user's real 1150px, Settings + Export + Help return. **GAP-3-1 CLOSED** |
| S3.3 | 3 Lifecycle | PF-13 clean-console audit across core flows | ✅ | `docs/plans/evidence/S3.3-console-audit.md` + raw `S3.3-console-capture.json`. **0 errors · 0 page errors · 12 warnings** across 8 core flows; typing/save/reopen/page-setup/undo-redo completely silent. **PF-13 UNKNOWN→TRUE.** Re-runnable spec at `rwanga-editor/tests/diagnostics/s3.3-console-audit/` (outside the e2e suite by design). The warnings surfaced **GAP-3-5** (Ctrl+Shift+S claimed by both Save As and Scene Navigator) |
| S4.1 | 4 RTL ⭐ | RTL QA fixture + convention checklist prep | ✅ | `docs/plans/evidence/S4.1-rtl-qa-protocol.md` — per-ID measurable criteria for RTL-04…13 + SW-23 (convention rule quoted · fixture blocks · inch offsets to ±1mm · FAIL signature). Records the **two-surfaces ruling** (Flow = direction only, Print/PDF = the full magnitudes) that stops Phase 4 manufacturing false reds against the Flow doctrine; surveys the fixture (114 mixed-script blocks already present; `shot` + bidi battery must be typed); folds GAP-3-4's two RTL reds into S4.2 |
| S4.2 | 4 RTL ⭐ | Editor alignment sweep RTL-04…RTL-09 | ✅ | `docs/plans/evidence/S4.2-rtl-alignment.md` + `S4.2-rtl-print-page.png` / `S4.2-rtl-flow-blocks.png`; spec `rwanga-editor/tests/e2e/rtl/rtl-alignment.spec.js` **2/2**. **6/6 measured PASS → RTL-04…09 PARTIAL→TRUE.** Print: character **192px=2.0in**, parenthetical **144px=1.5in** (box 336px=3.5in), dialogue **96px=1.0in**, action+heading flush start, transition mirrored to the LEFT (gapLeft 0), padding-left 0 everywhere; 0/200 blocks escape the content box; margins 1.0in left / **1.5in binding right**. Flow: direction correct, centred blocks stay symmetric (drafting doctrine). RTL-09's slug-in-action-block note verified **STALE** and removed |
| S4.3 | 4 RTL ⭐ | RTL Print Preview + PDF export (RTL-10, RTL-11) | ✅ (slice done; RTL-11 held open by GAP-4-1) | `docs/plans/evidence/S4.3-rtl-print-pdf.md` + `S4.3-rtl-print-preview.png` + `S4.3-rtl-export.pdf`; spec `rwanga-editor/tests/e2e/rtl/rtl-print-export.spec.js` **2/2**. **RTL-10 PARTIAL→TRUE** — all 85 pages: 0 box escapes, 0 pages exceeding the sheet (the `overflow:hidden` clipping concern CLOSED by measurement), binding margin 1.5in reading-start / 1.0in end on first AND last page, page number reading-start, leading exactly **1.30**. **RTL-11 stays PARTIAL** — export works (85 pp == preview, 0 tofu) but **40.2% of script characters extract as NUL** (ToUnicode CMap missing shaped Kurdish forms) → **GAP-4-1** |
| S4.4 | 4 RTL ⭐ | Bidi audit — mixed script + punctuation (RTL-12, RTL-13) | ✅ | `docs/plans/evidence/S4.4-bidi-audit.md` + `S4.4-rtl12-measurements.json` / `S4.4-rtl13-measurements.json` (raw per-block numbers) + 4 screenshots; spec `rwanga-editor/tests/e2e/rtl/rtl-bidi.spec.js` **2/2** (green on two consecutive full-file runs). **RTL-12 + RTL-13 UNKNOWN→TRUE.** RTL-12: 24/24 sampled mixed-script blocks hold `direction: rtl` in Flow AND Print — including the Latin-first bait lines (`FRAGMENT`, `WIDE SHOT:`, `MONITOR POV:`, `CAMERA`) where the classic base-direction bug would show — every Latin run reads LTR internally, 0 U+FFFD, Print insets match the S4.1 table to **0.000in** delta. RTL-13: 8/8 typed battery lines put sentence-final punctuation at the reading-end (left) and mirror paired delimiters open-right/close-left on both surfaces, and the side is **unchanged after an edit earlier in the line** — the instability the row names does not occur. **No gap rows** — the one notable finding (trailing period detaching to sit beside `)` in `(V.O.)`-style cues) is standard UAX#9 weak-character resolution, recorded not escalated. Orchestrator verification caught an ordering flake in the spec itself (`closePreview()` asserted nothing, so a still-active preview could overlay the editor and swallow RTL-13's typing); fixed by waiting on real state + asserting the typed text landed — no assertion weakened |
| S4.5 | 4 RTL ⭐ | SW-23 profile-convention verdict + flip all RTL rows | ✅ (**PHASE 4 CLOSED**; SW-23 held at PARTIAL by GAP-4-1 alone) | `docs/plans/evidence/S4.5-sw23-verdict.md` + `S4.5-{ltr-flip,rtl-control,new-doc}-measurements.json` + 3 screenshots; spec `rwanga-editor/tests/e2e/rtl/rtl-profile-drives-convention.spec.js` **3/3**, and the whole `tests/e2e/rtl/` folder is **9/9 green in file order** (orchestrator-verified, 25.3s). **(b) the decisive test PASSES:** flipping `metadata.screenplayProfile.direction` `rtl→ltr` on a copy reproduces the **identical magnitudes mirrored to the opposite edge** — sceneHeading/action 0.000in, character 2.000in, parenthetical 1.500in (box 3.5in), dialogue 1.000in, transition flush reading-end — **every delta 0.000in** vs the RTL control; a brand-new synthetic Kurdish/RTL `.rga` (not derived from the fixture) reproduces the same numbers with zero manual tweaking. The mirror is a reflection, not a second implementation. **(c) no forked layout model:** `renderer/js/framework/layout-profile.js:64-92` (`HOLLYWOOD_DEFAULTS.blockWidthsIn`) is one direction-agnostic table and `renderer/css/editor-prosemirror.css:2484-2519` is logical-property-only with no `[dir="rtl"]` magnitude override; the two direction-keyed values found are both legitimate — `RTL_PRINT_LEADING = 1.3` (:108, the ratified PP-16 leading exception) and `_charsPerInch` (:127-131, a font-metric pagination input, not a geometry width). **(d) vocabulary observations recorded** (untranslated `CUT`; Eastern-Arabic numerals in fixture prose) as future locale-slice input, not defects. **No new gaps** |
| S4.6F | 4 RTL ⭐ | **GAP-4-1 diagnosis** — Kurdish PDF text layer | ✅ (diagnosed; fix ruled post-launch) | `docs/plans/evidence/S4.6F-pdf-text-layer.md`. Root cause settled **by experiment, not code reading**: with *zero shaping*, **9 of 21** dotted/diacritic Noto Naskh letters break their own `ToUnicode` mapping while the identical characters in Tahoma/Arial map **21/21** — only the font varied, so font-vs-pipeline is decided. **But a font swap cannot close it:** Noto→Tahoma on the same shaped sentence moves NUL only **37.4% → 20.4%**; the residual is Chromium's CMap dropping contextual/medial variants regardless of font. Latin control **0% NUL** clears the `printToPDF` options. **USER RULING 2026-07-29: ship honest, fix after** — RTL-11 + SW-23 stay PARTIAL *by decision* (rows amended to say so), GAP-4-1 re-scoped post-launch and re-pointed at a different PDF text-layer path. Font track queued as **S4.7F** |
| S2.4F | 2 → fix | **GAP-2-3 fix** — Page Setup's paper-size dropdown actually changes the paper size | ✅ | `docs/plans/evidence/S2.4F-paper-size.md`; spec `rwanga-editor/tests/e2e/settings/page-setup-paper-size.spec.js` **3/3**. **GAP-2-3 CLOSED.** |
| S3.4F | 3 → fix | **GAP-3-5 fix** — keyboard-shortcut collisions (user ruled: Save As keeps Ctrl+Shift+S) | ✅ | `docs/plans/evidence/S3.4F-shortcut-collisions.md`; guard test `rwanga-editor/tests/unit/shell/kb-shortcut-default-collisions.test.js` **6/6** (confirmed RED pre-fix, GREEN post-fix) + e2e proof `rwanga-editor/tests/e2e/settings/gap-3-5-shortcut-collisions.spec.js` **4/4**. `kb.sceneNavigator` → `Ctrl+Shift+1` (matches the shell's real binding), `kb.exportPdf` → `Ctrl+Alt+E`, search panel → `Ctrl+Shift+2`; `kb.saveAs` unchanged at `Ctrl+Shift+S` per ruling. **GAP-3-5 CLOSED.** Unit suite at exact baseline (1936 · 0 fail · 1 skip) + 6 new = 1942 · 1941 pass · 0 fail · 1 skip. Proposed gap row (not fixed): `Ctrl+Shift+T` collision (`kb.toggleTheme` vs legacy "tag as" shim) — structurally identical, out of this slice's ledger. |
| S4.7F | 4 RTL | **GAP-4-1 track A** — repair/replace the vendored Arabic font (improvement, not a blocker) | ⬜ | |
| S2.3F | 2 → fix | **GAP-2-1 fix** — a New doc starts at a MINIMUM of one page (a floor, not a fixed size) | ✅ | `docs/plans/evidence/S2.3F-new-doc-geometry.md`; spec `rwanga-editor/tests/e2e/flow/new-doc-page-geometry.spec.js` **4/4** (Letter+A4 × LTR+RTL). GAP-2-1 **CLOSED**; gaps GAP-2-3 (Page Setup paper-size switch silently broken) + GAP-2-4 (one unit test asserts the superseded invariant) opened, non-blocking |
| S5.1 | 5 Geometry | Paper sizes + margins (MT-05, MT-06, PP-01, PP-03) | ⬜ | |
| S5.2 | 5 Geometry | Bottom-margin overflow + empty-line budget (MT-07, MT-10) | ⬜ | |
| S5.3 | 5 Geometry | Marker stability, heading edit, PDF page count (MT-02, SW-01, MT-04) | ⬜ | |
| S7.1 | 7 UI L10n | UI-localisation architecture brief (writing only) | ⬜ | |
| S7.2 | 7 UI L10n | Wire Interface Language + app-level UI direction (RTL-16, RTL-17) | ⬜ | |
| S7.3 | 7 UI L10n | Mirror the chrome - logical-properties sweep (RTL-18) | ⬜ | |
| S7.4 | 7 UI L10n | Translation layer - UI strings become keys (RTL-19) | ⬜ | |
| S7.5 | 7 UI L10n | Kurdish (Sorani) UI translation + native review (RTL-20) | ⬜ | |
| S7.6 | 7 UI L10n | Arabic UI translation + native review (RTL-21) | ⬜ | |
| S7.7 | 7 UI L10n | Full-app localisation walk - phase close | ⬜ | |
| S6.1 | 6 Roll-up | Reconcile checklist, flip QG-12, declare launch-gate closed | ⬜ | |
| SP.1 | P Design | `Rga.Contribution` write-API design brief (no code) | ⬜ | |

**Open gaps found during the campaign** (append rows; mirror in HANDOFF.md):

| Gap ID | Found in | Description | Status |
|---|---|---|---|
| GAP-1-1 | S1.1 | DOM-read-as-truth violation (H6, `0b024e24`): `settings-workspace.js:522` `_enterRebind()` gates on `classList.contains('is-disabled')` instead of `entry.requiresPro` (available in closure; correct idiom used at :584/:588). Caught by `source-audit.test.js` "audit (b)" — a standing guard, NOT stale. Fixed 2026-07-26: `_enterRebind` now gates on `entry.requiresPro \|\| _isPersistsOnly(entry)` — the exact states the CSS hook proxied (is-disabled applied for PERSISTS_ONLY via `_disableControlElement`). Evidence: source-audit 19/19; settings-workspace/applicators/reachability 67/67. | **CLOSED** |
| GAP-2-1 | S2.2 smoke | **Flow view opens a New doc with a large dead band** between top chrome and the page; it shrinks gradually as content is typed until the layout reaches its correct height. USER-REPORTED, long-standing, previously never ticketed (user has raised it before). Visual/layout defect in Flow initial geometry, packaged + dev alike. Screenshots in user report 2026-07-26. Does not block typing/structure. **Expected behavior (user-ratified):** a New doc's page renders at its FULL configured page size (A4/Letter per Page Setup) from the first paint — never a shrunken page that grows as content arrives. Needs its own fix-slice (systematic-debugging + failing test first). **CLOSED 2026-07-29 by slice S2.3F.** Root cause: `editor-prosemirror.css:53-54` gave the Flow `#editor` a purely content-driven height (`min-height: auto`), and no `--page-height` token existed. Fixed by publishing `--page-height` from `Rga.PageSurface.apply()` (mirroring the existing `--page-width`) and using it as a `min-height` FLOOR (not a cap — `height` stays `auto`, so the page still grows past one page once content overflows it). Flow stays one continuous surface — no seams/pagination introduced. Verified for Letter+A4 × LTR+RTL (4/4 green); Flow/print/RTL neighbours re-run clean (see evidence). Two things fell out of scope and were NOT fixed here: **GAP-2-3** (Page Setup's paper-size switch is silently broken) and **GAP-2-4** (one pre-existing unit test literally asserts the old `min-height: auto` invariant this fix supersedes). Evidence: `docs/plans/evidence/S2.3F-new-doc-geometry.md`; spec `rwanga-editor/tests/e2e/flow/new-doc-page-geometry.spec.js` 4/4. | **CLOSED** |
| GAP-2-3 | S2.3F (incidental) | **Page Setup's paper-size switch (Ctrl+Shift+G → change Paper size → Apply) silently does nothing — for every user, always.** `page-setup-dialog.js`'s Apply handler calls `Store.set('pageSetup.paperSize', paper.value)` where `paper.value` comes from the `<select>`'s options, built from `Constants.PAPER_SIZES` keys (`page-setup-dialog.js:31`) — `'Letter' \| 'A4' \| 'Legal'`. But the registry entry `pageSetup.paperSize` (`settings-registry.js:283-291`) only accepts lowercase `['letter','a4','custom']`. The `select` validator (`settings-validators.js:27-30`) does a case-sensitive `options.indexOf(v)`, so `'A4'` never matches `'a4'` — `Store.set` is rejected (`console.warn` + `return false`, no exception, no UI feedback) and `doc.settings.pageSetup.paperSize` never changes. Discovered incidentally while building S2.3F's A4 regression test (had to route around it via a synthetic pre-built A4 `.rga` opened through `FileManager.openFromDialog` instead of the modal). Not fixed — out of GAP-2-1's scope. Needs its own fix-slice: either lowercase the modal's option values to match the registry, or make the registry/labels case-insensitive/aligned with `Constants.PAPER_SIZES`; either way add a regression test that actually changes paper size through the modal and reads the new value back. **CLOSED 2026-07-29 (S2.4F).** Fixed at the control end: `page-setup-dialog.js`'s dropdown now sources its options from the settings registry entry (the SSOT) intersected case-insensitively with `Constants.PAPER_SIZES` (only sizes that are both registry-legal and have real dims — `letter`/`a4`; this also drops the never-registry-legal `Legal` option and the dims-less `custom` option rather than inventing new behavior for either), and the seed-from-doc read lowercases before assigning `select.value`. One canonical (lowercase, registry) form; no `.toLowerCase()` sprinkled at the Apply call site. Verified end-to-end: choosing A4 now visibly resizes the Flow page to 1122.52px (was stuck at Letter's 1056px); round-trip back to Letter also verified. Class guard added: every `#ps-paper` `<option value>` must be in the registry's accepted list. Evidence: `docs/plans/evidence/S2.4F-paper-size.md`; spec `rwanga-editor/tests/e2e/settings/page-setup-paper-size.spec.js` **3/3**. | **CLOSED** |
| GAP-2-4 | S2.3F | **One pre-existing unit test encodes the exact invariant S2.3F's ratified fix supersedes.** `tests/unit/shell/editor-page-color.test.js:61-75` ("Fix 2 — colour-only: the Flow #editor geometry is untouched") asserts `min-height\s*:\s*auto` as a "no growth model" guard from the earlier Visual-Inspection-Unblockers slice. S2.3F deliberately changes that exact line to `min-height: var(--page-height)` per the user-ratified GAP-2-1 expectation (page must paint at full size from first paint). Per doctrine ("never weaken/edit a test to get green; report the conflict instead"), the test was left AS-IS and is now a known, isolated red (confirmed: it is the only unit-suite delta introduced by S2.3F — 1936 tests, 1933 pass, 2 fail, where the second failure, `owned-chrome-menu-ownership.test.js` menubar-overflow, is unrelated pre-existing baseline noise verified present before S2.3F too). Needs a ruling: update this test's guard to assert the new floor (`min-height: var(--page-height)`) instead of `auto`, since "colour-only, geometry untouched" was already retired once before in this same file (the original `box-shadow: none` guard was replaced when F2 shipped a shadow) — same precedent applies here. | OPEN |
| GAP-3-1 | user report post-S3.1 | **Compact mode amputates half the menubar with no overflow.** `shell.css:2357-2362` hides the Tags / Tools / Export / Help menus whenever `#app.mode-compact` (window < ~1412 CSS px = virtually every laptop under Windows display scaling; user's 1440px @ ~125% ≈ 1152px). Settings' only menu entry lives in Tools → **Settings disappears from the menu**, as do all Export/Help items; no "…" overflow, no relocation. Gear icon + Ctrl+, still reach Settings (why tests stay green — they assert command registration, not menu visibility). Root-caused 2026-07-26 (responsive.js `_decideMode` + compact CSS). Fix direction (own slice): overflow "…" menu or move Settings to a never-hidden menu; never hide a menu's ONLY route to a feature. **CLOSED 2026-07-28 by slice S3.1F.** Fixed with an overflow `⋯` menubar item that appears exactly when the responsive rules hide menus and carries their contents, grouped under headings — read from the DOM rather than duplicating the breakpoint logic, so it tracks whatever the CSS hides in any mode. The narrow-mode rule was amended to exclude the overflow item itself (hiding the escape hatch would recreate the amputation). Guard test `rwanga-editor/tests/e2e/settings/menubar-overflow.spec.js` asserts the real invariant at 1600/1150/900px: **every one of the 8 menus stays reachable**, and Settings specifically opens from the overflow at the user's 1150px case. This is the gap the old tests missed because they assert command REGISTRATION, not menu REACHABILITY. Evidence: `docs/plans/evidence/GAP-3-1-overflow-menu.png`. | **CLOSED** |
| GAP-3-2 | user report post-S3.1 | **Settings workspace scroll/sticky layering broken.** User screenshot 2026-07-26 (installed app, Page Setup section): a row (Orientation, segmented control) paints ABOVE the sticky search band; section title/description scroll out of sync with the band; first row clipped mid-control. Suspects: `.rga-settings-content` is the scroll container (`overflow-y:auto`, 24px top padding — settings-workspace.css:279-294) with the sticky `.rga-settings-content-header` (top:0, z-index:10, bg-mask — :321-346) pinning inside it; masking/pinning fails under real content. User states Settings area has had unfixed visual problems for a while. Diagnosis plan (own fix-slice): Playwright DOM-geometry spec over the Settings workspace scroll (per project rule "Playwright > screenshots for layout work"), then fix + regression test. | OPEN |
| GAP-3-3 | S3.2 Step 4 | **E2E suite: 37 reds, all sampled ones caused by `app.close()` hanging in `afterEach` — the app will not quit.** Full run 2026-07-27: **326 pass · 37 fail** (1.2 h). Signature on every sampled failure: `Test timeout of 60000ms exceeded while running "afterEach" hook` at `app.close()` — **the test bodies pass**; recovery/autosave/paper-view assert green and only teardown fails. Proven PRE-EXISTING and independent of S3.2: the same specs fail identically when run alone with S3.2's files absent (7 fail / 6 pass), and again after clearing 17 orphaned Electron processes (each hung close leaks a process tree). Working hypothesis for the fix-slice: specs that leave the doc **dirty** hit the unsaved-changes prompt on quit, which blocks `close()` under automation — consistent with `print-contract.spec.js` (`clearDirtyAndClose`) and the three new lifecycle specs (which clear dirty) passing, while `app-close.spec.js` ("closing with unsaved changes prompts") is itself failing. **Also surfaced: no e2e baseline has ever been recorded** (the campaign's baseline truth is the UNIT suite only) — record one the way S0.1 did, since QG-12 cannot honestly roll up over an unmeasured suite. Needs its own fix-slice (systematic-debugging; decide per-spec whether it is test hygiene or a real quit-path defect). **CLOSED 2026-07-28 by slice S3.2F.** The working hypothesis was right, and a second cause sat behind it. (a) The quit guard (`main.js:99` → `index.html:1577` → `CloseGuard.confirmAppClose` → `#unsaved-modal`) correctly waits for a human, so under automation the verdict never arrives and main deliberately ABORTS the close — test hygiene, not a product defect. Fixed by one shared `closeApp()` teardown helper swept across 60 specs / 124 call sites. (b) The force-kill specs (`autosave`, `recovery`) SIGKILLed only the Electron main process; on Windows the surviving child processes hold Playwright's pipe open, so Playwright blocked 60 s at WORKER teardown and orphaned the children — fixed by killing the process tree. No test, assertion, or expectation was weakened. Evidence: `docs/plans/evidence/S3.2F-quit-path.md`. | **CLOSED** |
| GAP-3-4 | S3.2F baseline | **The 5 stable e2e reds left standing by the first recorded baseline** — all assertion failures inside test bodies (no teardown noise left to hide behind), so each is either a real product defect or a stale test, and none has been triaged yet. (1–2) `scene-navigator-rtl-expansion.spec.js` — scene-navigator marks report **zero** directional indent in BOTH the RTL test and its LTR control (`marksPadRight/Left` = 0); belongs with the Phase-4 RTL sweep. (3) `workspace-chrome-policy.spec.js:105` — the Settings tab must hide the toolbar; `computedDisplay` is `grid`, expected `none`. (4) `workspace-chrome-policy.spec.js:188` — Settings nav rail `overflow` is `hidden`, expected `auto`: **the same family as GAP-3-2** (Settings sticky/scroll layering) and probably the same defect as the user's screenshot — fix them together. (5) `settings-workspace-5b.spec.js:47` — General section row ids drifted from the expected registry list. PLUS two load-dependent flakes recorded, not adjusted: `page-setup-preview.spec.js:150` (116.7 ms vs a 100 ms budget) and `theme-applicator.spec.js:142` (theme across close+reopen; 3/3 green in isolation). Needs a triage slice per §0.2 — classify each as stale-test vs real defect BEFORE touching it. | OPEN |
| GAP-4-2 | user report 2026-07-28 | **The APPLICATION's own RTL/localisation does not exist — and no checklist row has ever tracked it.** The *document* side is fine (RTL-01…15, measured correct in S4.2/S4.3); this is the app chrome. Kurdish and Arabic ARE declared (`settings-registry.js:83-91`, options en/ku/ar) but nothing behind the setting was built: **no applicator** (44 registered, `language` not among them, hence the honest greyed "Behavior not wired yet" row), **no translation layer at all** (no i18n module or catalogue; ~17 hardcoded English `textContent` literals in the shell modules plus ~34 in `index.html`), and **no app-level direction** — `documentElement` computes `direction: ltr` and `<html lang>` is `en` always; every `dir` in the app comes from the OPEN DOCUMENT's profile (tab-manager:110, print-renderer:103, scene-navigator:150, tags:295, review-bar:599). The chrome CSS is also physical-first and could not mirror if flipped today (`shell.css` 25 physical/12 logical; `settings-workspace.css` **13 physical/0 logical**) — the R1 logical-property conversion covered print blocks only. Net effect: a Kurdish writer uses a left-to-right ENGLISH application to write a right-to-left Kurdish script. Searching all 123 checklist rows for interface language / translation / localisation / UI direction returns **nothing**, so this never showed up as a red — nothing measured it. **Needs a USER DECISION first: is UI localisation in the v1 launch gate or a post-launch chapter?** Either answer is legitimate, but the checklist must be amended to say which, or "all P0s TRUE" gets declared over a hole. Scoping (no work started) in `docs/plans/evidence/GAP-4-2-ui-localization-audit.md`; direction-first (app `dir` + logical-property sweep of the chrome) is the cheaper, higher-value half and is testable while the UI is still English. **USER RULED 2026-07-28: LAUNCH-BLOCKING** - "an essential part of the launch, this system will not be launched without them." Checklist amended: six new P0 rows **RTL-16...RTL-21** in Section 3 (open P0s 15 -> 21, total 60 -> 66). Owned by the new **Phase 7 - UI localisation + application RTL**, placed after Phase 4 and before Phase 5 because it is a BUILD phase with a long lead time (native reviewers are an external dependency) while Phase 5 is a short QA sweep. | OPEN - owned by Phase 7 |
| GAP-4-1 | S4.3 | **The exported PDF's text layer is ~40% unreadable for Kurdish.** Measured 2026-07-28 on the 85-page RTL fixture: the PDF renders correctly (85 pp == Print Preview, 0 U+FFFD) but **35,749 NUL (U+0000) characters = 40.2% of all script characters** come back from the text layer. The embedded font subset's `ToUnicode` CMap has no mapping for a large share of *shaped* Kurdish forms (initial/medial/final/ligature variants), so the glyphs DRAW right while anything reading the PDF as text gets NUL. Consequences: the exported script is **not searchable**, text **cannot be copied out**, screen readers get nothing, and downstream production tooling (breakdown software, festival portals, archive indexing) receives garbage. LTR exports do not have this problem, so it is also an equity gap between the two directions the app claims to serve equally. **This is why RTL-11 stays PARTIAL.** Fix direction (own slice): export renders HTML in a hidden window and calls `webContents.printToPDF` (`electron/bridge/export-pdf.js:67`); Chromium's subsetting writes the CMap, so the levers are the embedded font (a Noto Naskh Arabic build whose cmap survives subsetting) or the printToPDF options — isolate font-vs-pipeline on one paragraph first. The spec logs `nulShareOfScriptChars` every run but deliberately does NOT assert it: `=== 0` would leave the suite knowingly red, and asserting today's 40% would make the defect permanent. Evidence: `docs/plans/evidence/S4.3-rtl-print-pdf.md`. **DIAGNOSED 2026-07-29 (S4.6F): the lever is the font, primarily — and a font swap cannot close it.** Per-character isolation with *zero shaping* showed **9 of 21** dotted/diacritic Noto Naskh letters break their own `ToUnicode` mapping (to NUL, or to a wrong combining-mark codepoint) while the identical characters in Tahoma/Arial map **21/21**; only the font varied across those runs, so font-vs-pipeline is settled by experiment. **But Noto→Tahoma on the same shaped sentence moves NUL only 37.4% → 20.4%** — the residual is **Chromium's own CMap generation dropping contextual/medial variants (e.g. `ە` U+06D5) regardless of font.** A Latin control through the identical path extracts **0% NUL**, clearing the `printToPDF` options. **USER RULING 2026-07-29 ("do both sequentially, start with B"): ship honest now, improve after.** GAP-4-1 stays OPEN, **re-scoped POST-LAUNCH**, with its true fix re-pointed at a *different PDF text-layer path* rather than a different font; RTL-11 and SW-23 stay **PARTIAL at launch BY DECISION** (both rows amended to say so explicitly). Track A — repair/replace the vendored font, worth ~half the damage — is queued as slice **S4.7F** and is an improvement, not a blocker. Diagnosis: `docs/plans/evidence/S4.6F-pdf-text-layer.md`. | **OPEN — post-launch by user ruling** |
| GAP-3-5 | S3.3 console audit | **`Ctrl+Shift+S` is claimed by two different features — Save As has no working keyboard shortcut.** `settings-registry.js:549` gives `kb.saveAs` the default `Ctrl+Shift+S`; `:585` gives `kb.sceneNavigator` the **same** default. `Rga.KeyboardRegistry` is last-wins, Scene Navigator registers second, so out of the box Ctrl+Shift+S opens the Scene Navigator while the Settings screen still displays `Ctrl+Shift+S` next to "Save As" — a lost shortcut **and** a Settings-honesty violation (Settings Constitution: every visible setting is REAL or honestly disabled). Two lesser collisions from the same audit: `Ctrl+Shift+E` (shell scriptWorkspace panel toggle overridden by Export PDF) and `Ctrl+Shift+F` (search panel toggle overridden by a legacy-shim registration). Fix direction (own slice, and it needs a user ruling on which feature keeps which key): change the defaults so no two commands ship the same binding, and add a startup guard test that FAILS on any duplicate default in the registry — the registry, not the console, should be the place a collision is caught. Also noted from the same capture: Electron's **insecure-CSP** development warning (no CSP / `unsafe-eval`) — a hardening item to settle before launch, not a console-cleanliness failure. Evidence: `docs/plans/evidence/S3.3-console-audit.md`. **✅ USER RULING 2026-07-29: `Ctrl+Shift+S` belongs to SAVE AS.** Rationale accepted: it is the near-universal Save As binding (Word, Photoshop, VS Code) and writers reach for it by muscle memory, so breaking that convention costs more than moving a Rwanga-specific panel. **Scene Navigator must be given a different default.** The ruling unblocks the fix — queued as slice **S3.4F**, which also settles the two lesser collisions (`Ctrl+Shift+E`, `Ctrl+Shift+F`) and adds the duplicate-defaults guard test. | **RULED — fix queued as S3.4F** |
| GAP-2-3 | S2.3F | **Page Setup's paper-size dropdown does not work — for everyone, LTR and RTL alike.** Found while fixing GAP-2-1. The control writes `'A4'` / `'Letter'` but the settings registry only accepts the lowercase forms, so the value is rejected and **Apply never actually changes the paper size**. User-facing and trivial-sounding but total: the app ships a paper-size chooser that cannot choose paper. Not fixed in S2.3F per the scope-freeze rule (§0.2) — S2.3F set the *page height* correctly from whatever size is configured; this is the separate defect that the configured size can't be changed through the UI. Needs its own small fix-slice + a test that asserts the dropdown's emitted value is one the registry accepts (a case-mismatch guard, since this class of bug will recur). **CLOSED 2026-07-29 (S2.4F)** — see the fuller entry above (this row is a duplicate opened from the S2.3F evidence doc; same fix, same evidence). | **CLOSED** |
| GAP-2-4 | S2.3F | **A unit test asserted the very defect GAP-2-1 was filed for** (`editor-page-color.test.js`: `min-height: auto` "must be unchanged"), so the ratified fix turned it red. Reported rather than silently patched, per §0.2. **RESOLVED 2026-07-29 in the S2.3F close** by re-pointing it the way S1.2 re-pointed the stale shell snapshots: it now asserts the ratified invariant (`min-height: var(--page-height)` floor **and** `height: auto`, so the no-growth-model/continuous-surface property this guard exists to protect is still enforced), with the source cited inline. No assertion weakened. **Same close also fixed a SECOND latent red**, unrelated and older: `owned-chrome-menu-ownership.test.js` still declared exactly 8 menubar entries after slice **S3.1F** (2026-07-28) legitimately added a 9th, `overflow`, to close GAP-3-1 — i.e. S3.1F shipped its fix and left the suite red, and nothing caught it until now. Re-pointed to 9 with the source cited. Unit suite back to the S1.5 baseline exactly: **1936 · 1935 pass · 0 fail · 1 skip**. | **CLOSED** |
| GAP-2-5 | S2.4F | **"Legal" paper size is offered nowhere now — and never actually worked.** `Constants.PAPER_SIZES` carried `Legal`, but the settings registry only ever accepted `letter` / `a4` / `custom`, so choosing Legal was always rejected. S2.4F made the dropdown source its options from the registry (SSOT), which correctly stopped advertising a size the app cannot apply — honest per the Settings Constitution ("every visible setting is REAL or honestly disabled"), but it means **Legal is now visibly gone from Page Setup rather than visibly broken.** Also dropped: `custom`, which the registry accepts but has no dimensions behind it. **This is a product decision, not a bug:** either Legal (and custom) get real support end-to-end, or their absence is intentional and `Constants.PAPER_SIZES` should stop carrying a dead entry. Needs a user call — US Legal is a real (if uncommon) screenplay/production paper size. | OPEN — needs a user decision, not a fix |
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

### Slice S3.2F: GAP-3-3 fix — the e2e quit path, and the first recorded e2e baseline

**Authorized by the user 2026-07-28** ("fix the hanging-close bug first, record the missing test
baseline, then continue in order") — this is the fix-slice GAP-3-3 called for. It runs BEFORE S3.3,
because the console audit walks the same flows over the same harness.

**Files:**
- Create: `rwanga-editor/tests/helpers/app-teardown.js`
- Modify: every Playwright-Electron spec under `rwanga-editor/tests/e2e/**` + `tests/integration/**`
- Create: `docs/plans/evidence/S3.2F-e2e-baseline.txt`, `docs/plans/evidence/S3.2F-quit-path.md`

- [x] **Step 1: Root cause** (systematic-debugging Phase 1–3, reproduced then proven).
      `electron/main.js:99-117` intercepts the window `close` and asks the renderer
      (`app.closeRequested`); `renderer/index.html:1577-1590` runs
      `Rga.CloseGuard.confirmAppClose()`, which shows `#unsaved-modal` for every dirty document and
      **waits for a human**. Under Playwright there is no human, so the renderer never replies;
      main's `CLOSE_RESPONSE_TIMEOUT_MS` elapses and the close is deliberately ABORTED (never
      force-quit over unsaved work). `app.close()` therefore never resolves → 60 s `afterEach`
      timeout → leaked Electron process tree. **Verdict: test hygiene, not a product defect** — the
      guard is correct for a real user (proven by `app-close.spec.js` test 2, which answers the
      modal and quits cleanly). Reproduced on `app-close.spec.js` test 1: **1.4 min hang**.
- [x] **Step 2: One shared teardown helper, no assertion weakened.** `tests/helpers/app-teardown.js`
      exports `closeApp(app)` — marks every open document clean (all tabs, not just the active one:
      the guard iterates them all), dismisses a modal the test body left open, then closes. It is
      the repo's existing `clearDirtyAndClose` idiom (print-contract.spec.js) generalised; that
      local wrapper was deleted so there is one helper, not two. Teardown asserts nothing; specs
      that prove the guard keep their own assertions untouched.
- [x] **Step 3: Sweep the suite** — 60 spec files, 124 teardown call sites routed through
      `closeApp`. Deliberately left alone: `app-close.spec.js:65` (`app.waitForEvent('close')` — the
      close IS the assertion there).
- [x] **Step 4: Second defect — the force-kill specs leaked their process tree.**
      `autosave.spec.js` / `recovery.spec.js` simulate a crash with `proc.kill('SIGKILL')` on the
      Electron **main** process only. On Windows the GPU/renderer/utility children survive and keep
      the pipe Playwright talks to open, so Playwright never observes the app dying: it blocked the
      full 60 s at **worker** teardown and orphaned the children (16 stray processes were cleared
      during this slice — the same leak the S3.2 evidence noted). Fixed by killing the process TREE
      (`taskkill /T /F` on win32, `SIGKILL` elsewhere) and disposing the Playwright handle; `killApp`
      now lives beside `closeApp` in the shared helper. `autosave.spec.js` alone: **1.3 min → 13 s**.
- [x] **Step 5: Record the first e2e baseline** (`docs/plans/evidence/S3.2F-e2e-baseline.txt`) the
      way S0.1 recorded the unit baseline. Until now the campaign's only baseline truth was the UNIT
      suite; QG-12 cannot honestly roll up over an unmeasured suite. Pre-fix reference figure
      (S3.2, 2026-07-27): **326 pass · 37 fail · 1.2 h**.
      **RECORDED: 363 tests · 357 pass · 6 fail · 11.7 min · 0 teardown hangs · 0 orphans.**
      The first measurement caught a mistake in the sweep itself — 8 reds reading `ReferenceError:
      closeApp is not defined`, because the require had been appended at the BOTTOM of
      `tag-plugin-ownership.spec.js` instead of its require block. Fixed, and a placement check
      (require line < first `closeApp(` call) now passes 60/60. The baseline above is the re-run
      after that fix.
- [x] **Step 6: SLICE CLOSE RITUAL (§0.3)** — GAP-3-3 CLOSED in the gap ledger; the 5 stable reds
      still standing are triaged into **GAP-3-4** for a future slice (§0.2 — none weakened, skipped,
      quarantined, or deleted).

Commit message: `test(editor): fix e2e quit-path hangs + record first e2e baseline (GAP-3-3, S3.2F)`

### Slice S3.3: PF-13 clean-console audit

**Files:**
- Create: `docs/plans/evidence/S3.3-console-audit.md`
- Modify: `docs/RWANGA_IDE_LAUNCH_CHECKLIST.md` (PF-13 row)

- [x] **Step 1: Scripted audit via Playwright console capture** — write a throwaway audit spec (do not
      commit it into the suite; keep it under `docs/plans/evidence/` as `S3.3-audit.spec.js` and point
      Playwright at it explicitly).
      DONE, with one deviation: the spec lives at
      `rwanga-editor/tests/diagnostics/s3.3-console-audit/console-audit.spec.js` with its own
      config, because a spec outside `rwanga-editor/` cannot resolve `@playwright/test` and
      `tests/diagnostics/` is the repo's existing home for non-suite specs. It is still invisible to
      `npm run test:e2e` (that config matches only `integration/**` + `e2e/**`), which was the point.
      All 8 flows walked; every message captured to `docs/plans/evidence/S3.3-console-capture.json`
      tagged with the flow that produced it, and all 12 warnings transcribed in the evidence file. It launches the app, subscribes `page.on('console')` +
      `page.on('pageerror')`, then walks the core flows: new → type all 6 block types → save →
      reopen → Print Preview open/close → Page Setup change → undo/redo ×5 → close. Assert zero
      `error`-level console messages; record every `warning` verbatim in the evidence file.
- [x] **Step 2: Verdict** — 0 errors → flip PF-13 TRUE (UNKNOWN→TRUE). Any error → gap row per §0.2,
      PF-13 stays open, evidence file documents each error with its trigger.
      **RESULT: 0 error-level console messages · 0 uncaught page errors · 12 warnings.** Typing,
      saving, reopening, page-setup and undo/redo were completely silent; all messages came from
      launch (12) and Print Preview (1). **PF-13 UNKNOWN → TRUE**, flipped in the checklist in the
      same commit. The warnings were read rather than swept, and produced **GAP-3-5**: `Ctrl+Shift+S`
      is the shipped default for BOTH `kb.saveAs` and `kb.sceneNavigator` (registry last-wins →
      Save As has no working shortcut while Settings still displays it).
- [x] **Step 3: SLICE CLOSE RITUAL (§0.3)**

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

- [x] **Step 1: Build the QA protocol document.** From RTL_SCREENPLAY_CONVENTION.md, extract into
      `S4.1-rtl-qa-protocol.md` one table row per checklist ID (RTL-04…RTL-13, SW-23) with: the exact
      convention rule (quoted), the fixture/scene that exercises it, and the pass criterion (measurable —
      e.g. "dialogue block right edge at X from page right edge ±1mm", not "looks right").
      Primary fixture: `tests/fixtures/mysterious-guest-rtl.rga` (open a COPY under `%TEMP%` — never the
      tracked fixture, see §0.2). Where the fixture lacks a case (mixed-script line, bidi punctuation,
      all 6 block types in RTL), script the additions to type during QA and list them in the protocol.
      DONE — `docs/plans/evidence/S4.1-rtl-qa-protocol.md`: one section per ID (RTL-04…13, SW-23)
      with the convention rule quoted, the fixture blocks that exercise it, a measurable PASS
      criterion (inch offsets to ±1mm, with the px-per-inch recipe), and the FAIL signature to watch.
      **Key protocol ruling recorded up front (§0): Flow and Print are two surfaces with two
      truths.** The convention's 2.0/1.5/1.0in magnitudes are PAGE truth and bind Print Preview +
      PDF; Flow is a continuous drafting surface by locked doctrine and deliberately CENTRES
      character/dialogue/parenthetical (`editor-prosemirror.css:1145-1162`). Judging Flow against
      print indents would manufacture false reds and invite a "fix" that breaks the Flow doctrine —
      so every Phase-4 spec must declare which surface it measures. Fixture survey: 47 scenes /
      634 action / 434 character / 436 dialogue / 84 parenthetical / 44 transition, **114 blocks
      already mix Latin + Arabic script** (RTL-12 needs no authoring); MISSING and therefore scripted
      during QA — `shot` blocks (zero present) and an adversarial bidi-punctuation battery (RTL-13).
- [x] **Step 2: SLICE CLOSE RITUAL (§0.3)**

Commit message: `qa(editor): RTL QA protocol — per-ID criteria extracted from ratified profile (S4.1)`

### Slice S4.2: Editor alignment sweep (RTL-04…RTL-09)

**Files:**
- Create: `docs/plans/evidence/S4.2-rtl-alignment.md` + one screenshot per ID (`S4.2-rtl-0X-<element>.png`)
- Modify: `docs/RWANGA_IDE_LAUNCH_CHECKLIST.md` (rows RTL-04…RTL-09)

- [x] **Step 1:** In the installed app, open the temp copy of the RTL fixture. For each of: action
      (RTL-04), dialogue (RTL-05), character (RTL-06), parenthetical (RTL-07), transition (RTL-08),
      scene heading (RTL-09) — verify against the S4.1 criterion, screenshot, record verdict.
      RTL-09 note: checklist cites a known slug-in-action-block mapping bug via SW-08, but the handoff
      lists "RTL scene-heading map" as TRUE/test-backed — verify visually and trust what you see; if
      correct, note the stale cross-reference in the evidence file.
      DONE — but as a **measurement, not an eyeball**: `rwanga-editor/tests/e2e/rtl/rtl-alignment.spec.js`
      (2/2 PASS, now a permanent suite spec) drives the real render pipeline over a `%TEMP%` copy of
      the fixture and reads DOM geometry, per the standing "Playwright > screenshots" rule. All six
      IDs measured PASS on the first run — the RTL page geometry is genuinely correct.
      Worth recording: the first evidence screenshot was an ELEMENT capture of a page sheet wider
      than its scroll container; it came back cropped and looked exactly like text clipped at the
      left margin. Containment measurement showed **0 of 200 blocks** escaping the content box, and
      margins measuring 1.0in left / **1.5in binding right** (correctly mirrored). The capture was
      switched to a viewport screenshot. The rule earned its keep.
- [x] **Step 2:** Flip each ID that passes (PARTIAL→TRUE, evidence = screenshot + protocol row).
      Failures → gap rows; the ID stays PARTIAL with the gap cited.
      **6/6 flipped PARTIAL→TRUE**; no failures, so no gap rows. RTL-09's "real slug sits in an
      action block" note was verified **STALE** and removed (47 sceneHeading nodes for 47 scenes,
      rendering as sceneHeading with localized `INT.` = `ناوەوە`).
- [x] **Step 3: SLICE CLOSE RITUAL (§0.3)**

Commit message: `qa(editor): RTL alignment sweep RTL-04..09 — <n>/6 TRUE (S4.2)`

### Slice S4.3: RTL Print Preview + PDF export (RTL-10, RTL-11)

**Files:**
- Create: `docs/plans/evidence/S4.3-rtl-print-pdf.md` + screenshots + the exported PDF
- Modify: `docs/RWANGA_IDE_LAUNCH_CHECKLIST.md` (RTL-10, RTL-11)

- [x] **Step 1 (RTL-10):** Print Preview on the RTL fixture: every page visually correct, RTL block
      mirror per convention, **no clipped glyphs** (the checklist's known `overflow:hidden` concern —
      inspect line ends and page edges specifically; the Print-Truth-Unification work may have already
      fixed this: cross-check `rwanga-editor/docs/Filmustageation/redesign_campaign/PRINT_TRUTH_DOCTRINE_V1.md`).
- [x] **Step 2 (RTL-11):** Export the fixture to PDF (checklist note "blocked" is stale — export works).
      Open the PDF: direction preserved, glyph shaping correct (no disconnected Arabic-script letters),
      page count matches Print Preview. Keep the PDF as evidence.
      RTL-10 measured clean on ALL 85 pages: 0 box escapes, **0 pages with content exceeding the
      sheet** (`scrollWidth === clientWidth`, so the `overflow:hidden` concern is CLOSED by
      measurement), binding margin 1.5in reading-start / 1.0in end identical on first and last page,
      page number on the reading-start side, RTL leading exactly **1.30**.
      RTL-11: the "blocked" note was indeed stale — export works, 592 KB, **85 pages == 85 preview
      pages**, Arabic present, 0 U+FFFD. But **40.2% of script characters extract as NUL**: the font
      subset's ToUnicode CMap is missing most shaped Kurdish forms. The page DRAWS right; the text
      layer is broken (not searchable, not copyable, garbage downstream).
- [x] **Step 3:** Flip / gap per verdict. **RTL-10 PARTIAL→TRUE. RTL-11 stays PARTIAL** with
      **GAP-4-1** cited — flipping "RTL export correct" over a 40%-unreadable text layer would be the
      paper-over §0.2 forbids. **Step 4: SLICE CLOSE RITUAL (§0.3)** — done.

Commit message: `qa(editor): RTL print preview + PDF export verified — <verdict> (RTL-10/11, S4.3)`

### Slice S4.4: Bidi audit (RTL-12, RTL-13)

**Files:**
- Create: `docs/plans/evidence/S4.4-bidi-audit.md` + screenshots
- Modify: `docs/RWANGA_IDE_LAUNCH_CHECKLIST.md` (RTL-12, RTL-13)

- [x] **Step 1:** Using the S4.1 protocol's mixed-script cases, type into an RTL doc: a Kurdish action
      line containing a Latin name; a dialogue line with an English phrase mid-sentence; lines ending
      in `.` `!` `?` `:` and quotes around Latin runs; numbers (digits) inside RTL sentences. Verify in
      editor AND Print Preview: reading order sane, punctuation sits at the correct visual end, no
      mirrored/jumping brackets. Screenshot each case.
- [x] **Step 2:** Flip RTL-12/13 (UNKNOWN→TRUE) or gap rows. **Step 3: SLICE CLOSE RITUAL (§0.3)**

Commit message: `qa(editor): bidi audit — mixed-script + punctuation <verdict> (RTL-12/13, S4.4)`

### Slice S4.5: SW-23 roll-up + phase close

**Files:**
- Create: `docs/plans/evidence/S4.5-sw23-verdict.md`
- Modify: `docs/RWANGA_IDE_LAUNCH_CHECKLIST.md` (SW-23)

- [x] **Step 1:** SW-23 = "RTL profile drives correct RTL conventions" — it is the conjunction of
      S4.2–S4.4. Write the one-page verdict: table of RTL-04…13 outcomes, plus one check that the
      *profile switch itself* drives it (create a NEW doc with the Kurdish/RTL profile → confirm
      direction + conventions apply without manual tweaking).
- [x] **Step 2:** Flip SW-23 if all inputs TRUE; else it stays PARTIAL citing the open gap rows.
- [x] **Step 3: SLICE CLOSE RITUAL (§0.3)** — this checkpoint should list every RTL status delta.

Commit message: `qa(editor): SW-23 RTL convention verdict — phase 4 closed (S4.5)`

### Slice S4.6F: GAP-4-1 fix — the Kurdish PDF text layer (RTL-11 → SW-23)

**Opened 2026-07-29 by user ruling** ("proceed" on the recommendation that this be the next fix).
It is the **last defect standing between the RTL document work and a clean pass**: RTL-11 is PARTIAL
because of it, and SW-23 is PARTIAL *solely* because of RTL-11. Fixing this flips both.

**The defect (measured, S4.3):** the exported PDF **draws** correctly (85 pp == Preview, 0 U+FFFD,
0 tofu) but **35,749 NUL characters = 40.2% of all script characters** come back from its text layer.
The embedded font subset's `ToUnicode` CMap has no entry for a large share of *shaped* Kurdish forms
(initial/medial/final/ligature variants). Consequence: the exported script is not searchable, cannot
be copied out, gives screen readers nothing, and reaches downstream production tooling as garbage.
LTR exports are unaffected — so it is also an equity gap between the two directions the app claims to
serve equally.

**Where it lives:** `rwanga-editor/electron/bridge/export-pdf.js` renders the HTML in a hidden window
and calls `webContents.printToPDF` (:67, after a `document.fonts.ready` await). Chromium does the
subsetting and writes the CMap, so the levers are **(a)** the embedded font (a Noto Naskh Arabic build
whose `cmap` survives subsetting) or **(b)** the `printToPDF` options — **isolate font-vs-pipeline on
ONE paragraph before touching anything.**

**Files:**
- Create: `docs/plans/evidence/S4.6F-pdf-text-layer.md` + a minimal repro artifact
- Modify: whichever of the font chain / `export-pdf.js` the diagnosis actually indicts
- Modify: `docs/RWANGA_IDE_LAUNCH_CHECKLIST.md` (RTL-11, and SW-23 if it flips)

- [x] **Step 1 — DIAGNOSE, do not fix.** DONE — `docs/plans/evidence/S4.6F-pdf-text-layer.md`.
      **Root cause: the vendored font, primarily — but a font swap cannot fully fix it.** Per-character
      isolation (single glyphs, *no shaping at all*) showed **9 of 21** Noto Naskh Arabic letters
      carrying a dot or diacritic break their own `ToUnicode` mapping — to NUL, or to a wrong combining
      -mark codepoint — while the *identical characters* in Tahoma/Arial mapped **21/21**. Only the font
      varied; Chromium build, `printToPDF` options and HTML/CSS were byte-identical, which settles
      font-vs-pipeline decisively. **But:** swapping Noto→Tahoma on the same shaped sentence moved NUL
      only **37.4% → 20.4%**. The residual is Chromium's own CMap generation dropping contextual/medial
      variants (e.g. `ە` U+06D5) *regardless of font*. A Latin control through the identical pipeline
      extracted **0% NUL**, proving the export options are not misconfigured.

**⚖️ USER RULING 2026-07-29 — "do both sequentially, start with B."** Presented with the fork
(A: swap/repair the font now — halves the defect but reopens the RTL geometry locked in S4.1–S4.3 and
still leaves ~20%; B: ship honest, defer the real fix), the user ruled **B first, then A**. So:

- [x] **Step 2 (was: fix) — SUPERSEDED BY RULING B: record the hole honestly instead of papering it.**
      **RTL-11 stays PARTIAL and SW-23 stays PARTIAL, deliberately**, each row stating the measured
      number and the reason. This is the §0.2 "escalate, don't paper over" rule applied to a defect the
      user has chosen to ship with: the launch gate does NOT get to call these TRUE. **GAP-4-1 remains
      OPEN**, re-scoped as post-launch and re-pointed at the true fix (a different PDF text-layer path,
      not a different font). The export *draws* perfectly and prints correctly — what is lost is
      search, copy, screen-reader access and downstream tooling, for RTL only.
- [x] **Step 3 — SLICE CLOSE RITUAL (§0.3).** Track A continues as its own slice, S4.7F below.

Commit message: `qa(editor): Kurdish PDF text layer diagnosed — ruled ship-honest (GAP-4-1, S4.6F)`

### Slice S2.4F: GAP-2-3 fix — Page Setup's paper-size dropdown must actually change the paper

**Found in S2.3F, user ordered it done first (2026-07-29).** The control emits `'A4'` / `'Letter'`
but the settings registry accepts only the lowercase forms, so the value is rejected and **Apply never
changes the paper size** — for every user, both directions. Small fix, visible control, total failure.

**Files:** the Page Setup control + registry glue the diagnosis indicts; a guard test;
`docs/plans/evidence/S2.4F-paper-size.md`

- [x] **Step 1:** Reproduce it as a **failing test first** (superpowers:test-driven-development):
      choose A4 → Apply → assert the effective paper size actually became A4 (assert the *effect*,
      not that a function was called).
- [x] **Step 2:** Fix the mismatch at the correct end — decide deliberately whether the registry
      should accept both cases or the control should emit the canonical form, and say why in the
      evidence file. Prefer ONE canonical form with normalisation at the boundary.
- [x] **Step 3:** Add the **class guard**: a test asserting every Page-Setup control's emitted values
      are values the registry accepts. This bug class (case/format mismatch across the control↔registry
      seam) will recur, and the registry is where it should be caught.
- [x] **Step 4:** Verify against S2.3F's fix — changing paper must now visibly change the page height
      (Letter 1056px ↔ A4 1122.52px), which is the honest end-to-end proof. Close GAP-2-3.
      **Step 5: SLICE CLOSE RITUAL (§0.3) — done except commit/push, left to the orchestrator.**

Commit message: `fix(editor): Page Setup paper-size actually applies (GAP-2-3, S2.4F)`

### Slice S3.4F: GAP-3-5 fix — keyboard-shortcut collisions

**Unblocked by the user's ruling 2026-07-29: `Ctrl+Shift+S` belongs to SAVE AS.** Rationale on record —
it is the near-universal Save As binding (Word, Photoshop, VS Code) and writers reach for it by muscle
memory; breaking that convention costs more than moving a Rwanga-specific panel.

Today the registry is **last-wins**, so Scene Navigator (registered second) silently takes the key and
**Save As has no working shortcut at all — while Settings still displays `Ctrl+Shift+S` next to it.**
That is both a lost shortcut and a **Settings-honesty violation** (Settings Constitution: every visible
setting is REAL or honestly disabled).

**Files:** `renderer/js/.../settings-registry.js` (`kb.saveAs` :549, `kb.sceneNavigator` :585);
a guard test; `docs/plans/evidence/S3.4F-shortcut-collisions.md`

- [ ] **Step 1 — the guard test FIRST** (superpowers:test-driven-development), and it is the point of
      the slice: a test that **fails on ANY duplicate default binding in the registry**. The registry,
      not the console, is where a collision must be caught. Write it, watch it fail on today's three
      collisions, and keep it as a standing guard.
- [ ] **Step 2 — Save As keeps `Ctrl+Shift+S`** (the ruling). Give **Scene Navigator** a new default
      that collides with nothing; state the chosen key and why in the evidence file.
- [ ] **Step 3 — settle the two lesser collisions** found in the same audit: `Ctrl+Shift+E`
      (shell `scriptWorkspace` panel toggle vs Export PDF) and `Ctrl+Shift+F` (search panel toggle vs a
      legacy-shim registration). Same rule: one command per default.
- [ ] **Step 4 — prove it end to end:** Save As actually fires on `Ctrl+Shift+S` in a running app, and
      **Settings displays the true binding for every command it lists** (the honesty half — a shortcut
      shown in Settings that does not work is the defect, not just the collision). Close GAP-3-5.
      **Step 5: SLICE CLOSE RITUAL (§0.3).**

Commit message: `fix(editor): one command per shortcut — Save As keeps Ctrl+Shift+S (GAP-3-5, S3.4F)`

### Slice S4.7F: GAP-4-1 track A — repair/replace the vendored Arabic font

**Queued by the same ruling** ("do both sequentially, start with B") — B is done, so this is track A.
It is an **improvement slice, not a launch blocker**: it roughly halves the damage (37.4% → ~20.4%
measured) but cannot make the export searchable on its own, because the residual loss is Chromium's.

**The known risk, stated up front:** any font swap reopens the RTL visual work locked and verified in
S4.1–S4.3 (leading, metrics, the 85-page geometry sweep). This slice is therefore **not** "swap the
font" — it is "swap the font *and re-prove the page*".

**Files:** the vendored font chain; `docs/plans/evidence/S4.7F-font-repair.md`

- [ ] **Step 1:** Test alternative builds before choosing. The diagnosis explicitly left this UNKNOWN —
      only Noto Naskh vs Noto Sans were tried (both vendored, both broken). Find a build whose dot/
      diacritic marks are not separate un-mapped glyph components; measure each candidate's NUL share
      on the same one-paragraph harness the diagnosis built, and record a candidate table.
- [ ] **Step 2:** Adopt the winner, then **re-run the full S4.2 + S4.3 verification** against it — the
      alignment spec, the 85-page print sweep, leading, and the export page count. A font change that
      silently moves the geometry is a regression, not a fix.
- [ ] **Step 3:** Re-measure the 85-page NUL share (40.2% → ?) and update the GAP-4-1 row with the new
      number. RTL-11/SW-23 flip only if the text layer becomes genuinely readable — which the diagnosis
      predicts it will NOT. **Step 4: SLICE CLOSE RITUAL (§0.3).**

Commit message: `fix(editor): repair the vendored Arabic font subset (GAP-4-1 track A, S4.7F)`

### Slice S2.3F: GAP-2-1 fix — a New document must paint at full page size

**Re-raised by the user 2026-07-29** ("you still owe me a fix on the page geometry on opening a new
`.rga` document, the page is not created as the right A4 size"). Long-standing, user-reported more
than once, ticketed 2026-07-26, never yet fixed. **This is the oldest outstanding user-visible
complaint in the campaign** — treat it as owed, not as backlog.

**Symptom:** opening a New document in Flow view shows a large dead band between the top chrome and
the page; the page is not the configured size, and only grows toward its correct height gradually as
content is typed.

**Expected behavior (user-ratified; wording clarified by the user 2026-07-29):** a New doc's Flow
surface starts **at a MINIMUM of one configured page (A4 or Letter, per Page Setup) from the first
paint** — never a shrunken surface that grows out of dead space as content arrives.

⚠ **Read this before touching the fix — it is a FLOOR, not a page size.** The user's own words:
*"the view is not forcing the page geometry to be A4 or by paper size by design, because the view is a
continuous page with page breaks; only in print preview or print does the page have a real meaning.
What I needed was to present minimum A4 on start, because the view was breaking on empty space."*
So `min-height: var(--page-height)` with **`height: auto`** is the whole design: Flow keeps growing
continuously past one page, it simply may not start *shorter* than one. **Do not convert this into a
fixed height, and do not add pagination, seams or page capsules to Flow** — page truth lives in Print
Preview (locked continuous-drafting doctrine). The unit guard in `editor-page-color.test.js` asserts
BOTH halves (the floor *and* `height: auto`) precisely so this cannot be quietly hard-pinned later.

**Method:** superpowers:systematic-debugging, then superpowers:test-driven-development. Per the
standing project rule *"Playwright > screenshots for layout work"*, diagnose with a DOM-geometry spec
(`getComputedStyle` + rects), not screenshots. Beware the Flow doctrine
(`project_flow_continuous_doctrine`): Flow is a **continuous drafting surface**, so the fix is that the
page starts at its correct SIZE — it must not introduce page seams, capsules, or pagination into Flow.

**Files:**
- Create: `rwanga-editor/tests/e2e/flow/new-doc-page-geometry.spec.js` + `docs/plans/evidence/S2.3F-new-doc-geometry.md`
- Modify: whichever Flow/page-sizing module the diagnosis indicts

- [x] **Step 1 — reproduce and measure.** Playwright: launch → New doc → measure the page element's
      height/width **on the first frame**, against the configured paper size (A4 210×297mm,
      Letter 8.5×11in) at the known `pxPerIn` scale. Record the dead-band height too. Then type and
      re-measure to capture the "grows as you type" curve. Numbers, not adjectives.
      **Measured:** Letter New doc first-paint `#editor` height = 227.59px (should be 1056px, 21.5%
      of paper height); typing 2 short lines grew it to 261.19px — confirms the "grows toward its
      correct size" symptom. Full table in the evidence doc.
- [x] **Step 2 — root-cause it.** Name the module and line that sizes the Flow page, and say why an
      empty document yields a short page (content-driven height instead of paper-driven height is the
      obvious suspect — prove it, don't assume it).
      **Root cause:** `rwanga-editor/renderer/css/editor-prosemirror.css:53-54` (pre-fix) —
      `#editor-container.view-flow #editor { min-height: auto; height: auto; }` — a deliberate Fork A
      "no growth model" rule that made `#editor`'s height purely CONTENT-driven; no page-height token
      existed at all (`rwanga-editor/renderer/js/editor/page-surface.js` only ever published
      `--page-width`). Confirmed, not assumed: reverting the fix and re-running the new spec
      reproduces all 4 failures at the pre-fix heights.
- [x] **Step 3 — failing test first,** asserting the ratified behavior: a New doc's page matches the
      configured paper size on first paint, within tolerance, and does NOT change height as the first
      lines are typed. Then fix until green.
      **Test:** `rwanga-editor/tests/e2e/flow/new-doc-page-geometry.spec.js` (4 tests, red confirmed
      pre-fix, green post-fix). **Fix:** `Rga.PageSurface.apply()` now publishes `--page-height`
      alongside `--page-width`; `editor-prosemirror.css` uses it as `min-height` (a FLOOR, not a
      cap — `height` stays `auto` so the page still grows past one page once content overflows it).
      A default `--page-height: 11in` was added to `tokens.css` for the first-paint gap before
      `PageSurface.apply()` runs, mirroring the existing `--page-width` default. This changes the
      MINIMUM only — Flow stays one continuous `#editor` element, no seams/capsules/pagination
      introduced (Fork A's "no page-break chrome" invariant intact; only the floor changed).
- [x] **Step 4 — check both paper sizes and both directions** (A4 + Letter; LTR + RTL profile), so the
      fix is not a Letter-only or LTR-only patch. Re-run the Flow/print neighbours for regressions.
      All 4 combinations (Letter/A4 × LTR/RTL) green. Neighbours: `tests/e2e/flow/` 4/4,
      `tests/e2e/filmustageation/{flow-page-presence,flow-rail-and-marker,
      flow-settings-page-color-line-numbers}.spec.js` 24/24, `tests/e2e/settings/
      page-setup-ownership.spec.js` 5/5, `tests/e2e/rtl/` 9/9, `tests/e2e/filmustageation/{print-
      contract,print-preview-review-bar,print-recognition-underline,print-truth-unification}.spec.js`
      33/33 — all green, no regressions (2 transient parallel-worker flakes reproduced identically
      with the fix reverted, both pass serially). **1 pre-existing unit-test conflict found and left
      unedited per doctrine** (`tests/unit/shell/editor-page-color.test.js` literally asserts
      `min-height: auto`, a Fix-2/Fork-A invariant this ratified slice supersedes) — reported as
      GAP-2-4, not fixed here. Full numbers: `docs/plans/evidence/S2.3F-new-doc-geometry.md`.
- [x] **Step 5:** Close GAP-2-1 in the §0.5 gap ledger + HANDOFF. **Step 6: SLICE CLOSE RITUAL (§0.3).**

Commit message: `fix(editor): New doc paints at full page size in Flow (GAP-2-1, S2.3F)`

---

## Phase 7 - UI localisation + application RTL (RTL-16...RTL-21) LAUNCH-BLOCKING

**Opened 2026-07-28 by the user's scope ruling:** *"yes and it is an essential part of the launch,
this system will not be launched without them."* Origin: **GAP-4-2**
(`docs/plans/evidence/GAP-4-2-ui-localization-audit.md`).

**What this phase is, in one line:** the *document* speaks Kurdish; the *application around it* does
not. Today a Kurdish writer uses a left-to-right ENGLISH program to write a right-to-left Kurdish
script. Phase 4 fixed the page; this phase fixes the tool.

**Two independent axes - do not conflate them (this is the phase's central rule):**
- **UI direction** - which way the *chrome* lays out. Owned by the Interface Language setting.
- **Document direction** - which way the *script* reads. Owned by the document profile (RTL-01).

An English UI must be able to hold an RTL script, and a Kurdish UI must be able to hold an LTR
script. Every slice below is judged against that. The existing `dir` assignments
(`tab-manager.js:110`, `print-renderer.js:103`, `scene-navigator.js:150`, `tags.js:295`,
`review-bar.js:599`) are all **document**-owned and must stay that way.

**Ordering rationale:** direction-first, translation-second. Slices S7.2 + S7.3 deliver a fully
mirrored UI **while it is still in English** - independently valuable, immediately testable, and
most of what a Kurdish user actually feels. Translation (S7.4 to S7.6) carries an **external
dependency** (native reviewers) and so is started early in parallel: sourcing a reviewer must not
become the last thing standing between the product and launch.

**Placement:** runs after Phase 4 and before Phase 5, because it is a BUILD phase with a long lead
time while Phase 5 is a short QA sweep. S6.1 (roll-up) stays last regardless.

### Slice S7.1: UI-localisation architecture brief (writing only, no code)

**Files:** Create `docs/plans/evidence/S7.1-ui-localisation-brief.md`

- [ ] **Step 1: Decide and record the architecture**, with a rationale per decision:
      catalogue format and where it lives; key naming convention; lookup API surface and how a
      missing key behaves (must be *visible*, never a silent English fallback that hides gaps);
      whether the language change applies live or requires restart (the registry currently says
      `restartRequired: true` - confirm or change it deliberately); who owns UI direction and how it
      stays separate from document direction; how plurals and interpolation work; how the Settings
      *registry's own* labels/descriptions get translated (they are data, not markup - a distinct
      problem worth naming now).
- [ ] **Step 2: Enumerate the surface.** Produce the full inventory of strings to convert
      (`renderer/js/**` literals + `index.html` markup + settings-registry labels/descriptions),
      with a count per file - the translation volume must be known before a reviewer is asked.
- [ ] **Step 3: SLICE CLOSE RITUAL (0.3)**

Commit message: `docs(editor): UI-localisation architecture brief (S7.1)`

### Slice S7.2: Wire the setting + app-level direction (RTL-16, RTL-17)

**Files:** Modify `renderer/js/shell/shell-applicators.js`, `renderer/index.html`;
Create `rwanga-editor/tests/e2e/localisation/ui-direction.spec.js`

- [ ] **Step 1: Register a `language` applicator** so the setting stops being PERSISTS_ONLY. It sets
      `lang` and `dir` on the shell root from the chosen language, and nothing else.
- [ ] **Step 2: Prove the two axes stay separate** - the spec must cover all four combinations:
      {UI ltr, UI rtl} x {document ltr, document rtl}. An RTL script inside an English UI must still
      render exactly as S4.2 measured it; that is the regression this slice can most easily cause.
- [ ] **Step 3: Verify the setting row is no longer greyed** (`_isPersistsOnly` returns false, the
      "Behavior not wired yet." helper is gone) and that the choice survives a restart.
- [ ] **Step 4: Flip RTL-16 + RTL-17. SLICE CLOSE RITUAL (0.3)**

Commit message: `feat(editor): wire Interface Language + app-level UI direction (RTL-16/17, S7.2)`

### Slice S7.3: Mirror the chrome - logical properties sweep (RTL-18)

**Files:** Modify `renderer/css/shell.css`, `settings-workspace.css`, `components.css`,
`overlays.css`; Create `rwanga-editor/tests/e2e/localisation/chrome-mirror.spec.js`

- [ ] **Step 1: Convert physical to logical** exactly as R1 did for the print blocks: same
      magnitudes, expressed against the start/end axis. Baseline to beat: `shell.css` 25 physical /
      12 logical, `settings-workspace.css` **13 physical / 0 logical**, `components.css` 3/4.
      Physical values that are genuinely physical (window controls that must track the OS title-bar
      side) stay physical **and get a comment saying why** - the sweep is not blind.
- [ ] **Step 2: Playwright geometry at both UI directions** - sidebar, activity rail, toolbar, tab
      bar, panels, Settings workspace, dropdowns and modals all mirror; nothing overlaps; nothing
      escapes the viewport.
- [ ] **Step 3: Source guard** - a test that fails when new physical left/right appears in chrome
      CSS without the documented exemption comment, so the sweep cannot silently rot.
- [ ] **Step 4: Pick up RTL-CHROME-01** (deferred observation): line numbers and the drafting-guide
      line stay on the LTR side regardless of DOCUMENT direction. Adjacent but a different axis -
      judge it against document direction, not UI direction, and record the verdict.
- [ ] **Step 5: Flip RTL-18. SLICE CLOSE RITUAL (0.3)**

Commit message: `feat(editor): mirror app chrome via logical properties (RTL-18, S7.3)`

### Slice S7.4: The translation layer (RTL-19)

**Files:** Create `renderer/js/shell/i18n.js` + `renderer/locales/en.json`;
Modify every module holding a UI literal; Create `tests/unit/shell/i18n.test.js` +
`tests/unit/shell/no-hardcoded-ui-strings.test.js`

- [ ] **Step 1: Ship the lookup + the English catalogue** per the S7.1 brief. English is authored as
      a real catalogue, not as a fallback - if English is not a translation like any other, the
      other languages will always be second-class.
- [ ] **Step 2: Convert the inventory from S7.1** - `renderer/js/**` literals, `index.html` markup,
      and the settings-registry labels/descriptions.
- [ ] **Step 3: Guard test** that fails on a new hardcoded UI string literal. Without it the
      catalogue rots the first time someone is in a hurry.
- [ ] **Step 4: Missing keys must be loud** (per the S7.1 decision), never a silent English fallback.
- [ ] **Step 5: Flip RTL-19. SLICE CLOSE RITUAL (0.3)**

Commit message: `feat(editor): translation layer - UI strings become keys (RTL-19, S7.4)`

### Slice S7.5: Kurdish (Sorani) UI translation (RTL-20)

- [ ] **Step 1: Translate the full catalogue** to Sorani Kurdish into `renderer/locales/ku.json`.
- [ ] **Step 2: Native review - a HARD STOP requiring the user** (START rule 6: a person is outside
      an agent's power). Record the reviewer's name and sign-off date in the evidence file. **Do not
      fabricate or self-approve a translation review.**
- [ ] **Step 3: Coverage walk** - every surface in Kurdish with zero missing-key markers; screenshots
      of the main surfaces as evidence.
- [ ] **Step 4: Flip RTL-20. SLICE CLOSE RITUAL (0.3)**

Commit message: `feat(editor): Kurdish (Sorani) UI translation (RTL-20, S7.5)`

### Slice S7.6: Arabic UI translation (RTL-21)

- [ ] **Step 1: Translate the full catalogue** to Arabic into `renderer/locales/ar.json`.
- [ ] **Step 2: Native review - HARD STOP, same rule as S7.5.**
- [ ] **Step 3: Coverage walk + evidence.**
- [ ] **Step 4: Flip RTL-21. SLICE CLOSE RITUAL (0.3)**
      **Ask the user first** whether Arabic may ship post-launch (P1) if no reviewer is available.
      Kurdish is non-negotiable; Arabic's launch status is a decision, not an assumption.

Commit message: `feat(editor): Arabic UI translation (RTL-21, S7.6)`

### Slice S7.7: Phase close - full-app localisation walk

- [ ] **Step 1: Walk every surface in each language x each direction**, with an RTL script open in
      an LTR UI and vice versa, and record it.
- [ ] **Step 2: Confirm RTL-16...RTL-21 all TRUE**; reconcile the checklist totals.
- [ ] **Step 3: SLICE CLOSE RITUAL (0.3)**

Commit message: `qa(editor): full-app localisation walk - Phase 7 closed (S7.7)`

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
