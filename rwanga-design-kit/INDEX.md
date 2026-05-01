> **NOTE: Folder reorganization completed 2026-05-01.** Files are now in specs/, tasks/, guides/, prototypes/, assets/. See structure below.

# Rwanga Design Kit -- File Index & Manifest

**Owner:** Darya Ibrahim (daryabsb@gmail.com)
**Last updated:** 2026-05-01
**Purpose:** Master index of every file in rwanga-design-kit/, with status and category.

---

## Status Legend

| Status     | Meaning                                                      |
|------------|--------------------------------------------------------------|
| REFERENCE  | Permanent spec -- the agent must read this before working    |
| ACTIVE     | Current or upcoming task prompt -- not yet executed           |
| COMPLETED  | Task prompt already executed by the engineering agent         |
| TEMPLATE   | Production-ready Django template (copy into project)         |
| STATIC     | CSS/JS asset (copy into project)                             |
| ASSET      | Non-markdown file (HTML prototype, docx, zip, skill archive) |

---

## Proposed Folder Structure

If you decide to reorganize, here is the recommended layout:

```
rwanga-design-kit/
  specs/                  <-- permanent reference docs
    CLAUDE.md
    MASTER-DESIGN.md
    BACKEND_SPEC.md
    design-plan.md
    AI-ENGINE-DEV-SPEC.md
    MCP-SERVER-SPEC.md
    HUD2-SKELETON-CLONE-MANUAL.md
    ROADMAP.md
    SKILL.md
  tasks/
    completed/            <-- executed task prompts (history)
      FULL-DEVELOPMENT-TASK.md
      GAPS-COMPLETION-TASK.md
      PROJECT-WIZARD-TASK.md
      TEMPLATE-INTEGRATION-TASK.md
      MCP-PROGRESS-TASK.md
      AGENT-REMEDIATION.md
    active/               <-- current/upcoming task prompts
      EXPORT-BRANDING-TASK.md
  guides/                 <-- setup & operational guides
    MCP-SETUP-GUIDE.md
    README.md
  templates/              <-- Django templates (already organized)
    base.html
    stub.html
    accounts/
    components/
    floorplans/
    locations/
    notifications/
    progress/
    projects/
    scheduling/
    scripts/
    shots/
  static/                 <-- CSS/JS assets
    css/rwanga.css
    js/rwanga.js
  prototypes/             <-- visual reference HTML files
    Platform Preview.html
    Platform Prototype.html
  assets/                 <-- other non-code files
    RWANGA-CONSULTANT-BRIEFING.docx
    rwanga-production-agent.skill
    templates/update_templates.zip
```

---

## File-by-File Manifest

### Root-Level Markdown Files

| # | File | Category | Status | Description |
|---|------|----------|--------|-------------|
| 1 | `CLAUDE.md` | REFERENCE | active | 19 non-negotiable rules for the engineering agent. Must be read first before any coding session. Defines TDD, documentation, and progress-tracking requirements. |
| 2 | `MASTER-DESIGN.md` | REFERENCE | active | Complete system blueprint -- architecture, models, settings, phases P0-P5. The single source of truth for what the platform is. v3.0, April 29 2026. |
| 3 | `BACKEND_SPEC.md` | REFERENCE | active | URL structure, HTMX patterns, template context variables, view signatures. Backend engineering companion to MASTER-DESIGN. |
| 4 | `design-plan.md` | REFERENCE | active | UI/UX design spec -- vision, modules, layout, design tokens, color system, font stack, RTL rules. |
| 5 | `AI-ENGINE-DEV-SPEC.md` | REFERENCE | active | AI provider architecture -- local dev mode with zero cost, Celery tasks, WebSocket progress, provider swap pattern. |
| 6 | `MCP-SERVER-SPEC.md` | REFERENCE | active | Full MCP server specification -- resources, tools, transport, security. Covers all phases (progress, projects, shots, AI, community). |
| 7 | `HUD2-SKELETON-CLONE-MANUAL.md` | REFERENCE | done | Manual for cloning the hud2 Django skeleton. Skeleton has been cloned; kept as architecture reference. |
| 8 | `ROADMAP.md` | REFERENCE | active | Agent evolution plan -- from breakdown assistant to full AI Dude parity. Phases 1-5 with data model requirements per phase. |
| 9 | `SKILL.md` | REFERENCE | active | Rwanga production agent skill definition -- core principles, standard workflows, propose-preview-approve pattern. |
| 10 | `README.md` | REFERENCE | active | Design package overview -- describes the prototype, color tokens, and what is in the kit. |
| 11 | `INDEX.md` | REFERENCE | active | This file. Master index and manifest. |
| 12 | `FULL-DEVELOPMENT-TASK.md` | COMPLETED | done | First big development run. Instructed the agent to build P1-P5 apps (scripts, shots, scheduling, locations, floorplans, AI engine stubs). All phases attempted. |
| 13 | `GAPS-COMPLETION-TASK.md` | COMPLETED | done | Second run -- departments, exports, AI engine providers, remaining gaps from the first run. Includes progress-app enforcement rules. |
| 14 | `PROJECT-WIZARD-TASK.md` | COMPLETED | done | Project create wizard real CRUD implementation. Step 1 creates Project in DB, steps 2-4 add data. Wizard is now functional. |
| 15 | `TEMPLATE-INTEGRATION-TASK.md` | COMPLETED | done | Instructions to copy design-kit templates into the Django project and wire missing views/URLs. "Fill gaps only, do not touch existing code." |
| 16 | `MCP-PROGRESS-TASK.md` | COMPLETED | done | Instructions to build the Progress-only MCP server (subset of MCP-SERVER-SPEC.md section 9). Server is built and published as npm package. |
| 17 | `AGENT-REMEDIATION.md` | COMPLETED | done | Critical fixes after a bad agent run -- copy templates from design kit, fix template routing, repair broken views. Remediation has been applied. |
| 18 | `EXPORT-BRANDING-TASK.md` | ACTIVE | pending | Design task for Claude Design agent -- create branded export templates (call sheets, scene PDFs, shot lists) with Rwanga visual identity. Not yet executed. |
| 19 | `MCP-SETUP-GUIDE.md` | REFERENCE | active | Operational guide for connecting Claude Code/Cowork to the Rwanga MCP server. Configuration examples for Windows and remote SSE. |

### Non-Markdown Root Files

| # | File | Category | Status | Description |
|---|------|----------|--------|-------------|
| 20 | `Platform Prototype.html` | ASSET | reference | Full interactive prototype -- dark/light mode, RTL, project dashboard, scene 12 with 10 tabs. Open in browser as visual reference. DO NOT use as code source. |
| 21 | `Platform Preview.html` | ASSET | reference | Earlier/simpler visual preview of the platform. Open in browser for reference. |
| 22 | `RWANGA-CONSULTANT-BRIEFING.docx` | ASSET | reference | Consultant briefing document (Word format). |
| 23 | `rwanga-production-agent.skill` | ASSET | active | Packaged skill archive (zip) for the Rwanga production agent. Contains the SKILL.md and related config. |

### templates/ Directory

All templates are **TEMPLATE** category, status **active** (production-ready, to be copied into Django project).

| # | File | Description |
|---|------|-------------|
| 24 | `templates/base.html` | Master base template -- topnav, sidebar, RTL support, dark/light mode, HTMX setup |
| 25 | `templates/stub.html` | Generic stub/placeholder template for unbuilt pages |
| 26 | `templates/accounts/login.html` | Login page |
| 27 | `templates/accounts/register.html` | Registration page |
| 28 | `templates/accounts/profile.html` | User profile page |
| 29 | `templates/accounts/settings.html` | User settings page |
| 30 | `templates/accounts/team.html` | Team management page |
| 31 | `templates/accounts/contacts.html` | Project contacts page |
| 32 | `templates/components/_sidebar.html` | Sidebar navigation partial |
| 33 | `templates/components/_topnav.html` | Top navigation bar partial |
| 34 | `templates/components/_ai_progress.html` | AI job progress indicator partial |
| 35 | `templates/components/_modal.html` | Modal dialog partial |
| 36 | `templates/components/_breadcrumb.html` | Breadcrumb navigation partial |
| 37 | `templates/components/_empty_state.html` | Empty state placeholder partial |
| 38 | `templates/components/_toast.html` | Toast notification partial |
| 39 | `templates/projects/dashboard.html` | Project dashboard (5 color-coded sections) |
| 40 | `templates/projects/create_wizard.html` | 4-step project creation wizard |
| 41 | `templates/projects/scene_view.html` | Scene detail view with module tabs |
| 42 | `templates/projects/list.html` | Project list page |
| 43 | `templates/projects/settings.html` | Project settings page |
| 44 | `templates/projects/_scene_list.html` | Scene list partial (HTMX) |
| 45 | `templates/projects/scenes/tabs/overview.html` | Scene tab -- overview |
| 46 | `templates/projects/scenes/tabs/shots.html` | Scene tab -- shot list |
| 47 | `templates/projects/scenes/tabs/storyboard.html` | Scene tab -- storyboard grid |
| 48 | `templates/projects/scenes/tabs/floorplan.html` | Scene tab -- floor plan SVG |
| 49 | `templates/projects/scenes/tabs/schedule.html` | Scene tab -- schedule strip |
| 50 | `templates/projects/scenes/tabs/lighting.html` | Scene tab -- lighting notes |
| 51 | `templates/projects/scenes/tabs/sound.html` | Scene tab -- sound design |
| 52 | `templates/projects/scenes/tabs/props.html` | Scene tab -- props list |
| 53 | `templates/projects/scenes/tabs/wardrobe.html` | Scene tab -- wardrobe |
| 54 | `templates/projects/scenes/tabs/continuity.html` | Scene tab -- continuity notes |
| 55 | `templates/scripts/index.html` | Scripts list/index page |
| 56 | `templates/scripts/upload.html` | Script upload page |
| 57 | `templates/scripts/breakdown.html` | Script breakdown view |
| 58 | `templates/scripts/elements.html` | Script elements list |
| 59 | `templates/scripts/docs.html` | Script documents page |
| 60 | `templates/shots/list.html` | Shot list page |
| 61 | `templates/shots/storyboards.html` | Storyboard gallery page |
| 62 | `templates/scheduling/index.html` | Scheduling main page |
| 63 | `templates/scheduling/stripboard.html` | Stripboard view |
| 64 | `templates/scheduling/call_sheets.html` | Call sheets page |
| 65 | `templates/locations/list.html` | Locations list page |
| 66 | `templates/floorplans/list.html` | Floor plans list page |
| 67 | `templates/notifications/panel.html` | Notifications panel |
| 68 | `templates/progress/dashboard.html` | Progress tracking dashboard |
| 69 | `templates/progress/tasks.html` | Progress tasks list |
| 70 | `templates/progress/task_detail.html` | Progress task detail view |
| 71 | `templates/progress/updates.html` | Progress updates feed |
| 72 | `templates/progress/gaps.html` | Gaps and blockers list |
| 73 | `templates/progress/decisions.html` | Design decisions log |
| 74 | `templates/progress/changelog.html` | Changelog view |
| 75 | `templates/progress/agent_reports.html` | Agent reports view |
| 76 | `templates/progress/docs.html` | Progress documentation page |
| 77 | `templates/progress/diagrams.html` | Architecture diagrams page |
| 78 | `templates/update_templates.zip` | Zip archive of template updates (likely from a batch update) |

### static/ Directory

| # | File | Category | Status | Description |
|---|------|----------|--------|-------------|
| 79 | `static/css/rwanga.css` | STATIC | active | Master stylesheet -- all design tokens, dark/light mode, RTL logical properties, component styles |
| 80 | `static/js/rwanga.js` | STATIC | active | Master JavaScript -- HTMX config, sidebar toggle, theme switcher, toast system |

---

## Reading Order for the Engineering Agent

1. `CLAUDE.md` -- operating rules (read first, always)
2. `MASTER-DESIGN.md` -- system blueprint
3. `BACKEND_SPEC.md` -- URL structure, HTMX patterns
4. `design-plan.md` -- UI/UX spec
5. `AI-ENGINE-DEV-SPEC.md` -- AI provider architecture
6. `MCP-SERVER-SPEC.md` -- MCP server spec (if working on MCP)
7. `ROADMAP.md` -- future phases (if planning ahead)
8. Current task file from `tasks/active/`

## Summary Statistics

- **Total files:** 80
- **Reference specs:** 11 markdown files
- **Completed tasks:** 6 task prompts (executed, kept for history)
- **Active tasks:** 1 (EXPORT-BRANDING-TASK.md)
- **Templates:** 55 HTML files (production-ready)
- **Static assets:** 2 (CSS + JS)
- **Other assets:** 4 (2 HTML prototypes, 1 docx, 1 skill archive)
- **Archives:** 2 (update_templates.zip, rwanga-production-agent.skill)
