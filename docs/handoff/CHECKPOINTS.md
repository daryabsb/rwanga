# Rwanga — Checkpoint Log

Append-only. Newest at top. Never rewrite past entries (correct with a new one).
Template & rules: `PROTOCOL.md`.

---

## 2026-07-29 · S2.3F + S4.6F CLOSED — new-doc page size FIXED; Kurdish PDF diagnosed and ruled
- **Did (S2.3F — GAP-2-1, the oldest outstanding user complaint):** fixed it. The user re-raised it
  today ("you still owe me a fix on the page geometry on opening a new .rga document, the page is not
  created as the right A4 size"); it had been ticketed 2026-07-26 and reported verbally before that,
  and had never been given a fix-slice. **Root cause:** `renderer/css/editor-prosemirror.css:53-54`
  set `min-height: auto; height: auto` on the Flow surface, so page height was purely
  **content-driven**, and **no `--page-height` token existed anywhere** — `page-surface.js` only ever
  published `--page-width`. **Decisive measurement:** a new Letter doc painted at **227.59px on the
  first frame against a correct 1056px** (11in × 96dpi) = **21.5% of true size**, then crept to
  261.19px after two typed lines. **Fix:** `page-surface.js` now publishes `--page-height` alongside
  `--page-width`; the CSS consumes it as a **floor** (`height` stays `auto`); `tokens.css` carries an
  `11in` default for the first-paint gap. **After: Letter 1056px exact, A4 1122.52px exact, LTR and
  RTL, stable while typing.** Flow doctrine respected — one continuous `#editor`, no seams, capsules
  or pagination introduced (the doctrine's own regression test still green).
  Spec `rwanga-editor/tests/e2e/flow/new-doc-page-geometry.spec.js` **4/4** (Letter+A4 × LTR+RTL).
- **Did (S4.6F — GAP-4-1 diagnosis):** root-caused the Kurdish PDF text layer **by experiment, not by
  reading code**. With **zero shaping involved**, 9 of 21 dotted/diacritic Noto Naskh letters break
  their own `ToUnicode` mapping (to NUL or a wrong combining-mark codepoint) while the identical
  characters in Tahoma/Arial map **21/21** — only the font varied, so font-vs-pipeline is settled.
  **But a font swap cannot close it:** Noto→Tahoma on the same shaped sentence moves NUL only
  **37.4% → 20.4%**; the residual is **Chromium's own CMap generation dropping contextual/medial
  variants regardless of font**. A Latin control through the identical path extracts **0% NUL**,
  clearing the `printToPDF` options.
- **USER RULING 2026-07-29 — "do both sequentially, start with B":** ship honest now, improve after.
  **B executed:** RTL-11 and SW-23 stay **PARTIAL at launch BY DECISION**, both rows amended to state
  the measured number and the reason so the PARTIAL can never be mistaken for an oversight; GAP-4-1
  stays OPEN, **re-scoped post-launch**, its true fix re-pointed at a *different PDF text-layer path*
  rather than a different font. **A queued as slice S4.7F** (font repair — an improvement worth ~half
  the damage, which reopens the S4.2/S4.3 geometry verification and so must re-prove the page).
  ⚠ Recorded in HANDOFF Gates: **S6.1 must flip QG-12 as "green except this named, accepted defect",
  never as an unqualified TRUE** — otherwise the accepted hole silently disappears at roll-up.
- **Test-suite integrity — two latent reds found and re-pointed (no assertion weakened).** The S2.3F
  fix turned `editor-page-color.test.js` red because that test asserted `min-height: auto` — i.e. it
  asserted **the very defect GAP-2-1 was filed for**. Re-pointed the way S1.2 re-pointed the stale
  shell snapshots: it now asserts the ratified invariant (`min-height: var(--page-height)` floor
  **and** `height: auto`, so the no-growth-model property the guard exists to protect is still
  enforced), source cited inline. Running the suite also exposed a **second, older red nobody had
  caught**: `owned-chrome-menu-ownership.test.js` still declared exactly 8 menubar entries after slice
  **S3.1F** (2026-07-28) legitimately added a 9th (`overflow`) to close GAP-3-1 — S3.1F shipped its
  fix and left the suite red. Re-pointed to 9, source cited. **Unit suite restored to the S1.5
  baseline exactly: 1936 · 1935 pass · 0 fail · 1 skip.**
- **Evidence:** `docs/plans/evidence/S2.3F-new-doc-geometry.md`, `S4.6F-pdf-text-layer.md`.
- **Status deltas:** **GAP-2-1 CLOSED.** GAP-2-4 opened and CLOSED in the same close. GAP-4-1 remains
  OPEN, re-scoped post-launch by ruling. Launch-gate counts unchanged (**47 TRUE · 11 PARTIAL ·
  1 UNKNOWN · 7 FALSE**, 19 open of 66) — S2.3F closed a gap, not a checklist row.
- **Gaps surfaced:** **GAP-2-3 — Page Setup's paper-size dropdown does not work for anyone.** It
  emits `'A4'`/`'Letter'` while the registry accepts only lowercase, so Apply never changes the paper
  size. Found while fixing GAP-2-1, deliberately NOT fixed inside it (§0.2 scope freeze). Needs a
  small fix-slice plus a guard test asserting the control's emitted value is one the registry accepts
  — this class of case-mismatch bug will recur.
- **Housekeeping:** a stray `rwanga-editor/repro-tmp.js` left by the diagnosis harness was deleted
  (standing project rule: no orphaned scratch files in the tree).
- **Next action:** **S4.7F — GAP-4-1 track A** (font repair; improvement, must re-prove S4.2/S4.3
  geometry). Then **S7.1**, opening Phase 7. ⚠ Still waiting on the user: a named **Kurdish (Sorani)
  native reviewer** for S7.5, and a ruling on whether Arabic may ship post-launch if none is found.

---

## 2026-07-29 · S4.5 CLOSED — **PHASE 4 COMPLETE**; SW-23 verdict = PARTIAL (GAP-4-1 alone)
- **Did:** Executed slice S4.5, the SW-23 roll-up that closes Phase 4. SW-23 asks whether the RTL
  **profile** actually drives the convention or merely sets a direction flag. New spec
  `rwanga-editor/tests/e2e/rtl/rtl-profile-drives-convention.spec.js` (**3/3**) answers it by
  measurement, and the whole `tests/e2e/rtl/` folder was re-run **9/9 green in file order**
  (orchestrator-verified, 25.3 s, no orphaned Electron processes).
- **(b) THE DECISIVE TEST — PASSES.** Flipping `metadata.screenplayProfile.direction` from `rtl` to
  `ltr` on a fixture COPY reproduces the **identical magnitudes mirrored to the opposite edge**:
  sceneHeading/action 0.000in, character **2.000in**, parenthetical **1.500in** (box 3.5in), dialogue
  **1.000in** (box 3.5in), transition flush to the reading-end — **every delta 0.000in** against the
  RTL control. A brand-new *synthetic* Kurdish/RTL `.rga` (authored in the test, not derived from the
  fixture) reproduces the same numbers with **zero manual tweaking**. S4.1 called this "the strongest
  single test in Phase 4"; it confirms the mirror is a **reflection, not a second implementation**.
- **(c) No forked layout model.** `renderer/js/framework/layout-profile.js:64-92`
  (`HOLLYWOOD_DEFAULTS.blockWidthsIn`) is a single direction-agnostic width table;
  `renderer/css/editor-prosemirror.css:2484-2519` uses logical properties
  (`padding-inline-start`, `text-align: end`) with **no `[dir="rtl"]` override carrying a different
  magnitude**. Two direction-keyed values exist and neither is a violation:
  `RTL_PRINT_LEADING = 1.3` (:108 — the ratified PP-16 leading exception, convention §6) and
  `_charsPerInch` (:127-131 — a font-metric input to pagination wrap, not a geometry width).
- **(d) Vocabulary observations recorded, not ticketed:** transitions still render the untranslated
  `CUT`, and the fixture's prose carries Eastern-Arabic numerals while the convention defaults to
  Western-Arabic 0–9. Both are locale/vocabulary inputs for a future slice (Phase 7 territory), not
  launch-blocking geometry defects — recorded per protocol rather than silently accepted.
- **Verdict — SW-23 = PARTIAL** (unchanged status, but for a completely different and much narrower
  reason). It was PARTIAL because "full conventions unverified"; the conventions are now **verified**,
  and it is held at PARTIAL **solely by RTL-11**, itself PARTIAL under **GAP-4-1** (exported PDF text
  layer ~40.2% NUL). SW-23 flips TRUE the moment GAP-4-1 is fixed — nothing else stands in its way.
  The checklist row was rewritten to say exactly that, so the PARTIAL is no longer ambiguous.
- **Evidence:** `docs/plans/evidence/S4.5-sw23-verdict.md` (RTL-04…13 outcome table + side-by-side
  RTL/LTR magnitude tables + the source-level finding with file:line), raw
  `S4.5-{ltr-flip,rtl-control,new-doc}-measurements.json`, and 3 screenshots `S4.5-*.png`.
- **Status deltas:** SW-23 row rewritten (PARTIAL → PARTIAL, blocker narrowed to GAP-4-1 alone).
  Launch-gate counts unchanged at **47 TRUE · 11 PARTIAL · 1 UNKNOWN · 7 FALSE** (19 open of 66).
  **Phase 4 (RTL QA) is COMPLETE** — S4.1 → S4.5 all ✅.
- **Gaps surfaced:** **none new.** GAP-4-1 remains the sole open item from Phase 4, and this slice
  re-confirms it is the only thing blocking SW-23 rather than widening its scope.
- **Process note (orchestrator):** an apparent "spec fails to collect" result during verification was
  traced to the orchestrator's own shell running `npx` from the repo root instead of
  `rwanga-editor/` — not a defect in the spec. Recorded so a later reader does not re-chase it.
- **Next action:** **S7.1 — UI-localisation architecture brief (writing only)**, opening **Phase 7**.
  Phase 7 precedes Phase 5 by design: it is a BUILD phase with a long external lead time (native
  Kurdish/Arabic reviewers), while Phase 5 geometry QA is a short sweep. ⚠ Still waiting on the user:
  a named **Kurdish (Sorani) native reviewer** for S7.5.

---

## 2026-07-29 · S4.4 CLOSED — bidi audit PASSED, RTL-12 + RTL-13 → TRUE
- **Did:** Executed slice S4.4, the Phase-4 bidi audit, against the S4.1 protocol's measurable
  criteria. New Playwright spec `rwanga-editor/tests/e2e/rtl/rtl-bidi.spec.js` (**2/2**, ~20 s)
  measures both RTL-12 and RTL-13 on **both** surfaces (Flow editor + Print Preview) by DOM geometry
  and `Range` client-rects — per the standing "Playwright > screenshots for layout work" rule.
  Opens only a `%TEMP%` copy of the fixture; closes through `closeApp()` (S3.2F teardown law).
- **RTL-12 (mixed English/Kurdish readable) = TRUE.** 24/24 sampled mixed-script blocks (character,
  action, parenthetical, dialogue, spread across all 47 scenes, including the protocol's named
  `WIDE SHOT: نالی لەسەر…`, `FRAGMENT 1، کەمتر لە ٣ چرکە:`, `باخەوان (VOICEOVER، OFF)`) hold
  `direction: rtl` in Flow **and** Print — *including the Latin-first bait lines* (`FRAGMENT`,
  `WIDE SHOT:`, `MONITOR POV:`, `CAMERA`), which is exactly where the classic base-direction bug
  would surface. Every Latin run reads left-to-right *inside* the RTL line (first/last alphanumeric
  rect ordering); zero `U+FFFD`; Print insets match the S4.1 reference table to **0.000in** delta
  (tolerance was ±0.04in).
- **RTL-13 (bidi punctuation stable) = TRUE.** All 8 typed battery lines — `.`, `؟`, a parenthetical
  around mixed content, `« »`, `" "`, a bracketed Latin token, Latin-word-then-period, and a digit
  run followed by `%` — render sentence-final punctuation at the **reading-end (left)** and mirror
  paired delimiters open-right / close-left, identically in Flow and Print. Punctuation side was
  **unchanged after inserting a character earlier in the line** (measured before/after), so the
  instability the checklist row names does not occur.
- **Evidence:** `docs/plans/evidence/S4.4-bidi-audit.md` (full `case → criterion → expected →
  measured → verdict` table), raw `S4.4-rtl12-measurements.json` / `S4.4-rtl13-measurements.json`,
  and 4 screenshots `S4.4-*.png`.
- **Status deltas:** RTL-12 UNKNOWN→**TRUE**, RTL-13 UNKNOWN→**TRUE**. Launch gate
  45→**47 TRUE** · 11 PARTIAL · 3→**1 UNKNOWN** · 7 FALSE (21→**19** open of 66).
- **Gaps surfaced:** **none.** The one notable finding — in `(V.O.)`-style cues the trailing period
  detaches from the `V…O` run to sit beside the closing `)` (visual order `) . V . O (`) — is
  standard UAX#9 weak-character resolution between an LTR run and an RTL-adjacent bracket, not the
  "whole line flips to LTR" failure signature the protocol hunts. Recorded in the evidence file,
  deliberately not asserted and not escalated.
- **Test-hygiene fix during orchestrator verification:** the spec was green in isolation but failed
  `Flow: battery line "period" not found after typing` when the file ran in order. Cause was in the
  spec, not the product: `closePreview()` ended in a fixed `waitForTimeout(150)` and asserted
  nothing, so RTL-12 could hand RTL-13 a still-active Print Preview overlaying the editor, and the
  typing landed nowhere. Fixed by waiting on real state (`PrintPreview.isActive() === false` plus a
  non-zero-geometry editor) and adding a post-typing `waitForFunction` that proves every battery line
  reached the document — so a future focus/overlay problem fails as itself instead of masquerading as
  a bidi failure. **No assertion weakened.** Full file green on two consecutive back-to-back runs.
- **Also handled:** a user-reported "Save failed / ENOENT rename `.rga.tmp` → `.rga`" dialog was
  triaged as wreckage from a crash-restore, not a defect — `atomic-write.js` writes-fsyncs-closes the
  temp before renaming, so it cannot itself lose the temp; disk showed no stray `.tmp` and the fixture
  intact. Not ticketed. Pre-existing fixture dirt (`mysterious-guest-rtl.rga`) reverted at session
  start per the fixture law; 7 orphaned Electron processes from an earlier session cleaned up.
- **Next action:** **S4.5 — SW-23 roll-up + Phase 4 close.** Write the one-page verdict over
  RTL-04…13 and run the phase's strongest single test: flip `screenplayProfile.direction` to `ltr`
  on a copy and confirm the same magnitudes return as Hollywood-left geometry (one resolver, two
  directions). SW-23 will land PARTIAL, not TRUE, while RTL-11 is held open by GAP-4-1.

---

## 2026-07-28 · PHASE 7 OPENED — UI localisation ruled LAUNCH-BLOCKING by the user
- **Did:** Acted on the user's ruling in response to the GAP-4-2 audit: *"yes and it is an essential
  part of the launch, this system will not be launched without them."* Amended the launch
  constitution and planned the work; **no code written**.
- **Checklist amended:** six new **P0** rows in Section 3 (RTL / multilingual), all FALSE:
  **RTL-16** Interface Language setting actually wired · **RTL-17** app chrome mirrors to RTL
  independently of document direction · **RTL-18** shell CSS uses logical properties ·
  **RTL-19** a translation layer exists (strings are keys) · **RTL-20** Kurdish (Sorani) UI
  translation, native-reviewed · **RTL-21** Arabic UI translation, native-reviewed. Each row carries
  its measured evidence-required and the audit's findings as notes.
- **Masterplan amended:** new **Phase 7 — UI localisation + application RTL**, seven slices
  S7.1…S7.7, placed **after Phase 4 and before Phase 5** (a BUILD phase with a long external lead
  time goes before a short QA sweep; S6.1 roll-up stays last). Order within the phase is
  **direction-first, translation-second**: S7.2 + S7.3 deliver a fully mirrored UI *while it is still
  English* — independently valuable, immediately testable, and most of what a Kurdish user feels.
- **The phase's central rule, recorded so no slice violates it:** **UI direction and DOCUMENT
  direction are two separate axes.** An English UI must hold an RTL script and a Kurdish UI must hold
  an LTR script. Every existing `dir` assignment (`tab-manager.js:110`, `print-renderer.js:103`,
  `scene-navigator.js:150`, `tags.js:295`, `review-bar.js:599`) is document-owned and stays that way.
  S7.2's spec must cover all four combinations, because conflating the axes is the regression this
  work can most easily cause — it would undo what S4.2 just measured correct.
- **Status deltas:** gate counts 45/11/3/**1** → 45 TRUE · 11 PARTIAL · 3 UNKNOWN · **7 FALSE**;
  open P0s **15 → 21**, total P0s **60 → 66**. GAP-4-2 OPEN → **RULED, owned by Phase 7**.
  The open count going UP is the honest outcome: the work always existed, nothing was measuring it.
- **Hard stops recorded in the plan (outside an agent's power — START rule 6):** S7.5 and S7.6 each
  require a **named native reviewer** with a recorded sign-off. An agent may not self-approve or
  fabricate a translation review. Sourcing a Kurdish reviewer is the longest lead item in the phase
  and should start immediately, in parallel with S4.4/S4.5.
- **Still needing the user:** the Kurdish reviewer; whether Arabic may ship post-launch (P1) if no
  reviewer is available — Kurdish is non-negotiable, Arabic's status is a decision not an
  assumption; plus the two carried-over calls, GAP-4-1 (PDF text layer) and GAP-3-5 (Ctrl+Shift+S).
- **Next action:** S4.4 (bidi audit), S4.5, then S7.1.

---

## 2026-07-28 · GAP-4-2 OPENED — the application's own RTL/localisation does not exist (audit)
- **Did:** The user asked why RTL is missing from *the system* — explicitly not the scripts, which
  render correctly. Audited the app chrome rather than the document pipeline.
- **Evidence:** `docs/plans/evidence/GAP-4-2-ui-localization-audit.md`. Kurdish and Arabic **are**
  declared (`settings-registry.js:83-91`, `options: ['en','ku','ar']`, restart-required) — so the
  languages are not missing, everything behind them is. Live probe: `hasApplicator: false` (44
  applicators registered, `language` not among them — which is why the row renders greyed with
  "Behavior not wired yet.", the Settings Constitution being honest); `documentElement` computes
  **`direction: ltr`** and `<html lang>` is **`en`**. No i18n module or string catalogue exists
  anywhere; ~17 hardcoded English `textContent` literals in the shell modules plus ~34 in
  `index.html`. Every `dir` in the running app comes from the OPEN DOCUMENT's profile
  (`tab-manager.js:110`, `print-renderer.js:103`, `scene-navigator.js:150`, `tags.js:295`,
  `review-bar.js:599`) — content only, never chrome. The chrome CSS could not mirror even if flipped:
  `shell.css` 25 physical / 12 logical, `settings-workspace.css` **13 physical / 0 logical** (R1's
  logical-property conversion covered print blocks only).
- **The finding behind the finding:** searching all **123 checklist rows** for interface language,
  translation, localisation or UI direction returns **nothing**. RTL-01…RTL-15 are all
  document-scoped. So this never surfaced as a red because **nothing was ever measuring it** — the
  launch constitution has a hole, not just the code. Net effect on the product: a Kurdish writer uses
  a left-to-right ENGLISH application to write a right-to-left Kurdish script.
- **Status deltas:** **GAP-4-2 opened.** No checklist row flipped, no code written — this is an audit.
  Gate counts unchanged (45 TRUE · 11 PARTIAL · 3 UNKNOWN · 1 FALSE).
- **Blocked on the user:** is UI localisation **in the v1 launch gate or a post-launch chapter?**
  Either answer is legitimate, but the checklist must be amended to say which, or "all P0s TRUE" will
  be declared over a hole. Scoping is in the evidence doc; direction-first (app-level `dir` + a
  logical-property sweep of the chrome, exactly as R1 did for print blocks) is the cheaper,
  higher-value half and is testable while the UI is still English.
- **Next action:** user ruling on GAP-4-2 scope. Board work otherwise resumes at S4.4 (bidi audit).

---

## 2026-07-28 · S3.1F — GAP-3-1 FIXED: the Tools menu is reachable again on laptops
- **Did:** The user asked why the Tools menu was still missing "after we fixed it yesterday". It had
  **never been fixed** — commit `6656610e` (2026-07-26) changed three documentation files and zero
  code; the defect was root-caused and ticketed, and that was reported as if it were resolved. Fixed
  for real now: a `⋯` overflow item in the menubar (`renderer/index.html`) that appears exactly when
  the responsive rules hide menus, and carries those menus' items grouped under headings. Which menus
  are hidden is read from the DOM rather than by duplicating the breakpoint logic, so the overflow
  tracks whatever the CSS hides in any mode. The narrow-mode rule
  (`shell.css`) was amended to exclude the overflow item itself — hiding the escape hatch would
  recreate the amputation it exists to fix.
- **Evidence:** `rwanga-editor/tests/e2e/settings/menubar-overflow.spec.js` — **4/4 PASS**. It
  asserts the real invariant at 1600 / 1150 / 900px: **all 8 menus stay reachable**, the overflow is
  non-empty whenever something is hidden, and Settings specifically opens from the overflow at
  1150px (the user's 1440px @ ~125% scaling case). Screenshot:
  `docs/plans/evidence/GAP-3-1-overflow-menu.png` — File/Edit/View/Script/`⋯`, with TAGS · TOOLS
  (Command Palette, Toggle Theme, **Settings Ctrl+,**) · EXPORT · HELP inside.
  Neighbours: `source-audit` 19/19, `responsive-shell` green. `workspace-chrome-policy` has its 2
  pre-existing reds (already in the recorded e2e baseline, GAP-3-4) — unchanged by this fix.
- **Status deltas:** **GAP-3-1 OPEN → CLOSED.** New ledger row S3.1F. No launch-checklist row
  flipped (the gap was never a checklist row). Gate counts unchanged.
- **Why the old tests stayed green:** they assert command REGISTRATION, not menu REACHABILITY. A
  feature can be registered, keyboard-bound, and completely unreachable from the UI at the same time.
  The new spec closes exactly that gap, which is why it is written as "can the user still get there
  at this window size" rather than "is the command defined".
- **Process note:** the previous report treated "root-caused and ticketed" as done. A gap row is not
  a fix, and it must not be reported as one.
- **Next action:** S4.4 — bidi audit (RTL-12, RTL-13). Still waiting on the user: GAP-4-1 (PDF text
  layer) and GAP-3-5 (which feature keeps Ctrl+Shift+S).

---

## 2026-07-28 · S4.3 CLOSED — RTL-10 TRUE · RTL-11 held open by GAP-4-1 (PDF text layer)
- **Did:** Measured the RTL OUTPUT, not just the blocks: `rwanga-editor/tests/e2e/rtl/rtl-print-export.spec.js`
  (new, permanent, 2/2 PASS) over a `%TEMP%` copy of the 85-page Kurdish fixture. RTL-10 checks every
  page rather than a sample; RTL-11 exports a real PDF and reads its text layer with `pdf-parse`.
- **Evidence:** `docs/plans/evidence/S4.3-rtl-print-pdf.md` + `S4.3-rtl-print-preview.png` +
  `S4.3-rtl-export.pdf`. RTL-10 across all 85 pages: **0** element boxes escape the page content
  area, **0** pages have content exceeding the sheet (`scrollWidth 794 === clientWidth 794`),
  binding margin **1.5in reading-start / 1.0in end identical on page 0 and page 84**, page number on
  the reading-start side, RTL body leading **exactly 1.30** (the convention's 1.2–1.3 relaxation).
  RTL-11: export returns true, **592 KB, 85 pages == 85 preview pages**, Arabic script present,
  **0** U+FFFD.
- **Status deltas:** S4.3 ✅. **RTL-10 PARTIAL → TRUE.** RTL-11 UNKNOWN → **PARTIAL** (its "Blocked:
  PDF export non-functional" note was indeed stale and is rewritten). Gate counts 44/11/4/1 →
  **45 TRUE · 11 PARTIAL · 3 UNKNOWN · 1 FALSE** (15 open of 60), recounted from the checklist file.
  **The long-standing `overflow:hidden` clipping worry on RTL-10 is CLOSED by measurement** — the
  sheet does hide overflow, but nothing exceeds it, so it cuts nothing.
- **Gaps/risks surfaced:** **GAP-4-1 — the exported PDF's Kurdish text layer is ~40% unreadable.**
  35,749 NUL (U+0000) characters = **40.2% of all script characters** come back from the text layer:
  the embedded font subset's `ToUnicode` CMap has no mapping for a large share of *shaped* Kurdish
  forms. The glyphs DRAW correctly — the printed page is right — but the exported script is **not
  searchable**, **cannot be copied out**, gives screen readers nothing, and reaches downstream
  production tooling as garbage. LTR exports are unaffected, so it is also an equity gap between the
  two directions the app claims to serve equally. **RTL-11 therefore stays PARTIAL** rather than
  flipping "RTL export correct" over it (§0.2). The spec logs `nulShareOfScriptChars` on every run but
  deliberately does not assert it: `=== 0` would leave the suite knowingly red, and asserting today's
  40% would make the defect permanent — the assertion belongs to the fix-slice.
  Also recorded, not failed: 12 blocks of ~2,300 show 2–4px of glyph INK overhang (side bearings) with
  **zero** box escape — inside the S4.1 protocol's ±1mm tolerance, which is why the protocol set one.
- **Next action:** S4.4 — bidi audit (RTL-12, RTL-13). GAP-4-1 needs a user decision; it does not
  block S4.4/S4.5, but it does block RTL-11 and therefore the launch gate.

---

## 2026-07-28 · S4.2 CLOSED — RTL-04…RTL-09 TRUE (6/6 measured) · RTL page geometry is correct
- **Did:** Ran the RTL alignment sweep as a **measurement, not an eyeball**:
  `rwanga-editor/tests/e2e/rtl/rtl-alignment.spec.js` (new, permanent, in the e2e suite) drives the
  real render pipeline over a `%TEMP%` copy of `mysterious-guest-rtl.rga` — a real Kurdish feature,
  47 scenes, 85 rendered pages — and reads DOM geometry for both surfaces separately, per S4.1's
  two-surfaces ruling. **2/2 PASS, and all six IDs passed on the first run.**
- **Evidence:** `docs/plans/evidence/S4.2-rtl-alignment.md` + `S4.2-rtl-print-page.png` /
  `S4.2-rtl-flow-blocks.png`. Print Preview: character **192px = 2.0in**, parenthetical **144px =
  1.5in** (box 336px = 3.5in), dialogue **96px = 1.0in**, action + scene heading flush to the
  reading-start edge, transition mirrored to the **LEFT** (gapLeft 0 / gapRight 519), and
  `padding-left` **0 on every indented block** — the indents mirrored rather than being duplicated
  onto the wrong edge. Sampled 12 blocks per type, not just the first. Containment: **0 of 200**
  blocks escape the page content box; margins measure 1.0in left / **1.5in binding right** (the
  wider binding margin on the reading-start side, as the convention requires); review bar agrees:
  `A4 · Portrait · RTL · Page #s on · 85 pp · 47 scenes`. Flow: direction rtl, action hugs right,
  transition hugs left, character/dialogue/parenthetical stay symmetric (drafting doctrine).
- **Status deltas:** S4.2 ⬜ → ✅. **RTL-04, RTL-05, RTL-06, RTL-07, RTL-08, RTL-09 PARTIAL → TRUE.**
  Gate counts 38/17/4/1 → **44 TRUE · 11 PARTIAL · 4 UNKNOWN · 1 FALSE** (16 open of 60 P0s) —
  recounted from the checklist file itself, not incremented by hand.
  **RTL-09's "real slug sits in an action block" note verified STALE and removed**: the fixture holds
  47 sceneHeading nodes for 47 scenes and they render as sceneHeading, bold, flush start, with the
  scene number, the recognition underline, and the localized `INT.` (`ناوەوە`).
- **Gaps/risks surfaced:** none — no failures, so no gap rows. Two observations carried to SW-23
  (S4.5) rather than failed here, per the protocol: transitions still render the English `CUT`
  (vocabulary, not geometry), and the document renders Eastern-Arabic numerals while the convention's
  default is Western-Arabic with Eastern as a locale option (the document's own content chose them).
  GAP-3-4's two RTL scene-navigator reds were deliberately **not** folded in: they concern the
  sidebar's mark indentation, and both the RTL test *and its LTR control* report zero indent — that
  points at the marks losing their indent entirely, not a direction bug. Mixing them would muddy both
  verdicts.
- **Method note worth keeping:** the first evidence screenshot was an ELEMENT capture of a page sheet
  wider than its scroll container. It came back cropped and looked exactly like text clipped at the
  left margin — a defect that does not exist. The containment measurement disproved it and the
  capture was switched to a viewport screenshot. The standing "Playwright > screenshots for layout"
  rule earned its keep in both directions.
- **Next action:** S4.3 — RTL Print Preview + PDF export (RTL-10, RTL-11). RTL-11's "Blocked: PDF
  export non-functional" note is stale; correct it when flipping.

---

## 2026-07-28 · S4.1 CLOSED — RTL QA protocol written (Phase 4 open)
- **Did:** Turned RTL-04…RTL-13 + SW-23 from "visual QA vs the profile" into measurable criteria:
  `docs/plans/evidence/S4.1-rtl-qa-protocol.md`. One section per ID with the convention rule quoted
  verbatim, the fixture blocks that exercise it, a numeric PASS criterion (inch offsets to ±1 mm,
  with the px-per-inch recipe), and the FAIL signature to watch for. Read the ratified convention,
  the print-block CSS, the layout profile, and surveyed the fixture directly.
- **Evidence:** the protocol document. Reference magnitudes reconciled from source, not memory:
  character 2.0in / parenthetical 1.5in (box 3.5in → 2.0in text) / dialogue 1.0in (box 3.5in →
  2.5in text) / transition flush reading-end / heading + action + shot flush start at 6.0in
  (`editor-prosemirror.css:2484-2518`, `layout-profile.js:68-78`).
- **Status deltas:** S4.1 ⬜ → ✅. No checklist row flipped (protocol slice). Gate counts unchanged
  (38 TRUE · 17 PARTIAL · 4 UNKNOWN · 1 FALSE).
- **Gaps/risks surfaced:** none new — but one **ruling recorded that prevents a whole class of false
  verdicts**: Flow and Print are two surfaces with two truths. The convention's 2.0/1.5/1.0in
  magnitudes are PAGE truth binding Print Preview + PDF; Flow is a continuous drafting surface by
  locked doctrine and deliberately CENTRES character/dialogue/parenthetical
  (`editor-prosemirror.css:1145-1162`). Judging Flow against print indents would have produced false
  reds in S4.2 and invited a "fix" that breaks the Flow doctrine — so every Phase-4 spec must declare
  which surface it measures. Also surveyed: the fixture already carries **114 mixed Latin+Arabic
  blocks** (RTL-12 needs no authoring), but has **zero `shot` blocks** and no adversarial bidi
  punctuation — both scripted into the protocol as typed additions. RTL-09 carries a known
  slug-in-action-block bug that must be characterised (mis-typed in the fixture vs mis-mapped by the
  parser — different defects, different owners) before its alignment is judged. RTL-11's "Blocked:
  PDF export non-functional" note is stale and must be corrected when flipped.
- **Next action:** S4.2 — RTL editor alignment sweep (RTL-04…RTL-09), folding GAP-3-4's two RTL
  scene-navigator reds into it.

---

## 2026-07-28 · S3.3 CLOSED — PF-13 TRUE (console audit 0 errors) · PHASE 3 COMPLETE · GAP-3-5 opened
- **Did:** Built a re-runnable console audit
  (`rwanga-editor/tests/diagnostics/s3.3-console-audit/console-audit.spec.js` + its own config,
  deliberately outside the e2e suite) that subscribes `console` + `pageerror` for a whole session
  and walks 8 core flows: launch → new script → every screenplay block type typed through the real
  key flow (slug/action/character/dialogue/shot) → Save As (real path, dialog stubbed in main) →
  reopen from disk → Print Preview open/hide → Page Setup (A4, landscape, portrait, Letter) →
  undo/redo ×5 → close. Every message is captured tagged with the flow that produced it.
  Deviation from the plan text: the spec lives under `tests/diagnostics/` rather than
  `docs/plans/evidence/`, because a spec outside `rwanga-editor/` cannot resolve `@playwright/test`.
- **Evidence:** `docs/plans/evidence/S3.3-console-audit.md` + raw `S3.3-console-capture.json`.
  **0 error-level console messages · 0 uncaught page errors · 12 warnings · 13 messages total.**
  Messages by flow: launch 12, Print Preview 1 — typing, saving, reopening, page-setup and
  undo/redo were completely silent.
- **Status deltas:** S3.3 ⬜ → ✅. **PF-13 UNKNOWN → TRUE** (checklist row edited in the same
  commit). Gate counts 37/17/5/1 → **38 TRUE · 17 PARTIAL · 4 UNKNOWN · 1 FALSE** (22 open).
  **Phase 3 is COMPLETE** — S3.1, S3.2, S3.2F, S3.3 all closed. Next phase is 4 (RTL ⭐).
- **Gaps/risks surfaced:** **GAP-3-5** — the warnings were read, not swept, and one is a shipped
  defect: `settings-registry.js:549` gives `kb.saveAs` the default `Ctrl+Shift+S` and `:585` gives
  `kb.sceneNavigator` the **same** default. The keyboard registry is last-wins, Scene Navigator
  registers second, so **Ctrl+Shift+S opens the Scene Navigator and Save As has no working
  shortcut** — while Settings still displays `Ctrl+Shift+S` next to "Save As" (a Settings-honesty
  violation too). Two lesser collisions: `Ctrl+Shift+E` (scriptWorkspace toggle vs Export PDF) and
  `Ctrl+Shift+F` (search toggle vs a legacy shim). Needs a **user ruling** on which feature keeps
  which key, plus a guard test that fails on any duplicate default in the registry. Also noted:
  Electron's insecure-CSP development warning (no CSP / `unsafe-eval`) — a hardening item for
  before launch, not a console-cleanliness failure. Not fixed here (S3.3's scope froze when it
  opened, §0.2).
- **Next action:** S4.1 — Phase 4 RTL QA prep. Fold GAP-3-4's two RTL scene-navigator reds into
  that sweep instead of opening a separate slice.

---

## 2026-07-28 · S3.2F CLOSED — GAP-3-3 fixed (e2e quit path) · FIRST e2e baseline recorded
- **Did:** Root-caused and fixed the hanging app-close, on the user's instruction to do it before
  S3.3. Two distinct causes, **both test hygiene — no product code was touched**:
  (a) the quit guard is correct and deliberate (`electron/main.js:99` intercepts the close →
  `renderer/index.html:1577` → `Rga.CloseGuard.confirmAppClose()` → `#unsaved-modal`), and it waits
  for a **human**; under Playwright nobody clicks, the verdict never arrives, and main aborts the
  close rather than force-quit over unsaved work — so `app.close()` never resolved. Fixed with one
  shared teardown helper (`tests/helpers/app-teardown.js` → `closeApp`), generalising the repo's
  existing `clearDirtyAndClose` idiom to ALL tabs and sweeping it across **60 spec files / 124 call
  sites**. (b) The force-kill specs (`autosave`, `recovery`) SIGKILLed only the Electron **main**
  process; on Windows the surviving GPU/renderer children keep Playwright's pipe open, so Playwright
  never saw the app die — it blocked 60 s at WORKER teardown and orphaned the children. Fixed by
  killing the process **tree** (`taskkill /T /F`); `killApp` now lives beside `closeApp`.
  Then recorded the campaign's first e2e baseline.
- **Evidence:** `docs/plans/evidence/S3.2F-quit-path.md` + `S3.2F-e2e-baseline.txt`.
  **E2E BASELINE: 363 tests · 357 pass · 6 fail · 11.7 min · 0 teardown hangs · 0 orphans**
  (before: 326 pass · 37 fail · 1.2 h). Spot proofs: `app-close.spec.js` 1.4 min hang → 2/2 in 7.9 s;
  `autosave.spec.js` 1.3 min → 3/3 in 13.3 s; `autosave` + `recovery` 6/6 in 33.1 s.
- **Status deltas:** S3.2F ✅ (new slice, authorized by the user 2026-07-28). GAP-3-3 OPEN →
  **CLOSED**. No launch-checklist row flipped — this slice fixed the measuring instrument, not a P0.
  Gate counts unchanged (37 TRUE · 17 PARTIAL · 5 UNKNOWN · 1 FALSE).
- **Gaps/risks surfaced:** **GAP-3-4** — the 5 stable reds the fix left visible, all assertion
  failures in test bodies with no teardown noise to hide behind, none yet triaged: scene-navigator
  marks report zero directional indent (RTL **and** its LTR control); Settings tab fails to hide the
  toolbar (`display:grid`, expected `none`); Settings nav rail `overflow:hidden` expected `auto`
  — **same family as GAP-3-2**, fix together; Settings General rows drifted from the registry. Two
  load-dependent flakes recorded rather than adjusted (`page-setup-preview` 116.7 ms vs a 100 ms
  budget; `theme-applicator` theme-across-reopen, 3/3 green in isolation). Nothing was weakened,
  skipped, quarantined, or deleted. Also self-caught: the sweep first appended a `require` at the
  bottom of `tag-plugin-ownership.spec.js`, producing 8 `ReferenceError` reds in the very first
  baseline run — fixed, with a placement check now green 60/60.
- **Next action:** S3.3 — PF-13 clean-console audit across core flows.

---

## 2026-07-27 · S3.2 CLOSED — PF-02/03/05 TRUE (lifecycle E2E 3/3) · GAP-3-3 opened
- **Did:** Wrote the three lifecycle specs under `rwanga-editor/tests/e2e/lifecycle/`. Step-1 seam
  chosen by reading the code: stub `dialog.showSaveDialog`/`showOpenDialog` in the MAIN process
  (the `atomic-save.spec.js` idiom) instead of the plan's `doc.handle = p` shortcut — the real
  path then runs end to end (`saveAs()` → IPC `files.pickSaveAs` → atomic write → `rebindHandle` →
  `clearDirty`). PF-02 reopens in a SECOND app instance with a fresh userData dir, so content is
  proven on disk. PF-03/05 use a temp COPY of the RTL fixture (§0.2 fixture law — it is v3.0 and
  would auto-migrate). Ran the full e2e suite and then proved the failures are not ours.
- **Evidence:** `docs/plans/evidence/S3.2-lifecycle-e2e.md` — lifecycle **3/3 PASS** (first run and
  again on a cleaned machine); full suite **326 pass · 37 fail**, new specs not among the failures;
  isolation run with our files absent fails identically (7 fail / 6 pass).
- **Status deltas:** S3.2 ⬜ → ✅. **PF-02, PF-03, PF-05 PARTIAL → TRUE** (per-row evidence in the
  checklist). Gate counts 34/20/5/1 → **37 TRUE · 17 PARTIAL · 5 UNKNOWN · 1 FALSE** (23 open).
- **Gaps/risks surfaced:** **GAP-3-3** — e2e suite 37 reds, every sampled one an `app.close()` hang
  in `afterEach` (test bodies pass; the app will not quit; 17 orphaned Electron processes were
  cleared). Pre-existing, out of frozen scope. Hypothesis: dirty-doc quit prompt blocks close.
  Second finding: **no e2e baseline has ever been recorded** — QG-12 cannot honestly roll up over an
  unmeasured suite.
- **Next action:** S3.3 (PF-13 clean-console audit) — but first decide with the user whether GAP-3-3
  is fixed before it, since the audit runs over the same flows.

## 2026-07-27 · S3.1 CLOSED — PF-01 Windows launch matrix 13/13 · `/rwanga` case command built
- **Did:** (1) Built the missing artifact-4 of the master-plan process: the `/rwanga` case command
  (START / END / STATUS over this ledger), deployed to `~/.claude/commands/` + version-controlled at
  `.claude/commands/rwanga.md` on `main` (`.gitignore` negated for `.claude/commands/*.md`).
  Tested cold with two fresh subagents: END passed; START failed (no way to locate the active slice's
  section in a 756-line plan) → fixed (one permitted `^### Slice ` lookup, self-healing head-read,
  box-vs-prose reconcile rule, `status -sb` focus lock) → re-tested PASS. (2) Corrected three stale
  HANDOFF lines the tests surfaced (HEAD SHA, "28"→26 open P0s, fixture warning generalised).
  (3) Recorded S3.1 matrix row 13 (post-reboot launch, user-performed 2026-07-27) → slice closed.
- **Evidence:** `docs/plans/evidence/S3.1-launch-matrix.md` — Windows **13/13 PASS · 0 failures**
  (10/10 cold starts 1.1–1.6 s · post-reboot PASS · single-instance focus-existing · no `.rga`
  association, observed not failure). Commands: `9e6c82cb`; HANDOFF fixes pushed same day.
- **Status deltas:** S3.1 ⬜/🟡 → ✅. PF-01 PARTIAL → PARTIAL **(Windows-verified, evidence-backed)**
  — not TRUE because the row spans macOS. Gate counts unchanged (34 TRUE · 20 PARTIAL · 5 UNKNOWN ·
  1 FALSE).
- **Gaps/risks surfaced:** none new. Standing: PF-01's macOS half is deferred on hardware
  (Decision #1); GAP-2-1/2-2/3-1/3-2 remain OPEN, owned by future fix-slices.
- **Next action:** Start S3.2 — PF-02/03/05 lifecycle E2E specs; Step 1 is discovering the
  dialog-free save seam in `renderer/js/file-manager.js` + its IPC bridge.

## 2026-07-26 · Two user-reported Settings defects root-caused/ticketed (GAP-3-1, GAP-3-2)
- **Did:** Investigated the user's report "Settings is gone from the menu + the Settings area has
  never-fixed problems." (1) **GAP-3-1 root-caused:** the Settings menu entry lives ONLY in the
  Tools menu, and `#app.mode-compact` (shell.css:2357-2362) hides Tags/Tools/Export/Help outright —
  compact starts below ~1412 CSS px (responsive.js derived thresholds), which under Windows display
  scaling is virtually every laptop; no overflow "…" menu exists. Gear icon + Ctrl+, remain the only
  routes. (2) **GAP-3-2 ticketed:** user screenshot shows the Settings workspace's sticky search
  band failing — a row paints above the band, rows clip mid-control; suspects documented
  (settings-workspace.css:279-346); diagnosis plan = Playwright DOM-geometry spec.
- **Evidence:** code citations in the §0.5 gap rows; user screenshots in-session.
- **Status deltas:** §0.5 + HANDOFF gain GAP-3-1, GAP-3-2 (both OPEN). No checklist rows changed.
- **Gaps/risks surfaced:** the launch-checklist Settings band + responsive-shell rows likely
  overstate health — the S5/S6 reconciliation should re-check them against these gaps.
- **Next action:** unchanged — finish S3.1 item 13 (user reboot + one launch), then fix-slices for
  the open gaps can be inserted before S3.2 per the plan's gap rule.

## 2026-07-26 · S3.1 (in progress) — Windows launch matrix 12/13, blocked on user reboot
- **Did:** Decision #1 resolved by user: **macOS stays in scope, Mac provided when needed** (plan
  annotated; PF-01 will sit PARTIAL until the macOS matrix). Ran the scripted Windows matrix on the
  installed app: **10/10 cold starts** reach a window in 1.1–1.6 s (user observing, no error
  dialogs); **second-instance launch** → single-instance lock, focus-existing, no corruption;
  **`.rga` association**: none registered by the installer (plan: observed behavior, not a failure;
  candidate `fileAssociations` config improvement).
- **Evidence:** `docs/plans/evidence/S3.1-launch-matrix.md` (12/13, 0 failures).
- **Status deltas:** ledger S3.1 → 🟡 12/13. PF-01 not yet flipped (pending reboot item + macOS).
- **Gaps/risks surfaced:** none (the no-association note is an observation, not a gap).
- **Next action:** USER: reboot → launch installed app once → report. Then close S3.1 and open S3.2
  (lifecycle E2E specs — agent-only work, no user needed).

## 2026-07-26 · S2.2 — installed-app smoke 5/5 PASS; LR-01 flipped TRUE (Phase 2 complete)
- **Did:** User accepted the unsigned installer (Decision #2). Silent-installed the packaged build
  (`%LOCALAPPDATA%\Programs\rwanga-editor`); the USER performed the 5-item smoke by hand on the
  installed app: open / new+type / save / close+reopen / print preview — **5/5 PASS**. Flipped LR-01
  UNKNOWN→TRUE in the launch checklist.
- **Evidence:** `docs/plans/evidence/S2.2-installer-smoke.md` (+ user screenshots in-session).
- **Status deltas:** ledger S2.2 ⬜→✅; **LR-01 UNKNOWN→TRUE**. Launch P0s: 34 TRUE · 20 PARTIAL ·
  5 UNKNOWN · 1 FALSE. QG-12's remaining blockers = the QA sweep clusters only.
- **Gaps/risks surfaced (both ticketed in §0.5, non-blocking for LR-01):**
  - **GAP-2-1:** New doc renders a dead band above a shrunken page that grows as content arrives;
    user-ratified expected behavior = full configured page size from first paint. Long-standing,
    user-reported repeatedly, now formally tracked.
  - **GAP-2-2:** packaged app shares userData with the dev app (restored dev session; auto-opened
    the playground fixture). Decide appId/userData split before launch.
  - Print Preview: user notes "needs improvement later, but pass as feature" (no new gap row;
    existing print-polish backlog).
- **Next action:** S3.1 — PF-01 launch matrix; Step 1 = user Decision #1 (macOS scope).

## 2026-07-26 · S2.1 — pack:win succeeds under Dev Mode; installer produced
- **Did:** User enabled Windows Developer Mode (via `ms-settings:developers`; verified
  `AllowDevelopmentWithoutDevLicense = 1`). `npm run pack:win` then completed with exit 0 — the
  winCodeSign symlink-privilege blocker is gone, no elevated shell needed, no cache purge needed.
- **Evidence:** `docs/plans/evidence/S2.1-pack-win.txt` (env note + full log).
  Artifact: `rwanga-editor\build\output\Rwanga Editor-Setup-0.1.0-alpha.0.exe` (76 MB, NSIS x64,
  oneClick, **unsigned** — no cscInfo). NOTE: output dir is `build\output\` per project config,
  not the plan-assumed `dist\` (plan annotated).
- **Status deltas:** ledger S2.1 ⬜→✅. LR-01 still open pending S2.2 (install + smoke + flip).
- **Gaps/risks surfaced:** none. (dist/ artifacts not committed, per plan.)
- **Next action:** S2.2 — Step 1 is a user decision: accept unsigned installer for LR-01
  (Decision #2), then install + 5-item smoke.

## 2026-07-26 · S1.5 — QG-01 GREEN: unit suite 0 reds, checklist flipped TRUE (Phase 1 complete)
- **Did:** Full clean unit run captured to `docs/plans/evidence/S1.5-green-run.txt`; flipped QG-01
  PARTIAL→TRUE in `docs/RWANGA_IDE_LAUNCH_CHECKLIST.md` (old 2026-06-10 triage note kept for the
  record). Phase 1 of the masterplan (S0.1→S1.5 + GAP-1-1 fix-slice) is complete in one session.
- **Evidence:** **1936 tests · 1935 pass · 0 fail · 1 skipped** (exit 0) at HEAD `90485776`.
  Zero quarantines added — the suite is green on real assertions.
- **Status deltas:** ledger S1.5 ⬜→✅; **QG-01 PARTIAL→TRUE** (launch P0s now 33 TRUE · 20 PARTIAL ·
  6 UNKNOWN · 1 FALSE; QG-12's remaining named blockers: LR-01 + QA sweeps).
- **Gaps/risks surfaced:** none new. Standing: the running Electron instance auto-migrates
  `playground-the-last-light.rga` — keep the pre-commit fixture check.
- **Next action:** S2.1 — LR-01 installer: check Dev Mode; if disabled, blocked on user
  (enable Dev Mode or elevated shell).

## 2026-07-26 · GAP-1-1 fix-slice — DOM-read-as-truth violation resolved
- **Did:** Fixed the one real defect from the QG-01 triage. `_enterRebind()` in
  `renderer/js/shell/workspaces/settings-workspace.js` no longer reads
  `classList.contains('is-disabled')` as state truth; it gates on
  `entry.requiresPro || _isPersistsOnly(entry)` — exactly the states the CSS hook proxied
  (`is-disabled` is applied by `_disableControlElement` for PERSISTS_ONLY rows; requiresPro was the
  other non-interactive case, previously guarded only at the click/keydown call sites). Behavior
  identical; the belt-and-suspenders guard is now sourced from state.
- **Evidence:** TDD red→green: `source-audit.test.js` **19/19** (was 18/19); neighbors
  `settings-workspace` + `settings-applicators` + `settings-reachability` **67/67**.
- **Status deltas:** §0.5 GAP-1-1 OPEN→**CLOSED**.
- **Gaps/risks surfaced:** none.
- **Next action:** S1.5 — full clean run captured to evidence, flip QG-01 TRUE.

## 2026-07-26 · S1.4 — recovery-phase3 reds resolved (both stale, re-pointed)
- **Did:** Verdict = stale expectations (sub-case i), both tests in
  `tests/unit/editor/editor-recovery-phase3.test.js` (the file guards UX-recovery — Flow gutter +
  Draft footer — NOT crash recovery; `9693012d` unrelated). Gutter test re-pointed from the retired
  opacity mechanism to the F1/F6 rail tokens (`--flow-rail-num` + `--flow-rail-bg`,
  editor-prosemirror.css:146-158, commit `fd198a49` LOCKED), keeping a conditional ≥0.7 guard so a
  reintroduced dimmer still fails. Whitelist test gained the 4 authorized modules (inspector.js
  F1A.3 · toolbar.js F1A.6 · page-setup-preview.js S8 · settings-migrations.js H2) with provenance
  comments in the file's established pattern.
- **Evidence:** suite file **12/12 pass** (was 10/12).
- **Status deltas:** ledger S1.4 ⬜→✅. Unit suite now **1936 · 1 fail · 1 skipped** — the only red
  is GAP-1-1's source-audit "audit (b)".
- **Gaps/risks surfaced:** root cause of the recurring fixture dirt identified: a RUNNING Electron
  instance (started 22:03 local) keeps auto-migrating `playground-the-last-light.rga`. Reverted
  again this session; user advised to close the app. Check fixture state before every commit.
- **Next action:** GAP-1-1 fix-slice — replace the `classList.contains('is-disabled')` gate at
  `settings-workspace.js:522` with `entry.requiresPro`; the red source-audit test is the TDD test.

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
