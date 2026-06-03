# Rwanga IDE — Launch Readiness Reconciliation Report

> **Date:** 2026-06-02 · **Branch:** `main` (worktree `E:/api/rwanga`, confirmed) · HEAD `95916e51`
> **Task:** reality-reconcile the launch checklist against actual code + running tests. **No implementation performed.**
> **Method:** five parallel code-verification sweeps (Settings · Print/PDF/Export · RTL/Manuscript · Screenplay/Slug · Foundation/Persistence) reading actual source, plus a full unit-test run for the Quality-Gates baseline. Checklist statuses were **not trusted** — every claim below is sourced to code, a test, or a test-run result.

---

## 0. Headline

The launch checklist's *status prose* (frozen 2026-05-22) was badly pessimistic. The four "hard P0 FALSE" items it named are now mostly resolved in code:

| Old P0 FALSE (2026-05-22) | Verified reality 2026-06-02 |
|---|---|
| **SW-08** RTL slug lands in an action block, fields empty | **FIXED → TRUE.** Scene heading is structured (`setting`/`time` attrs + `location` content); normalizer reads the structure; slug never lands in an action block. `screenplay-normalizer.js:125-129`, `schema-v3.js:124-130` |
| **PP-14 / IE-04** PDF export is plumbing-only | **BUILT → TRUE.** Full pipeline renders a real multi-page PDF to disk via offscreen `webContents.printToPDF()`. `renderer/js/export/pdf-export.js:168-205` → `electron/bridge/export-pdf.js:79-105`; tests `pdf-export.test.js`, `export-pdf-wiring.test.js` |
| **QG-12** "no known P0/P1 bugs" | **Still FALSE** — but now only because of 28 red tests + the RTL-leading defect + an unverified installer build (not because of broken core features) |
| *(snapshot prose)* "autosave/recovery do not exist" | **Already FALSE in the prose, TRUE in the table.** PF-06/PF-08 rows were updated 2026-05-22 with passing tests; the §3 prose was never synced. Autosave + crash recovery are wired and tested (`autosave.js`, `recovery.js`, `recovery.spec.js` 2/2) |

**The real remaining work is a verification sweep + a packaged build + getting the test suite green + one RTL-leading decision — not feature construction.**

---

## 1. Reconciled checklist — verified status by band

Statuses are **today's reality**. "→" shows the change from the 2026-05-22 checklist. Evidence is `file:line` or a test name.

### Settings (AS-* / ES-* / RTL-14) — was "no settings UI exists"; now a real 62-setting subsystem (22 wired, 40 honestly-disabled per the Settings Constitution)
| ID | Was | Now | Evidence |
|---|---|---|---|
| AS-01 Appearance | FALSE | **TRUE** | 7 `appearance.*` entries (5 wired) — `settings-registry.js:440-494`, `settings-layout.js:99-108` |
| AS-02 Theme | PARTIAL | **TRUE** | wired applicator `shell-applicators.js:230-249` (resolves `system` via matchMedia) |
| AS-03 Accent color | FALSE | **FALSE** | not in registry (`shell-applicators.js:49` lists it as absent) |
| AS-04 Font choices | FALSE | **TRUE** | `editor.fontFamily` wired `editor-applicators.js:72-77` |
| AS-05 Font size | FALSE | **TRUE** | `editor.fontSize` wired `editor-applicators.js:83-87` |
| AS-06 Language | PARTIAL | **PARTIAL** | registered `settings-registry.js:83-90`, present in panel, but PERSISTS_ONLY (no applicator) — honestly disabled |
| AS-07 Default direction | FALSE | **TRUE** | `editor.scriptLanguage` wired `editor-applicators.js:132-137` |
| AS-08 Default paper size | FALSE | **TRUE** | `pageSetup.paperSize` wired (generic handler) `shell-applicators.js:425-434` |
| AS-09 Default screenplay profile | FALSE | **PARTIAL** | registered `settings-registry.js:218-226`; PERSISTS_ONLY |
| AS-10 Autosave interval | FALSE | **TRUE** | wired to `Rga.Autosave.setInterval` `shell-applicators.js:516-531` |
| AS-11 Backup location | FALSE | **PARTIAL** | registered `settings-registry.js:433-437`; PERSISTS_ONLY |
| AS-12 Customizable shortcuts | FALSE | **TRUE** | 10 `kb.*` entries wired via `KR.register` `shell-applicators.js:380-384` |
| AS-13 Accessibility | FALSE | **FALSE** | not in registry |
| AS-14 Spellcheck | UNKNOWN | **TRUE** | `editor.spellcheck` wired `editor-applicators.js:109-113` |
| AS-15 Telemetry/privacy | UNKNOWN | **FALSE** | not in registry |
| AS-16 Export defaults | FALSE | **PARTIAL** | 7 `export.*` entries registered; PERSISTS_ONLY |
| AS-17 Print defaults | FALSE | **TRUE** | `pageSetup.*` wired `shell-applicators.js:425-434` |
| ES-01 Editor font | PARTIAL | **TRUE** | = AS-04 |
| ES-02 RTL font | PARTIAL | **PARTIAL** | direction wired via scriptLanguage; no dedicated RTL-font picker |
| ES-03 Line height | FALSE | **TRUE** | `editor.lineHeight` wired `editor-applicators.js:95-103` |
| ES-04 Paragraph spacing | FALSE | **FALSE** | not in registry |
| ES-07 Gutter visibility | UNKNOWN | **TRUE** | `editor.showLineNumbers` wired `editor-applicators.js:184-187` |
| ES-08 Line numbers | PARTIAL | **TRUE** | = ES-07 |
| ES-11 Toolbar visibility | UNKNOWN | **TRUE** | `appearance.formatToolbar` wired `shell-applicators.js:489-491` |
| ES-12 Inspector visibility | PARTIAL | **PARTIAL** | inspector exists; no toggle setting in registry |
| ES-13 Bottom-panel default | PARTIAL | **PARTIAL** | only `appearance.statusBar` wired `shell-applicators.js:135-138` |
| RTL-14 Lang-specific typography | FALSE | **PARTIAL** | per-script `scriptLanguage`/`margins`/`profile` travel with `.rga`; no dedicated RTL-typography UI |

> **Settings Constitution holds:** the 40 unwired controls are rendered at 60% opacity, `aria-disabled`, "Behavior not wired yet." — no fake/PERSISTS-ONLY-pretending-real controls. `settings-workspace.js:889-960`.

### Print Preview + PDF Export (PP-* / IE-* / MT-04)
| ID | Was | Now | Evidence |
|---|---|---|---|
| PP-01 Paper size | PARTIAL | **TRUE** | `print-renderer.js:94-97`; PDF parity `pdf-print-options.js:45-46` |
| PP-03 Margins | PARTIAL | **TRUE** | `print-renderer.js:104-110` (RTL-mirrored) |
| PP-04 Header | PARTIAL | **TRUE** | `print-renderer.js:123-132` |
| PP-05 Footer | PARTIAL | **TRUE** | `print-renderer.js:170-178` |
| PP-07 Title page | PARTIAL | **PARTIAL** | `renderModel.title` rendered; title-page-as-cover deferred |
| PP-13 Print preview | PARTIAL | **TRUE** | one `.rga-page-sheet` per PageMap page `print-renderer.js:60-62`; **Review Bar fully built** (see §1a) |
| PP-14 PDF export | FALSE | **TRUE** | real offscreen `printToPDF()` → file write `export-pdf.js:79-105` |
| PP-16 RTL print | PARTIAL | **TRUE** | `dir=rtl` + mirrored padding `print-renderer.js:85-109` |
| IE-04 PDF export | FALSE | **TRUE** | = PP-14 |
| IE-05 Plain-text export | FALSE | **FALSE** | no text-export module exists |
| IE-07 Preserve RTL | UNKNOWN | **TRUE** | export sets `<html dir=rtl>` `pdf-export.js:117` |
| IE-08 Preserve formatting | UNKNOWN | **TRUE** | marks rendered in export `print-renderer.js:183-293`; test `pdf-export.test.js:208-230` |
| IE-09 Preserve scene structure | UNKNOWN | **TRUE** | `data-block-type`/`data-scene-id` emitted `print-renderer.js:187-188` |
| MT-04 PDF page-count == preview | UNKNOWN | **TRUE** | export reuses the identical pipeline `pdf-export.js:86-143` |

### 1a. Review Bar inventory (`review-bar.js`, 513 lines — substantially built)
**Present & wired:** visible exit (`← Done`), live `N / total` indicator (RAF-debounced on scroll), prev/next, jump-to-page, Fit-page, Fit-width, zoom stepper + % readout, Export-PDF button, document identity (title/paper/count), RTL bar mirroring, Enter/Esc/PageUp/PageDown keys.
**Missing (deferred slices, not blockers):** thumbnail rail, review-layers toggle, native Print button (present but disabled "coming soon"), title-page cover sheet, export-options popover.

### RTL + Manuscript (Section 2/3)
| ID | Was | Now | Evidence |
|---|---|---|---|
| SW-08 RTL slug → fields | **FALSE** | **TRUE** | structured heading; `screenplay-normalizer.js:125-129` |
| SW-23 RTL convention | PARTIAL | **TRUE** | direction from language + RTL font chain; `v2-to-v3.js:135`, `tokens.css:245` |
| MT-02 Markers stable | PARTIAL | **TRUE** | keep-with-next chains `pagemap-engine.js:94-128`; `page-break-stability.test.js` |
| MT-05 A4/Letter/Legal | PARTIAL | **TRUE** | `constants.js:37-39`, `page-setup-dialog.js:19-35` |
| MT-06 Margins | PARTIAL | **TRUE** | `editor-prosemirror.css:2297-2298`, `page-setup-dialog.js:45-63` |
| MT-07 Bottom margin respected | PARTIAL | **TRUE** | 0/65 sheets overflow — `slice-8-verification.md` |
| MT-10 Empty lines don't inflate | PARTIAL | **TRUE** | `pagemap-engine.js:54-77`; density campaign flipped TRUE |
| RTL-01 / RTL-02 Direction | TRUE | **TRUE** | `tokens.css:245`, `pdf-export.js:117` |
| RTL-11 RTL export correct | UNKNOWN | **TRUE** | direction preserved on export `pdf-export.js:117` (vocabulary localization still OFF — not a P0) |
| **R1 logical-property mirror** | (was the open RTL bug) | **SHIPPED** | `padding-inline-start` / `text-align:end` — `editor-prosemirror.css:2399,2410,2415,2427` (commit `566fcef9`) |
| **RTL body leading 1.0** | defect | **STILL FALSE (PP-D5)** | `.rga-page-sheet line-height:1.0` `editor-prosemirror.css:2301` — too tight for Arabic diacritics; pagination-coupled |

### Screenplay writing + marks (SW-* / TF-* / ES-15/16) — all verified TRUE
SW-01..05/07 (scene heading + pickers + custom slug), SW-09..13 (action/character/dialogue/parenthetical/transition), SW-14..17 (shot/note/flag/tag), SW-19/20 (numbering/navigator sync), TF-01..07 (bold/italic/underline/strike/color/highlight/clear — defined, wired, shortcut-bound), TF-13/15, ES-15/16 (Enter/Tab by block type). Evidence: `schema-v3.js`, `v3-commands.js:23-34`, `base-outer-marks.js:20-157`, `format-toolbar.js:383-404`, `nav-index.js`. **SlugResolver V1 shipped and routed** through Print/PageMap/Nav (`slug-resolver.js:114`, `print-renderer.js:222`, `pagemap-engine.js:73`, `nav-index.js:210`); word-order convergence with Flow is **deferred by design — not a launch blocker.**

### Foundation / persistence (PF-*) — stronger than the §3 prose claimed
Save/atomic-write (PF-04), autosave (PF-06), crash recovery (PF-08), unsaved-close guard (PF-11), dirty indicator (PF-07), tab switching (PF-10) — **all TRUE, all test-backed** (`atomic-write.test.js`, `autosave.spec.js`, `recovery.spec.js` 2/2, `close-guard.test.js`). Open as **verification gaps** (code works, dedicated proof missing): PF-01 (cold-start matrix), PF-02/PF-03/PF-05 (new/open/save-as E2E), PF-13 (runtime console audit).

### Quality Gates (QG-*) — real test run 2026-06-02
**`node --test`: 1621 tests · 1592 pass · 28 fail.**
| ID | Was | Now | Evidence |
|---|---|---|---|
| QG-01 Unit tests | TRUE ("1024/1024") | **PARTIAL** | 28 failures (see below) |
| QG-05 RTL fixture / QG-06 EN fixture / QG-07 round-trip / QG-11 crash recovery | TRUE | **TRUE** | unchanged, still green |
| QG-12 No known P0/P1 bugs | FALSE | **FALSE** | gated on the 28 reds + RTL leading + unverified build |

**The 28 failures are concentrated and non-core:** `tests/unit/shell/*` chrome-ownership / visual-comfort / breadcrumb / sidebar / keyboard / studio-panel (~22), `framework/parenthetical-box-geometry` (3), `editor/editor-recovery-phase3` (2), `shell/v1-1-regressions` titlebar theme-button (1). These are **UI-structure regression tests that the shell has evolved past** (the project's own "suspect the test first" pattern) plus one parenthetical geometry test and an older recovery *unit* test (the recovery *integration* spec passes). **No core data-loss / persistence / pagination test is red.**

### Coverage gaps (honest UNKNOWN — not auto-verified this pass)
- Full **Section 3 RTL** P0 set beyond RTL-01/02/11/14.
- Full **Section 14 Accessibility** items.
- **LR-01 installer build** — `electron-builder.yml` exists; no verified packaged build was produced or launched.

---

## 2. Top 10 Launch Blockers (ranked — only things that would stop a launch tomorrow)

1. **No verified installer build (LR-01, P0, UNKNOWN).** You cannot ship a binary you have not built and launched on a clean machine. Hard blocker.
2. **28 failing unit tests / QG-01 not green (P0).** A red suite means every change ships blind and QG-12 cannot close. Must be triaged to green (fix or quarantine-with-reason).
3. **QG-12 "no known P0/P1 bugs" is FALSE (P0).** Closes only after #1, #2, and the RTL-leading decision land.
4. **RTL body leading 1.0 is too tight (PP-D5).** For the headline Kurdish/RTL market this is a real readability defect on every exported page. Borderline blocker — needs an explicit ship-as-is-vs-fix decision, not silent shipping.
5. **PF-01 cold-start reliability unverified (P0).** "App opens reliably" has no launch-matrix evidence on a clean Windows profile. Cheap to close; must be done.
6. **PF-13 runtime console-clean audit (P0, UNKNOWN).** No runtime console pass across core flows. Cheap QA, but currently unproven.
7. **PF-02 / PF-03 / PF-05 lack direct round-trip E2E (P0, PARTIAL).** New/Open/Save-As work in code but the new→type→save→reopen and open-from-disk E2E proofs don't exist.
8. **Unverified RTL Section 3 + Accessibility Section 14 P0 clusters (UNKNOWN).** These were not auto-verifiable this pass; an honest QG-12 requires assessing them.
9. **PDF export has no end-to-end human smoke (MT-04 evidence).** The pipeline is wired and unit-tested, but no recorded "exported a real RTL + LTR script, opened the PDF, it's correct" pass exists.
10. **Code signing not in place (LR-02 plan only; LR-03 update blocked on it).** Unsigned binaries trigger SmartScreen/Gatekeeper friction. Tolerable for an alpha, but a named distribution risk.

## 3. Top 10 Non-Blockers (discussed often; do NOT stop launch — be ruthless)

1. **Slug word-order convergence (Flow vs Print).** Recognition nicety; resolver shipped; deferred by design. Touches LOCKED Flow framework. Not a writing blocker.
2. **Flow↔Print feel mismatch (PP-D6).** Cosmetic perception; Print is intentionally the truth surface. Designer call, post-launch.
3. **Plain-text export (IE-05).** PDF export covers the launch need.
4. **Native Print button in Review Bar.** Deferred; Export-PDF is the path.
5. **Review-Bar thumbnail rail + export-options popover.** Polish, designed-not-built.
6. **Breakdown toolbox (BD-01..15, all P3).** v2.
7. **Review/comments system (RV-01..14, P2/P3).** Notes/flags exist; threaded review is post-launch.
8. **Revision system (RS-01..08, P2/P3).** Production-color workflow is post-launch.
9. **Timeline.** Explicitly gated to "after the app feels alive"; P3.
10. **Import (DOCX/Fountain/FDX), accent-color/accessibility/telemetry settings, inspector future features, scene-card weight.** All P2/P3 or Phase-2 "Alive App" — none gate v01.

---

## 4. Launch Verdict

# 🟡 NEAR LAUNCH

**Why not LAUNCHABLE:** QG-12 is FALSE, the unit suite is red (28), there is no verified installer build (LR-01), the RTL-leading defect is undecided, and two P0 clusters (RTL §3, Accessibility §14) are unverified. By the checklist's own rule, PARTIAL/UNKNOWN block as hard as FALSE.

**Why not NOT-LAUNCHABLE:** every feature that used to make this NOT-launchable is now real and test-backed — persistence (save/autosave/recovery/close-guard), PDF export, Print Preview + Review Bar, the Settings subsystem, pagination/manuscript truth, the RTL logical-property mirror, and the previously-broken RTL slug mapping (SW-08). The screenplay writing core and formatting marks are wired and tested. **What stands between here and launchable is a verification sweep, a build, a green test run, and one typography decision — hours of disciplined closeout, not weeks of construction.**

---

## 5. Day Plan (ordered; ≤10; effort · value · launch-impact)

> Do these in order. Items 1–5 are the launch-critical path; 6–9 close the honesty gaps.

1. **Resolve `95916e51`** (push or drop the settings-styling commit). · ~5 min · clean tree · low-impact but unblocks a clean baseline.
2. **Triage the 28 red tests → green** (fix real ones; quarantine stale shell-chrome/visual-comfort tests with a written reason). · ~half day · trustworthy gate · **HIGH — unblocks QG-01 + QG-12.**
3. **Produce + smoke-launch a packaged Windows installer** (`electron-builder --win`, run on a clean user profile). · ~2-3h · proves it actually ships · **HIGH — LR-01, the hard blocker.**
4. **Cold-start launch matrix (PF-01) + clean-console runtime audit (PF-13)** on Windows. · ~1-2h · "it opens and is quiet" · **HIGH — closes 2 P0 verification gaps.**
5. **Add core round-trip E2E** (new→type→save→reopen, open-from-disk, Save-As). · ~2-3h · editor-trust proof · **HIGH — closes PF-02/03/05.**
6. **Decide RTL body leading (PP-D5):** ship 1.0 for v01 or run the pagination-recalibration slice. · decision ~15 min (fix +half day) · RTL readability · **MEDIUM-HIGH — recommend ship-as-is + post-launch fix; record the decision.**
7. **End-to-end PDF export smoke** on a real RTL + LTR script; open and eyeball the output. · ~1h · export confidence · **MEDIUM — produces MT-04/IE-07 evidence.**
8. **Verify the unassessed P0 clusters** (RTL Section 3 remainder + Accessibility Section 14). · ~2h · honest map · **MEDIUM — converts UNKNOWN→known; required for QG-12.**
9. **Close QG-12** once 2/3/4/5/7/8 land; update the checklist verdict. · ~30 min paperwork · the launch gate · **HIGH — the final flip.**

---

## STOP

Reconciliation complete. The launch checklist has been updated (dated 2026-06-02 verdict + reconciliation log + flipped band rows). No blockers were fixed; no features were built. Await review before starting any Day-Plan item.
