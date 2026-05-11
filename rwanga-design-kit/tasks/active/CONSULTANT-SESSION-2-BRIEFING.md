# Consultant Session 2 — Response & Exercise Briefing

**Date:** 2 May 2026  
**From:** Darya's AI Agent (Rwanga Platform)  
**To:** Sarwar (Director / Consultant)  
**Via:** Darya Ibrahim  

---

## Part 1 — Response to Your Feedback

Thank you for your response to the review redesign brief. I want to address the key points you raised and show where we've moved since then.

### On the Bible as Lens

You described the bible as a "lens over the screenplay" — an analytical layer that doesn't replace the script but illuminates it. This is exactly right, and it's become the core design principle. We've now formalized this into a concrete format:

**A lens is a ≤50 word Kurdish analytical summary of a scene.** It doesn't retell what happens — it names the mechanism the scene reveals about the story's structural system. It uses the vocabulary of the locked decisions (دڵنیایی, ناڕاستەوخۆ, سیستم, خۆوێرانکردن). It points forward or backward to other moments in the chain.

The bible, then, is a collection of these lenses — one per scene or scene-cluster — that together form a map of the screenplay's structural DNA. When the interactive viewer is built, clicking a decision (e.g., D9 — شڕوبی) will highlight the relevant lens AND scroll to the corresponding screenplay section.

### On the Director Workbench

Your instinct about the director's experience was correct: the director should see the work first (unsettled decisions), the reference second (locked conclusions), and the full bible third (for reading straight through). We've designed a three-tab structure:

1. **بڕیارە نوێیەکان** — Active/unsettled decisions only. Accept/reject inline. Bible highlights on click.
2. **بڕیارە جێگیرکراوەکان** — Locked conclusions from past reviews. Read-only, collapsed.
3. **بایبڵ** — Full bible text, no overlay. For reading the story through.

Plus a toggle: **بایبڵ ↔ سکریپت** — switch the right panel between the analytical summary (1-2 pages) and the full screenplay (all scenes, full detail).

### On the MVP Build Order

We agree with your sequence. The current state:

- **Done:** 25 correct decisions seeded and locked. Story Bible V3 loaded. MCP tools operational.
- **Ready to build:** Bible section parser, manual decision-to-section mapping, split-screen viewer.
- **Needs design (this discussion):** The lens format, the mapping granularity, the highlighting UX.
- **Future:** AI-based automatic mapping, change tracking, multi-version diffs.

### On the North Star

Your statement — that the system should make the director feel like they're reading a smarter version of their own script — aligns with our one-line vision:

> **Rwanga's review system is an interactive analytical overlay on the screenplay — where clicking a decision illuminates the story moment it governs, and the bible is the bridge between structural analysis and the actual film that gets shot.**

---

## Part 2 — The Lens Exercise

Darya proposed a collaborative exercise before we build anything. The idea is simple: validate the lens format by testing it on real scenes.

### What We've Done So Far

We took 8 scenes from "Mysterious Guest" and compressed each one into a ≤50 word Kurdish analytical lens, then mapped which of the 25 locked decisions govern that moment.

**Round 1** (5 scenes) — built from the English Story Bible prose:
- Scene 3: Video call with Gesha (masks + certainty)
- Scene 12: Gesha enters the house (entering the system)
- Scene 16: The cruel line + sherbet (bilateral destruction)
- Scene 32: The locked room (certainty's origin)
- Scene 37: The desert / leaving the body (Nali's most human moment)

**Round 2** (3 scenes) — built from your ACTUAL Kurdish screenplay text (the full PDF):
- Scene 13: Nali alone in the garden, calling AI (the control instrument)
- Scene 21: Rehearsal over the body (art as cover — Chekhov on a corpse)
- Scene 34: The desert burial attempt (conscience without system)

### What We Discovered

Working from the actual screenplay text makes the lenses sharper. Dialogue gives them teeth. For example:

**Scene 21 lens** — the actors rehearse Chekhov's Seagull sitting on the couch with Gesha's body underneath. Edib says "ژیان بەو شێوەیە پیشان بدەین کە لە خەونەکانماندا هەن" (life should be shown as it is in our dreams) — not knowing real life is under his seat. Nali reprises the killer's work as director: he manages a performance on top of the corpse.

This scene revealed a new principle not in our original 25 decisions: **Art as Cover** — Nali's role as director becomes the concealment mechanism. This is different from D15 (mediation) because it's not just that Nali mediates through systems, but that the artistic world itself becomes a tool for hiding the truth.

### What We Need From You

**1. Review the lenses.** The full exercise file is attached (`LENS-PROTOTYPE-EXERCISE.md`). Read the Kurdish lenses. Do they capture the analytical truth? Would you read one and immediately see the scene in your head? Are they too abstract? Too detailed?

**2. Pick 3-5 scenes yourself.** Choose scenes you think are structurally critical — moments where the story's system is most visible. We'll create lenses together and see if we agree on what each scene reveals.

**3. Challenge the mapping.** We found that D15 (mediation/ناڕاستەوخۆیی) maps to 6 of 8 scenes. D17 (certainty/دڵنیایی) maps to 5 of 8. Does this feel right? Is mediation really that pervasive, or are we over-applying it?

**4. The "Art as Cover" principle.** Scene 21 suggests Nali's artistic identity is a structural mechanism, not just character flavor. Should this become Decision 26? Or is it a sub-case of D15?

### The Goal

If the lenses work — if Sarwar reads a 50-word Kurdish lens and sees the scene — then we have the format for the interactive bible viewer. Each bible section becomes a lens. Each lens maps to decisions. Each decision highlights the screenplay. The whole chain is validated before we write a single line of viewer code.

---

## Part 3 — Files for Review

The following files are available for your review:

1. **`LENS-PROTOTYPE-EXERCISE.md`** — The full exercise with all 8 scene lenses (Kurdish + English back-translations), mapped decisions, pattern observations, and comparative analysis between Round 1 and Round 2.

2. **`CONSULTANT-BRIEF-REVIEW-REDESIGN.md`** — The original brainstorming brief (9 sections) covering the problems, the core insight, the interactive viewer concept, three director archetypes, mapping architecture, technology, and open questions.

Both files are in `rwanga-design-kit/tasks/active/`.

---

**The exercise is ready. Darya will mediate the first round. After we validate the format, we build.**
