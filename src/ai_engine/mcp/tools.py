"""
src.ai_engine.mcp.tools
~~~~~~~~~~~~~~~~~~~~~~~

MCP tools for Progress write operations.
"""
import json

from mcp.types import CallToolResult, TextContent, Tool

from src.progress.services import ProgressService

service = ProgressService()


def register_tools(app):
    def _ok(payload: dict) -> CallToolResult:
        return CallToolResult(content=[TextContent(type="text", text=json.dumps(payload, default=str))])

    @app.list_tools()
    async def list_tools():
        return [
            Tool(name="report_progress_update", description="Record a progress update for a task or general project.", inputSchema={"type": "object", "properties": {"task_id": {"type": "string"}, "update_type": {"type": "string"}, "body": {"type": "string"}, "files_affected": {"type": "array", "items": {"type": "string"}}, "tests_run": {"type": "object"}}}),
            Tool(name="create_task", description="Create a new progress task.", inputSchema={"type": "object", "required": ["title"], "properties": {"title": {"type": "string"}, "description": {"type": "string"}, "task_type": {"type": "string"}, "phase": {"type": "string"}, "app_name": {"type": "string"}, "priority": {"type": "string"}, "assigned_to": {"type": "string"}, "blocked_by": {"type": "array", "items": {"type": "string"}}}}),
            Tool(name="update_task_status", description="Update task status.", inputSchema={"type": "object", "required": ["task_id", "status"], "properties": {"task_id": {"type": "string"}, "status": {"type": "string"}, "note": {"type": "string"}}}),
            Tool(name="report_gap", description="Report a gap or blocker.", inputSchema={"type": "object", "required": ["title", "description", "gap_type", "severity"], "properties": {"title": {"type": "string"}, "description": {"type": "string"}, "gap_type": {"type": "string"}, "severity": {"type": "string"}, "related_task_id": {"type": "string"}, "related_app": {"type": "string"}, "phase": {"type": "string"}}}),
            Tool(name="submit_agent_report", description="Submit an agent session report.", inputSchema={"type": "object", "required": ["agent_name", "session_id", "report_type", "phase", "summary"], "properties": {"agent_name": {"type": "string"}, "session_id": {"type": "string"}, "report_type": {"type": "string"}, "phase": {"type": "string"}, "summary": {"type": "string"}, "tasks_completed": {"type": "array", "items": {"type": "string"}}, "tasks_blocked": {"type": "array", "items": {"type": "string"}}, "gaps_found": {"type": "array", "items": {"type": "string"}}}}),
            Tool(name="record_change", description="Record a code change.", inputSchema={"type": "object", "properties": {"task_id": {"type": "string"}, "change_type": {"type": "string"}, "app_name": {"type": "string"}, "description": {"type": "string"}, "files_changed": {"type": "array", "items": {"type": "string"}}, "diff_summary": {"type": "string"}, "commit_hash": {"type": "string"}}}),
            Tool(name="record_decision", description="Record a design decision.", inputSchema={"type": "object", "required": ["title", "context", "decision"], "properties": {"title": {"type": "string"}, "context": {"type": "string"}, "decision": {"type": "string"}, "alternatives_considered": {"type": "string"}, "decided_by": {"type": "string"}, "phase": {"type": "string"}, "app_name": {"type": "string"}}}),
            Tool(name="update_diagram", description="Update a system diagram and mark current.", inputSchema={"type": "object", "required": ["title", "diagram_type", "phase", "content"], "properties": {"title": {"type": "string"}, "diagram_type": {"type": "string"}, "phase": {"type": "string"}, "content": {"type": "string"}, "render_format": {"type": "string"}, "notes": {"type": "string"}}}),
            Tool(
                name="list_studios",
                description="List all studios the given user has active membership in. Returns id, name, slug, specialty, is_primary (whether this is the user's primary 'My Studio'), and member_count (active members) for each studio.",
                inputSchema={
                    "type": "object",
                    "required": ["user_id"],
                    "properties": {
                        "user_id": {"type": "string", "description": "PK of the user whose studios to list."},
                    },
                },
            ),
            Tool(
                name="get_studio",
                description="Get full details of one studio: id, name, slug, specialty, members (email/role/tier for each active member), and project_count. Verifies the user has active membership before returning details.",
                inputSchema={
                    "type": "object",
                    "required": ["user_id", "studio_id"],
                    "properties": {
                        "user_id": {"type": "string"},
                        "studio_id": {"type": "string"},
                    },
                },
            ),
            Tool(
                name="list_projects",
                description="List projects accessible to the given user (owner, created_by, or active membership). Optionally scoped to one studio. Returns id, name, slug, project_type, status, studio_id, studio_name.",
                inputSchema={
                    "type": "object",
                    "required": ["user_id"],
                    "properties": {
                        "user_id": {"type": "string"},
                        "studio_id": {"type": "string", "description": "Optional studio scope."},
                    },
                },
            ),
            Tool(
                name="get_project",
                description="Get full project details: name, name_latin, slug, type, status, logline, language, director_credit, scene/member counts. Verifies user has access.",
                inputSchema={
                    "type": "object",
                    "required": ["user_id", "project_id"],
                    "properties": {
                        "user_id": {"type": "string"},
                        "project_id": {"type": "string"},
                    },
                },
            ),
            Tool(
                name="create_project",
                description="Create a new project in the given studio. User must have active membership in the studio. Returns id, name, slug, status (draft).",
                inputSchema={
                    "type": "object",
                    "required": ["user_id", "studio_id", "name"],
                    "properties": {
                        "user_id": {"type": "string"},
                        "studio_id": {"type": "string"},
                        "name": {"type": "string"},
                        "project_type": {"type": "string", "default": "feature"},
                    },
                },
            ),
        ]

    @app.call_tool()
    async def call_tool(name: str, arguments: dict):
        args = arguments or {}
        if name == "report_progress_update":
            update = service.record_update(
                task_id=args.get("task_id"),
                update_type=args.get("update_type", "implementation"),
                body=args.get("body", ""),
                files_affected=args.get("files_affected"),
                tests_run=args.get("tests_run"),
            )
            return _ok({"id": str(update.pk), "status": "created"})
        if name == "create_task":
            task = service.create_task(
                title=args["title"],
                description=args.get("description", ""),
                task_type=args.get("task_type", "implementation"),
                phase=args.get("phase", ""),
                app_name=args.get("app_name"),
                priority=args.get("priority", "normal"),
                assigned_to=args.get("assigned_to"),
                blocked_by=args.get("blocked_by"),
            )
            return _ok({"id": str(task.pk), "status": task.status})
        if name == "update_task_status":
            task = service.update_task_status(task_id=args["task_id"], status=args["status"], note=args.get("note"))
            return _ok({"id": str(task.pk), "status": task.status})
        if name == "report_gap":
            gap = service.report_gap(
                title=args["title"],
                description=args["description"],
                gap_type=args["gap_type"],
                severity=args["severity"],
                related_task_id=args.get("related_task_id"),
                related_app=args.get("related_app"),
                phase=args.get("phase", ""),
            )
            return _ok({"id": str(gap.pk), "status": "open"})
        if name == "submit_agent_report":
            report = service.submit_agent_report(
                agent_name=args["agent_name"],
                session_id=args["session_id"],
                report_type=args["report_type"],
                phase=args["phase"],
                summary=args["summary"],
                tasks_completed=args.get("tasks_completed"),
                tasks_blocked=args.get("tasks_blocked"),
                gaps_found=args.get("gaps_found"),
            )
            return _ok({"id": str(report.pk), "status": "submitted"})
        if name == "record_change":
            change = service.record_change(
                task_id=args.get("task_id"),
                change_type=args.get("change_type", "model_added"),
                app_name=args.get("app_name", ""),
                description=args.get("description", ""),
                files_changed=args.get("files_changed"),
                diff_summary=args.get("diff_summary"),
                commit_hash=args.get("commit_hash"),
            )
            return _ok({"id": str(change.pk), "status": "recorded"})
        if name == "record_decision":
            dec = service.record_decision(
                title=args["title"],
                context=args["context"],
                decision=args["decision"],
                alternatives_considered=args.get("alternatives_considered"),
                decided_by=args.get("decided_by", ""),
                phase=args.get("phase", ""),
                app_name=args.get("app_name"),
            )
            return _ok({"id": str(dec.pk), "status": dec.status})
        if name == "update_diagram":
            diagram = service.update_diagram(
                title=args["title"],
                diagram_type=args["diagram_type"],
                phase=args["phase"],
                content=args["content"],
                render_format=args.get("render_format", "mermaid"),
                notes=args.get("notes"),
            )
            return _ok({"id": str(diagram.pk), "status": "current"})
        if name == "list_studios":
            from src.accounts.models import User, Studio
            try:
                user = User.objects.get(pk=args["user_id"])
            except (User.DoesNotExist, ValueError):
                return _ok({"error": "user not found", "user_id": args.get("user_id")})
            studios_qs = Studio.objects.filter(
                memberships__user=user, memberships__status="active",
            ).distinct()
            out = []
            for s in studios_qs:
                m = s.memberships.filter(user=user).first()
                out.append({
                    "id": str(s.id),
                    "name": s.name,
                    "slug": s.slug,
                    "specialty": s.specialty,
                    "is_primary": bool(m and m.is_primary),
                    "member_count": s.memberships.filter(status="active").count(),
                })
            return _ok({"studios": out})
        if name == "get_studio":
            from src.accounts.models import User, Studio
            try:
                user = User.objects.get(pk=args["user_id"])
                studio = Studio.objects.get(
                    pk=args["studio_id"],
                    memberships__user=user,
                    memberships__status="active",
                )
            except (User.DoesNotExist, Studio.DoesNotExist, ValueError):
                return _ok({"error": "studio not accessible to user"})
            members = [
                {"email": m.user.email, "role": m.role, "tier": m.tier}
                for m in studio.memberships.filter(status="active").select_related("user")
            ]
            return _ok({
                "id": str(studio.id),
                "name": studio.name,
                "slug": studio.slug,
                "specialty": studio.specialty,
                "members": members,
                "project_count": studio.projects.count(),
            })
        if name == "list_projects":
            from src.accounts.models import User, Studio
            from src.projects.models import Project
            from django.db.models import Q
            try:
                user = User.objects.get(pk=args["user_id"])
            except (User.DoesNotExist, ValueError):
                return _ok({"error": "user not found"})
            qs = Project.objects.filter(
                Q(owner=user) | Q(created_by=user) | Q(memberships__user=user)
            ).distinct().select_related("studio")
            if args.get("studio_id"):
                qs = qs.filter(studio_id=args["studio_id"])
            out = [
                {
                    "id": str(p.id),
                    "name": p.name or p.title,
                    "slug": p.slug,
                    "project_type": p.project_type,
                    "status": p.status,
                    "studio_id": str(p.studio_id),
                    "studio_name": p.studio.name,
                }
                for p in qs
            ]
            return _ok({"projects": out})
        if name == "get_project":
            from src.accounts.models import User
            from src.projects.models import Project
            from django.db.models import Q
            try:
                user = User.objects.get(pk=args["user_id"])
                project = Project.objects.filter(
                    Q(owner=user) | Q(created_by=user) | Q(memberships__user=user)
                ).filter(pk=args["project_id"]).select_related("studio").first()
                if project is None:
                    return _ok({"error": "project not accessible to user"})
            except (User.DoesNotExist, ValueError):
                return _ok({"error": "user not found"})
            members = [
                {"email": m.user.email, "role": m.role_type, "tier": getattr(m, "tier", "production")}
                for m in project.memberships.filter(status="active").select_related("user")
            ]
            return _ok({
                "id": str(project.id),
                "name": project.name or project.title,
                "name_latin": project.name_latin,
                "slug": project.slug,
                "project_type": project.project_type,
                "status": project.status,
                "logline": project.logline,
                "language": project.language,
                "director_credit": project.director_credit,
                "estimated_shoot_start": str(project.estimated_shoot_start) if project.estimated_shoot_start else None,
                "estimated_length_minutes": project.estimated_length_minutes,
                "studio_id": str(project.studio_id),
                "studio_name": project.studio.name,
                "scenes_count": project.scenes.count(),
                "members": members,
            })
        if name == "create_project":
            from src.accounts.models import User, Studio
            from src.projects.services.lifecycle_services import create_project
            try:
                user = User.objects.get(pk=args["user_id"])
                studio = Studio.objects.get(
                    pk=args["studio_id"],
                    memberships__user=user,
                    memberships__status="active",
                )
            except (User.DoesNotExist, Studio.DoesNotExist, ValueError):
                return _ok({"error": "user or studio not accessible"})
            project = create_project(
                studio=studio,
                user=user,
                name=args["name"],
                project_type=args.get("project_type", "feature"),
            )
            return _ok({
                "id": str(project.id),
                "name": project.name,
                "slug": project.slug,
                "status": project.status,
            })
        raise ValueError(f"Unknown tool: {name}")
