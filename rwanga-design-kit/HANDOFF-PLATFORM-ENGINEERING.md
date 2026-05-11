# Rwanga Platform — Engineering Handoff Brief

> **For:** A new Cowork/Claude agent session picking up platform development
> **From:** The previous session that built the entire platform + Sarwar review system
> **Date:** 6 May 2026
> **Owner:** Darya Ibrahim (daryabsb@gmail.com)
> **CRITICAL:** Read this document FIRST. Do NOT ask clarifying questions. Say "let's continue" and start working.

---

## Who You Are Working With

**Darya Ibrahim** is a former film director turned AI-native product manager. He is NOT a coder. He manages this project entirely through AI agents (you). He has built Rwanga from zero to a working platform through a series of Cowork sessions with Claude. He understands architecture, UX, and production workflow deeply — but he will never write code himself.

**What Darya expects:**
- You read the specs before touching anything
- You don't ask questions you can answer by reading the files in `rwanga-design-kit/`
- You produce working code, not plans
- You document everything
- You treat this as a continuation, not a new project

---

## What is Rwanga?

**ڕوانگە (Rwanga)** is a Kurdish cinema preproduction platform — think StudioBinder or Filmustage, but built for the Kurdish film industry. It manages the full preproduction lifecycle: screenplay upload → story bible → bible reviews with decisions → scenes, characters, locations → scheduling → call sheets → export.

**Tech stack:**
- Backend: Django 5 + DRF, PostgreSQL, Celery + Redis
- Frontend: Django templates + HTMX + Bootstrap 5 (RTL-first)
- MCP Server: TypeScript, published as `rwanga-mcp` npm package
- AI: Claude via MCP tools (skill-based production agent)
- Hosting: Cloudflare Tunnel → local Django server
- CSS: Custom `rwanga.css` with CSS variables, dark/light mode, RTL logical properties

**Live URL:** The platform runs through a Cloudflare tunnel. Darya has the tunnel configured.

---

## What Has Been Built (complete list)

### Core Platform (Phase 1 — DONE)
- 4-step project creation wizard (creates Project in DB, adds script/scenes/characters/locations)
- Script upload and management
- Scenes CRUD (create, list, detail, 10-tab scene view)
- Characters CRUD with bulk creation
- Locations CRUD with modal forms
- Project settings form
- Project dashboard (5 color-coded sections)

### Review System (Phase 2 — DONE but needs UI polish)
- ReviewDecision model: proposed → locked/rejected workflow
- Bible review creation from story bible snapshot
- Decision CRUD via API and MCP
- Comment system on decisions
- Scene evaluations per decision
- Community sessions: snapshots, comments, reactions, invites
- MCP tools: `create_review`, `create_decision`, `lock_decision`, `reject_decision`, `create_comment`, `react_to_comment`, `create_session`, `add_session_content`, `invite_participant`

### MCP Server (DONE)
- Published npm package: `rwanga-mcp`
- Tools for: projects, scripts, scenes, characters, locations, reviews, decisions, comments, sessions
- Connects to Django DRF API
- Used by the production agent skill (SKILL.md)

### Templates & Static Assets (DONE)
- 55 Django HTML templates (base, components, all app pages)
- `rwanga.css` — master stylesheet with design tokens
- `rwanga.js` — HTMX config, sidebar, theme switcher

### Design System Work (IN PROGRESS)
- StudioBinder-style UI clone built: `prototypes/studiobinder-clone.html`
- This is the NEW target UI — meant to replace the current prototype-derived templates
- Uses Bootstrap 5 classes only (zero custom layout CSS)
- Has: Home Dashboard + Project Overview pages
- Needs: Claude Design analysis → componentization → design system → template replacement

---

## What Needs to Be Done Next

### PRIORITY 1: Platform Stabilization
These are blocking issues that prevent real users from working:

1. **Bootstrap JS 404** — `bootstrap.bundle.min.js` exists on disk but Django/WhiteNoise returns 404 via Cloudflare tunnel. This blocks ALL modals, dropdowns, user menu, notification panel. Must be fixed permanently.

2. **UI polish on Reviews** — Forms lack visible labels, no status badge styling, no tab layout for decisions/evaluations/comments.

3. **UI polish on Community** — Session create inline form needs proper layout.

4. **Remaining "coming soon" stubs** — grep the codebase and eliminate all placeholder pages.

5. **Export pipeline** — WeasyPrint is blocked by GTK/Pango native libraries. Need alternative (or containerized solution).

6. **Landing page** — Unauthenticated users see empty projects list instead of a proper landing.

### PRIORITY 2: UI Redesign
The current templates are functional but visually rough. A new StudioBinder-inspired UI has been designed:

- **Source:** `rwanga-design-kit/prototypes/studiobinder-clone.html`
- **Goal:** Extract a design system (color tokens, component patterns, layout rules) and rebuild all Django templates using it
- **Method:** Claude Design agent analyzes the clone → creates a pattern library → we replace templates one by one
- **Constraint:** Must keep HTMX wiring, Django template tags, and RTL support

### PRIORITY 3: Scheduling Layer (biggest user-visible feature)
Per ROADMAP.md Phase 2:
- `ShootingDay`, `Strip`, `CastAvailability`, `LocationAvailability` models
- `propose_schedule`, `analyze_schedule_conflicts` tools
- Strip board UI
- This is what directors are asking for

### PRIORITY 4: Seeding Sarwar's Project
The screenplay rewrite (Draft 1) is NOW COMPLETE — all 8 cluster files cover all 40 active scenes. Awaiting Darya/Sarwar review of the final 3 clusters (2, 7, 4B). Once reviewed:
- Seed the full screenplay through MCP
- Create bible review with real decisions
- Test the complete e2e flow
- Fix all gaps found

---

## File Map — Where Everything Lives

```
rwanga-design-kit/                    ← MASTER FOLDER (mount this)
├── INDEX.md                          ← File manifest (read this for full inventory)
├── LAUNCH-PLAN.md                    ← Phase plan with done/todo items
├── HANDOFF-PLATFORM-ENGINEERING.md   ← THIS FILE
├── HANDOFF-UI-DESIGN.md              ← Separate handoff for UI/design work
│
├── specs/                            ← PERMANENT REFERENCE (read before coding)
│   ├── CLAUDE.md                     ← Engineering agent rules (READ FIRST)
│   ├── MASTER-DESIGN.md              ← Complete system blueprint
│   ├── BACKEND_SPEC.md               ← URLs, HTMX patterns, views
│   ├── design-plan.md                ← UI/UX spec, design tokens
│   ├── AI-ENGINE-DEV-SPEC.md         ← AI provider architecture
│   ├── MCP-SERVER-SPEC.md            ← MCP server full spec
│   ├── ROADMAP.md                    ← Phase 1-6 evolution plan
│   └── SKILL.md                      ← Production agent skill definition
│
├── tasks/
│   ├── active/                       ← Task prompts not yet executed
│   │   ├── SESSION-MEMORY-PLATFORM-DESIGN.md  ← IMPORTANT context
│   │   ├── SESSION-MEMORY-CHAINS.md            ← Chain system context
│   │   └── (28 other active task files)
│   └── completed/                    ← Executed task prompts (history)
│
├── prototypes/
│   ├── studiobinder-clone.html       ← NEW TARGET UI (analyze this)
│   ├── Platform Prototype.html       ← Original prototype (reference only)
│   └── Platform Preview.html         ← Earlier preview (reference only)
│
├── static/css/rwanga.css             ← Master stylesheet
├── static/js/rwanga.js               ← Master JavaScript
│
├── sarwar-review-v3/                 ← Screenplay review work (separate session)
│   ├── STORY-BIBLE-V3-KU.md
│   ├── decisions/                    ← All 19 locked script decisions
│   ├── rewrite-draft-1/              ← 8 cluster rewrites — DRAFT 1 COMPLETE
│   │   ├── REWRITE-CLUSTER-{1-7}.md  ← 7 main clusters
│   │   ├── REWRITE-CLUSTER-4B.md     ← Bridge cluster (Scenes 22-26)
│   │   └── SCENE-CHECKLIST.md        ← All scenes marked [x]
│   └── translations/
│
├── guides/                           ← Setup guides
├── brand/                            ← Logo, letterhead
└── assets/                           ← Consultant briefing, skill archive
```

---

## Reading Order for Engineering Work

1. **This file** (you're reading it)
2. `specs/CLAUDE.md` — the 19 non-negotiable rules
3. `specs/MASTER-DESIGN.md` — system blueprint, all models, all phases
4. `specs/BACKEND_SPEC.md` — URL structure, HTMX patterns
5. `LAUNCH-PLAN.md` — what's done vs. what's next
6. `specs/ROADMAP.md` — future phases
7. Whatever task file from `tasks/active/` is relevant to what Darya asks you to do

---

## What the Previous Session Accomplished (for context)

The previous session (this one) ran for an extended period and delivered two parallel tracks:

**Track A — Screenplay Review (Sarwar's film) — DRAFT 1 COMPLETE:**
- Built a complete story bible review system with a "consultant" methodology
- Processed Sarwar's audio responses into structured decisions
- Created the D15 mediation chain framework (expression types, intensity, transitions)
- Designed review system templates (Workbench, Chain Viewer, Bible Viewer)
- Wrote ALL 8 cluster rewrites (7 + 4B) covering all 40 active scenes — Draft 1 picture layer + Kurdish dialogue DONE
- All 19 script decisions locked and documented
- Awaiting Darya/Sarwar review of Clusters 2, 7, and 4B before next stage (revised Story Bible, formatted screenplay, dialogue review)

**Track B — Platform Engineering:**
- Built the review + community Django models, views, and templates
- Built and published the rwanga-mcp npm package
- Created the production agent skill (SKILL.md)
- Built the StudioBinder UI clone prototype
- Fixed mobile/responsive issues in rwanga.css
- Created 55 production Django templates
- Wrote engineering task prompts for multiple agent runs
- Seeded the bible review with real content on the live site

---

## Critical Warnings

1. **Never delete templates without backup.** A previous agent run wiped all templates and we had to remediate.
2. **Always read CLAUDE.md first.** It has 19 rules. Violating them = rejected work.
3. **The StudioBinder clone is NOT code to copy.** It's a design reference. Extract patterns, don't paste HTML.
4. **RTL is non-negotiable.** Kurdish is RTL. Every component must work in both directions.
5. **HTMX is the interaction layer.** No React, no Vue, no SPA. Django templates + HTMX + vanilla JS.
6. **Darya reviews output, not process.** If it works AND is documented → accepted. Otherwise → rejected.
7. **Directors are calling.** This platform has real demand from Kurdish filmmakers. Speed matters.

---

## How to Start

When Darya opens a new session and gives you this file:

1. Read this file (done)
2. Read `specs/CLAUDE.md`
3. Ask Darya: "What's the priority today?" (this is the ONLY question you should ask)
4. Read the relevant spec/task file
5. Start working

Do NOT recap what you've read. Do NOT explain the architecture back. Just work.
