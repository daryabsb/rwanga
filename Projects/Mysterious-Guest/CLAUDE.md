# Mysterious Guest — Project Memory

## What This Project Is

"Mysterious Guest" (میوانی نادیار) is a Kurdish psychological suspense film in preproduction. Director: Sarwar Muhedin. This was the first project — and it proved the concept. The bible review received significant praise from directors, and what started as one film's preproduction has become the foundation of a consulting business and eventually a live platform (Rwanga) for Kurdish cinema.

**This is not just a film project anymore. This is the beginning of a business that aims to transform the Kurdish film industry.**

## The User: Darya Ibrahim

- Email: daryabsb@gmail.com
- From Slemani, Kurdistan Region
- 30 years of passion for Kurdish cinema. Left the field because he couldn't make the systemic change he wanted — couldn't even control a boom holder. Now directors are coming to him for consultation. This AI partnership made that possible. The stakes are deeply personal and professional.
- Speaks Slemani Kurdish dialect (NOT academic/Mukryani Kurdish)
- Works with a human translator for Kurdish documents — AI Kurdish translations were rejected as unreadable
- Sets adversarial review rules: defend your positions, don't fold immediately, lock decisions through genuine debate
- Prefers: "Do not recreate files — modify them" when possible
- Values thoroughness but hates unnecessary postamble

### The Bigger Vision
Darya is building a consultation practice and a live platform (Rwanga) for Kurdish cinema professionals. The Mysterious Guest review is the proof of concept — and it's already getting attention from directors. The mission: **"I want people to debug their stories before making movies."** This is about changing an entire industry, not just one film. Not about getting rich — about raising the floor of Kurdish cinema so every film that gets made is better than it would have been.

## Key Working Agreements

1. **Kurdish translations must be human-translated.** The workflow: extract English text into numbered chunks → human translator returns Kurdish → rebuild document with translated text. Never attempt AI Kurdish translation for final documents.
2. **13 locked decisions exist** from adversarial review — these are the analytical foundation. See PROJECT-LOG.md for the full list.
3. **All documents must be mobile responsive** — Sarwar reads on phone.
4. **Project log and profiles must be updated every session.** Don't let this slip.
5. **Scene-by-scene annotation is pending** — Darya will say when to start this.
6. **Rwanga platform** — a Kurdish AI preproduction platform idea, deferred to another session.
7. **Never rebuild review files from scratch during discussion.** Discuss first, lock decisions, then use a lightweight script/patch to update the review data. Rebuilding consumes too many tokens. Separate the thinking from the document work.

### SESSION START PROTOCOL
**Every new session: read CLAUDE.md and PROJECT-LOG.md FIRST.** When Darya says "let's do this" or starts a task, you must already know the full context — what's been done, what's pending, who the stakeholders are, and what the working agreements are. No asking "can you catch me up?" — the files are here. Read them. Be up to speed immediately.

## Current State (as of April 28, 2026)

### Active Documents
| File | What | Version |
|------|------|---------|
| `BIBLE-REVIEW-v2.html` | English bible review (first round) | Final |
| `BIBLE-REVIEW-KU-v3.html` | Kurdish bible review (human translated) | Final |
| `Reviews/REVIEW-V2.html` | English second review (Sarwar response round) | Final |
| `Reviews/REVIEW-V2-KU.html` | Kurdish second review (human translated) | Final |
| `Reviews/TRANSLATION-CHUNKS-V2.txt` | English chunks for V2 translation | Reference |
| `Reviews/TRANSLATION-CHUNKS-KU-V2.txt` | Kurdish chunks from translator | Reference |
| `Scene12-Viewer-KU.html` | Kurdish Scene 12 preproduction viewer | Final |
| `STORY-BIBLE-KU.md` / `.docx` | Kurdish story bible | Final |
| `PROJECT-LOG.md` | Full activity log | Updated April 28 |
| `SARWAR-PROFILE.md` | Director context & meeting prep | Updated April 28 |

### What's Been Done
- Full 43-scene suspense analysis (Hitchcock bomb model, Chekhov threads, tension scoring)
- Adversarial review round 1: 13 decisions locked through debate
- Bible review v1 → v2 with locked decisions, tabs, conversation log
- Kurdish translation: AI attempt failed → human translation workflow → KU-v3 built
- Scene 12 interactive viewer (English + Kurdish)
- Story bible (English + Kurdish)
- Rwanga platform design plan (draft)
- **Sarwar's 11 responses analyzed** through adversarial debate (3 rounds)
- **7 new decisions locked** (Decisions 14-20) — total: 20 locked decisions
- **REVIEW-V2.html built** — second review with 4 tabs (Summary, Analysis, Refined Bible, Conversation)
- **Three-layer alignment identified:** Character (certainty) → Mechanism (mediation) → Theme (mediated vs direct contact)

### What's Pending
- ~~Kurdish translation of REVIEW-V2~~ — DONE (REVIEW-V2-KU.html)
- Scene-by-scene annotation (when Darya says go)
- Rwanga platform — design and build (see RWANGA-VISION.md)

## Important Context

- The film's core concept: everything from Scene 2 to Scene 43 is Nali's psychological projection — not a dream, but how his traumatized mind processes the possibility of love
- The "structural leak" is Act 2A (Scenes 12-18): intimacy scenes lack active threat vectors
- Three critical fixes: (1) plant the bomb before dinner, (2) make the house speak, (3) hide the imagination frame until Scene 43
- The sofa sequence (Scenes 19-29) is Hitchcock-grade and must not be touched
- Genre lock: psychological suspense, NOT relationship drama
- **NEW — Core tension:** The film's tension is between mediated experience and direct human contact
- **NEW — Character spine:** Nali is addicted to certainty — certainty eliminates emotional pain risk
- **NEW — Behavioral grounding:** Human logic must be sufficient — clinical logic must never be required
- **NEW — AI rule:** AI observes but does not interpret (thermostat, not therapist)
- **NEW — Mediation law:** All of Nali's interactions are mediated. Any rare unmediated moment = structural rupture

## Rwanga Platform

See `/RWANGA-VISION.md` in the root of the workspace for the full vision document. Summary: three pillars (Director Dashboard, Discussion Board, Professional Review), human-first business model (no AI auto-generation in Phase 1), pay-as-you-go for ~20-30 active directors, university pipeline for long-term growth. The mission: debug stories before they become movies.

## File Structure
```
RWANGA-VISION.md                        ← Platform vision & business model
Projects/Mysterious-Guest/
├── CLAUDE.md                          ← You are here
├── PROJECT-LOG.md                     ← Activity log (UPDATE EVERY SESSION)
├── SARWAR-PROFILE.md                  ← Director context (UPDATE AS NEEDED)
├── BIBLE-REVIEW-v2.html               ← English bible review, first round (FINAL)
├── BIBLE-REVIEW-KU-v3.html            ← Kurdish bible review (FINAL)
├── Reviews/
│   ├── REVIEW-V2.html                 ← Second review, Sarwar response round (FINAL)
│   ├── REVIEW-V2-KU.html             ← Kurdish second review (FINAL)
│   ├── TRANSLATION-CHUNKS-V2.txt      ← English chunks for V2 translation
│   └── TRANSLATION-CHUNKS-KU-V2.txt   ← Kurdish chunks from translator
├── TRANSLATION-CHUNKS.txt             ← English chunks for V1 translation
├── HUMANIZED-CHUNKS.txt               ← Human Kurdish translations (V1)
├── Scene12-Viewer.html                ← English scene 12 viewer
├── Scene12-Viewer-KU.html             ← Kurdish scene 12 viewer
├── STORY-BIBLE.md                     ← English story bible
├── STORY-BIBLE-KU.md / .docx          ← Kurdish story bible
├── Mysterious_Guest_Original_Screenplay.docx  ← Source screenplay
├── rwanga-design-plan.md               ← Platform design (deferred)
├── scene12_overhead_floor_plan.svg     ← Interactive floor plan
├── reference/                          ← Location photos (house-00 to 03)
├── storyboard/                         ← Storyboard assets
├── archive/                            ← Old versions
└── [v1, v2, META files]               ← Superseded versions (keep for reference)
```
