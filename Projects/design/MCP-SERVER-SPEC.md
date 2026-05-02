# ڕوانگە — MCP Server Specification

**Purpose:** Enable Claude (and other AI agents) to interact with a live Rwanga instance — read project data, create/edit shots, trigger AI jobs, export scenes, and participate in community review sessions.

**Protocol:** Model Context Protocol (MCP) — https://modelcontextprotocol.io
**Transport:** stdio (local) or SSE over HTTP (remote)
**Port:** Configured via `MCP_SERVER_PORT` (default: 8002)

---

## 1. Why MCP

Rwanga is built by AI agents and will be operated alongside AI agents. The MCP server allows:

1. **Claude as consultant** — read a director's project, analyze their screenplay, produce a bible review, push it back into the platform
2. **Claude as assistant** — create shots from a script description, generate floor plan JSON, optimize a schedule
3. **External AI agents** — any MCP-compatible agent can connect and work with project data
4. **Darya's workflow** — Darya works with Claude in Cowork/Claude Code. The MCP server lets Claude reach into the live platform without Darya copy-pasting data

---

## 2. Architecture

```
┌─────────────────────────┐
│  Claude / AI Agent       │
│  (MCP Client)           │
└──────────┬──────────────┘
           │ MCP Protocol (stdio or SSE)
┌──────────┴──────────────┐
│  Rwanga MCP Server       │
│  src/ai_engine/mcp/      │
│                          │
│  ├── server.py           │ ← MCP server entry point
│  ├── tools.py            │ ← tool definitions
│  ├── resources.py        │ ← resource definitions
│  ├── auth.py             │ ← authentication
│  └── prompts.py          │ ← prompt templates
│                          │
└──────────┬──────────────┘
           │ Django ORM / Services
┌──────────┴──────────────┐
│  Rwanga Django App       │
│  (all apps accessible)   │
└─────────────────────────┘
```

### Integration with Django

The MCP server runs as a separate process but shares the Django ORM:

```python
# src/ai_engine/mcp/server.py
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'src.settings')
django.setup()

from mcp.server import Server
from mcp.server.stdio import stdio_server
# or: from mcp.server.sse import SseServerTransport

from src.ai_engine.mcp.tools import register_tools
from src.ai_engine.mcp.resources import register_resources
from src.ai_engine.mcp.prompts import register_prompts

app = Server("rwanga")
register_tools(app)
register_resources(app)
register_prompts(app)
```

### Startup

```bash
# Local (stdio transport — for Claude Code / Cowork)
python -m src.ai_engine.mcp.server

# Remote (SSE transport — for remote agents)
python -m src.ai_engine.mcp.server --transport sse --port 8002
```

### MCP Client Configuration (for Claude Code / Cowork)

```json
{
  "mcpServers": {
    "rwanga": {
      "command": "python",
      "args": ["-m", "src.ai_engine.mcp.server"],
      "cwd": "/e/api/rwanga",
      "env": {
        "DJANGO_SETTINGS_MODULE": "src.settings"
      }
    }
  }
}
```

---

## 3. Authentication

### API Key Authentication

Every MCP connection must authenticate with an API key tied to a Studio + User.

```python
# src/ai_engine/mcp/auth.py
from src.accounts.models import ProjectMembership

class MCPAuth:
    """
    Authenticate MCP connections via API key.

    API keys are stored on ProjectMembership model.
    Each key inherits the user's role permissions in that project.
    """

    @staticmethod
    def authenticate(api_key: str) -> tuple:
        """
        Returns (user, project, role_type) or raises AuthError.
        """
        membership = ProjectMembership.objects.select_related('user', 'project').filter(
            mcp_api_key=api_key,
            mcp_enabled=True,
        ).first()
        if not membership:
            raise MCPAuthError("Invalid API key")
        return membership.user, membership.project, membership.role_type
```

### Required Model Addition

```python
# Add to src/accounts/models.py → ProjectMembership
class ProjectMembership(BaseModel):
    # ... existing fields ...
    mcp_api_key = models.CharField(max_length=64, blank=True, unique=True, null=True)
    mcp_enabled = models.BooleanField(default=False)
```

---

## 4. Resources (Read Data)

MCP resources expose project data as readable content. Claude can list and read these.

### Resource Definitions

```python
# src/ai_engine/mcp/resources.py

# ── PROJECT LEVEL ──

@app.list_resources()
async def list_resources():
    """List all projects the authenticated user can access."""
    projects = Project.objects.filter(
        studio__memberships__user=current_user
    )
    return [
        Resource(
            uri=f"rwanga://projects/{p.id}",
            name=p.title,
            description=f"{p.project_type} — {p.scenes.count()} scenes",
            mimeType="application/json",
        )
        for p in projects
    ]

@app.read_resource()
async def read_resource(uri: str):
    """Read a specific resource by URI."""
    # URI patterns:
    #   rwanga://projects/{id}
    #   rwanga://projects/{id}/scenes
    #   rwanga://projects/{id}/scenes/{scene_id}
    #   rwanga://projects/{id}/scenes/{scene_id}/shots
    #   rwanga://projects/{id}/scenes/{scene_id}/floorplan
    #   rwanga://projects/{id}/scenes/{scene_id}/departments
    #   rwanga://projects/{id}/schedule
    #   rwanga://projects/{id}/characters
    ...
```

### Resource URI Scheme

```
rwanga://projects/                              → list all projects
rwanga://projects/{id}                          → project detail (title, type, logline, stats)
rwanga://projects/{id}/scenes                   → all scenes (number, location, time)
rwanga://projects/{id}/scenes/{sid}             → scene detail (full data)
rwanga://projects/{id}/scenes/{sid}/shots       → all shots for scene
rwanga://projects/{id}/scenes/{sid}/floorplan   → floor plan JSON
rwanga://projects/{id}/scenes/{sid}/lighting    → lighting notes
rwanga://projects/{id}/scenes/{sid}/sound       → sound notes
rwanga://projects/{id}/scenes/{sid}/props       → props list
rwanga://projects/{id}/scenes/{sid}/wardrobe    → wardrobe items
rwanga://projects/{id}/scenes/{sid}/continuity  → continuity items
rwanga://projects/{id}/schedule                 → full shooting schedule
rwanga://projects/{id}/characters               → character list
rwanga://projects/{id}/locations                → location list
rwanga://projects/{id}/community-sessions       → community review sessions
rwanga://progress/overview                      → aggregated project state
rwanga://progress/tasks                         → all progress tasks (filterable)
rwanga://progress/tasks/{id}                    → task detail with linked items
rwanga://progress/updates                       → chronological update feed
rwanga://progress/gaps                          → open gaps and blockers
rwanga://progress/decisions                     → design decisions
rwanga://progress/diagrams                      → current system diagrams
rwanga://progress/flowchart                     → current flowchart
rwanga://progress/agent-reports                 → agent session reports
```

### Resource Response Format

All resources return JSON:

```json
{
  "project": {
    "id": "uuid",
    "title": "میوانێکی نادیار",
    "title_latin": "Mysterious Guest",
    "project_type": "short",
    "logline": "...",
    "scenes_count": 43,
    "shots_count": 340,
    "status": "development",
    "studio": {
      "name": "Sarwar Muhedin Films",
      "language": "ckb"
    }
  }
}
```

---

## 5. Tools (Write Data / Take Actions)

MCP tools let Claude create, edit, and trigger actions in the platform.

### Tool Definitions

```python
# src/ai_engine/mcp/tools.py

# ── PROJECT MANAGEMENT ──

@app.tool()
async def create_project(
    title: str,
    project_type: str = "feature",
    logline: str = "",
) -> dict:
    """
    Create a new film project.

    Args:
        title: Project title (Kurdish or English)
        project_type: One of: feature, short, tv_episode, music_video, commercial
        logline: Brief story summary

    Returns:
        Created project data with ID
    """
    from src.projects.services import ProjectService
    project = ProjectService.create(
        studio=current_studio,
        title=title,
        project_type=project_type,
        logline=logline,
    )
    return {"id": str(project.id), "title": project.title}


@app.tool()
async def create_scene(
    project_id: str,
    number: int,
    int_ext: str,
    location_name: str,
    time_of_day: str,
    description: str = "",
) -> dict:
    """
    Add a scene to a project.

    Args:
        project_id: UUID of the project
        number: Scene number (must be unique within project)
        int_ext: "INT" or "EXT"
        location_name: Location name in Kurdish
        time_of_day: Time of day in Kurdish
        description: Scene description

    Returns:
        Created scene data with ID
    """


# ── SHOT MANAGEMENT ──

@app.tool()
async def create_shot(
    scene_id: str,
    number: str,
    style: str,
    shot_type: str,
    lens: str = "",
    movement: str = "",
    duration: str = "",
    description: str = "",
    notes: str = "",
) -> dict:
    """
    Add a shot to a scene.

    Args:
        scene_id: UUID of the scene
        number: Shot number (e.g., "12.1")
        style: Shot style in Kurdish (e.g., "لێدانی ناوەندی")
        shot_type: One of: dialogue, visual, insert
        lens: Lens spec (e.g., "50mm")
        movement: Camera movement description
        duration: Estimated duration (e.g., "12s")
        description: Shot description
        notes: Production notes

    Returns:
        Created shot data with ID
    """


@app.tool()
async def update_shot(
    shot_id: str,
    **fields,
) -> dict:
    """
    Update one or more fields on an existing shot.

    Args:
        shot_id: UUID of the shot
        **fields: Any shot field to update (style, lens, notes, etc.)

    Returns:
        Updated shot data
    """


@app.tool()
async def reorder_shots(
    scene_id: str,
    shot_ids: list[str],
) -> dict:
    """
    Reorder shots within a scene.

    Args:
        scene_id: UUID of the scene
        shot_ids: Ordered list of shot UUIDs

    Returns:
        Confirmation with new order
    """


# ── FLOOR PLAN ──

@app.tool()
async def update_floorplan(
    scene_id: str,
    furniture: list[dict] | None = None,
    cameras: list[dict] | None = None,
    paths: list[dict] | None = None,
    room_width: float | None = None,
    room_height: float | None = None,
) -> dict:
    """
    Create or update a floor plan for a scene.

    Args:
        scene_id: UUID of the scene
        furniture: List of furniture items [{type, x, y, w, h, label, color}]
        cameras: List of camera positions [{letter, x, y, target_x, target_y}]
        paths: List of character paths [{character, points, color}]
        room_width: Room width in metres
        room_height: Room height in metres

    Returns:
        Updated floor plan data
    """


# ── DEPARTMENTS ──

@app.tool()
async def add_lighting_note(
    shot_id: str,
    note: str,
    color_temp: str = "",
    equipment: str = "",
) -> dict:
    """Add a lighting note to a shot."""


@app.tool()
async def add_sound_note(
    shot_id: str,
    note: str,
    sound_type: str = "ambience",
) -> dict:
    """Add a sound design note to a shot."""


@app.tool()
async def add_prop(
    project_id: str,
    name: str,
    category: str = "B",
    notes: str = "",
    scene_ids: list[str] | None = None,
) -> dict:
    """Add a prop to the project, optionally linked to scenes."""


@app.tool()
async def add_wardrobe_item(
    character_id: str,
    scene_id: str,
    outfit_name: str,
    description: str = "",
) -> dict:
    """Add a wardrobe item for a character in a scene."""


@app.tool()
async def add_continuity_item(
    scene_id: str,
    direction: str,
    description: str,
) -> dict:
    """
    Add a continuity checkpoint.

    Args:
        scene_id: UUID of the scene
        direction: "in" (entering scene) or "out" (leaving scene)
        description: What to check
    """


# ── SCHEDULING ──

@app.tool()
async def create_shoot_day(
    project_id: str,
    date: str,
    day_number: int,
    notes: str = "",
) -> dict:
    """Create a shoot day."""


@app.tool()
async def add_schedule_block(
    shoot_day_id: str,
    scene_id: str,
    title: str,
    block_type: str = "shoot",
    duration_minutes: int = 30,
    notes: str = "",
    shot_ids: list[str] | None = None,
) -> dict:
    """Add a schedule block to a shoot day."""


# ── AI JOBS ──

@app.tool()
async def run_script_breakdown(
    script_id: str,
) -> dict:
    """
    Trigger AI script breakdown.
    Queues a Celery task that parses the screenplay with Claude.

    Returns:
        Job ID for progress tracking
    """


@app.tool()
async def generate_floorplan(
    scene_id: str,
    description: str,
) -> dict:
    """
    Trigger AI floor plan generation.
    Describe the room in Kurdish/English → get floor plan JSON.

    Returns:
        Job ID for progress tracking
    """


@app.tool()
async def optimize_schedule(
    project_id: str,
) -> dict:
    """
    Trigger AI schedule optimization.
    Analyzes all scenes and suggests optimal shooting order.

    Returns:
        Job ID for progress tracking
    """


@app.tool()
async def get_job_status(
    job_id: str,
) -> dict:
    """
    Check the status of an AI job.

    Returns:
        {status, progress (0-100), step, result (if done), error (if failed)}
    """


# ── EXPORTS ──

@app.tool()
async def export_scene_viewer(
    scene_id: str,
) -> dict:
    """
    Generate a self-contained HTML scene viewer.

    Returns:
        {url: download URL, size: file size}
    """


@app.tool()
async def export_call_sheet(
    shoot_day_id: str,
    send_whatsapp: bool = False,
) -> dict:
    """
    Generate a call sheet PDF, optionally send via WhatsApp.

    Returns:
        {url: PDF download URL, whatsapp_sent: bool}
    """


# ── COMMUNITY SESSIONS ──

@app.tool()
async def create_community_session(
    project_id: str,
    title: str,
    scene_id: str | None = None,
) -> dict:
    """Start a new community review session on a project.
    Source: src.community"""


@app.tool()
async def post_session_comment(
    session_id: str,
    body: str,
) -> dict:
    """Post a comment to a community review session.
    Source: src.community"""


@app.tool()
async def lock_decision(
    session_id: str,
    post_id: str,
    decision_text: str,
) -> dict:
    """
    Lock a ReviewDecision in the reviews app (adversarial review process).
    Only directors and above can lock decisions.
    Source: src.reviews
    """
```

---

## 6. Prompts (Reusable Templates)

MCP prompts provide pre-built workflows Claude can execute:

```python
# src/ai_engine/mcp/prompts.py

@app.prompt()
async def scene_analysis(project_id: str, scene_id: str) -> list:
    """
    Analyze a scene for suspense, tension, and structural issues.
    Uses the proven bible review methodology.
    """
    scene = await get_scene_with_all_data(scene_id)
    return [
        {"role": "user", "content": f"""
Analyze Scene {scene.number} ({scene.int_ext}. {scene.location_name} — {scene.time_of_day})
of the film "{scene.project.title}".

Scene has {scene.shots.count()} shots across {scene.setups.count()} setups.

Shot breakdown:
{format_shots(scene.shots.all())}

Analyze for:
1. Tension arc — does it build, plateau, or leak?
2. Hitchcock bomb model — does the audience know more than the characters?
3. Chekhov threads — are setups paid off? Any dangling threads?
4. Dual-function test — does every beat serve both emotional AND threat escalation?

Be specific. Reference shot numbers. This is for a Kurdish director — be direct.
"""}
    ]


@app.prompt()
async def bible_review(project_id: str) -> list:
    """
    Full screenplay bible review — the core consultation product.
    Multi-scene analysis with locked decision methodology.
    """


@app.prompt()
async def production_prep(project_id: str, scene_id: str) -> list:
    """
    Production preparation checklist for a specific scene.
    Covers: shots, floor plan, lighting, sound, props, wardrobe, continuity.
    """


@app.prompt()
async def progress_report(scope: str = "full", phase: str | None = None) -> list:
    """
    Generate a comprehensive project status report from live Progress data.

    Args:
        scope: "full" | "phase" | "blockers_only"
        phase: Required if scope="phase" (e.g., "P1")

    Data sources (read automatically):
        - rwanga://progress/overview
        - rwanga://progress/tasks (filtered by scope)
        - rwanga://progress/gaps (open)
        - rwanga://progress/decisions (recent)
        - rwanga://progress/agent-reports (latest)

    Output sections:
        1. Current Phase & Completion (% tasks done)
        2. Completed Work (since last report)
        3. In Progress (active tasks, assigned agents)
        4. Blockers & Gaps (sorted by severity)
        5. Risks (critical gaps, stale blocked tasks)
        6. Decisions Made (approved this phase)
        7. Recommended Next Steps (highest priority unblocked tasks)
    """
```

---

## 7. Tool Summary Table

| Tool | Category | Permissions | Phase |
|------|----------|------------|-------|
| create_project | Projects | director+ | P1 |
| create_scene | Projects | director+ | P1 |
| create_shot | Shots | dp+ | P2 |
| update_shot | Shots | dp+ | P2 |
| reorder_shots | Shots | dp+ | P2 |
| update_floorplan | Floor Plans | dp+ | P2 |
| export_scene_viewer | Exports | viewer+ | P2 |
| add_lighting_note | Departments | dp+ | P3 |
| add_sound_note | Departments | sound+ | P3 |
| add_prop | Departments | art+ | P3 |
| add_wardrobe_item | Departments | art+ | P3 |
| add_continuity_item | Departments | ad+ | P3 |
| create_shoot_day | Scheduling | ad+ | P4 |
| add_schedule_block | Scheduling | ad+ | P4 |
| export_call_sheet | Exports | ad+ | P4 |
| run_script_breakdown | AI | director+ | P5 |
| generate_floorplan | AI | director+ | P5 |
| optimize_schedule | AI | director+ | P5 |
| get_job_status | AI | viewer+ | P5 |
| create_community_session | Community | director+ | P6 |
| post_session_comment | Community | viewer+ | P6 |
| lock_decision | Reviews | director+ | P6 |
| report_progress_update | Progress | agent | P0 |
| create_task | Progress | agent | P0 |
| update_task_status | Progress | agent | P0 |
| report_gap | Progress | agent | P0 |
| submit_agent_report | Progress | agent | P0 |
| record_change | Progress | agent | P0 |
| record_decision | Progress | agent | P0 |
| update_diagram | Progress | agent | P0 |

---

## 8. Implementation Notes

### Package Dependencies
```
mcp>=1.0.0           # MCP Python SDK
```

### App Structure
```
src/ai_engine/mcp/
├── __init__.py
├── server.py         ← entry point, Server() init
├── tools.py          ← all @app.tool() definitions
├── resources.py      ← all @app.resource() definitions
├── prompts.py        ← all @app.prompt() definitions
├── auth.py           ← API key authentication
└── tests/
    ├── test_tools.py
    ├── test_resources.py
    └── test_auth.py
```

### Testing
Every tool and resource must have tests:
```python
# tests/test_tools.py
class TestCreateShot:
    def test_creates_shot_with_valid_data(self):
        """Tool creates a shot and returns its ID."""

    def test_rejects_invalid_scene_id(self):
        """Tool returns error for non-existent scene."""

    def test_requires_dp_permission(self):
        """Tool rejects users without dp+ role."""
```

### Future: MCP as Plugin

Once stable, the MCP server can be packaged as a Claude Code plugin:

```json
{
  "name": "rwanga",
  "description": "Kurdish cinema preproduction platform",
  "mcpServers": {
    "rwanga": {
      "command": "python",
      "args": ["-m", "src.ai_engine.mcp.server"]
    }
  }
}
```

This would let any Claude Code user install the Rwanga connector and work with their projects.

---

## 9. Progress System Integration (Non-Negotiable)

The Progress app exposes its full state via MCP. This is how AI agents observe and report on the development process.

### 9.1 Progress Resources (READ)

```python
# src/ai_engine/mcp/resources.py — Progress section

# rwanga://progress/overview
#   Source: aggregation across all progress models
#   Returns: {current_phase, tasks: {total, pending, in_progress, completed, blocked},
#             gaps: {open, critical}, recent_updates: last 5, phase_completion_pct}

# rwanga://progress/tasks
#   Source: ProgressTask
#   Filters: ?phase=P1&status=blocked&app=shots
#   Returns: list of {id, title, task_type, phase, app_name, status, priority, assigned_to}

# rwanga://progress/tasks/{id}
#   Source: ProgressTask + related ProgressUpdate, ChangeRecord, GapBlocker
#   Returns: full task record + chronological linked items

# rwanga://progress/updates
#   Source: ProgressUpdate
#   Filters: ?author=agent-name&update_type=implementation&since=2026-04-28

# rwanga://progress/gaps
#   Source: GapBlocker
#   Filters: ?status=open&severity=critical

# rwanga://progress/decisions
#   Source: DesignDecision
#   Filters: ?status=approved&phase=P1

# rwanga://progress/diagrams
#   Source: SystemDiagram (where is_current=True)

# rwanga://progress/flowchart
#   Source: SystemDiagram (where is_current=True, diagram_type="flow")

# rwanga://progress/agent-reports
#   Source: AgentReport
#   Filters: ?agent=agent-name&report_type=phase_completion
```

### 9.2 Progress Tools (WRITE / REPORT)

```python
# src/ai_engine/mcp/tools.py — Progress section

@app.tool()
async def report_progress_update(
    task_id: str | None = None,
    update_type: str = "implementation",
    body: str = "",
    files_affected: list[str] | None = None,
    tests_run: dict | None = None,
) -> dict:
    """Record a progress update. All writes go through ProgressService."""

@app.tool()
async def create_task(
    title: str,
    description: str,
    task_type: str,
    phase: str,
    app_name: str | None = None,
    priority: str = "normal",
    assigned_to: str | None = None,
    blocked_by: list[str] | None = None,
) -> dict:
    """Create a new progress task."""

@app.tool()
async def update_task_status(
    task_id: str,
    status: str,
    note: str | None = None,
) -> dict:
    """Update task status. Auto-creates ProgressUpdate with update_type='status_change'."""

@app.tool()
async def report_gap(
    title: str,
    description: str,
    gap_type: str,
    severity: str,
    related_task_id: str | None = None,
    related_app: str | None = None,
    phase: str = "",
) -> dict:
    """Report a gap or blocker."""

@app.tool()
async def submit_agent_report(
    agent_name: str,
    session_id: str,
    report_type: str,
    phase: str,
    summary: str,
    tasks_completed: list[str] | None = None,
    tasks_blocked: list[str] | None = None,
    gaps_found: list[str] | None = None,
) -> dict:
    """Submit an agent session report."""

@app.tool()
async def record_change(
    task_id: str | None = None,
    change_type: str = "model_added",
    app_name: str = "",
    description: str = "",
    files_changed: list[str] | None = None,
    diff_summary: str | None = None,
    commit_hash: str | None = None,
) -> dict:
    """Record a code change."""

@app.tool()
async def record_decision(
    title: str,
    context: str,
    decision: str,
    alternatives_considered: str | None = None,
    decided_by: str = "",
    phase: str = "",
    app_name: str | None = None,
) -> dict:
    """Record a design decision."""

@app.tool()
async def update_diagram(
    title: str,
    diagram_type: str,
    phase: str,
    content: str,
    render_format: str = "mermaid",
    notes: str | None = None,
) -> dict:
    """Update a system diagram. Sets new as is_current=True, previous as False."""
```

**Critical rule:** All MCP tools route through `ProgressService` — the same service called by web views and DRF endpoints. No direct ORM writes. Same validation everywhere.

### 9.3 Progress Report Prompt

```python
@app.prompt()
async def progress_report(scope: str = "full", phase: str | None = None) -> list:
    """
    Generate a comprehensive project status report from live Progress data.

    Args:
        scope: "full" | "phase" | "blockers_only"
        phase: Required if scope="phase" (e.g., "P1")

    Data sources (read automatically):
        - rwanga://progress/overview
        - rwanga://progress/tasks (filtered by scope)
        - rwanga://progress/gaps (open)
        - rwanga://progress/decisions (recent)
        - rwanga://progress/agent-reports (latest)

    Output sections:
        1. Current Phase & Completion (% tasks done)
        2. Completed Work (since last report)
        3. In Progress (active tasks, assigned agents)
        4. Blockers & Gaps (sorted by severity)
        5. Risks (critical gaps, stale blocked tasks)
        6. Decisions Made (approved this phase)
        7. Recommended Next Steps (highest priority unblocked tasks)
    """
```

---

*The MCP server is built in Phase 5 but its interface is designed now so all prior phases build services that the MCP server will consume. Every service method a tool calls must already exist.*
