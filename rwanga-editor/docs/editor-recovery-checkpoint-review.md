# Rwanga Editor — Recovery Checkpoint Review

**Date:** 2026-05-17
**Author:** review pass (no implementation)
**Scope:** Editor Recovery Phases 1, 2, 3 — checkpoint review only
**Inputs:**
- `docs/editor-recovery-forensic-report.md` (2026-05-17, investigation)
- Commits `f9772c46` (Phase 1), `90c871ef` (Phase 2), `041b07e4` (Phase 3)
- Test suite: 676/676 passing at HEAD (`041b07e4`)

**Status:** REVIEW ONLY. No code changes, no new plans, no fixes.

---

## 1. Recovery summary

### Phase 1 — Flow page-boundary feel (C1(b))

**Intended problem (from forensic §9 rank 1 + rank 4):**
Flow view rendered as "one tall scrollable column" with `.rga-page-marker` widgets degraded to a `0.75rem` dashed hairline. Reads as Google Doc, not screenplay manuscript.

**Actual outcome:**
- `.rga-page-marker` (Flow only) promoted to 32px / -0.5in / 28px margin block, sandwich border, linear-gradient desk-strip background, 13px letter-spaced "— Page N —" label.
- `.rga-page-break` (manual page break PM node) given the same treatment minus the label, so manual and automatic breaks read consistently.
- Dark-theme variant included.
- Print / Draft / PrintPreview hide rules preserved.
- 7 guard tests lock the shape (margin, borders, gradient, negative horizontal margin, manual-break parity, hide rules, no content-splitting CSS).

**Unresolved side effects:**
- None observed in tests.
- Not visually verified by the user — no screenshot or live confirmation in this session that the desk-strip "feels like paper" the way the user remembered pre-reset Flow feeling. **The whole point of Phase 1 was perceived feel, and that is the one thing not measured yet.**
- Still no true paged-sheet DOM in Flow; Phase 1 chose option (b) per the forensic recommendation. If the desk-strip turns out to be insufficient, the headline complaint may persist and escalate to C1(a) becomes the only remaining lever.

**Confidence:**
- Technical (CSS guards green, no regressions): **HIGH**.
- That it solves the user's "feels worse than pre-reset" complaint: **MEDIUM-LOW** — unverified by user.

---

### Phase 2 — Print page-N identity + slug strengthening + Scene Navigator dual-state (C2 + C5 + C3)

**Intended problem (forensic §9 ranks 2, 3, 5):**
- C2: Print view had no page-N or title headers (deferred at `editor-prosemirror.css:50–52`).
- C5: Slug / scene-heading visual was "plain" (forensic claimed the pink underline was missing).
- C3: Scene Navigator current vs selected rows visually too similar.

**Actual outcome:**
- **C2 — Print page numbers:** `.rga-page-marker` un-hidden in `body.view-print-active`; original "— Page N —" text zeroed out via `font-size: 0`; `::after` pseudo pulls page number via `content: attr(data-page-number) "."`; right-aligned manuscript-style "1." "2." labels.
- **C2 — Script title at top-left:** **DEFERRED.** Pure CSS cannot reach `document.title` / `doc.displayName`. Documented in commit message. Requires either engine emitting a `data-script-title` attr on the marker, or shell setting `body[data-script-title]`.
- **C5 — Slug strengthening:** Forensic was wrong — the pink underline DID exist (line 1857) at 2px. Phase 2 strengthened it to 3px solid `var(--accent-rwanga)`, added `letter-spacing: 0.04em`, and bumped `margin: 1em 0 0.6em 0` (was `0 0 0.6em 0`).
- **C3 — Scene Navigator:** `-row-current` now uses `var(--accent-rwanga)` for the left bar + scene-number color + `font-weight: 600`; `-row-selected` switched from `--bg-active` to softer `--bg-hover` + `outline: 1px solid var(--border-secondary)`.
- 7 guard tests lock C2 (print rule body, attr() use, right-align + font-size 0), C5 (≥2px underline + letter-spacing + positive margin-top), C3 (current uses --accent-rwanga + bold; selected does NOT use --accent-rwanga or --bg-active + has outline).

**Unresolved side effects:**
- Print's title-at-top-left half of C2 is open. The page-number half is done; the symmetric title label is parked.
- Slug change made the brand pink more visible — if the user disliked the prominence pre-reset, this strengthens rather than restores. No user signal yet.
- Scene Navigator dual-state separation is now codified by tests, but the soft hover-outline for "selected" may read as no-feedback on some themes — unverified.

**Confidence:**
- Technical: **HIGH** (guards green).
- That the three sub-fixes match the user's mental model of pre-reset: **MEDIUM** — C2 page numbers are unambiguous wins; C5 and C3 are taste-dependent.

---

### Phase 3 — FlowChrome gutter visibility + Draft mode context footer (C4 + C6)

**Intended problem (forensic §9 ranks 6, 7):**
- C4: Memory said "VSCode-style per-visual-line gutter" was locked at `501a4b00`. Forensic suspected `Rga.FlowChrome` was stubbed or DOM target missing.
- C6: Draft mode hid every non-editor element — distraction-free became context-loss.

**Actual outcome:**
- **C4 — FlowChrome investigation:** Module is REAL, not stubbed (`rebuildLineNumbers()`, MutationObserver, `getClientRects()` all present). `#flow-line-gutter` DOM target exists. Flow-view `display: block` override exists. v3 selectors match real DOM. The actual defect was visibility: opacity `0.55 × var(--text-tertiary)` was invisible against the editor background. CSS-only fix: opacity → 0.85, color → `--text-secondary`, font-size 11px → 12px. Engine untouched, selector list unchanged.
- **C6 — Draft footer:** New `<footer id="draft-mode-footer">` with four segments: DRAFT MODE label · page position · word count · "Esc to exit". `wireDraftFooter()` lives in `index.html` boot script (existing `wireXxx` pattern) — subscribes to `Rga.ScriptSession` + `Rga.ScriptMetrics` only. CSS hides by default; `body.view-draft-active` reveals; `pointer-events: none`; empty segments collapse before first metric event.
- 12 guard tests (5 FlowChrome, 6 footer, 1 cross-cutting "no new shell module").

**Unresolved side effects:**
- FlowChrome: the per-visual-line geometry pipeline runs on every editor mutation via MutationObserver — if the gutter is now visibly active, any performance cost previously masked by invisibility becomes visible too. Not measured this session.
- Draft footer: assumes `Rga.ScriptSession.get().currentPage` and `Rga.ScriptMetrics.get().wordCount` are always populated by the time Draft is entered. If a writer enters Draft on a fresh document before metrics fire, segments render empty (collapsed by `:empty` rule). Safe by design but may surprise on first-ever Draft entry.
- The footer styling is a calm fixed pill at bottom-centre — taste decision unverified by user.

**Confidence:**
- Technical: **HIGH** (12/12 guards, 676/676 suite, no regressions).
- That C4 + C6 close the user-perceived "FlowChrome missing" and "Draft strips too much" complaints: **MEDIUM** — both are visibility fixes that require seeing.

---

## 2. Current editor screenshots inventory

**This pass did NOT capture live screenshots.** No browser screenshot tool was driven; no live app frame was recorded. Below is a reference map of what each surface currently emits, derived from CSS / DOM / module reading at HEAD `041b07e4`. To verify visually, the surfaces must be opened in a running Electron build and recorded by the user (or by a future session with a screenshot tool wired in).

| Surface | DOM / module | Where to look | Current visual state (derived) |
|---|---|---|---|
| **Flow view** | `#editor-container.view-flow .rga-page-row` → `.rga-page` (`editor-prosemirror.css:73-85`) | Open any script; default view | Single 8.5in `.rga-page` column. Auto page boundaries emit Phase-1-styled desk-strip markers; manual `.rga-page-break` matches. `.flow-line-gutter` visible at 12px / `--text-secondary` / opacity 0.85. |
| **Draft view** | `body.view-draft-active` + `#editor-container.view-draft` (`editor-prosemirror.css:167-221`) | View → Draft (or Cmd/Ctrl+Shift+D) | Hides menu/activity/sidebar/tab/bottom/inspector/status/format-toolbar/scene-toolbox. Editor full-screen 64px padded. Scene form-controls strip to plain text. **Phase 3 addition:** `<footer id="draft-mode-footer">` pinned at bottom-centre with mode/page/words/Esc hint. |
| **Print view** | `body.view-print-active` (`editor-prosemirror.css` Phase 2 print rule) | View → Print | Same editor DOM as Flow. `.rga-page-marker` un-hidden; original text suppressed by `font-size: 0`; `::after` renders right-aligned `N.` per page (manuscript convention). |
| **Print Preview** | `#rga-print-preview-root` (`renderer/js/print-preview.js` + `print-renderer.js`) | Toolbar → Print Preview | UNCHANGED by Phases 1–3. Real `.rga-page-sheet` per page with `data-page-number`; read-only. Top-left script title still absent (C9 — engine-touchability gated). |
| **Scene Navigator** | `.rga-shell-scene-navigator-row` (`renderer/css/shell.css`) | Activity rail → Scenes panel | **Phase 2 (C3) state:** current row uses `--accent-rwanga` brand pink left bar + bold scene number; selected row uses softer `--bg-hover` overlay + `1px solid --border-secondary` outline. Two-state separation now codified. |
| **Draft footer** | `#draft-mode-footer` (`renderer/index.html` + `editor-prosemirror.css:643-686`) | Visible only when `body.view-draft-active` | Fixed bottom-centre 11px monospace pill: "DRAFT MODE · Page N of M · N words · Esc to exit". Empty segments collapse. Non-interactive. Phase 3. |
| **FlowChrome gutter** | `#flow-line-gutter` (`renderer/js/flow-chrome.js` + `editor-prosemirror.css:83-85, 144-162`) | Flow view, left of `.rga-page` column | Visible 44px gutter, per-visual-line numbers, monospace, 12px, opacity 0.85, `--text-secondary`. Phase 3 visibility recovery. |
| **Toolbox (Scene Toolbox)** | `#scene-toolbox` (`editor-prosemirror.css:240-296`) | Any non-Draft view; right edge of `#editor-area` | UNCHANGED. Absolute-positioned top-right corner (Slice V1 §T4); 88px wide; hidden in Draft. Disabled-class wiring still in v3 plugins (off-limits). C8 unaddressed. |
| **Scene heading treatment** | `.rga-scene-heading-v3` (`editor-prosemirror.css` ~line 1857) | Any scene's slug line in Flow / Print | **Phase 2 (C5) state:** 3px solid `var(--accent-rwanga)` underline, `letter-spacing: 0.04em`, `margin: 1em 0 0.6em 0`, `padding-bottom: 0.3em`. Stronger pink-brand identifier than pre-Phase-2. |

**To capture real screenshots:** launch the app (`npm start` from `rwanga-editor/`), open `tests/fixtures/sample-the-last-light.rga` (the locked sample), and capture each surface in both light and dark themes. This is the user task referenced in §5 recommendation B.

---

## 3. Remaining pain inventory (re-scored)

Items remaining from the forensic report after Phases 1–3, re-scored against the current code state.

| ID | Pain | Impact | Difficulty | Confidence | Recommendation |
|---|---|---|---|---|---|
| **C1(a)** | True paged-sheet DOM in Flow (multi-`.rga-page-sheet` containers) | ⭐⭐⭐⭐ if C1(b) desk-strip doesn't satisfy; ⭐⭐ if it does | HIGH — fights PM's contiguous-doc model; selection/paste/undo risk | MEDIUM (well-understood risk; no prototype yet) | **Wait for user verdict on C1(b) first.** Do not preemptively escalate. |
| **C2 (title half)** | Script title at top-left of Print pages (page-N done, title deferred) | ⭐⭐ — manuscript convention; less urgent than page-N | LOW (CSS only, IF shell sets `body[data-script-title]`) or MEDIUM (engine emits attr on marker) | HIGH — clear path | Small follow-up. Shell can set the attribute from existing `Rga.ScriptSession` snapshot without touching the engine. Park as a sub-item of any next visual phase. |
| **C7** | Page numbers in the editor surface (inline, not just Scene Navigator badge) | ⭐⭐⭐ if user wants Flow paged; ⭐ if Phase 1 desk-strip + Scene Navigator badge satisfies | LOW (depends on C1 outcome) | MEDIUM — overlaps with C1 | **Re-evaluate after user verdict on C1(b).** If desk-strip + Scene Navigator badge suffices, C7 collapses; if user wants per-page-N labels inside the surface, Phase 1's `.rga-page-marker` already shows "— Page N —" in Flow. |
| **C8** | Toolbox enable/disable feels "questionable" | ⭐⭐ — works mechanically; perceived not real | HIGH — engine-touchability gated (lives in `doc-types/screenplay/v3-*.js`) | LOW — root cause not investigated; symptom not reproduced | Park behind engine-touchability gate (per Runtime Stabilization LOCKED rules). Consider shell-side override (CSS rule on `ScriptMetrics.currentBlockType`) only if user reports concrete misbehaviour. |
| **C9** | Print Preview header / footer page metadata (script title + total-page count) | ⭐⭐ — Print Preview is already a separate paged view | MEDIUM — `print-renderer.js` is engine-side, off-limits this workstream | HIGH — clear scope, blocked by gate | Park behind engine-touchability gate. |
| **C10** | Dead `injectIcons()` loop in `renderer/index.html:441-453` | ⭐ — invisible to users | LOW — mechanical delete | HIGH | Cleanup, can land anytime. Not phase-worthy alone. |
| **T1** | Page-N/title labels deferred — partially addressed by Phase 2 (page-N done) | folded into C2 above | — | — | C2 title half is the remaining slice of T1. |
| **T2** | `editor-empty-state-recent` reserves DOM but no recent-files list | ⭐ — affects empty editor UX only | MEDIUM — needs ScriptSession history surface | LOW | Defer; out of recovery scope. |
| **T3** | `Rga.SceneManager` referenced in StudioPanel notes-connector but module not loaded | ⭐⭐ — scene-notes save silently degrades | MEDIUM — needs decision on SceneManager fate | LOW — degraded path is defensive-guarded | Park; surface during any future scene-notes work. |
| **T4** | StudioPanel scene-notes connector uses `Rga.Cursor.getCurrentBlock` DOM walker | ⭐ — couples shell to fragile DOM API | MEDIUM | LOW | Park; tech debt. |
| **T5** | PrintPreview `previousView` edge case (printPreview-from-printPreview) | ⭐ — edge case, unlikely | LOW | HIGH — documented | Park; cosmetic. |
| **T6** | ScriptMetrics relies on ScriptSession recompute as trigger signal | ⭐ — defensive concern; works in practice | LOW–MEDIUM | MEDIUM | Park; documented in Slice 7 §A. |
| **T7** | Dead `injectIcons()` selectors target removed `.activity-icon[data-panel]` | same as C10 | — | — | Same fix as C10. |
| **A5** | (Closed by Phase 3 §A investigation — FlowChrome is real, not a stub.) | — | — | — | Removed from gap list. |
| **U2** | Print view isn't visibly different from Flow | ⭐⭐ — partially addressed by Phase 2's page-N labels in Print | — | MEDIUM | Re-score after user verdict on Phase 2 — page-N in Print may have closed this. |
| **U4** | Scene Navigator dual-state visually subtle | ⭐ — addressed by Phase 2 (C3) | — | — | Likely closed. Awaiting user confirmation. |
| **U7** | "You are on page N of M" indicator | ⭐ — Phase 3 (C6) added page position to Draft footer; status bar still has it for non-Draft views | — | — | Likely closed for Draft; status bar already covers non-Draft. |

**Items confidently still-open after Phases 1–3:**
- C1(a) — only if user reports C1(b) insufficient.
- C2 (title half) — small, clearly-scoped follow-up.
- C10 — trivial cleanup.
- C8 / C9 — parked behind engine-touchability gate; no change.
- T2 / T3 / T4 / T5 / T6 — tech-debt, none recovery-urgent.

**Items likely closed (pending user visual confirmation):**
- C1(b) — Phase 1.
- C2 page-N half — Phase 2.
- C3 / C5 — Phase 2.
- C4 / C6 — Phase 3.
- U4 / U7 (for Draft) — incidental closures from Phase 2 / Phase 3.

---

## 4. Recovery effectiveness

**Did Recovery Phases 1–3 actually make the editor feel more screenplay-like?**

### Technical success

**Yes — by every measurable signal:**
- 676 / 676 tests pass (was 650 pre-recovery; +26 guards across 3 phases, all green).
- 3 commits, no reverts, no rebases, no hotfixes.
- Zero new shell modules (Phase 3 cross-cutting guard enforced this).
- Zero engine / framework / doc-types / schema touches.
- Three forensic-report items (C1(b), C2 page-N, C3, C4, C5, C6) implemented per scope.
- Two items deferred with explicit documentation (C2 title half, C1(a)).
- All recovery work is CSS + thin boot-script wiring against existing SSoTs — reversible by `git revert` of three commits.
- FlowChrome's "may be stubbed" forensic hypothesis was actually FALSIFIED by Phase 3 investigation — recovered $$at low cost without engine touch.

### User-perceived success

**Unknown — and that is the honest answer:**
- No user has opened the app and confirmed that Phase 1's desk-strip "feels like paper".
- No user has confirmed that Phase 2's pink slug strengthening matches their mental model of pre-reset.
- No user has confirmed that Phase 3's FlowChrome gutter is now readable (or, conversely, distracting).
- No user has entered Draft and confirmed the new footer is calming rather than chrome creep.
- No screenshot diff against pre-reset memory has been taken.

The headline forensic finding was "the editor feels worse than pre-reset". That is a perceptual claim. Phases 1–3 shipped perceptual changes. **Perceptual changes can only be evaluated perceptually.** Tests prove the CSS deploys; they cannot prove the editor feels right.

**Asymmetry to flag honestly:**
- If Phase 1's C1(b) is enough → the dominant pain is gone with one slice of CSS work.
- If Phase 1's C1(b) is not enough → C1(a) becomes the next ask, and C1(a) is the highest-risk item in the forensic report (PM contenteditable split).

This single user assessment determines whether recovery is effectively done or whether the most expensive remaining item must be opened.

---

## 5. Recommended next path

**B — Request user feedback / screenshots first.**

### Justification

1. **The dominant forensic complaint was perceptual, and Phases 1–3 are predominantly perceptual fixes.** Continuing into Phase 4 without user perception data would compound the risk: every additional phase moves the codebase further from a known-good aesthetic baseline based on assumptions about what "feels right".

2. **The next biggest open item (C1(a) — true paged Flow DOM) is gated on whether C1(b) sufficed.** Opening Phase 4 to attempt C1(a) preemptively would burn the highest-risk slice in the forensic report (PM contenteditable split risk; selection / paste / undo) without first knowing the cheaper fix already landed. The forensic report explicitly recommended this sequencing: "start with (b), measure how it feels; only escalate to (a) if (b) doesn't address the user complaint."

3. **Phase 4's plausible inventory is thin without user input.**
   - C10 (dead `injectIcons()` cleanup) — trivial; not phase-worthy.
   - C2 title half — small follow-up; could go in any future visual phase.
   - C8 / C9 — engine-touchability gated; cannot proceed.
   - T2–T6 — tech debt; not recovery.
   So a Phase 4 spun up now would either (a) escalate to C1(a) on speculation, or (b) bundle minor cleanups — neither matches the workstream's "recover the felt experience" purpose.

4. **The verification cost is low and reversible.** Asking the user to open the app, view Flow / Print / Draft / Scene Navigator in both themes, and report what feels right vs wrong is one session of effort and informs the next 1–3 phases. If everything reads correctly, recovery moves to option C (declare complete) with confidence; if specific items are still off, the next phase has a real target instead of guesses.

5. **Declaring complete (option C) is premature** because C1(a), C2 title half, and C10 are objectively still open in the report — but those should be scoped against user feedback, not pre-emptively bundled.

### What the user feedback session should cover (for the user to drive, not me)

- Flow view in both themes — does the desk-strip read as a page boundary?
- Print view — do the right-aligned "N." page numbers read as manuscript?
- Draft mode — does the new footer disrupt the focus state or restore orientation?
- Scene Navigator — can the user tell cursor-current apart from keyboard-selected at a glance?
- FlowChrome gutter — visible? readable? distracting?
- Scene heading slug — does the 3px pink underline match the pre-reset memory?

If the answers are mostly yes → declare recovery complete; address C10 + C2 title half as a tiny cleanup. If the answers reveal Flow still doesn't feel like paper → open Phase 4 to scope C1(a) properly.

End of review.
