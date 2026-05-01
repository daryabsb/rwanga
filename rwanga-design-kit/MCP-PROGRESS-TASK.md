# Progress MCP Server — Coding Agent Instructions

**Priority:** HIGH — implement this before any P1+ feature work
**Date:** 2026-04-30
**Prerequisite:** Progress app models, views, URLs already working at /progress/

---

## What This Is

Build a minimal MCP (Model Context Protocol) server that exposes the existing Progress app data to AI agents. This is Section 9 of `MCP-SERVER-SPEC.md` — the progress-specific subset only.

The server lets Claude (via Claude Code or Cowork) read project tasks, gaps, decisions, and updates — and write new entries — without copy-pasting reports. It runs as a separate process sharing the Django ORM.

**Scope:** Progress app resources + tools ONLY. Do NOT implement project/shots/floorplan/AI tools — those are Phase 5.

---

## GOLDEN RULE: Progress App Is Already Built — Don't Touch It

The Progress app (`src/progress/`) is already implemented with models, views, URLs, and templates. The DB has 83+ tasks, 54+ updates, and 4+ gaps from the forensic pass.

**DO NOT:**
- Modify any existing model in `src/progress/models.py`
- Change any existing view in `src/progress/views.py`
- Alter any existing URL in `src/progress/urls.py`
- Touch any existing template
- Modify settings, migrations, or admin registrations
- Add fields to existing models (if auth fields are needed, flag as GapBlocker)

**DO:**
- Create new files under `src/ai_engine/mcp/`
- Import and use existing Progress models read-only (for resources) or through a new ProgressService (for tools)
- Add `mcp` to requirements

---

## Step 0: Audit Current State (MANDATORY)

Before writing any code:

1. Verify the Progress app is working:
   ```bash
   python manage.py runserver
   # Visit /progress/ — should render dashboard
   ```

2. Check what models exist and their field names:
   ```bash
   python manage.py shell -c "from src.progress.models import *; print([f.name for f in ProgressTask._meta.get_fields()])"
   ```

3. Check if `src/progress/services.py` exists. If it does, your MCP tools MUST call it. If it doesn't, create it as part of this task.

4. Check if `src/ai_engine/` app directory exists and what's in it.

5. Present your findings and execution plan. **WAIT for approval.**

---

## Step 1: Install MCP SDK

```bash
pip install "mcp[cli]>=1.0.0"
```

Add to `requirements.txt`:
```
mcp[cli]>=1.0.0
```

---

## Step 2: Create ProgressService (if missing)

If `src/progress/services.py` doesn't already exist, create it. If it exists, skip this step.

The service layer is the single write path — views, API, and MCP all call the same service.

```python
"""
src.progress.services
~~~~~~~~~~~~~~~~~~~~~

Business logic for Progress app. Single write path for all interfaces
(web views, DRF API, MCP tools).

Dependencies:
    - src.progress.models (all 8 models)
"""

from src.progress.models import (
    ProgressTask, ProgressUpdate, DesignDecision,
    AgentReport, GapBlocker, ChangeRecord,
    SystemDiagram, DocumentVersion,
)


class ProgressService:
    """
    Service layer for Progress operations.

    All writes go through this class. Views, API, and MCP tools
    all call these methods. Never write directly to models.

    Usage:
        service = ProgressService()
        task = service.create_task(title="...", phase="P1", ...)
    """

    def get_overview(self) -> dict:
        """
        Aggregate dashboard data.

        Returns:
            dict with keys: current_phase, tasks (counts by status),
            gaps (open/critical counts), recent_updates, phase_completion_pct
        """
        tasks = ProgressTask.objects.all()
        total = tasks.count()
        completed = tasks.filter(status='completed').count()

        return {
            'current_phase': self._detect_current_phase(),
            'tasks': {
                'total': total,
                'pending': tasks.filter(status='pending').count(),
                'in_progress': tasks.filter(status='in_progress').count(),
                'completed': completed,
                'blocked': tasks.filter(status='blocked').count(),
            },
            'gaps': {
                'open': GapBlocker.objects.filter(status='open').count(),
                'critical': GapBlocker.objects.filter(status='open', severity='critical').count(),
            },
            'recent_updates': list(
                ProgressUpdate.objects.order_by('-created_at')[:5].values(
                    'id', 'update_type', 'body', 'created_at', 'task_id'
                )
            ),
            'phase_completion_pct': round((completed / total * 100) if total else 0, 1),
        }

    def create_task(self, *, title, description='', task_type='implementation',
                    phase='', app_name=None, priority='normal',
                    assigned_to=None, blocked_by=None) -> ProgressTask:
        """Create a new progress task."""
        task = ProgressTask.objects.create(
            title=title,
            description=description,
            task_type=task_type,
            phase=phase,
            app_name=app_name or '',
            status='pending',
            priority=priority,
            assigned_to=assigned_to or '',
        )
        if blocked_by:
            blockers = ProgressTask.objects.filter(pk__in=blocked_by)
            task.blocked_by.set(blockers)
        return task

    def update_task_status(self, *, task_id, status, note=None) -> ProgressTask:
        """
        Update task status. Auto-creates a ProgressUpdate.

        Args:
            task_id: UUID of the task
            status: New status string
            note: Optional note for the status change update
        """
        task = ProgressTask.objects.get(pk=task_id)
        old_status = task.status
        task.status = status
        task.save(update_fields=['status', 'updated_at'])

        ProgressUpdate.objects.create(
            task=task,
            author='mcp-agent',
            update_type='status_change',
            body=note or f'Status changed: {old_status} → {status}',
        )
        return task

    def record_update(self, *, task_id=None, update_type='implementation',
                      body='', files_affected=None, tests_run=None,
                      author='mcp-agent') -> ProgressUpdate:
        """Record a progress update."""
        task = ProgressTask.objects.get(pk=task_id) if task_id else None
        return ProgressUpdate.objects.create(
            task=task,
            author=author,
            update_type=update_type,
            body=body,
            files_affected=files_affected or [],
            tests_run=tests_run or {},
        )

    def report_gap(self, *, title, description, gap_type, severity,
                   related_task_id=None, related_app=None, phase='') -> GapBlocker:
        """Report a gap or blocker."""
        task = ProgressTask.objects.get(pk=related_task_id) if related_task_id else None
        return GapBlocker.objects.create(
            title=title,
            description=description,
            gap_type=gap_type,
            severity=severity,
            related_task=task,
            related_app=related_app or '',
            phase=phase,
            status='open',
        )

    def submit_agent_report(self, *, agent_name, session_id, report_type,
                            phase, summary, tasks_completed=None,
                            tasks_blocked=None, gaps_found=None) -> AgentReport:
        """Submit an agent session report."""
        report = AgentReport.objects.create(
            agent_name=agent_name,
            session_id=session_id,
            report_type=report_type,
            phase=phase,
            summary=summary,
        )
        if tasks_completed:
            report.tasks_completed.set(
                ProgressTask.objects.filter(pk__in=tasks_completed)
            )
        if tasks_blocked:
            report.tasks_blocked.set(
                ProgressTask.objects.filter(pk__in=tasks_blocked)
            )
        if gaps_found:
            report.gaps_found.set(
                GapBlocker.objects.filter(pk__in=gaps_found)
            )
        return report

    def record_change(self, *, task_id=None, change_type='model_added',
                      app_name='', description='', files_changed=None,
                      diff_summary=None, commit_hash=None) -> ChangeRecord:
        """Record a code change."""
        task = ProgressTask.objects.get(pk=task_id) if task_id else None
        return ChangeRecord.objects.create(
            task=task,
            change_type=change_type,
            app_name=app_name,
            description=description,
            files_changed=files_changed or [],
            diff_summary=diff_summary or '',
            commit_hash=commit_hash or '',
        )

    def record_decision(self, *, title, context, decision,
                        alternatives_considered=None, decided_by='',
                        phase='', app_name=None) -> DesignDecision:
        """Record a design decision."""
        return DesignDecision.objects.create(
            title=title,
            context=context,
            decision=decision,
            alternatives_considered=alternatives_considered or '',
            decided_by=decided_by,
            phase=phase,
            app_name=app_name or '',
            status='proposed',
        )

    def update_diagram(self, *, title, diagram_type, phase, content,
                       render_format='mermaid', notes=None) -> SystemDiagram:
        """Update a system diagram. Sets new as is_current, previous as not."""
        # Deactivate previous current diagram of same type
        SystemDiagram.objects.filter(
            diagram_type=diagram_type, is_current=True
        ).update(is_current=False)

        return SystemDiagram.objects.create(
            title=title,
            diagram_type=diagram_type,
            phase=phase,
            content=content,
            render_format=render_format,
            is_current=True,
            notes=notes or '',
        )

    def _detect_current_phase(self) -> str:
        """Detect current phase from task statuses."""
        for phase in ['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7']:
            tasks = ProgressTask.objects.filter(phase=phase)
            if tasks.exists():
                incomplete = tasks.exclude(status='completed').exists()
                if incomplete:
                    return phase
        return 'P7'
```

**IMPORTANT:** If `services.py` already exists with different method signatures, adapt the MCP tools to call the existing methods. Do NOT rewrite the service.

---

## Step 3: Create MCP Server Files

Create the directory structure:
```
src/ai_engine/mcp/
├── __init__.py
├── server.py
├── resources.py
├── tools.py
└── prompts.py
```

### `src/ai_engine/mcp/__init__.py`
```python
"""
src.ai_engine.mcp
~~~~~~~~~~~~~~~~~

MCP server for Rwanga Progress system.
Exposes Progress app data to AI agents via Model Context Protocol.
"""
```

### `src/ai_engine/mcp/server.py`
```python
"""
src.ai_engine.mcp.server
~~~~~~~~~~~~~~~~~~~~~~~~~

MCP server entry point. Runs as a separate process sharing Django ORM.

Usage:
    # stdio transport (for Claude Code local connection)
    python -m src.ai_engine.mcp.server

    # SSE transport (for remote agents / Cowork)
    python -m src.ai_engine.mcp.server --transport sse --port 8002
"""
import os
import sys
import asyncio
import argparse

# Django setup MUST happen before any model imports
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'src.settings')

import django
django.setup()

from mcp.server import Server
from mcp.server.stdio import stdio_server

from src.ai_engine.mcp.resources import register_resources
from src.ai_engine.mcp.tools import register_tools
from src.ai_engine.mcp.prompts import register_prompts

app = Server("rwanga-progress")

# Register all handlers
register_resources(app)
register_tools(app)
register_prompts(app)


async def run_stdio():
    """Run server with stdio transport (local Claude Code)."""
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())


async def run_sse(port: int):
    """Run server with SSE transport (remote agents)."""
    from mcp.server.sse import SseServerTransport
    from starlette.applications import Starlette
    from starlette.routing import Route
    import uvicorn

    sse = SseServerTransport("/messages/")

    async def handle_sse(request):
        async with sse.connect_sse(
            request.scope, request.receive, request._send
        ) as streams:
            await app.run(streams[0], streams[1], app.create_initialization_options())

    starlette_app = Starlette(routes=[
        Route("/sse", endpoint=handle_sse),
        Route("/messages/", endpoint=sse.handle_post_message, methods=["POST"]),
    ])
    config = uvicorn.Config(starlette_app, host="0.0.0.0", port=port)
    server = uvicorn.Server(config)
    await server.serve()


def main():
    parser = argparse.ArgumentParser(description="Rwanga Progress MCP Server")
    parser.add_argument("--transport", choices=["stdio", "sse"], default="stdio")
    parser.add_argument("--port", type=int, default=8002)
    args = parser.parse_args()

    if args.transport == "sse":
        asyncio.run(run_sse(args.port))
    else:
        asyncio.run(run_stdio())


if __name__ == "__main__":
    main()
```

### `src/ai_engine/mcp/resources.py`
```python
"""
src.ai_engine.mcp.resources
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

MCP resources — read-only access to Progress app data.

Resources:
    rwanga://progress/overview      → aggregate dashboard data
    rwanga://progress/tasks         → task list (filterable)
    rwanga://progress/tasks/{id}    → single task + linked records
    rwanga://progress/updates       → update feed
    rwanga://progress/gaps          → gaps and blockers
    rwanga://progress/decisions     → design decisions
    rwanga://progress/diagrams      → current system diagrams
    rwanga://progress/agent-reports → agent session reports
"""
import json
from mcp.types import Resource, TextContent

from src.progress.models import (
    ProgressTask, ProgressUpdate, DesignDecision,
    AgentReport, GapBlocker, ChangeRecord,
    SystemDiagram, DocumentVersion,
)
from src.progress.services import ProgressService

service = ProgressService()


def _serialize(obj):
    """JSON-safe serializer for Django objects."""
    from django.core.serializers.json import DjangoJSONEncoder
    return json.loads(json.dumps(obj, cls=DjangoJSONEncoder))


def register_resources(app):

    @app.list_resources()
    async def list_resources():
        return [
            Resource(uri="rwanga://progress/overview", name="Progress Overview",
                     description="Dashboard summary: phases, task counts, gaps, completion %",
                     mimeType="application/json"),
            Resource(uri="rwanga://progress/tasks", name="All Tasks",
                     description="Full task list with status, phase, priority",
                     mimeType="application/json"),
            Resource(uri="rwanga://progress/gaps", name="Gaps & Blockers",
                     description="Open gaps and blockers sorted by severity",
                     mimeType="application/json"),
            Resource(uri="rwanga://progress/updates", name="Recent Updates",
                     description="Chronological progress update feed",
                     mimeType="application/json"),
            Resource(uri="rwanga://progress/decisions", name="Design Decisions",
                     description="Design decisions with approval status",
                     mimeType="application/json"),
            Resource(uri="rwanga://progress/diagrams", name="System Diagrams",
                     description="Current system architecture diagrams",
                     mimeType="application/json"),
            Resource(uri="rwanga://progress/agent-reports", name="Agent Reports",
                     description="Agent session reports",
                     mimeType="application/json"),
        ]

    @app.read_resource()
    async def read_resource(uri: str):
        uri_str = str(uri)

        if uri_str == "rwanga://progress/overview":
            data = service.get_overview()
            return [TextContent(type="text", text=json.dumps(_serialize(data), indent=2))]

        elif uri_str == "rwanga://progress/tasks":
            tasks = ProgressTask.objects.all().order_by('phase', '-priority', 'status')
            data = list(tasks.values(
                'id', 'title', 'task_type', 'phase', 'app_name',
                'status', 'priority', 'assigned_to', 'created_at', 'updated_at',
            ))
            return [TextContent(type="text", text=json.dumps(_serialize(data), indent=2))]

        elif uri_str.startswith("rwanga://progress/tasks/"):
            task_id = uri_str.split("/")[-1]
            task = ProgressTask.objects.get(pk=task_id)
            updates = list(task.updates.order_by('-created_at').values(
                'id', 'update_type', 'body', 'author', 'created_at',
            ))
            changes = list(task.changes.order_by('-created_at').values(
                'id', 'change_type', 'app_name', 'description', 'commit_hash', 'created_at',
            ))
            gaps = list(GapBlocker.objects.filter(related_task=task).values(
                'id', 'title', 'severity', 'status',
            ))
            data = {
                'task': {
                    'id': str(task.pk), 'title': task.title,
                    'description': task.description, 'task_type': task.task_type,
                    'phase': task.phase, 'app_name': task.app_name,
                    'status': task.status, 'priority': task.priority,
                    'assigned_to': task.assigned_to,
                },
                'updates': updates,
                'changes': changes,
                'gaps': gaps,
            }
            return [TextContent(type="text", text=json.dumps(_serialize(data), indent=2))]

        elif uri_str == "rwanga://progress/gaps":
            gaps = GapBlocker.objects.order_by('-severity', '-created_at')
            data = list(gaps.values(
                'id', 'title', 'description', 'gap_type', 'severity',
                'status', 'phase', 'related_app', 'created_at',
            ))
            return [TextContent(type="text", text=json.dumps(_serialize(data), indent=2))]

        elif uri_str == "rwanga://progress/updates":
            updates = ProgressUpdate.objects.order_by('-created_at')[:50]
            data = list(updates.values(
                'id', 'task_id', 'author', 'update_type', 'body', 'created_at',
            ))
            return [TextContent(type="text", text=json.dumps(_serialize(data), indent=2))]

        elif uri_str == "rwanga://progress/decisions":
            decisions = DesignDecision.objects.order_by('-created_at')
            data = list(decisions.values(
                'id', 'title', 'context', 'decision', 'status',
                'phase', 'decided_by', 'created_at',
            ))
            return [TextContent(type="text", text=json.dumps(_serialize(data), indent=2))]

        elif uri_str == "rwanga://progress/diagrams":
            diagrams = SystemDiagram.objects.filter(is_current=True)
            data = list(diagrams.values(
                'id', 'title', 'diagram_type', 'phase',
                'content', 'render_format', 'created_at',
            ))
            return [TextContent(type="text", text=json.dumps(_serialize(data), indent=2))]

        elif uri_str == "rwanga://progress/agent-reports":
            reports = AgentReport.objects.order_by('-created_at')[:20]
            data = list(reports.values(
                'id', 'agent_name', 'session_id', 'report_type',
                'phase', 'summary', 'created_at',
            ))
            return [TextContent(type="text", text=json.dumps(_serialize(data), indent=2))]

        raise ValueError(f"Unknown resource: {uri_str}")
```

### `src/ai_engine/mcp/tools.py`
```python
"""
src.ai_engine.mcp.tools
~~~~~~~~~~~~~~~~~~~~~~~~

MCP tools — write operations for Progress app.
All writes go through ProgressService.

Tools (8):
    report_progress_update  — log implementation work
    create_task             — create a new task
    update_task_status      — change task status
    report_gap              — report a gap or blocker
    submit_agent_report     — submit session report
    record_change           — log a code change
    record_decision         — log a design decision
    update_diagram          — update system diagram
"""
from src.progress.services import ProgressService

service = ProgressService()


def register_tools(app):

    @app.tool()
    async def report_progress_update(
        task_id: str | None = None,
        update_type: str = "implementation",
        body: str = "",
        files_affected: list[str] | None = None,
        tests_run: dict | None = None,
    ) -> dict:
        """Record a progress update for a task or general project."""
        update = service.record_update(
            task_id=task_id, update_type=update_type,
            body=body, files_affected=files_affected,
            tests_run=tests_run,
        )
        return {"id": str(update.pk), "status": "created"}

    @app.tool()
    async def create_task(
        title: str,
        description: str = "",
        task_type: str = "implementation",
        phase: str = "",
        app_name: str | None = None,
        priority: str = "normal",
        assigned_to: str | None = None,
        blocked_by: list[str] | None = None,
    ) -> dict:
        """Create a new progress task."""
        task = service.create_task(
            title=title, description=description,
            task_type=task_type, phase=phase,
            app_name=app_name, priority=priority,
            assigned_to=assigned_to, blocked_by=blocked_by,
        )
        return {"id": str(task.pk), "status": task.status}

    @app.tool()
    async def update_task_status(
        task_id: str,
        status: str,
        note: str | None = None,
    ) -> dict:
        """Update task status. Auto-creates a ProgressUpdate."""
        task = service.update_task_status(
            task_id=task_id, status=status, note=note,
        )
        return {"id": str(task.pk), "status": task.status}

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
        gap = service.report_gap(
            title=title, description=description,
            gap_type=gap_type, severity=severity,
            related_task_id=related_task_id,
            related_app=related_app, phase=phase,
        )
        return {"id": str(gap.pk), "status": "open"}

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
        report = service.submit_agent_report(
            agent_name=agent_name, session_id=session_id,
            report_type=report_type, phase=phase,
            summary=summary, tasks_completed=tasks_completed,
            tasks_blocked=tasks_blocked, gaps_found=gaps_found,
        )
        return {"id": str(report.pk), "status": "submitted"}

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
        change = service.record_change(
            task_id=task_id, change_type=change_type,
            app_name=app_name, description=description,
            files_changed=files_changed, diff_summary=diff_summary,
            commit_hash=commit_hash,
        )
        return {"id": str(change.pk), "status": "recorded"}

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
        dec = service.record_decision(
            title=title, context=context, decision=decision,
            alternatives_considered=alternatives_considered,
            decided_by=decided_by, phase=phase, app_name=app_name,
        )
        return {"id": str(dec.pk), "status": dec.status}

    @app.tool()
    async def update_diagram(
        title: str,
        diagram_type: str,
        phase: str,
        content: str,
        render_format: str = "mermaid",
        notes: str | None = None,
    ) -> dict:
        """Update a system diagram. Previous current diagram is deactivated."""
        diagram = service.update_diagram(
            title=title, diagram_type=diagram_type,
            phase=phase, content=content,
            render_format=render_format, notes=notes,
        )
        return {"id": str(diagram.pk), "status": "current"}
```

### `src/ai_engine/mcp/prompts.py`
```python
"""
src.ai_engine.mcp.prompts
~~~~~~~~~~~~~~~~~~~~~~~~~~

MCP prompts — pre-built analysis workflows.
Only the progress_report prompt for now.
"""
import json
from src.progress.services import ProgressService
from src.progress.models import (
    ProgressTask, GapBlocker, DesignDecision, AgentReport,
)

service = ProgressService()


def register_prompts(app):

    @app.prompt()
    async def progress_report(scope: str = "full", phase: str | None = None) -> list:
        """
        Generate a comprehensive project status report.

        Args:
            scope: "full" | "phase" | "blockers_only"
            phase: Required if scope="phase" (e.g. "P1")
        """
        overview = service.get_overview()

        # Build task data based on scope
        if scope == "phase" and phase:
            tasks = ProgressTask.objects.filter(phase=phase)
            scope_desc = f"Phase {phase}"
        elif scope == "blockers_only":
            tasks = ProgressTask.objects.filter(status='blocked')
            scope_desc = "Blockers Only"
        else:
            tasks = ProgressTask.objects.all()
            scope_desc = "Full Project"

        completed = list(tasks.filter(status='completed').values_list('title', flat=True))
        in_progress = list(tasks.filter(status='in_progress').values_list('title', flat=True))
        blocked = list(tasks.filter(status='blocked').values_list('title', flat=True))
        pending = list(tasks.filter(status='pending').values_list('title', flat=True))

        gaps = list(GapBlocker.objects.filter(status='open').values(
            'title', 'severity', 'gap_type', 'phase'
        ))
        decisions = list(DesignDecision.objects.filter(status='approved').order_by('-created_at')[:10].values(
            'title', 'decision', 'phase'
        ))
        latest_report = AgentReport.objects.order_by('-created_at').first()

        prompt_text = f"""Generate a Rwanga project status report.

Scope: {scope_desc}
Current Phase: {overview['current_phase']}
Completion: {overview['phase_completion_pct']}%

Task Summary:
- Total: {overview['tasks']['total']}
- Completed ({len(completed)}): {', '.join(completed[:15])}{'...' if len(completed) > 15 else ''}
- In Progress ({len(in_progress)}): {', '.join(in_progress)}
- Blocked ({len(blocked)}): {', '.join(blocked)}
- Pending ({len(pending)}): {', '.join(pending[:15])}{'...' if len(pending) > 15 else ''}

Open Gaps/Blockers ({len(gaps)}):
{json.dumps(gaps, indent=2, default=str)}

Recent Approved Decisions:
{json.dumps(list(decisions), indent=2, default=str)}

Latest Agent Report: {latest_report.summary[:200] if latest_report else 'None'}

Produce a report with these sections:
1. Current Phase & Completion
2. Completed Work (highlight key achievements)
3. In Progress (what's actively being worked on)
4. Blockers & Gaps (sorted by severity, with recommended actions)
5. Risks (critical gaps, stale tasks)
6. Decisions Made (this phase)
7. Recommended Next Steps (highest priority unblocked tasks)

Be specific. Use task titles. This report is for Darya who manages the project through AI agents.
"""
        return [{"role": "user", "content": prompt_text}]
```

---

## Step 4: Make It Runnable as a Module

Ensure `src/ai_engine/mcp/` can be run with `python -m src.ai_engine.mcp.server`.

Add `__main__.py`:
```python
# src/ai_engine/mcp/__main__.py
from src.ai_engine.mcp.server import main
main()
```

---

## Step 5: Validate

Run these checks in order:

```bash
# 1. MCP SDK installed
python -c "import mcp; print(mcp.__version__)"

# 2. Server module imports cleanly
python -c "
import os; os.environ['DJANGO_SETTINGS_MODULE'] = 'src.settings'
import django; django.setup()
from src.ai_engine.mcp.server import app
print('Server initialized:', app.name)
"

# 3. Resources work
python -c "
import os, asyncio, json; os.environ['DJANGO_SETTINGS_MODULE'] = 'src.settings'
import django; django.setup()
from src.progress.services import ProgressService
s = ProgressService()
overview = s.get_overview()
print(json.dumps(overview, indent=2, default=str))
"

# 4. Test stdio transport starts (Ctrl+C to exit)
python -m src.ai_engine.mcp.server
```

If any step fails, fix it before proceeding.

---

## Step 6: Update Progress App

Record this work in the Progress app:

```python
# Via Django shell or management command
from src.progress.services import ProgressService
s = ProgressService()

task = s.create_task(
    title="Implement Progress MCP Server",
    description="MCP server exposing Progress app data (Section 9 of MCP-SERVER-SPEC.md)",
    task_type="implementation",
    phase="P0",
    app_name="ai_engine",
    priority="high",
)

s.update_task_status(task_id=str(task.pk), status="completed", note="MCP server implemented with 7 resources, 8 tools, 1 prompt")

s.record_change(
    task_id=str(task.pk),
    change_type="model_added",
    app_name="ai_engine",
    description="Created MCP server with Progress resources/tools/prompts",
    files_changed=[
        "src/ai_engine/mcp/__init__.py",
        "src/ai_engine/mcp/server.py",
        "src/ai_engine/mcp/resources.py",
        "src/ai_engine/mcp/tools.py",
        "src/ai_engine/mcp/prompts.py",
        "src/ai_engine/mcp/__main__.py",
        "src/progress/services.py",
    ],
)
```

---

## Step 7: Commit

```
feat(mcp): implement Progress MCP server with resources, tools, and prompts

- Create src/ai_engine/mcp/ with server entry point (stdio + SSE transport)
- Add 7 MCP resources for reading Progress data (overview, tasks, gaps, updates, decisions, diagrams, agent-reports)
- Add 8 MCP tools for writing Progress data (create_task, update_status, report_gap, etc.)
- Add progress_report prompt for generating status reports
- Create ProgressService as single write path (if not already present)
- Add mcp[cli]>=1.0.0 to requirements
```

---

## What NOT To Do

1. **DO NOT** implement project/shots/floorplan/scheduling MCP tools — those are Phase 5
2. **DO NOT** modify existing Progress models, views, or URLs
3. **DO NOT** add authentication (MCP auth needs ProjectMembership model changes — defer to Phase 5)
4. **DO NOT** rewrite any existing service methods — adapt your tools to call them
5. **DO NOT** create tests yet — get the server running first, tests come next
6. **DO NOT** add the MCP server to Django's URL routing — it runs as a separate process

---

## Reference Files

| File | Purpose |
|------|---------|
| `MCP-SERVER-SPEC.md` (Section 9) | Full spec for Progress MCP resources/tools/prompts |
| `MASTER-DESIGN.md` (Part 4, progress section) | Model schemas and API endpoints |
| `CLAUDE.md` (Rules 3, 16, 17) | Progress is source of truth, update before moving on, MCP integration |
| `src/progress/models.py` | Existing models — DO NOT MODIFY |
| `src/progress/views.py` | Existing views — DO NOT MODIFY |
