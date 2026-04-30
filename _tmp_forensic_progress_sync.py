from src.progress.models import ProgressTask, ProgressUpdate, GapBlocker

TASKS = [
    ("P0.1", "Clone HUD2 skeleton to new rwanga/ repository", "completed", "Repository scaffold present with split settings and src package."),
    ("P0.2", "Strip all HUD2 domain apps from LOCAL_APPS", "completed", "LOCAL_APPS currently only core/accounts/projects/progress."),
    ("P0.3", "Create .env from HUD2 .env", "completed", "Environment wiring is present and project runs manage.py commands."),
    ("P0.4", "Add rwanga.py settings component", "completed", "rwanga settings component exists in settings/components."),
    ("P0.5", "Create src/core/ app", "completed", "BaseModel and middleware present in src/core."),
    ("P0.6", "Write tests for core models", "completed", "src/core/tests/test_models.py exists."),
    ("P0.7", "Create src/progress/ app", "completed", "Progress models/views/api exist with dashboard."),
    ("P0.8", "Write tests for progress models and API", "completed", "src/progress/tests has model/api/service tests."),
    ("P0.9", "Verify progress dashboard renders at /progress/", "completed", "Route and template exist."),
    ("P0.10", "Run validation checklist", "in_progress", "Manage.py checks pass; full infra checklist not fully evidenced in repo."),
    ("P0.11", "Record all P0 work in Progress app", "completed", "P0 tasks and updates now recorded during forensic pass."),
    ("P0.12", "Create initial SystemDiagram", "pending", "No persisted system diagram evidence found in this pass."),
    ("P1.1", "Create src/accounts/ app", "completed", "Accounts models, api, tests, and views present."),
    ("P1.2", "Create base.html", "completed", "Base template exists and is wired."),
    ("P1.3", "Create rwanga.css with all design tokens", "completed", "static/css/rwanga.css exists."),
    ("P1.4", "Create src/projects/ app", "completed", "Projects models, api, tests, views present."),
    ("P1.5", "Create scene_view.html shell", "completed", "Scene shell template exists with tab routing."),
    ("P1.6", "Create src/reviews/ app", "pending", "src/reviews app is missing."),
    ("P1.7", "Wire InlineComment into scene view", "pending", "No InlineComment integration found."),
    ("P1.8", "Implement project-as-workspace UX", "in_progress", "Projects lobby exists; deep context-switch/exit flow not fully implemented."),
    ("P1.9", "TV-first validation 1920x1080", "pending", "No automated or documented validation evidence found."),
    ("P1.10", "Update architecture/flow/changelog", "pending", "Design-required docs are not updated in docs/."),
    ("P2.1", "Create src/shots/ app", "in_progress", "Shots has HTMX views/urls but lacks models/services/api/tests."),
    ("P2.2", "Create src/floorplans/ app", "in_progress", "Floorplans has HTMX views/urls but lacks models/services/api/tests."),
    ("P2.3", "Create src/exports/ app", "in_progress", "Exports has views/urls but lacks models/services/api/tests and offline export engine."),
    ("P2.4", "Wire Sortable.js for shot reorder", "pending", "No shot reorder integration detected."),
    ("P2.5", "Build project dashboard", "completed", "Dashboard template and route exist."),
    ("P2.6", "Update architecture/flow/api docs", "pending", "No evidence of phase docs update."),
    ("P3.1", "Create src/departments/ app", "in_progress", "Departments has HTMX views/urls but lacks models/services/api/tests."),
    ("P3.2", "Build department tab templates", "pending", "Dedicated scene tab templates for departments not implemented."),
    ("P3.3", "Build storyboard tab template", "pending", "Dedicated storyboard tab template with upload/sort not implemented."),
    ("P3.4", "Update scene viewer export with department data", "pending", "Scene viewer does not include full department payload."),
    ("P3.5", "Update architecture/flow/api docs", "pending", "No evidence of phase docs update."),
    ("P4.1", "Create src/scheduling/ app", "in_progress", "Scheduling has HTMX views/urls but lacks models/services/api/tests."),
    ("P4.2", "Call sheet generation", "pending", "No WeasyPrint/Twilio task flow present."),
    ("P4.3", "Create src/locations/ app", "in_progress", "Locations has HTMX view/url only; no models/services/api/tests."),
    ("P4.4", "Create src/notifications/ app", "in_progress", "Notifications has HTMX panel view/url only; no model/feed/ws wiring."),
    ("P4.5", "Update documentation", "pending", "No evidence of phase docs update."),
    ("P5.1", "Create src/ai_engine/ app", "in_progress", "AI engine has HTMX-like endpoints only; lacks models/services/api/tests."),
    ("P5.2", "AI Script Breakdown", "pending", "No parser/pipeline implementation found."),
    ("P5.3", "AI Floor Plan Generation", "pending", "No AI floor plan generation implementation found."),
    ("P5.4", "AI Schedule Optimization", "pending", "No schedule optimizer implementation found."),
    ("P5.5", "MCP Server", "pending", "No in-repo MCP server implementation found."),
    ("P5.6", "WebSocket progress for AI jobs", "pending", "No realtime consumer wiring found."),
    ("P5.7", "Update documentation", "pending", "No evidence of phase docs update."),
    ("P6.1", "Create src/community/ app", "pending", "src/community app is missing."),
    ("P6.2", "Professional Review output", "pending", "Review output system not implemented."),
    ("P6.3", "Update Progress app with all changes", "in_progress", "Forensic update in progress now."),
    ("P7.1", "PWA service worker", "pending", "Not implemented."),
    ("P7.2", "Multi-language human-verified .po", "in_progress", "i18n base exists; translation artifacts not fully evidenced."),
    ("P7.3", "Budget module", "pending", "Not implemented."),
    ("P7.4", "Performance optimization for large projects", "pending", "Not implemented."),
    ("P7.5", "Mobile-responsive refinements", "pending", "Not formally validated/documented."),
    ("P7.6", "Celery Beat scheduled tasks", "pending", "No scheduled maintenance tasks evidenced."),
]

STATUS_MAP = {
    "pending": ProgressTask.Status.PENDING,
    "in_progress": ProgressTask.Status.IN_PROGRESS,
    "completed": ProgressTask.Status.COMPLETED,
    "blocked": ProgressTask.Status.BLOCKED,
}

for code, title, status, note in TASKS:
    task, _ = ProgressTask.objects.get_or_create(
        title=f"{code} {title}",
        defaults={
            "description": note,
            "task_type": ProgressTask.TaskType.DOCUMENTATION,
            "phase": code.split('.')[0],
            "status": STATUS_MAP[status],
            "priority": ProgressTask.Priority.HIGH if status != "completed" else ProgressTask.Priority.NORMAL,
        },
    )
    changed = []
    if task.status != STATUS_MAP[status]:
        task.status = STATUS_MAP[status]
        changed.append("status")
    if task.description != note:
        task.description = note
        changed.append("description")
    if changed:
        changed.append("updated_at")
        task.save(update_fields=changed)

    body = f"Forensic inspection (2026-04-30): {note}"
    if not ProgressUpdate.objects.filter(task=task, body=body).exists():
        ProgressUpdate.objects.create(
            task=task,
            update_type=ProgressUpdate.UpdateType.NOTE,
            body=body,
            files_affected=["rwanga-design-kit/INDEX.md", "rwanga-design-kit/MASTER-DESIGN.md", "src/"],
            tests_run=["python manage.py check"],
        )

for title, desc, sev in [
    ("Gap: Design requires many local apps but only 4 are installed", "MASTER-DESIGN expects broad LOCAL_APPS coverage (reviews/community/realtime and phase apps), but common.py currently installs only core/accounts/projects/progress.", GapBlocker.Severity.CRITICAL),
    ("Gap: Design-kit template hashes diverged from implementation", "Current template hashes differ from rwanga-design-kit counterparts; per owner rule these were not auto-refactored in this pass.", GapBlocker.Severity.MAJOR),
    ("Gap: Missing reviews/community/realtime apps", "Architecture-critical apps from MASTER-DESIGN are absent in src/.", GapBlocker.Severity.CRITICAL),
]:
    GapBlocker.objects.get_or_create(
        title=title,
        defaults={
            "description": desc,
            "gap_type": GapBlocker.GapType.TECHNICAL_BLOCKER,
            "severity": sev,
            "phase": "P1+",
            "status": GapBlocker.Status.OPEN,
            "related_app": "progress",
        },
    )

print("Forensic progress records written cleanly.")
