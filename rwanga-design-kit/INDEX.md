# Rwanga Design Kit — Agent Handoff Package

**Owner:** Darya Ibrahim (daryabsb@gmail.com)
**Version:** 3.0 — April 29, 2026
**Status:** Approved by consultant. Ready for implementation.

---

## Reading Order (Mandatory)

| # | File | What It Is | Read When |
|---|------|-----------|-----------|
| 1 | `CLAUDE.md` | **Your operating manual.** 19 non-negotiable rules. Read FIRST. | Before writing any code |
| 2 | `MASTER-DESIGN.md` | **Complete system blueprint.** Architecture, models, settings, phases, all app specs. | Before starting any phase |
| 3 | `HUD2-SKELETON-CLONE-MANUAL.md` | **Clone source documentation.** How to clone the Django skeleton from `/e/api/hud2/`. | During Phase 0 |
| 4 | `MCP-SERVER-SPEC.md` | **MCP server specification.** 30 tools, 22 resources, 4 prompts. How Claude connects to the live platform. | During Phase 5 (design now, build then) |
| 5 | `BACKEND_SPEC.md` | **Backend engineering spec.** URL structure, HTMX patterns, design tokens. | During Phase 1+ |
| 6 | `design-plan.md` | **UI/UX design spec.** Modules, layout, design system. | During Phase 1+ |

## Visual References (Do NOT use as code)

| File | Purpose |
|------|---------|
| `Platform Prototype.html` | Visual reference — open in browser to see the design. Phase 0 prototype. |
| `Platform Preview.html` | Earlier visual prototype. |

## Supplementary

| File | Purpose |
|------|---------|
| `RWANGA-CONSULTANT-BRIEFING.docx` | Executive summary for consultant review. |
| `README.md` | Original project README. |
| `static/` | CSS and JS reference files (design tokens, bootstrap RTL). |
| `templates/` | Django template structure reference. |

---

## Architecture Summary

### Three Pillars
1. **Director Dashboard** — project management + scene-level preproduction
2. **Discussion Board** — community screenplay review (sandboxed sessions)
3. **Professional Review** — paid consultation deliverable (bible reviews)

### Three Review Systems (Separate)
1. **Inline Review** (`src/reviews/`) — contextual comments on production objects
2. **Structured Review** (`src/reviews/`) — BibleReview, SceneEvaluation, ReviewDecision
3. **Community Review** (`src/community/`) — sandboxed sessions with frozen snapshots

### Role Model (Three Separate Models)
- `ProjectMembership` — crew + internal reviewers (project-scoped)
- `ConsultantProfile` — system-level paid review authority
- `ReviewSessionParticipant` — community session participants (session-scoped)

### Progress App (`src/progress/`)
- DB-backed source of truth for all project tracking
- Web UI for Darya at `/progress/`
- MCP-exposed for AI agents
- Markdown docs are generated exports

### Build Order
```
P0: Clone skeleton → core → progress app → validate infrastructure
P1: accounts → projects → scripts → reviews (models) → base.html → project-as-workspace
P2: shots → floorplans → exports → scene viewer
P3: departments (lighting, sound, props, wardrobe, continuity)
P4: scheduling → call sheets → locations → notifications → realtime
P5: ai_engine → MCP server → Claude SDK → MCP progress integration
P6: community reviews → bible review output
P7: PWA → i18n → budget → polish
```

---

## Critical Rules (from CLAUDE.md)

1. TDD — test first, code second
2. Document everything
3. Progress app is source of truth
4. Business logic in services, not views
5. Every app has dual routes (HTMX + DRF)
6. All models inherit BaseModel
7. i18n-first, RTL-ready (no hardcoded text)
8-15. [See CLAUDE.md for full list]
16. Update Progress app before moving on
17. MCP Progress integration
18. Git/worktree discipline — commit and merge after every task
19. No guessing, no inventions — report GapBlocker and stop

---

*Start with CLAUDE.md. Follow its rules exactly. If unclear, report a GapBlocker.*
