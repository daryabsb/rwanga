# Rwanga Editor — Checklist Reality Audit

> **Mission:** stop feature work and report where the project really stands.
> **Date:** 2026-06-01 · **Branch:** `main` (worktree `E:/api/rwanga`, confirmed) · **No implementation performed.**
> **Method:** read every checklist + the Filmustageation audit/doctrine cluster, cross-checked the launch checklist's status column against shipped code and the most recent session handoff. This document does not change any checklist; it reports the gap between them and reality.

---

## TL;DR

1. **The designated source of truth is `docs/RWANGA_IDE_LAUNCH_CHECKLIST.md`** (233 items, 60 P0). `RWANGA_IDE_ALIVE_APP_CHECKLIST.md` is its dormant Phase-2 sequel and must not be used yet.
2. **The launch checklist's status column is materially STALE — frozen at 2026-05-22.** Roughly ten days of shipped work (Settings subsystem, PDF export, RTL R1, slug resolver, Print recognition, scene-sidebar SN.1, Print-Preview review bar) never updated it, in violation of the checklist's own Operating Rule 6.
3. **The document even disagrees with itself:** its header snapshot says *P0: 28 TRUE / 22 PARTIAL / 6 UNKNOWN / 4 FALSE*; its closing verdict says *19 TRUE / 29 PARTIAL / 8 UNKNOWN / 4 FALSE*. Both are stale anyway.
4. **Filmustageation is NOT done — it is Partial, and front-loaded on paper.** Most of it is audits, doctrine, and designer direction; only a handful of small slices shipped. A second "redesign_campaign V2" (2026-05-31, still untracked) re-opened Flow's direction on top of already-shipped Phase-1 Flow slices.
5. **The thing the user actually feels — Flow↔Print rhythm mismatch, Print Preview feeling worse than the designer direction, fragile forms, weak scene-list hierarchy — is real and is documented**, but it sits in *audits and design briefs that have not been implemented.* These are the true blockers to a usable writing app, not slug/architecture work.

---

## 1. Which checklists exist?

| File | Type | Scope | Current? |
|---|---|---|---|
| `docs/RWANGA_IDE_LAUNCH_CHECKLIST.md` | **Status tracker** (233 items, 60 P0) | "Can Rwanga launch?" | **Designated SoT, but status frozen 2026-05-22 — stale** |
| `docs/RWANGA_IDE_ALIVE_APP_CHECKLIST.md` | Status tracker (Phase 2) | "Is Rwanga alive?" — soul/feel | **Dormant by design.** Entry gate not met; all boxes unchecked |
| `rwanga-editor/docs/rwanga-settings/RWANGA_SETTINGS_IMPLEMENTATION_CHECKLIST.md` | **Per-PR procedural gate** | "Did this Settings PR follow the constitution?" | Current as a process doc; **not** a status tracker |
| `rwanga-design-kit/.../SCENE-CHECKLIST.md` | **Script-content checklist** | Rewrite of the sample screenplay *The Unknown Guest* | Not an app checklist — irrelevant to launch state |

### Filmustageation cluster (`rwanga-editor/docs/Filmustageation/`)
This is **not a checklist** — it is a body of **audits + doctrines + designer direction**, mostly *investigation-only*:

- **Doctrines / direction (decided, mostly unbuilt):** `redesign_campaign/PRINT_TRUTH_DOCTRINE_V1.md`, `RTL_SCREENPLAY_CONVENTION.md`, `SLUG_TRUTH_DOCTRINE_V1.md`, `FLOW_VIEW_UX_DIRECTION_V2.md`, `PRINT_PREVIEW_UX_DIRECTION_V2.md`, `ENGINEERING_IMPLEMENTATION_GUIDE.md`, `IMPLEMENTATION_MAP_PHASE1.md`, `SCENE_SIDEBAR_CATALOGUE_UX_DIRECTION.md`, `PRINT_PREVIEW_REVIEW_SURFACE_UX_DIRECTION.md`.
- **Audits (investigation-only):** `PRINT_PREVIEW_PHASE0_AUDIT.md`, `PRINT_PREVIEW_FORMATTING_FIDELITY_AUDIT.md`, `RTL_PRINT_PREVIEW_FORENSIC_AUDIT.md`, `RTL_SCREENPLAY_DESIGNER_BRIEF.md`, `FLOW_SLUG_CONVERGENCE_AUDIT.md`, `SCENE_HEADING_IDENTITY_AUDIT.md`, `SLUG_RESOLVER_AUDIT.md`, `PRINT_RECOGNITION_BUNDLE_PHASE0.md`.

**There is no dedicated "writing-workflow" status checklist.** The closest coverage is Launch-checklist Section 4 (Text formatting) + Section 5 (Screenplay writing toolbox). A "print preview / export" checklist exists only as Launch §11/§12 plus the Filmustageation Print audits — there is no standalone tracker.

---

## 2. Which checklist is the current source of truth?

**`docs/RWANGA_IDE_LAUNCH_CHECKLIST.md` is the binding source of truth by doctrine** (it declares itself "the single source of truth for *Can Rwanga launch?*", and memory confirms it as the launch constitution). **The ALIVE_APP checklist is the second chapter and is explicitly dormant** until the launch P0 set is TRUE and the app is visually verified.

**But the launch checklist is not currently *truthful*.** Its status snapshot is dated **2026-05-22** and has not been maintained since, even though substantial work shipped after that date. Concrete proof of staleness:

| Checklist claim (frozen 2026-05-22) | Reality now | Evidence |
|---|---|---|
| AS-01…AS-17, ES-01…04, RTL-14, AS-06: **"No settings UI exists"** (FALSE / "Settings — build") | A full Settings subsystem exists and is wired | `renderer/js/shell/settings-{registry,store,applicators,validators,migrations,search,layout}.js`, `shell/panels/settings.js`, `shell/workspaces/settings-workspace.js`, `css/settings-workspace.css`; "131 settings e2e pass" + **Settings Constitution locked 2026-05-26**; settings form-styling fix `95916e51` |
| PP-14 / IE-04 / MT-04: **PDF export "only IPC plumbing exists; no content rendering"** (FALSE/UNKNOWN, P0) | PDF export renders, and a multi-page bug was fixed + pushed 2026-05-30 | `renderer/js/export/pdf-export.js`, `electron/bridge/export-pdf.js`, `electron/lib/pdf-print-options.js`, tests `pdf-export.test.js` / `export-pdf-wiring.test.js`; 2026-05-30 handoff. **Now PARTIAL, not FALSE** (carries failing tests — see §3) |
| QG-01: **"1024/1024 green"** (TRUE) | Suite carries **57 pre-existing failures** | 2026-06-01 handoff §"Pre-existing red" (shell ownership/keyboard/visual-comfort, editor-recovery-phase3, pdf-export, parenthetical-box-geometry) |
| RTL-* indentation collapse | **R1 shipped** (logical-property mirror) | `PRINT_PREVIEW_FORMATTING_FIDELITY_AUDIT.md` "R1 verified correct" |

**Verdict for Q2:** *The launch checklist is the source of truth for **what** must be true; it is no longer a reliable record of **what is** true.* Operating Rule 6 ("every step updates this checklist — no exceptions") was not honored by the Filmustageation / settings / slug track, which ran as a parallel campaign and updated its own docs instead. **Reconciling the launch checklist against reality is itself an overdue task.**

---

## 3. TRUE / PARTIAL / FALSE / UNKNOWN

Two readings are given: the checklist's own (stale) accounting, and the corrections this audit can support with evidence. A full 233-item re-derivation was **not** run (out of scope; would require the QA verification sweep the checklist itself calls for).

### As the checklist states it (P0, 2026-05-22)
- Header snapshot: **28 TRUE · 22 PARTIAL · 6 UNKNOWN · 4 FALSE**
- Closing verdict (same doc): **19 TRUE · 29 PARTIAL · 8 UNKNOWN · 4 FALSE**
- The internal disagreement is itself a finding: the document's accounting drifted within a single file.

### The 4 hard P0 FALSE items it names
- **SW-08** — RTL scene-heading slug not parsed into heading fields (lands in an `action` block; pickers render empty). *Still open.*
- **PP-14 / IE-04** — PDF export non-functional. **STALE → now PARTIAL** (renders; multi-page fix shipped; `pdf-export` tests currently red).
- **QG-12** — "No known P0/P1 bugs" — FALSE while the above stand. *Still FALSE.*

### Corrections this audit can support (evidence-backed)
- **Stale-FALSE → at least PARTIAL:** the entire Settings band (AS-01…17, ES-01…04, AS-06, RTL-14) — a real, wired Settings subsystem exists; each control is now "real+wired or honestly disabled" per the Settings Constitution. They should be re-assessed individually, not left at blanket FALSE.
- **Stale-FALSE → PARTIAL:** PP-14 / IE-04 / MT-04 (PDF export now produces output).
- **Stale-PARTIAL → likely TRUE pending RTL leading:** RTL print indentation (R1 logical-property mirror verified).
- **Stale-TRUE → now PARTIAL/regressed:** QG-01 (suite is no longer all-green; 57 failures), and therefore QG-12 is *more* FALSE, not less.

### Genuinely UNKNOWN (honest, unchanged)
PF-13 (console-clean runtime), PF-14 (large-doc perf), MT-12 (manual page break), LR-01 (installer build) — none assessed at runtime; no evidence either way. These remain the honest UNKNOWNs.

**Bottom line:** the *shape* of the checklist is right, but **at least ~25 items (the whole Settings band + the PDF band + the test-gate items) are mis-stated.** No one should quote the current numbers as the project's status.

---

## 4. Which visible writing basics are still failing?

These are corroborated by the Filmustageation audits and the user's own observations — and **none of them are yet implemented**; they live in audits/briefs:

1. **Flow ↔ Print rhythm mismatch (PP-D6).** Flow body leading ≈ 20.8px (1.3) vs Print 16px (1.0); character cues centered/bold in Flow vs indented/400-weight in Print; dialogue centered vs columned. Confirmed; a designer decision under the design freeze. *(`PRINT_PREVIEW_FORMATTING_FIDELITY_AUDIT.md`)*
2. **RTL body leading too tight (PP-D5).** 1.0 collides Arabic diacritics; needs ~1.2–1.3. Confirmed, but **pagination-coupled** — cannot be a free CSS tweak. *(same)*
3. **Print Preview has no review chrome (Phase-0 audit).** Pipeline is correct, but no toolbar, no visible page count, no prev/next/jump, no zoom/fit, no in-surface export. The "Review Bar v1" exists as a skeleton; the rest is designed-not-built. *(`PRINT_PREVIEW_PHASE0_AUDIT.md`, `PRINT_PREVIEW_REVIEW_SURFACE_UX_DIRECTION.md`)*
4. **Settings/forms polish is fragile.** The most recent fix (`95916e51`, local-unpushed) repaired controls that fell back to translucent rgba because `--surface-*` tokens were never defined. Wired now, but visual hardening is shallow and the commit is not even pushed.
5. **Scene-list readability / hierarchy is thin.** Direction exists (orientation-not-management, current-vs-selected separation invariant, auto-scroll); only SN.1 (auto-scroll) shipped. Scene cards still lack visual weight/state. *(`SCENE_SIDEBAR_CATALOGUE_UX_DIRECTION.md`; ALIVE §2)*
6. **RTL scene-heading slug mapping broken (SW-08, P0 FALSE).** The slug lands in an action block; heading fields render empty `— /`.
7. **Text-formatting marks unverified (TF-01…16, mostly PARTIAL/UNKNOWN).** Bold/italic/underline/etc. are defined but their apply/persist/round-trip behavior is untested.
8. **Flow's slug word-order diverges from Print** (`SETTING — TIME / LOCATION` vs `SETTING LOCATION — TIME`). Real recognition gap — but it is a *content/convention* decision, **not** a rendering bug, and it touches the LOCKED Flow framework.

---

## 5. Is Filmustageation actually done?

**No — Partial, and paper-heavy.**

**What shipped (small slices):** SlugResolver V1 (`728b53c4`), Print Recognition Package A — brand-pink slug underline (`3a197fd8`), RTL R1 logical-property mirror, scene-sidebar SN.1 (auto-scroll), Print-Preview Review Bar v1 skeleton, and the earlier Flow Phase-1 slices (F1/F6/F2/F3/F7 per the 2026-05-30 handoff).

**What is written but NOT built (the bulk):** the entire `redesign_campaign/` V2 set (2026-05-31, **still untracked**) — Flow page-presence/shadow/centering, line-rail personality, Inspector un-docking, the two new Flow settings, Print Preview chrome, RTL leading relaxation, and Flow↔Print convergence — is **direction and doctrine only**. The engineering guide explicitly states it "does not authorize a sprint."

**Direction has also churned:** the V2 campaign re-opened Flow's direction (e.g., reversing "remove the gutter" → "keep + elevate the gutter", "warm the paper" → "white by default, color is a setting") *on top of* already-shipped Phase-1 Flow work. So part of what shipped is now partly re-specified by uncommitted docs.

**Net:** Filmustageation has produced excellent diagnosis and a few safe, geometry-neutral wins. It has **not** delivered the felt redesign — the writing surface still reads as an IDE, and Print still feels colder than the designer direction. Done: **Partial.**

---

## 6. Top 10 blockers to a usable writing app

Ranked by impact on a writer's daily experience, not by checklist priority:

1. **Flow↔Print rhythm/feel mismatch (PP-D6).** The two surfaces a writer lives in look like different apps. Needs a designer ruling, then a slice.
2. **Print Preview has no review chrome.** No page count, no navigation, no zoom — the preview is a dead surface. Review Bar v1 must be finished.
3. **The launch checklist is not trustworthy.** You cannot prioritize against a status column that is 10 days and ~25 items stale. Reconcile it before any planning.
4. **PDF export is PARTIAL with red tests.** Export is the writer's payoff; it renders but `pdf-export` tests are failing and it is unverified against the page-truth profile (MT-04).
5. **RTL scene-heading slug mapping broken (SW-08, P0).** Kurdish/RTL is the headline market; the slug lands in the wrong block.
6. **RTL body leading too tight (PP-D5).** Arabic text is hard to read at 1.0 — but it is pagination-coupled, so it is a real slice, not a tweak.
7. **Scene-list lacks weight and state.** The list a director reads to understand the script is flat; only auto-scroll shipped.
8. **Settings polish shallow + the fix is unpushed (`95916e51`).** Controls were unreadable until days ago; hardening is incomplete and not on origin.
9. **Text-formatting marks unverified (TF band).** Bold/italic/highlight/etc. have no behavior tests — a writing basic that may silently fail.
10. **Test suite is red (57 failures) and QG-12 is FALSE.** No green baseline means every new slice ships blind; "no known P0/P1 bugs" cannot be claimed.

---

## 7. What to fix first — smallest visible-value slices, in order

Each is scoped to be a single behavior-preserving or design-approved slice with a Playwright proof, per the project's verify-before-commit doctrine. **None is started here.**

1. **Reconcile the launch checklist (paperwork, zero code).** Walk the Settings band, the PDF band, and QG-01/QG-12 and re-state them against shipped reality with cited evidence. Restores a trustworthy map. *(Touches `RWANGA_IDE_LAUNCH_CHECKLIST.md` only.)*
2. **Push `95916e51` (settings styling fix) or consciously drop it.** It is the only local-unpushed commit; resolve it before anything else.
3. **Get the suite to a known baseline.** Triage the 57 failures into "pre-existing, accepted" vs "must-fix" so future slices have a green gate. No fixing campaign — just an honest baseline + the `pdf-export` reds (since export is now a real feature).
4. **Finish Print-Preview Review Bar v1** (visible exit + live `N/total` + prev/next/jump + Fit/zoom). All data already exists; geometry-free; highest felt payoff. *(`PRINT_PREVIEW_REVIEW_SURFACE_UX_DIRECTION.md`)*
5. **Get a designer ruling on Flow↔Print feel (PP-D6), then one CSS-only convergence slice** for the non-pagination parts (cue/dialogue presentation), leaving leading for its own slice.
6. **RTL leading slice (PP-D5)** as a dedicated pagination-recalibration slice (it is geometry-coupled — do not bundle it with #5).
7. **Scene-list weight slice** — give cards state/visual hierarchy per the sidebar direction (still orientation-not-management). *(ALIVE §2 / sidebar direction.)*
8. **SW-08 RTL slug mapping** — only after #5/#6, since it shares the RTL/heading surface.

**Explicitly defer:** any further slug/architecture work (SlugResolver is shipped; Flow slug convergence touches the LOCKED Flow framework and is gated). Per the audits, the slug word-order gap is a recognition nicety, **not** a writing blocker — it does not earn priority over rhythm, preview chrome, RTL legibility, or export.

---

## Special-attention findings (as requested)

- **Flow vs Print line spacing/rhythm:** Real and documented (PP-D6, 20.8px vs 16px). **Designer decision, then one slice.** Not yet built.
- **Print Preview worse than designer direction:** Confirmed — the render pipeline is correct but the *room around the pages* (chrome/navigation/zoom/export) is missing; Review Bar is a skeleton. Finishing it is the single highest-payoff visible slice.
- **Settings/forms still fragile:** Confirmed — the token fix is recent and unpushed; visual hardening is shallow.
- **Scene-list readability/hierarchy:** Confirmed thin — only SN.1 shipped; direction exists for the rest.
- **Slug/architecture:** **Does not block writing.** The checklist proves the blockers are rhythm, preview chrome, RTL legibility, export, and scene weight — not slug order. Avoid further slug work.

---

## STOP

This is an audit only. No code, no refactor, no new features, no checklist edits, no file cleanup were performed. Recommended next action is **item 7.1 — reconcile the launch checklist** so the project is planning against a truthful map. Await authorization before any implementation slice.
