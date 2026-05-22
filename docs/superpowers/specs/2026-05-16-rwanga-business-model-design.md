# Rwanga Business Model — Zero to Stable

**Date:** 2026-05-16
**Status:** Locked decisions from strategy session 2026-05-15→2026-05-16. Foundation for future planning and implementation, not yet a build plan.
**Origin session:** continuation of v2 AI architecture work paused 2026-05-15; today's session pivoted from AI architecture to business model and refined several previously locked decisions.

---

## 1. Executive Summary

Rwanga is a **bootstrap-first, evenings-and-weekends business** with a $1,000 personal seed budget for v01 launch. The model is **Trojan Horse via OSS IDE**: a free open-source desktop IDE acquires writers, a *mandatory free Platform account* (signup gate) converts them into an addressable audience, and Pro entitlement plus credit-pack AI consumption converts that audience into revenue at a patient pace. The full trajectory is four phases — Zero State → Adoption → Monetization Maturity → Reinvestment Scaling — with the transition from side project to full-time business triggered by *MRR exceeding day-job income*.

The strategic moat is not features (any competitor can copy AI assists) but **trust + atmosphere + iteration data**: Rwanga is the writer's *studio* with absolute privacy commitment, a script-as-session architecture (every script has its own brain), and multimodal capture/agent dialogue that compounds into a screenplay-domain iteration dataset no global AI tool will build.

---

## 2. Strategic Frame & Operating Principles

### Locked operating principles (carried over and reinforced)

- **OSS + free-forever core.** The fence is the network boundary. Local execution is free; server execution is paid. (See `project_ide_oss_strategy`.)
- **IDE is file-sovereign at runtime.** Offline-first; no login required to *use* the IDE once installed. (See `project_ide_files_sovereign_principle`.)
- **Distribution gate ≠ runtime gate.** Signup IS required to download the official binary (hard gate). Source code on GitHub stays public — anyone can build from source without signup. (New refinement of OSS strategy.)
- **AI assists, never authors.** Hard constraint, all tiers, all versions. Refined this session — see Section 6.
- **International positioning.** English default, Kurdish/Arabic/Persian first-class. Personal Kurdish curation as marketing asset.
- **Multi-provider AI routing.** LiteLLM or thin adapter; switching providers is a one-file change.

### New operating principles locked this session

- **Privacy principle (the third pillar).** See Section 11.
- **Script = Session architecture.** See Section 10.
- **Voice-as-input principle.** See Section 8.
- **Closing-handoff rule.** Every session close produces a handoff memory for the next session.

### Founder posture

Solo founder, evenings/weekends, day job covers living. No funding, no investors. $1,000 personal seed deployed strategically across AI hosting + small ad budget + free-tier AI consumption. Trigger to go full-time: MRR > day-job income reliably for 2-3 months.

---

## 3. The Four-Phase Trajectory

Months are post v01-launch. Numbers are order-of-magnitude estimates to calibrate decisions, refined as Phase 1 actuals come in.

### Phase 1 — Zero State (months 0–3)

- **Ships:** v01 IDE (free + Pro entitlement: branded PDF, DOCX); Platform with hard signup gate; project mgmt basics; **AI taste features** (see Section 5) via Together.ai + Claude
- **Infra:** 1 platform server (Django + DB) + Together.ai API key + Claude API key
- **Team:** Solo, evenings/weekends
- **Monthly cost:** ~$60–230 (infra $30–80, AI $30–100, ads $20–100)
- **Monthly revenue:** $0–200 (a few Pro subs trickle in)
- **Marketing:** Personal Kurdish/ME film community outreach; first YouTube/Medium tutorials; $20–100/mo experimental IG/TikTok ads
- **Trigger to Phase 2:** ~50–100 confirmed accounts + steady IDE downloads + no critical production bugs

### Phase 2 — Adoption (months 3–9)

- **Ships:** IDE iteration on user feedback; Platform UX polish; content cadence (YouTube weekly, blog); localized landing pages (Kurdish/Arabic); maybe additional Pro perks (templates library, project archives)
- **Infra:** Same shape, modest DB/storage growth
- **Team:** Solo + possibly Kurdish community part-timer (gig rate) for translation/outreach
- **Monthly cost:** ~$230–750 (infra $80–200, AI $50–150, ads $100–400)
- **Monthly revenue:** $300–1500 MRR target
- **Marketing:** Email-list activation (asset built since day 1 via signup gate); scaled paid ads to top-performing personas; partnership feelers with Kurdish/ME film schools
- **Trigger to Phase 3:** MRR > (infra + AI) → profitable; ~500–1000 active accounts; email list of 1500+

### Phase 3 — Monetization Maturity (months 9–18)

- **Ships:** Full **cross-language collab** (the v2 headline); **deeper script breakdown** (sample was in v01); credit pack billing; 100MB free cloud sync tier; Platform binding (push from IDE to Project)
- **Infra:** Scale platform server (more RAM or 2nd instance); DB scale; AI inference budget grows with usage
- **Team:** First hire: support + community ops (part-time → full-time as MRR allows)
- **Monthly cost:** ~$800–2900 (infra $200–600, AI $300–1500, marketing $300–800)
- **Monthly revenue:** $2000–6000 MRR (Pro subs + credit packs)
- **Marketing:** Cross-language collab demo as headline content; Swedish↔Saudi pitch video; conference/festival presence
- **Trigger to Phase 4:** MRR > day-job income reliably for 2–3 months → founder goes full-time

### Phase 4 — Reinvestment Scaling (months 18+)

- **Ships:** Full v2 AI rollout; chatbot matures (v2.5); more language anchors (Arabic, Persian); MCP/CLI delivery surfaces; advanced Platform Pro features; dataset pipeline + fine-tune prep
- **Infra:** Multi-region or cloud-native scaling; dedicated AI inference budget; phase-2 fine-tune deploy via Together/Fireworks
- **Team:** 2–4 people: founder full-time (product + eng), ops hire (now full-time), maybe 1 engineer, contractor curators per language
- **Monthly cost:** ~$8.5K–26K
- **Monthly revenue:** $15K–40K MRR target
- **Phase exit:** Stable team, sustainable margins, conscious decision point — stay indie at scale, raise to accelerate, or hold steady

### Three callouts on this trajectory

1. **Phase 1 cost ceiling is small enough that the day job comfortably covers worst case.** Even ~$230/mo with $0 revenue is well under restaurant-budget territory.
2. **Phase 3 is when v2 AI fully executes.** Phase 1–2 accumulation IS the dataset for Phase 3's deeper features and eventual fine-tune.
3. **The support hire in Phase 3 happens BEFORE going full-time** — never simultaneously hire and leave stability.

---

## 4. Acquisition: Hard Signup Gate

The official Rwanga IDE binary is downloadable **only through a signed-up Platform account**. Source code on GitHub stays public for OSS legitimacy — anyone serious enough to build from source can do so, but binary distribution flows through the funnel.

### Why hard gate

- **Email list from day 1 = highest-leverage marketing asset on a $0 marketing budget.** Beats paid ads on cost per addressable contact.
- **Account exists from day 1** = frictionless Pro upgrade later; no "create account to upgrade" friction at the moment of conversion.
- **Sync, brain travel, collaborator features (later phases) require accounts anyway** — the account exists from the start.
- **Telemetry consent collected upfront** (granular, default OFF for training) → better v2 fine-tune dataset.
- **Email confirmation creates a small commitment barrier** that filters bots and drive-by downloads.

### Signup flow (Phase 1)

1. Landing page: "Get Rwanga IDE" → signup form (email + password, or magic link)
2. Email confirmation → activation
3. Activation page: "Download Rwanga IDE for Windows / macOS / Linux"
4. Account dashboard shows download history + upgrade path

### Consent UX (granular, pre-unchecked, revocable)

- ☐ Anonymous usage telemetry (recommended)
- ☐ Product updates + occasional tips (1–2 emails per month)
- ☐ Help train Rwanga's AI (your scripts and notes may be used for model improvement, anonymized) — separate, prominent

### OSS legitimacy preserved

- Public GitHub repo with Apache 2.0 (or similar)
- Build instructions in README
- Forkers can rebuild and rename, just cannot use the "Rwanga" name (trademark) or connect to Rwanga's APIs (server-side entitlement)

---

## 5. AI Surface in v01 (Revised — Pulled Forward from v2)

**Significant scope change from prior v1 plan:** AI features that were deferred to v2 are now pulled forward to v01 in constrained form, funded by the $1K seed deploying to Together.ai + Claude API. The principle: **a "small free taste" of real AI features is the conversion engine.** Free users get to feel the value before being asked to pay.

### Feature surface in v01

| Feature | What it does | Free tier | Pro tier |
|---|---|---|---|
| **Variations** | Highlight text → "give me 3 alternatives" | Cooldown + credit cost | Unlimited, longer selections |
| **Modify** | Highlight scene + intent → "make this character feel rude" → AI suggests specific craft moves | Cooldown + credit cost | Unlimited |
| **Review** | Highlight scene → AI critiques (what works, what doesn't, structural notes) | Cooldown + credit cost, brief output | Unlimited, deeper critique, longer output |
| **Breakdown sample** | Extract characters/props/locations for 1 scene per script | Limited (1 scene/script free) | Full script breakdown |
| **Ask** (chat) | Conversational question about the writer's work → AI responds with options/critiques | Cooldown + credit, selected-text context | Unlimited, full script + brain context |
| **Notes-to-Rwanga + Agent** | Send memo (text/voice/photo) → agent analyzes against script | Storage + sync free; agent analysis = Pro | Full agent response, multimodal |

### What is NEVER in the menu (sovereignty constraint)

- ❌ "Write the next scene for me"
- ❌ "Generate a screenplay from this idea"
- ❌ "Complete this scene"
- ❌ Ghost-text autocomplete (Tab-to-accept) — implies AI-written prose accepted as-is, breaks the principle

### Right-inspector chatbot ships in v01 (constrained), not v2.5

The chatbot UI surface (right-side inspector panel) was previously deferred to v2.5. With the AI collaboration model defined (selection-based, returns options not finished prose, hard-guarded at prompt layer), a *constrained* version ships in v01. The full chatbot (multi-language, full-script context for free users, etc.) still matures in v2.

---

## 6. The AI Collaboration Model (Sovereignty Refined)

**Sharper articulation than the original `project_ide_creative_sovereignty` memory:**

> The AI is invited *into the writer's existing work* to help shape, vary, and refine it. It returns **options, alternatives, critiques, specific craft suggestions** — material the writer reads, evaluates, and chooses whether/how to integrate. It never returns **finished prose for the writer to accept and move on**. The writer's hands stay on the keyboard. The output is *thinking material*, not *replacement text*.
>
> The founding promise: *"I want the writer to take responsibility for their story, but not feel they have to leave Rwanga and do the job elsewhere and copy-paste what they got back."*

### Why this matters strategically

AI features are easy to copy. Final Draft, WriterDuet, Celtx will all bolt on AI eventually. What is hard to copy is **a principled relationship with the writer's authorship**. Cursor and Copilot author code. Rwanga *deliberately does not author stories*. That's not a limitation — it's the brand.

### Example (writer's own framing)

ALLOWED:
- "I wrote this scene, give me 3 alternative ways to picture or write this" → AI returns options
- "The character is soft with the lady but is actually not nice — how can I modify the scene to reflect his true personality?" → AI suggests: "He could look at the wall while talking to her; doesn't break the scene's narrative but shows he's dismissive"

NOT ALLOWED:
- "Complete the story for me"
- "Write the next scene"
- "Give me a complete screenplay from a 2-line idea"

---

## 7. Free-Tier Mechanics (Cooldowns + Credits + Context Depth)

### The single Pro/free differential locked: context depth

Earlier exploration considered three differentials (speed, smart model, context depth). The locked answer is **context depth only**:

- **Free tier:** Same speed, same smart model, same response quality — but **selected text only** (no whole-script context, no script brain)
- **Pro tier:** Same speed, same smart model — plus **whole script + full script brain in context**

Why this is cleaner: "Free is limited, Pro is unlimited + your whole story" is a one-sentence promise. No tier shame. Free users see the real Rwanga, just less of it.

### The volume gate: per-feature cooldowns + monthly credit cap

Cooldowns alone have no upper bound — a patient power user could spam at the cooldown limit indefinitely. Credits alone allow bursts that hammer infrastructure. **Both gates together** create a humane, honest constraint:

- **Per-feature cooldowns** prevent burst abuse (no spamming Variations in 1 minute)
- **Monthly credit pool** prevents steady-state abuse (the patient bypasser)

### Calibration (proposed values; subject to Phase 1 actuals)

These numbers are proposed starting points to enable Phase 1 launch. Final calibration happens once real usage data is in:

- **First-launch honeymoon:** ~60 free credits, one-time, lets new users try every feature
- **Monthly free pool:** ~30–40 credits, resets monthly
- **Cost per feature (proposed):** Variation = 1 credit, Modify = 1, Ask = 2, Review = 3, Breakdown sample = 5
- **Per-feature cooldown:** ~1–2 hours per feature
- **Target outcomes after tuning:**
  - Typical occasional writer (~8–15 credits/month): never feels the cap, gets value
  - Active free writer (~25–35 credits/month): feels the wall regularly, sees upgrade prompt at moments of need
  - Power user bypassing Pro: burns through in 4–6 days, waits 24+ for reset — converts

### Soft landing > hard wall

"You've used 28/30 free credits — cooldowns now stretch to 4h to help you finish the month" reads as service.
"OUT OF CREDITS, UPGRADE NOW" reads as paywall.
Same constraint, opposite emotional register. Bigger conversion. Use the former framing.

### The deeper structural wall

Even with infinite credits, free users still see only selected text. A serious writer composing a 90-page screenplay hits the **value ceiling** (the AI doesn't know their story) long before the credit ceiling. That's the deeper Pro upgrade driver.

---

## 8. Voice-as-Input Principle

**Locked phrase:** *"Voice as input, not as order."*

Voice memos to Rwanga are a typist replacing the keyboard — nothing more. The same sovereignty rules apply:

- ✅ **Allowed:** Writer dictates a scene as they imagine it. Rwanga transcribes and formats into screenplay structure, preserving every word and intent. Example: writer at the lake says *"INT. GARDEN — DAY. Gesha tries to call Nali. He picks up. She says: 'Where were you?' He replies: 'I was busy.' She hangs up angry."* Rwanga writes that scene in proper format.
- ❌ **Not allowed:** Writer says *"I want a scene where a husband and wife fight about him being late."* Rwanga does NOT generate the scene. Voice cannot unlock what the keyboard cannot.

**The mapping:** Keyboard → prompt → Agent fulfills. Voice → transcription (as input text) → prompt → Agent fulfills with same constraints.

### Pro vs free on voice transcription

Voice transcription is a **Pro feature** (Whisper API costs accumulate; ~$0.006/min × power users = real cost). Free tier can *send* voice memos — they're stored, untranscribed, until upgrade. (Alternative: ship on-device Whisper-small in desktop IDE for free local transcription. Decision deferred to spec time.)

---

## 9. Notes-to-Rwanga + Agent Feature

The single most distinctive feature concept in the entire discussion. This is the v01 manifestation of the Rwanga Agent layer described in `project_v2_ai_architecture` §2, pulled forward in constrained form.

### Inbound channels

1. **Email to dedicated Rwanga address** — user's email is in DB; auto-matches to account
2. **Voice memo** (via email attachment or in-app recording)
3. **Photo** (paper, person, scene reference)
4. **In-platform/IDE "Note to self":** record audio, take picture, add text

### Free vs Pro split

- **Free:** Note gets ingested, transcribed (text)/uploaded (photo), stored in user's account, synced to IDE. Capture is the friction killer; even storage-only is genuinely valuable.
- **Pro:** The **agent responds**. Analyzes the note against script context, finds cross-references, surfaces options.

### Example workflow (the actress scenario)

Writer sends a photo + text to Rwanga: *"I'm thinking about this girl for Gesha's role in Mysterious Guest."*

Pro agent:
1. Knows "Gesha" is a character in "Mysterious Guest" (script brain access)
2. Looks up Gesha's description (curly hair, mentions nose job in dialogue)
3. Analyzes the photo (short hair + visible cosmetic surgery)
4. Returns: *"She doesn't match your current description of Gesha, but it's not a rejection — your options:*
   - *Find someone else who matches the curly-hair description*
   - *Modify Gesha's description in your script (mentioned in scene 12: 'her curly hair is...'; scene 23 dialogue 'how much does your nose job cost?' actually fits her better now)*
   - *Adjust which traits matter most to you for this role"*

The agent **notices, cross-references, surfaces options**. It never **decides** or **rewrites**.

### Architecture (the v01 Rwanga Agent)

```
Note ingested (text / email / voice / photo)
  → Transcription (Whisper) / vision parsing (Claude/Gemini vision)
  → Intent classification (casting / observation / scene fragment / question)
  → Script context retrieval (script brain access if note references a project)
  → Intent-specific analysis with sovereignty-guarded prompt
  → Structured response: notes + questions + options
  → Delivered to user (in-app notification + email)
```

### Dataset capture (long moat)

Every annotated note is a five-tuple no competitor can replicate:

```
{
  multimodal input: text + photo + voice,
  script context: writer's actual work-in-progress,
  intent: classified (casting / scene / observation / question),
  agent response: structured options/critique,
  writer reaction: did they integrate? modify? ignore?
}
```

Five years of this = a Rwanga-specific screenplay-craft model with multimodal creative inputs and **iteration patterns**. Google has language fluency. OpenAI has reasoning. Nobody has the iteration data of writers responding to AI suggestions on their own creative work.

---

## 10. Script = Session Architecture

**The foundational unit of Rwanga.**

Where ChatGPT, Claude, Cursor use a *conversation* as the unit, Rwanga uses a **script**. Every script is its own session, with its own **brain**.

### Two memory layers

- **Script-level memory (the script's brain):** Notes, voice memos, photos, character details, casting ideas, decisions made by the writer, agent's accumulated understanding of this script's world. **Travels with the script** — sync across devices, share with collaborators, the brain comes along.
- **Global user memory:** Who the writer is as a person (age, preferences, photo, writing rhythm). **Stays in the user's account.** Never travels with any script. Never accessible to collaborators querying a shared script.

### Boundaries (the privacy contract operationalized)

A collaborator on a shared script can query the script's brain (subject to Pro entitlement + original writer's sharing settings). A collaborator CANNOT query the original writer's personal memory through the script.

> *"The Rwanga script has a brain, with boundaries, not sharing private data."*

### Consequences this unifies

- The "AI doesn't know my story" problem is structurally solved — the brain accumulates as the writer works
- Re-entry briefings (after a paused script) are a natural byproduct of the brain having been there
- The "context depth = Pro" lever (Section 7) becomes operationally crisp: free = selected text + small brain slice; Pro = full script + full brain
- Collaboration mechanics get a clean rule: brain travels with script; user-level memory does not
- **The moat in one phrase:** A Rwanga script has a brain. Final Draft has files. Cursor has codebases. Rwanga has *story brains*. That goes on the homepage.

### Auto-draft on capture (preserves Script = Session purity)

Every capture must live in a script. If no script is targeted, Rwanga **auto-creates `my_draft_NNN.rga`** as a holding script. Later the writer can rename it, merge it with an existing script, or delete it. **No "Inbox" concept, no "Sketchbook" concept, no second class of object. Everything in Rwanga is a script.**

### Active-draft caching (TTL model, mirrors ChatGPT/Claude)

Server-side cache tracks the writer's currently active script (the one they last opened or captured to). New captures stream to that active script. When the cache expires (TTL — likely ~6h or end-of-day, similar to Claude/ChatGPT session timeouts), the next capture spawns a fresh `my_draft_NNN.rga`. **Drafts save on the fly** — content is never lost; only the "what's active" attribution expires.

---

## 11. Privacy Principle (The Third Pillar)

> **The Rwanga privacy principle:** Anything a user creates, captures, or uploads is *their property* in their account. Rwanga stores it, syncs it, never inspects it, never trains on it, never surfaces it. Content only enters Rwanga's processing scope when the user *explicitly* adds it to a project — and even then, with a clear warning at the point of use. The dataset capture pipeline (for future model training) is opt-in, granular, revocable, and entirely separate from the storage layer.

### Why this is the third pillar (alongside file-sovereignty and creative-sovereignty)

In a closed culture (Middle Eastern / Kurdish writer demographics in particular), privacy is not just product design — it's the **trust contract**. International platforms cannot credibly compete on this because the trust differential is built into who Rwanga is, not into a marketing line.

### The promise, in plain language

- Upload a personal photo to your account? It stays in your account, encrypted, untouched by Rwanga unless you explicitly link it to a project.
- Send a voice memo with sensitive content? Same. Storage, no inspection.
- Add the photo to a project as character reference? **Warning appears:** "This content will now be available to the AI agent for analysis (and to collaborators if shared). Continue?"
- Enable dataset training consent? Granular: separate toggles for scripts, notes, agent interactions, photos. Default OFF for all. Revocable in account settings.

### Hard rules

- Photos of identifiable people are never shared upstream regardless of consent (training only on de-identified descriptions)
- End-to-end encryption where feasible
- Visible audit log: "You've shared 12 notes this month for AI training"
- GDPR right-to-delete enforced; deletion cascades to training datasets where technically possible

### Strategic implication

This is part of why writers will send intimate material (casting fantasies, personal observations, scene drafts about real events in their lives). Break this once and the moat evaporates. Treat consent UX as a product feature, not legal boilerplate.

---

## 12. Cross-Platform Renderer (Recap from Existing Memory)

Already locked in `project_ide_renderer_portable` and reaffirmed this session:

- **One editor codebase.** Manifests in multiple shells: desktop Electron (free standalone), web inside Platform (live web IDE), opens synced scripts from any device.
- **Same renderer, same UX, same path.**
- Implication for this business model: the "Platform vs IDE" distinction is mostly architectural, not user-facing. The user opens Rwanga; whether it's desktop or web depends on context.

### IA implication: Notebook lives in the editor, not separately

The "Notebook" surface (where script brain content — notes, memos, photos — is viewed and managed) is part of the editor codebase. It manifests in both desktop and web. No separate Notebook product.

---

## 13. Cost & Revenue Model per Phase

### Phase 1 unit economics (must hold)

- **Per-free-user AI cost:** Cooldowns + credits hold this to ~$0.30–1.50/month per active free user
- **Per-Pro-user AI cost:** ~$2–8/month at moderate usage; up to $15 for heavy users
- **Pro price target (proposed range):** $7–10/month subscription for v01; exact point TBD in Phase 1 launch prep. Credit packs added in Phase 3 for v2 features.
- **Conversion target (proposed):** 5–10% free → Pro within first 3 months of user lifecycle. Real number known after Phase 1.

### Where the $1K seed goes (Phase 1)

| Bucket | Allocation | Why |
|---|---|---|
| Infra (server, DB, Together.ai keys) | $300–400 | 6–12 months runway at Phase 1 scale |
| AI taste budget (free-tier consumption) | $200–300 | Subsidizes free users until conversion kicks in |
| Initial ad experimentation | $200–300 | Test 3–4 ad personas/creatives, find what converts |
| Buffer / domain / tooling | $100–200 | DNS, email, design assets, contingency |

### Phase 2 reinvestment loop

Revenue from early Pro subs reinvests into: more ad spend (scale what worked), better landing pages, content production, Kurdish/Arabic localization.

### Phase 3 first hire

Triggered by MRR > (infra + AI) consistently for 2 months + email list growth. Hire is **support + community ops**, not engineering. Frees founder to focus on product + v2 AI deployment.

---

## 14. Memory Updates Required

When this spec is locked, the following memories need creating/updating in `C:\Users\darya\.claude\projects\E--api-rwanga\memory\`:

**New memories:**
- `project_business_model_v01.md` — comprehensive lock of all 12 decisions, links to this spec
- `project_privacy_principle.md` — the third pillar
- `project_script_equals_session.md` — architectural memory; subsumes auto-draft + TTL details
- `feedback_session_close_handoff.md` — the rule about closing sessions with handoff
- `project_session_handoff_2026_05_16.md` — transient handoff covering still-open items from both today and prior v2 AI session

**Updates to existing memories:**
- `project_ide_creative_sovereignty.md` — sharper articulation (writer-in-driver-seat, options-not-finished-prose, "leave to do the job elsewhere"); add voice-as-input subsection
- `project_ide_v1_scope.md` — AI shifts (now ships v01 in constrained form per Section 5)
- `project_v2_ai_architecture.md` — agent layer + chatbot pulled forward to v01; update Section 9 launch sequence
- `project_ide_oss_strategy.md` — add distribution-gate (hard signup for binary) clarification

**Deletions:**
- `project_session_handoff_v2_ai.md` — its job is done; replaced by new handoff per its own self-destruct instructions

**MEMORY.md index:**
- Add new entries (5)
- Remove deleted entry (1)
- Keep updated entries (no MEMORY.md change needed for content updates)

---

## 15. Open Dimensions Deferred to Future Sessions

These are open questions, NOT contradictions of locked decisions. Surface them when the user returns:

### Business model dimensions still open
- **Exact Pro price point** ($7? $10? $7 with $10 "supporter" tier?)
- **Credit pack structure** for v2 AI (packs of 100/500/1000 at $5/$20/$35? Or different)
- **Phase 1 marketing channel deep dive** (which subreddit communities, which IG hashtags, which YouTube series style)
- **Localized landing pages** — when in Phase 2? Auto-detect language vs. user-selected?
- **Script-binding sync protocol** — exact mechanics of brain travel between desktop, web, collaborators
- **Annual vs monthly Pro pricing** — discount math, when to add

### Open items still pending from prior v2 AI session
- Exact provider for Arabic-dialect cultural anchor (Falcon? Jais? Aya?)
- Exact provider for Persian cultural anchor
- Curator model for non-Kurdish language anchors (community? partnerships? hire?)
- Storyboard consistency approach (reference image, LoRA, ControlNet — own brainstorm)
- Concrete current pricing numbers (WebFetch when closer to build)
- Per-user credit cost calibration (will refine with Phase 1 actuals)
- Local AI mode UX (auto-detect Ollama vs. explicit opt-in)

### Implementation-level questions for spec time
- Voice transcription: cloud (Whisper API) vs. on-device (Whisper.cpp in Electron)
- TTL exact value (6h? end-of-day local? configurable per user?)
- Honeymoon credit replenishment if user dormants (does month 4 reset honeymoon? No, credit cap is monthly only)
- Multi-tenant Platform DB sharding plan (Phase 4 concern, not now)
- Backup/restore for script brains (granular vs. snapshot)

---

## 16. Cross-References

- `project_ide_oss_strategy` — the fence rule, free + Pro categories (this spec adds distribution-gate refinement)
- `project_ide_v1_scope` — what v1 ships (this spec significantly expands the AI scope in v01)
- `project_ide_creative_sovereignty` — the assist-not-author principle (this spec sharpens it)
- `project_v2_ai_architecture` — multi-provider routing, hosting phases (this spec pulls agent layer + chatbot forward)
- `project_ide_files_sovereign_principle` — files-first, offline-first (privacy principle is its sibling)
- `project_ide_renderer_portable` — cross-platform editor (this spec reaffirms it)
- `project_unified_production_types` — production_type enum bridging IDE and Platform (still applies)

---

## 17. Status & Next Steps

- **Spec status:** Strategic foundation locked. Not yet an implementation plan.
- **Next session:** User will return with more strategic threads. Per the closing-handoff rule, see `project_session_handoff_2026_05_16` for restart context.
- **Implementation plan:** When user explicitly requests, invoke `writing-plans` skill with this spec as input. Likely scope: a phased build plan that sequences signup gate → IDE Pro entitlement → AI taste features → Notes-to-Rwanga + Agent.
