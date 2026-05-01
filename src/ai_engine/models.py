from django.db import models

from src.core.models import BaseModel


class AIJob(BaseModel):
    class JobType(models.TextChoices):
        BREAKDOWN = "breakdown", "Breakdown"
        FLOORPLAN = "floorplan", "Floor Plan"
        SCHEDULE = "schedule", "Schedule"

    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        RUNNING = "running", "Running"
        DONE = "done", "Done"
        ERROR = "error", "Error"

    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="ai_jobs")
    type = models.CharField(max_length=20, choices=JobType.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.QUEUED)
    progress = models.PositiveSmallIntegerField(default=0)
    step = models.CharField(max_length=200, blank=True)
    result = models.JSONField(default=dict, blank=True)
    error = models.TextField(blank=True)
