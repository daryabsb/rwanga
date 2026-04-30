from src.progress.models import (
    AgentReport,
    ChangeRecord,
    DesignDecision,
    DocumentVersion,
    GapBlocker,
    ProgressTask,
    ProgressUpdate,
    SystemDiagram,
)


class ProgressService:
    @staticmethod
    def seed_initial_tasks():
        tasks = [
            ("P0.1 Clone HUD2 skeleton", "Clone and validate base skeleton", "P0", ProgressTask.TaskType.INFRASTRUCTURE, ProgressTask.Status.COMPLETED, ProgressTask.Priority.CRITICAL),
            ("P0.2 Strip HUD2 domain apps", "Remove non-rwanga domain modules", "P0", ProgressTask.TaskType.IMPLEMENTATION, ProgressTask.Status.COMPLETED, ProgressTask.Priority.HIGH),
            ("P0.3 Create .env", "Provision project environment configuration", "P0", ProgressTask.TaskType.INFRASTRUCTURE, ProgressTask.Status.COMPLETED, ProgressTask.Priority.HIGH),
            ("P0.4 Add rwanga.py settings component", "Wire rwanga settings component", "P0", ProgressTask.TaskType.INFRASTRUCTURE, ProgressTask.Status.COMPLETED, ProgressTask.Priority.HIGH),
            ("P0.5 Create core app", "Create reusable base model utilities", "P0", ProgressTask.TaskType.IMPLEMENTATION, ProgressTask.Status.COMPLETED, ProgressTask.Priority.HIGH),
            ("P0.6 Write core tests", "Validate core model behavior", "P0", ProgressTask.TaskType.TESTING, ProgressTask.Status.COMPLETED, ProgressTask.Priority.HIGH),
            ("P0.7 Create progress app", "Create tracking models and views", "P0", ProgressTask.TaskType.IMPLEMENTATION, ProgressTask.Status.COMPLETED, ProgressTask.Priority.CRITICAL),
            ("P0.8 Write progress tests", "Add tests for progress services and views", "P0", ProgressTask.TaskType.TESTING, ProgressTask.Status.COMPLETED, ProgressTask.Priority.HIGH),
            ("P0.9 Verify progress dashboard", "Confirm dashboard routing and rendering", "P0", ProgressTask.TaskType.TESTING, ProgressTask.Status.COMPLETED, ProgressTask.Priority.NORMAL),
            ("P0.10 Infrastructure validation (Django, ASGI, Celery, Redis, DRF, WebSocket)", "Run baseline runtime checks for all stack layers", "P0", ProgressTask.TaskType.INFRASTRUCTURE, ProgressTask.Status.COMPLETED, ProgressTask.Priority.CRITICAL),
            ("P0.11 Record all P0 work in Progress app", "Backfill progress entries for P0", "P0", ProgressTask.TaskType.DOCUMENTATION, ProgressTask.Status.COMPLETED, ProgressTask.Priority.NORMAL),
            ("P0.12 Create initial SystemDiagram", "Capture architecture baseline", "P0", ProgressTask.TaskType.DOCUMENTATION, ProgressTask.Status.COMPLETED, ProgressTask.Priority.NORMAL),
            ("P1.1 Create accounts app (models, DRF, views)", "Implement authentication and studio domain", "P1", ProgressTask.TaskType.IMPLEMENTATION, ProgressTask.Status.COMPLETED, ProgressTask.Priority.HIGH),
            ("P1.2 Create base.html (design-kit template - COPY, not create)", "Adopt shared base shell from design-kit", "P1", ProgressTask.TaskType.DESIGN, ProgressTask.Status.COMPLETED, ProgressTask.Priority.HIGH),
            ("P1.3 Create rwanga.css (design-kit static - COPY, not create)", "Adopt design token stylesheet from design-kit", "P1", ProgressTask.TaskType.DESIGN, ProgressTask.Status.COMPLETED, ProgressTask.Priority.HIGH),
            ("P1.4 Create projects app (models, DRF, views)", "Implement projects and scenes", "P1", ProgressTask.TaskType.IMPLEMENTATION, ProgressTask.Status.COMPLETED, ProgressTask.Priority.HIGH),
            ("P1.5 Create scene_view.html shell (design-kit template - COPY)", "Adopt scene view from design-kit", "P1", ProgressTask.TaskType.DESIGN, ProgressTask.Status.COMPLETED, ProgressTask.Priority.HIGH),
            ("P1.6 Create reviews app (InlineComment, BibleReview shell, ReviewDecision)", "Reviews app not implemented yet", "P1", ProgressTask.TaskType.IMPLEMENTATION, ProgressTask.Status.BLOCKED, ProgressTask.Priority.NORMAL),
            ("P1.7 Wire InlineComment into scene view", "Inline comments pending reviews app", "P1", ProgressTask.TaskType.IMPLEMENTATION, ProgressTask.Status.BLOCKED, ProgressTask.Priority.NORMAL),
            ("P1.8 Project-as-workspace UX (dashboard=lobby, project=workspace, exit flow)", "Align routing and workspace behavior", "P1", ProgressTask.TaskType.IMPLEMENTATION, ProgressTask.Status.IN_PROGRESS, ProgressTask.Priority.HIGH),
            ("P1.9 Scripts app (models, upload view)", "Implement scripts upload flow", "P1", ProgressTask.TaskType.IMPLEMENTATION, ProgressTask.Status.IN_PROGRESS, ProgressTask.Priority.HIGH),
            ("P1.10 TV-first validation at 1920x1080", "Visual QA on target display profile", "P1", ProgressTask.TaskType.TESTING, ProgressTask.Status.PENDING, ProgressTask.Priority.NORMAL),
            ("P1.11 Update Progress app", "Keep progress tracker in sync with execution", "P1", ProgressTask.TaskType.DOCUMENTATION, ProgressTask.Status.IN_PROGRESS, ProgressTask.Priority.HIGH),
        ]

        for title, description, phase, task_type, status, priority in tasks:
            task, _ = ProgressTask.objects.get_or_create(
                title=title,
                defaults={
                    "description": description,
                    "phase": phase,
                    "task_type": task_type,
                    "status": status,
                    "priority": priority,
                },
            )
            if not task.updates.exists():
                ProgressUpdate.objects.create(
                    task=task,
                    update_type=ProgressUpdate.UpdateType.IMPLEMENTATION,
                    body=f"{title}: tracked status {status}.",
                    files_affected=["src/progress/services.py"],
                    tests_run=["python manage.py check"],
                )

        gap_entries = [
            ("Gap: Auth flow diverged from allauth expected behavior (Drift A from delivery report)", "Auth flow diverged from allauth expectation; corrected toward allauth login pipeline.", GapBlocker.Severity.MAJOR, GapBlocker.Status.OPEN),
            ("Gap: Bootstrap was CDN instead of local (Drift B - now fixed)", "Bootstrap sourcing policy was inconsistent previously.", GapBlocker.Severity.MINOR, GapBlocker.Status.RESOLVED),
            ("Gap: Template comment leakage in UI (Drift C - now fixed)", "Template-level notes leaked into rendered UI in earlier iterations.", GapBlocker.Severity.MINOR, GapBlocker.Status.RESOLVED),
            ("Gap: Invented templates instead of using design-kit (Drift D - fixing now)", "Templates diverged from design-kit source of truth.", GapBlocker.Severity.MAJOR, GapBlocker.Status.OPEN),
            ("Gap: Static path resolution broken (Drift E - now fixed)", "Static path mismatches affected CSS/JS resolution.", GapBlocker.Severity.MAJOR, GapBlocker.Status.RESOLVED),
        ]
        for title, description, severity, status in gap_entries:
            GapBlocker.objects.get_or_create(
                title=title,
                defaults={
                    "description": description,
                    "gap_type": GapBlocker.GapType.DESIGN_GAP,
                    "severity": severity,
                    "phase": "P1",
                    "status": status,
                    "related_app": "progress",
                },
            )

    @staticmethod
    def list_task_titles():
        return ProgressTask.objects.values_list("title", flat=True)

    @staticmethod
    def record_foundation_completion():
        task, _ = ProgressTask.objects.get_or_create(
            title="P0 foundation",
            defaults={
                "description": "Bootstrap skeleton, settings, and runtime validation",
                "task_type": ProgressTask.TaskType.INFRASTRUCTURE,
                "phase": "P0",
                "status": ProgressTask.Status.COMPLETED,
                "priority": ProgressTask.Priority.CRITICAL,
            },
        )
        task.status = ProgressTask.Status.COMPLETED
        task.save(update_fields=["status", "updated_at"])

        ProgressUpdate.objects.create(
            task=task,
            update_type=ProgressUpdate.UpdateType.IMPLEMENTATION,
            body="Foundation slice completed: skeleton, settings, core app, and basic validation.",
            files_affected=[
                "manage.py",
                "src/settings",
                "src/core/models.py",
            ],
            tests_run=["python manage.py test src.core.tests.test_models", "python manage.py check"],
        )

    def get_overview(self) -> dict:
        tasks = ProgressTask.objects.all()
        total = tasks.count()
        completed = tasks.filter(status=ProgressTask.Status.COMPLETED).count()
        return {
            "current_phase": self._detect_current_phase(),
            "tasks": {
                "total": total,
                "pending": tasks.filter(status=ProgressTask.Status.PENDING).count(),
                "in_progress": tasks.filter(status=ProgressTask.Status.IN_PROGRESS).count(),
                "completed": completed,
                "blocked": tasks.filter(status=ProgressTask.Status.BLOCKED).count(),
            },
            "gaps": {
                "open": GapBlocker.objects.filter(status=GapBlocker.Status.OPEN).count(),
                "critical": GapBlocker.objects.filter(
                    status=GapBlocker.Status.OPEN, severity=GapBlocker.Severity.CRITICAL
                ).count(),
            },
            "recent_updates": list(
                ProgressUpdate.objects.order_by("-created_at")[:5].values(
                    "id", "update_type", "body", "created_at", "task_id"
                )
            ),
            "phase_completion_pct": round((completed / total * 100) if total else 0, 1),
        }

    def create_task(
        self,
        *,
        title,
        description="",
        task_type="implementation",
        phase="",
        app_name=None,
        priority="normal",
        assigned_to=None,
        blocked_by=None,
    ) -> ProgressTask:
        task = ProgressTask.objects.create(
            title=title,
            description=description,
            task_type=task_type,
            phase=phase,
            app_name=app_name or "",
            status=ProgressTask.Status.PENDING,
            priority=priority,
            assigned_to=assigned_to or "",
        )
        if blocked_by:
            blockers = ProgressTask.objects.filter(pk__in=blocked_by)
            task.blocked_by.set(blockers)
        return task

    def update_task_status(self, *, task_id, status, note=None) -> ProgressTask:
        task = ProgressTask.objects.get(pk=task_id)
        old_status = task.status
        task.status = status
        task.save(update_fields=["status", "updated_at"])
        ProgressUpdate.objects.create(
            task=task,
            author="mcp-agent",
            update_type=ProgressUpdate.UpdateType.STATUS_CHANGE,
            body=note or f"Status changed: {old_status} -> {status}",
        )
        return task

    def record_update(
        self,
        *,
        task_id=None,
        update_type="implementation",
        body="",
        files_affected=None,
        tests_run=None,
        author="mcp-agent",
    ) -> ProgressUpdate:
        task = ProgressTask.objects.get(pk=task_id) if task_id else None
        return ProgressUpdate.objects.create(
            task=task,
            author=author,
            update_type=update_type,
            body=body,
            files_affected=files_affected or [],
            tests_run=tests_run or {},
        )

    def report_gap(
        self,
        *,
        title,
        description,
        gap_type,
        severity,
        related_task_id=None,
        related_app=None,
        phase="",
    ) -> GapBlocker:
        task = ProgressTask.objects.get(pk=related_task_id) if related_task_id else None
        return GapBlocker.objects.create(
            title=title,
            description=description,
            gap_type=gap_type,
            severity=severity,
            related_task=task,
            related_app=related_app or "",
            phase=phase,
            status=GapBlocker.Status.OPEN,
        )

    def submit_agent_report(
        self,
        *,
        agent_name,
        session_id,
        report_type,
        phase,
        summary,
        tasks_completed=None,
        tasks_blocked=None,
        gaps_found=None,
    ) -> AgentReport:
        report = AgentReport.objects.create(
            agent_name=agent_name,
            session_id=session_id,
            report_type=report_type,
            phase=phase,
            summary=summary,
        )
        if tasks_completed:
            report.tasks_completed.set(ProgressTask.objects.filter(pk__in=tasks_completed))
        if tasks_blocked:
            report.tasks_blocked.set(ProgressTask.objects.filter(pk__in=tasks_blocked))
        if gaps_found:
            report.gaps_found.set(GapBlocker.objects.filter(pk__in=gaps_found))
        return report

    def record_change(
        self,
        *,
        task_id=None,
        change_type="model_added",
        app_name="",
        description="",
        files_changed=None,
        diff_summary=None,
        commit_hash=None,
    ) -> ChangeRecord:
        task = ProgressTask.objects.get(pk=task_id) if task_id else None
        return ChangeRecord.objects.create(
            task=task,
            change_type=change_type,
            app_name=app_name,
            description=description,
            files_changed=files_changed or [],
            diff_summary=diff_summary or "",
            commit_hash=commit_hash or "",
        )

    def record_decision(
        self,
        *,
        title,
        context,
        decision,
        alternatives_considered=None,
        decided_by="",
        phase="",
        app_name=None,
    ) -> DesignDecision:
        return DesignDecision.objects.create(
            title=title,
            context=context,
            decision=decision,
            alternatives_considered=alternatives_considered or "",
            decided_by=decided_by,
            phase=phase,
            app_name=app_name or "",
            status=DesignDecision.Status.PROPOSED,
        )

    def update_diagram(
        self,
        *,
        title,
        diagram_type,
        phase,
        content,
        render_format="mermaid",
        notes=None,
    ) -> SystemDiagram:
        SystemDiagram.objects.filter(diagram_type=diagram_type, is_current=True).update(is_current=False)
        return SystemDiagram.objects.create(
            title=title,
            diagram_type=diagram_type,
            phase=phase,
            content=content,
            render_format=render_format,
            is_current=True,
            notes=notes or "",
        )

    def _detect_current_phase(self) -> str:
        for phase in ["P0", "P1", "P2", "P3", "P4", "P5", "P6", "P7"]:
            tasks = ProgressTask.objects.filter(phase=phase)
            if tasks.exists() and tasks.exclude(status=ProgressTask.Status.COMPLETED).exists():
                return phase
        return "P7"
