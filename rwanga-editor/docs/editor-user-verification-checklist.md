# Rwanga Editor — User Verification Checklist

**Date issued:** 2026-05-17
**Status:** Recovery implementation PAUSED. User verification mode ACTIVE.
**Purpose:** Replace assumptions about how the editor feels with direct user observation.

**Cross-reference:**
- `docs/editor-recovery-forensic-report.md` — original pain inventory
- `docs/editor-recovery-checkpoint-review.md` — post-Phases-1–3 state assessment
- Commits under review: `f9772c46` (Phase 1), `90c871ef` (Phase 2), `041b07e4` (Phase 3)

---

## How to use this checklist

1. Launch the editor (`npm start` from `rwanga-editor/`).
2. Open `tests/fixtures/sample-the-last-light.rga` (the locked sample script).
3. Walk through each section below in order. For each surface, switch between **light theme** and **dark theme** at least once.
4. Answer each question with whatever wording feels natural — no scoring needed for §A. Optional: jot a one-line note next to anything that feels off.
5. Fill in §B's 1–10 scoring table at the end.
6. Add a free-text **Top 5 annoyances** list at the bottom of §A.6 (most painful first).

There are no wrong answers. The goal is to capture perception, not to grade the recovery.

---

## A. Section-by-section walkthrough

### 1. Flow View

**How to reach it:** open the sample script — Flow is the default view.

**What changed in recovery:** Phase 1 (C1(b)) promoted the page-boundary markers from a 1px dashed hairline to a desk-strip-style gap with subtle gradient + "— Page N —" label. Phase 3 (C4) made the line-number gutter readable (opacity 0.55 → 0.85). Phase 2 (C5) strengthened the scene-heading slug (3px pink underline + letter-spacing).

**Questions to answer:**

- [ ] Does Flow now feel closer to paper?
- [ ] Do page boundaries feel meaningful (i.e., do they read as "this is where one page ends and the next begins"), or do they still read as decoration?
- [ ] Does writing still feel continuous? (i.e., typing across a page boundary doesn't feel like crossing a wall)
- [ ] Is anything distracting? (markers too loud, gutter too bright, slug too pink, spacing too generous, etc.)

**Free-text notes:**

> _Write any observations here that don't fit the questions above._

---

### 2. Draft View

**How to reach it:** View menu → Draft, or the View Mode dropdown in the toolbar. Esc exits.

**What changed in recovery:** Phase 3 (C6) added a small fixed-bottom-centre footer pill showing "DRAFT MODE · Page N of M · N words · Esc to exit". The footer is non-interactive and only visible in Draft view. All previous Draft-mode chrome stripping (no menu/sidebar/toolbox/status bar) is unchanged.

**Questions to answer:**

- [ ] Does Draft still feel distraction-free? (i.e., the footer didn't push it back toward "regular editor with extra chrome")
- [ ] Does the footer context help (orientation, word count, mode reminder), or does it distract?
- [ ] Is the Esc behaviour obvious? (Does the footer's "Esc to exit" hint actually register, or is it noise?)
- [ ] Does anything feel missing? (e.g., would you want scene name, current section, current speaker, timer, etc.)

**Free-text notes:**

> _Write any observations here that don't fit the questions above._

---

### 3. Scene Navigator

**How to reach it:** Activity rail (left side) → Scenes panel.

**What changed in recovery:** Phase 2 (C3) made the dual-state distinction visually explicit. The row matching the editor's cursor location ("current") now uses the brand pink (`--accent-rwanga`) for its left bar + scene number, with bold font weight. The row holding the keyboard-navigation focus ("selected") now uses a softer hover-tinted background with a thin outline (instead of the previous heavier filled background).

**Try this:** click into the script, then use Up/Down arrow keys in the Scene Navigator to move keyboard focus to a different scene than your cursor.

**Questions to answer:**

- [ ] Can current scene vs selected scene be identified instantly (i.e., at a glance, no thinking required)?
- [ ] Does navigation feel natural? (Clicking jumps to scene; arrow keys move focus without jumping; Enter / click commits.)
- [ ] Is anything visually noisy? (Pink too bright? Outline too thin / too thick? Both states reading as "the same"?)

**Free-text notes:**

> _Write any observations here that don't fit the questions above._

---

### 4. FlowChrome gutter

**How to reach it:** Flow view, left of the `.rga-page` column. The gutter holds per-visual-line numbers.

**What changed in recovery:** Phase 3 (C4) determined the FlowChrome module was real (not stubbed as the forensic report had suspected) and that the only defect was visibility. CSS-only fix: opacity 0.55 → 0.85, color `--text-tertiary` → `--text-secondary`, font-size 11px → 12px.

**Questions to answer:**

- [ ] Useful? (Do you read line numbers, or do they live as ambient texture you ignore?)
- [ ] Invisible? (Even after Phase 3, are the numbers still hard to find?)
- [ ] Distracting? (Numbers compete with the prose for attention?)
- [ ] Too strong? (Numbers feel like they're in the eye-line?)
- [ ] Too weak? (Numbers fade out, especially in dark theme?)

**Free-text notes:**

> _Write any observations here that don't fit the questions above. If gutter behaviour differs noticeably between light and dark themes, note it here._

---

### 5. Scene headings

**How to reach them:** Any scene's slug line in Flow or Print view (e.g., "INT. APARTMENT — NIGHT").

**What changed in recovery:** Phase 2 (C5) strengthened the existing slug treatment. Underline went from 2px to 3px solid brand pink (`--accent-rwanga`); `letter-spacing: 0.04em` added to the uppercase; `margin: 1em 0 0.6em 0` (was `0 0 0.6em 0`) for breathing room above.

**Questions to answer:**

- [ ] Does screenplay identity feel stronger? (i.e., does a slug now read unmistakably as "this is a scene heading, not regular prose"?)
- [ ] Is the pink treatment too much? (Brand intrusion competing with the writing?)
- [ ] Too little? (Even after the strengthening, slugs blend in?)
- [ ] Correct? (Matches what you remember about pre-reset slug styling — or improves on it?)

**Free-text notes:**

> _Write any observations here that don't fit the questions above._

---

### 6. Overall feeling

**Step back from the specific surfaces.** Open and edit the sample script for ~5 minutes as if you were writing. Then answer:

**Questions to answer:**

- [ ] Better than pre-reset?
- [ ] Worse than pre-reset?
- [ ] Same?

**Top 5 annoyances** (most painful first — anything that pulled you out of the writing flow, anything that looked wrong, anything that took thought):

1.
2.
3.
4.
5.

**Free-text notes:**

> _Anything else worth flagging — surprises, regressions, things you didn't notice were missing until just now, things you assumed would be there._

---

## B. Scoring table

Score each dimension on a **1–10 scale** based on the overall editing experience. Higher is better.

- **1** = unusable / actively hostile
- **3** = bad enough to abandon the session
- **5** = neutral, works but doesn't help
- **7** = good, supports the work
- **9** = excellent, helps the writing
- **10** = best-in-class

| Dimension | Score (1–10) | One-line reason |
|---|---|---|
| **Screenplay feeling** — does the editor surface read as a screenplay tool, not a generic document editor? | | |
| **Paper feeling** — does Flow feel like manuscript pages, or like a scrollable text area? | | |
| **Writing comfort** — does typing, editing, navigating feel natural with no friction? | | |
| **Focus** — does the editor stay out of the way when you want to write? Does Draft mode actually clear the room? | | |
| **Navigation** — Scene Navigator, scroll-to-scene, view-mode switching: do these feel reliable and instant? | | |
| **Professionalism** — does this look like a serious tool, or like a prototype? | | |

**Optional aggregates:**

- Mean score: ___
- Lowest-scoring dimension: ___ (this should drive the next phase if recovery resumes)
- Highest-scoring dimension: ___ (this should be preserved at all costs in any future change)

---

## Outcome paths (decision will be made by the user after reading their own answers)

- **If §A answers are mostly positive AND §B scores are ≥6 across the board** → declare recovery complete; resolve the remaining open items (C2 title half, C10 cleanup) as a tiny follow-up bundle.
- **If §A.1 surfaces "Flow still doesn't feel like paper" OR §B's "Paper feeling" scores ≤4** → open Phase 4 to scope C1(a) — true paged Flow DOM (the highest-risk forensic item).
- **If §A surfaces complaints concentrated in one specific surface** → open a targeted Phase 4 scoped to that surface only.
- **If §B's "Writing comfort" or "Focus" scores ≤4** → halt visual recovery work and investigate behavioural regressions instead.

The decision is the user's. This checklist exists to make sure that decision is based on what the editor actually feels like, not on what we hope it feels like.

End of checklist.
