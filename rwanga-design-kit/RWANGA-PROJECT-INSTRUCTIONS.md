# Rwanga Project — Combined Instructions

> **Paste this into the Rwanga project's custom instructions field.**
> Every chat opened inside this project will inherit this context.

---

## About This Project

**Rwanga (ڕوانگە)** is a Kurdish cinema preproduction platform AND its first real production — Sarwar's film **میوانی نادیار (The Unknown Guest)**. The project has two active tracks:

### Track A — Platform Engineering
Building the SaaS platform: Django 5, HTMX, Bootstrap 5, MCP server. Think StudioBinder/Filmustage for Kurdish cinema. Directors are already asking for access.

### Track B — Screenplay (Sarwar's Film)  
Rewriting the Kurdish screenplay scene-by-scene using a consultant methodology. 7 clusters, 19 locked decisions, picture layer + Kurdish dialogue.

**These tracks share a workspace but should NOT share a chat.** Open separate chats for each track.

---

## About Darya

Darya Ibrahim is a former film director, now AI-native product manager. He is NOT a coder. He manages everything through AI agents. He understands architecture, UX, and production workflow deeply — but will never write code himself.

**What he expects:**
- Read specs before touching anything — don't re-explore what's documented
- Don't ask questions you can answer from the files
- Be compact — token efficiency matters
- Produce working output, not plans (unless planning is the task)
- Trust the context files he points you to

---

## Workspace Layout

```
normalize/rwanga-design-kit/              ← MASTER FOLDER
├── HANDOFF-PLATFORM-ENGINEERING.md       ← Full context for platform work
├── HANDOFF-UI-DESIGN.md                  ← Context for UI/design system work
├── PROJECT-INSTRUCTIONS-SCREENPLAY.md    ← Full context for screenplay work
├── INDEX.md                              ← File manifest
├── LAUNCH-PLAN.md                        ← What's done / what's next
│
├── specs/                                ← Engineering specs (read before coding)
│   ├── CLAUDE.md                         ← 19 engineering rules (READ FIRST)
│   ├── MASTER-DESIGN.md                  ← System blueprint
│   ├── BACKEND_SPEC.md, design-plan.md, etc.
│   └── ROADMAP.md                        ← Phase 1-6 evolution plan
│
├── prototypes/
│   └── studiobinder-clone.html           ← NEW target UI (needs design analysis)
│
├── tasks/active/                         ← Task prompts + session memory files
├── tasks/completed/                      ← History
│
├── sarwar-review-v3/                     ← SCREENPLAY TRACK
│   ├── STORY-BIBLE-V3-KU.md
│   ├── decisions/                        ← 19 locked script decisions
│   ├── rewrite-draft-1/                  ← 7 cluster rewrites (COMPLETE)
│   └── translations/
│
├── static/css/rwanga.css                 ← Master stylesheet
├── static/js/rwanga.js                   ← Master JavaScript
├── brand/, guides/, assets/
```

---

## How to Start Any Chat

**For platform engineering:** Read `HANDOFF-PLATFORM-ENGINEERING.md` first, then `specs/CLAUDE.md`.

**For screenplay work:** Read `PROJECT-INSTRUCTIONS-SCREENPLAY.md` first, then the relevant cluster file.

**For UI/design:** Read `HANDOFF-UI-DESIGN.md` first, then open `prototypes/studiobinder-clone.html`.

**For anything else:** Ask Darya "which handoff doc should I read?" — he'll point you.

---

## Current Priorities (as of 6 May 2026)

1. **Platform stabilization** — Bootstrap JS 404, review UI polish, eliminate stubs
2. **UI redesign** — StudioBinder clone → design system → replace templates
3. **Screenplay** — Darya/Sarwar reviewing Clusters 2 & 7, 5 scenes still to write
4. **Scheduling layer** — Phase 2 from ROADMAP.md (biggest user-visible feature)
5. **Seed Sarwar's project** — once screenplay rewrite is reviewed, seed full data through MCP

---

## Rules That Apply Everywhere

1. Never delete files without backup
2. RTL is non-negotiable (Kurdish is RTL)
3. HTMX is the interaction layer — no React, no SPA
4. Document everything — undocumented work gets rejected
5. Each chat = one focused task. Don't mix tracks.
