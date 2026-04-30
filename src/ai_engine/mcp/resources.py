"""
src.ai_engine.mcp.resources
~~~~~~~~~~~~~~~~~~~~~~~~~~~

MCP resources for read-only access to Progress data.
"""
import json

from mcp.types import Resource, TextResourceContents

from src.progress.models import AgentReport, DesignDecision, GapBlocker, ProgressTask, ProgressUpdate, SystemDiagram
from src.progress.services import ProgressService

service = ProgressService()


def _serialize(obj):
    from django.core.serializers.json import DjangoJSONEncoder

    return json.loads(json.dumps(obj, cls=DjangoJSONEncoder))


def register_resources(app):
    @app.list_resources()
    async def list_resources():
        return [
            Resource(
                uri="rwanga://progress/overview",
                name="Progress Overview",
                description="Dashboard summary",
                mimeType="application/json",
            ),
            Resource(
                uri="rwanga://progress/tasks",
                name="All Tasks",
                description="Task list",
                mimeType="application/json",
            ),
            Resource(
                uri="rwanga://progress/gaps",
                name="Gaps & Blockers",
                description="Open gaps",
                mimeType="application/json",
            ),
            Resource(
                uri="rwanga://progress/updates",
                name="Recent Updates",
                description="Chronological feed",
                mimeType="application/json",
            ),
            Resource(
                uri="rwanga://progress/decisions",
                name="Design Decisions",
                description="Design decisions",
                mimeType="application/json",
            ),
            Resource(
                uri="rwanga://progress/diagrams",
                name="System Diagrams",
                description="Current diagrams",
                mimeType="application/json",
            ),
            Resource(
                uri="rwanga://progress/agent-reports",
                name="Agent Reports",
                description="Agent reports",
                mimeType="application/json",
            ),
        ]

    @app.read_resource()
    async def read_resource(uri: str):
        uri_str = str(uri)

        if uri_str == "rwanga://progress/overview":
            data = service.get_overview()
            return [TextResourceContents(uri=uri_str, text=json.dumps(_serialize(data), indent=2), mimeType="application/json")]

        if uri_str == "rwanga://progress/tasks":
            tasks = ProgressTask.objects.all().order_by("phase", "-priority", "status")
            data = list(
                tasks.values(
                    "id",
                    "title",
                    "task_type",
                    "phase",
                    "app_name",
                    "status",
                    "priority",
                    "assigned_to",
                    "created_at",
                    "updated_at",
                )
            )
            return [TextResourceContents(uri=uri_str, text=json.dumps(_serialize(data), indent=2), mimeType="application/json")]

        if uri_str.startswith("rwanga://progress/tasks/"):
            task_id = uri_str.split("/")[-1]
            task = ProgressTask.objects.get(pk=task_id)
            updates = list(task.updates.order_by("-created_at").values("id", "update_type", "body", "author", "created_at"))
            changes = list(task.changes.order_by("-created_at").values("id", "change_type", "app_name", "description", "commit_hash", "created_at"))
            gaps = list(GapBlocker.objects.filter(related_task=task).values("id", "title", "severity", "status"))
            data = {
                "task": {
                    "id": str(task.pk),
                    "title": task.title,
                    "description": task.description,
                    "task_type": task.task_type,
                    "phase": task.phase,
                    "app_name": task.app_name,
                    "status": task.status,
                    "priority": task.priority,
                    "assigned_to": task.assigned_to,
                },
                "updates": updates,
                "changes": changes,
                "gaps": gaps,
            }
            return [TextResourceContents(uri=uri_str, text=json.dumps(_serialize(data), indent=2), mimeType="application/json")]

        if uri_str == "rwanga://progress/gaps":
            gaps = GapBlocker.objects.order_by("-severity", "-created_at")
            data = list(
                gaps.values(
                    "id",
                    "title",
                    "description",
                    "gap_type",
                    "severity",
                    "status",
                    "phase",
                    "related_app",
                    "created_at",
                )
            )
            return [TextResourceContents(uri=uri_str, text=json.dumps(_serialize(data), indent=2), mimeType="application/json")]

        if uri_str == "rwanga://progress/updates":
            updates = ProgressUpdate.objects.order_by("-created_at")[:50]
            data = list(updates.values("id", "task_id", "author", "update_type", "body", "created_at"))
            return [TextResourceContents(uri=uri_str, text=json.dumps(_serialize(data), indent=2), mimeType="application/json")]

        if uri_str == "rwanga://progress/decisions":
            decisions = DesignDecision.objects.order_by("-created_at")
            data = list(decisions.values("id", "title", "context", "decision", "status", "phase", "decided_by", "created_at"))
            return [TextResourceContents(uri=uri_str, text=json.dumps(_serialize(data), indent=2), mimeType="application/json")]

        if uri_str == "rwanga://progress/diagrams":
            diagrams = SystemDiagram.objects.filter(is_current=True)
            data = list(diagrams.values("id", "title", "diagram_type", "phase", "content", "render_format", "created_at"))
            return [TextResourceContents(uri=uri_str, text=json.dumps(_serialize(data), indent=2), mimeType="application/json")]

        if uri_str == "rwanga://progress/agent-reports":
            reports = AgentReport.objects.order_by("-created_at")[:20]
            data = list(reports.values("id", "agent_name", "session_id", "report_type", "phase", "summary", "created_at"))
            return [TextResourceContents(uri=uri_str, text=json.dumps(_serialize(data), indent=2), mimeType="application/json")]

        raise ValueError(f"Unknown resource: {uri_str}")
