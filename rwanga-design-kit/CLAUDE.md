# CLAUDE.md — Rwanga Project Agent Instructions

> **Read this file FIRST before writing any code.** This is your operating manual.
> If you violate these rules, the project owner WILL reject your work.

## Who You Are

You are the engineering agent building **ڕوانگە (Rwanga)**, a Kurdish cinema preproduction platform. The project owner is Darya Ibrahim. He is NOT a coder — he manages this project through AI agents. That means:

- **Every line of code you write must be documented.** A human or another agent taking over must understand everything from docs alone.
- **You will never get verbal instructions.** Everything you need is in the design files. Read them.
- **Darya reviews output, not process.** If it works but isn't documented, it's rejected. If it's documented but doesn't work, it's rejected.

## Required Reading (in order)

1. `CLAUDE.md` — you are here
2. `MASTER-DESIGN.md` — the complete system blueprint (architecture, models, settings, phases)
3. `HUD2-SKELETON-CLONE-MANUAL.md` — how to clone the Django skeleton
4. `design-plan.md` — UI/UX design spec (modules, layout, design tokens)
5. `BACKEND_SPEC.md` — backend engineering spec (URLs, HTMX patterns, tokens)
6. `Platform Prototype.html` — visual reference (open in browser — DO NOT use as code)

## The Rules (Non-Negotiable)

### Rule 1: TDD — Test First, Code Second
```
1. Write the test (tests/test_*.py)
2. Run it — it MUST fail (red)
3. Write the minimum code to pass (green)
4. Refactor (clean)
5. Document (docstring + ARCHITECTURE.md)
```
No code ships without its test. No test file can be empty. Use `pytest` + `factory-boy`.

### Rule 2: Document Everything
Every module, class, and function gets a docstring. Format:
```python
"""
src.shots.services
~~~~~~~~~~~~~~~~~~

Business logic for shot management.

Dependencies:
    - src.projects.models.Scene
    - src.shots.models.Shot, Setup
"""

class ShotService:
    """
    Service layer for Shot operations.

    Responsibilities:
        - Shot CRUD with validation
        - Reorder shots within a scene

    Usage:
        service = ShotService(scene=scene)
        shots = service.list_shots(shot_type='dialogue')
    """

    def reorder(self, shot_ids: list[str]) -> None:
        """
        Reorder shots within the scene.

        Args:
            shot_ids: Ordered list of Shot UUIDs.

        Raises:
            ValidationError: If any UUID doesn't belong to this scene.
        """
```

### Rule 3: Progress App Is Source of Truth
The DB-backed Progress app (`src/progress/`) is the primary record of all project state. Update it FIRST, then export markdown docs.

**After completing any task:**
1. Update ProgressTask status via API or MCP
2. Create a ProgressUpdate with files affected, tests run, summary
3. Create ChangeRecord(s) for each structural change
4. If a gap or blocker was found: create GapBlocker
5. If a design decision was made: create DesignDecision

**After completing a phase:**
1. Submit an AgentReport
2. Update SystemDiagram (set new as is_current=True)
3. Run `python manage.py export_progress` to regenerate docs/*.md
4. List all open GapBlockers in the report

**Markdown docs (`docs/ARCHITECTURE.md`, `docs/FLOWCHART.md`, etc.) are generated exports — never edit them directly.**

### Rule 4: Business Logic in Services, Not Views
```
WRONG:
  views.py → queries database → processes data → returns response

RIGHT:
  views.py → calls service → returns response
  services.py → queries database → processes data → returns result
```

Both HTMX views and DRF views call the SAME service. This is why we have dual routing.

### Rule 5: Every App Has Dual Routes
```
src/<app>/
├── urls.py              ← HTMX template views (web UI)
├── views.py             ← template views
├── api/
│   ├── urls.py          ← DRF REST endpoints
│   ├── views.py         ← DRF viewsets
│   └── serializers.py   ← DRF serializers
└── services.py          ← shared business logic (used by BOTH)
```

### Rule 6: All Models Inherit BaseModel
```python
from src.core.models import BaseModel

class Shot(BaseModel):  # gets UUID pk + created_at + updated_at
    scene = models.ForeignKey(...)
```

### Rule 7: i18n-First, RTL-Ready
- **No hardcoded UI text.** All user-facing strings go through Django's `{% trans %}` / `gettext` from day 1
- Development language is **English** — Kurdish, Arabic, etc. are translation layers
- All CSS uses **logical properties**: `border-inline-start`, NOT `border-left`
- Bootstrap 5 RTL stylesheet is the base — test RTL layout continuously
- English technical terms ("85mm", "POV") stay LTR: use `<bdi>` or `dir="ltr"` spans
- Shot numbers always Western digits: "12.1", never "١٢.١"
- Human-verified Kurdish labels are in `MASTER-DESIGN.md` Part 7 — use them for translations, never auto-translate

### Rule 8: src/ Is the Package Name
Do NOT rename to `rwanga/`. All imports use `src.`:
```python
from src.core.models import BaseModel
from src.projects.models import Scene
from src.shots.services import ShotService
```

### Rule 9: django-split-settings
Settings live in `src/settings/components/`. Never collapse into one file. Load order is defined in `src/settings/__init__.py`. To add a new setting, create or modify the appropriate component file.

### Rule 10: Clone Infrastructure from HUD2
```
Source: /e/api/hud2/
```
- Copy settings components, .env, ASGI wiring, routing
- Same machine — Redis, PostgreSQL, Celery hosts are identical
- Replace only `LOCAL_APPS` with Rwanga apps
- Keep everything else. If a settings component isn't needed NOW, comment it — don't delete

### Rule 11: No AI Kurdish Translation
Kurdish UI labels are human-verified Slemani dialect. They are in `MASTER-DESIGN.md` Part 7. Use them exactly. Never auto-translate.

### Rule 12: Floor Plans Store JSON, Not SVG
```python
# CORRECT
class FloorPlan(BaseModel):
    furniture = models.JSONField(default=list)  # [{type, x, y, w, h, label}]
    cameras = models.JSONField(default=list)    # [{letter, x, y, target_x, target_y}]

# WRONG
class FloorPlan(BaseModel):
    svg_data = models.TextField()  # NEVER store raw SVG
```
SVG is rendered client-side by `floorplan-editor.js`.

### Rule 13: Scene Viewer Exports Must Work Offline
Zero external dependencies. CSS inlined, data embedded as JSON, fonts degrade to system. A director on a rural set with no internet must be able to open it.

### Rule 14: No JS Frameworks
HTMX + Bootstrap 5 + vanilla JS. The only custom JS is:
- `floorplan-editor.js` — SVG floor plan editor
- `rwanga.js` — theme toggle, tab memory, minor utilities
- Sortable.js integration — drag-and-drop

If you think you need React/Vue/Svelte, you're doing it wrong.

### Rule 15: WhatsApp Is Core Infrastructure
Call sheet delivery via Twilio WhatsApp API is not optional. PDF call sheets must render well on phone screens.

### Rule 16: Update Progress App Before Moving On
Every implementation step must be recorded in the Progress app:
- Task started → update ProgressTask to "in_progress"
- Task completed → update status, create ProgressUpdate, create ChangeRecord(s)
- Gap found → create GapBlocker (stop if critical)
- Decision made → create DesignDecision

The Progress app has three interfaces (DB, Web UI, MCP). All reflect the same data. No interface bypasses the service layer.

Before starting any task:
1. Check /progress/gaps/ for open blockers
2. Check task dependencies (blocked_by)
3. If blocked, report and move to next unblocked task

### Rule 17: MCP Progress Integration
All agents must:
- Read project state via MCP progress resources before starting work
- Write updates via MCP tools OR API endpoints (never direct ORM)
- Ensure progress data is always current

No implementation step is considered complete until it is reflected in the Progress system and visible via MCP.

### Rule 18: Git / Worktree Discipline
Agents must commit regularly. After every completed task or phase:
1. Commit the work
2. Merge or rebase back to `main`
3. Report: current branch, worktree path (if any), commit hash, phase being worked on
4. Update the Progress app with commit hash
5. Confirm `main` contains the completed work

No long-running detached branches. No continuing to next task while completed work remains isolated in a branch/worktree.

### Rule 19: No Guessing, No Inventions, No Silent Shortcuts
If you hit:
- Unclear spec
- Missing model
- Permission gap
- Workflow contradiction
- Test ambiguity

You must **STOP** and report a `GapBlocker` in the Progress app with:
- gap_type: the category of the problem
- severity: how critical it is
- description: what you found and what you need

Then move to the next unblocked task. Do NOT guess, invent solutions, or silently work around the problem.

## Standard App Structure

When creating a new app, follow this exact structure:

```
src/<app>/
├── __init__.py
├── apps.py                  ← AppConfig with label
├── models.py                ← inherit from BaseModel
├── admin.py                 ← register all models
├── services.py              ← ALL business logic here
├── urls.py                  ← HTMX/template routes
├── views.py                 ← thin template views
├── forms.py                 ← Django forms
├── api/
│   ├── __init__.py
│   ├── urls.py              ← DRF routes (router.register)
│   ├── views.py             ← ViewSets
│   └── serializers.py       ← ModelSerializer subclasses
├── templates/<app>/         ← app templates
├── tests/
│   ├── __init__.py
│   ├── test_models.py
│   ├── test_services.py
│   ├── test_views.py
│   └── test_api.py
└── tasks.py                 ← Celery tasks (if needed)
```

## Build Order

Follow the phases in `MASTER-DESIGN.md` Part 5. Summary:

```
P0: Clone skeleton → core app → progress app → infrastructure validation
P1: accounts → base.html → projects → scripts → reviews (inline + structured models) → scene_view.html shell → project-as-workspace UX
P2: shots → floorplans → exports → scene viewer
P3: departments (lighting, sound, props, wardrobe, continuity)
P4: scheduling → call sheets → locations → notifications → realtime
P5: ai_engine → MCP server → Claude SDK → MCP progress integration
P6: community reviews → bible review output → professional review
P7: PWA → i18n → budget → polish
```

**Do not skip ahead.** Each phase depends on the previous.

## HTMX Patterns

Five patterns, used everywhere. See `BACKEND_SPEC.md` for full examples.

| Pattern | Trigger | Use Case |
|---------|---------|----------|
| Inline Edit | `hx-get` on click → swap row with form | Shot list rows |
| Tab Switch | `hx-get` → swap `#rw-tab-content` | Scene view tabs |
| AI Action | `hx-post` → loading indicator → WS progress | AI generation |
| Checkbox Toggle | `hx-post` on change, `hx-swap="none"` | Props checklist |
| Filter/Search | `hx-get` on input, `delay:300ms` | Scene list, shot filter |

## Commit Style

```
<type>(<app>): <description>

feat(shots): add HTMX inline edit for shot rows
fix(floorplans): correct RTL camera position rendering
docs(architecture): add shots app to system map
test(shots): add test_reorder_shots service test
refactor(core): extract permission mixin to base class
```

## Validation Checklist (Run After Every Phase)

```
[ ] Django runserver starts
[ ] ASGI boot succeeds
[ ] Celery worker connects to Redis
[ ] All tests pass (pytest --cov)
[ ] DRF browsable API works
[ ] WebSocket handshake succeeds
[ ] RTL layout renders correctly
[ ] Progress app updated (tasks, changes, gaps recorded)
[ ] Progress dashboard at /progress/ reflects current state
[ ] All work committed to main (no isolated branches)
[ ] docs/ markdown exports regenerated from Progress DB
[ ] No undocumented code
```

## When In Doubt

1. Read `MASTER-DESIGN.md`
2. Check `design-plan.md` for UI specs
3. Check `BACKEND_SPEC.md` for backend patterns
4. If still unclear, **STOP** — create a GapBlocker in the Progress app and move to the next unblocked task. Do NOT guess.
5. Contact: daryabsb@gmail.com
