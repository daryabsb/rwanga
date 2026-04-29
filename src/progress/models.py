from django.db import models

from src.core.models import BaseModel


class ProgressTask(BaseModel):
    class TaskType(models.TextChoices):
        IMPLEMENTATION = "implementation", "Implementation"
        DESIGN = "design", "Design"
        INFRASTRUCTURE = "infrastructure", "Infrastructure"
        DOCUMENTATION = "documentation", "Documentation"
        TESTING = "testing", "Testing"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETED = "completed", "Completed"
        BLOCKED = "blocked", "Blocked"

    class Priority(models.TextChoices):
        CRITICAL = "critical", "Critical"
        HIGH = "high", "High"
        NORMAL = "normal", "Normal"
        LOW = "low", "Low"

    title = models.CharField(max_length=255)
    description = models.TextField()
    task_type = models.CharField(max_length=32, choices=TaskType.choices)
    phase = models.CharField(max_length=16)
    app_name = models.CharField(max_length=64, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    priority = models.CharField(max_length=16, choices=Priority.choices, default=Priority.NORMAL)
    assigned_to = models.CharField(max_length=255, blank=True)
    blocked_by = models.ManyToManyField("self", blank=True, symmetrical=False)

    class Meta:
        ordering = ["phase", "created_at"]

    def __str__(self):
        return self.title


class ProgressUpdate(BaseModel):
    class UpdateType(models.TextChoices):
        STATUS_CHANGE = "status_change", "Status Change"
        IMPLEMENTATION = "implementation", "Implementation"
        FIX = "fix", "Fix"
        NOTE = "note", "Note"
        QUESTION = "question", "Question"

    task = models.ForeignKey(
        ProgressTask, on_delete=models.SET_NULL, null=True, blank=True, related_name="updates"
    )
    author = models.CharField(max_length=255, blank=True)
    update_type = models.CharField(max_length=32, choices=UpdateType.choices)
    body = models.TextField()
    files_affected = models.JSONField(default=list, blank=True)
    tests_run = models.JSONField(default=list, blank=True)


class DesignDecision(BaseModel):
    class Status(models.TextChoices):
        PROPOSED = "proposed", "Proposed"
        APPROVED = "approved", "Approved"
        SUPERSEDED = "superseded", "Superseded"

    title = models.CharField(max_length=255)
    context = models.TextField()
    decision = models.TextField()
    alternatives_considered = models.TextField(blank=True)
    decided_by = models.CharField(max_length=255)
    phase = models.CharField(max_length=16)
    app_name = models.CharField(max_length=64, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PROPOSED)
    superseded_by = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="supersedes"
    )


class GapBlocker(BaseModel):
    class GapType(models.TextChoices):
        DESIGN_GAP = "design_gap", "Design Gap"
        SPEC_UNCLEAR = "spec_unclear", "Spec Unclear"
        DEPENDENCY_MISSING = "dependency_missing", "Dependency Missing"
        TECHNICAL_BLOCKER = "technical_blocker", "Technical Blocker"
        QUESTION_FOR_OWNER = "question_for_owner", "Question For Owner"

    class Severity(models.TextChoices):
        CRITICAL = "critical", "Critical"
        MAJOR = "major", "Major"
        MINOR = "minor", "Minor"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        RESOLVED = "resolved", "Resolved"
        DEFERRED = "deferred", "Deferred"

    title = models.CharField(max_length=255)
    description = models.TextField()
    gap_type = models.CharField(max_length=32, choices=GapType.choices)
    severity = models.CharField(max_length=16, choices=Severity.choices)
    related_task = models.ForeignKey(
        ProgressTask, on_delete=models.SET_NULL, null=True, blank=True, related_name="gaps"
    )
    related_app = models.CharField(max_length=64, blank=True)
    phase = models.CharField(max_length=16)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)
    resolution = models.TextField(blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)


class AgentReport(BaseModel):
    class ReportType(models.TextChoices):
        PHASE_COMPLETION = "phase_completion", "Phase Completion"
        BLOCKER = "blocker", "Blocker"
        PROGRESS = "progress", "Progress"
        HANDOFF = "handoff", "Handoff"

    agent_name = models.CharField(max_length=255)
    session_id = models.CharField(max_length=255)
    report_type = models.CharField(max_length=32, choices=ReportType.choices)
    phase = models.CharField(max_length=16)
    summary = models.TextField()
    tasks_completed = models.ManyToManyField(ProgressTask, blank=True, related_name="reports_completed")
    tasks_blocked = models.ManyToManyField(ProgressTask, blank=True, related_name="reports_blocked")
    gaps_found = models.ManyToManyField(GapBlocker, blank=True, related_name="reports")


class ChangeRecord(BaseModel):
    class ChangeType(models.TextChoices):
        MODEL_ADDED = "model_added", "Model Added"
        MODEL_MODIFIED = "model_modified", "Model Modified"
        VIEW_ADDED = "view_added", "View Added"
        URL_ADDED = "url_added", "URL Added"
        TEST_ADDED = "test_added", "Test Added"
        CONFIG_CHANGED = "config_changed", "Config Changed"
        MIGRATION_RUN = "migration_run", "Migration Run"
        DEPENDENCY_ADDED = "dependency_added", "Dependency Added"

    task = models.ForeignKey(
        ProgressTask, on_delete=models.SET_NULL, null=True, blank=True, related_name="changes"
    )
    change_type = models.CharField(max_length=32, choices=ChangeType.choices)
    app_name = models.CharField(max_length=64)
    description = models.TextField()
    files_changed = models.JSONField(default=list, blank=True)
    diff_summary = models.TextField(blank=True)
    commit_hash = models.CharField(max_length=64, blank=True)


class SystemDiagram(BaseModel):
    class DiagramType(models.TextChoices):
        ARCHITECTURE = "architecture", "Architecture"
        TOPOLOGY = "topology", "Topology"
        DEPENDENCY_GRAPH = "dependency_graph", "Dependency Graph"
        DATA_MODEL = "data_model", "Data Model"
        FLOW = "flow", "Flow"

    class RenderFormat(models.TextChoices):
        MERMAID = "mermaid", "Mermaid"
        SVG = "svg", "SVG"

    title = models.CharField(max_length=255)
    diagram_type = models.CharField(max_length=32, choices=DiagramType.choices)
    phase = models.CharField(max_length=16)
    content = models.TextField()
    render_format = models.CharField(max_length=16, choices=RenderFormat.choices)
    is_current = models.BooleanField(default=True)
    notes = models.TextField(blank=True)


class DocumentVersion(BaseModel):
    document_name = models.CharField(max_length=255)
    version = models.CharField(max_length=64)
    content = models.TextField()
    changed_by = models.CharField(max_length=255)
    change_summary = models.TextField()
    phase = models.CharField(max_length=16)
