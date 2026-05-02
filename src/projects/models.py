from django.conf import settings
from django.db import models

from src.core.models import BaseModel


class Project(BaseModel):
    studio = models.ForeignKey("accounts.Studio", on_delete=models.CASCADE, related_name="projects")
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="owned_projects")
    title = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    synopsis = models.TextField(blank=True)
    status = models.CharField(max_length=32, default="draft")
    canonical_bible = models.JSONField(default=dict, blank=True)
    bible_version = models.PositiveIntegerField(default=0)
    bible_status = models.CharField(
        max_length=20,
        choices=[
            ("empty", "Empty"),
            ("draft", "Draft"),
            ("in_review", "In Review"),
            ("final", "Final"),
        ],
        default="empty",
    )
    bible_finalized_at = models.DateTimeField(null=True, blank=True)
    bible_finalized_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="finalized_bibles",
    )

    class Meta:
        ordering = ["title"]
        db_table = "rwanga_projects_project"

    def __str__(self):
        return self.title


class Scene(BaseModel):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="scenes")
    number = models.PositiveIntegerField()
    title = models.CharField(max_length=255)
    summary = models.TextField(blank=True)
    script_text = models.TextField(blank=True)
    ordering = models.PositiveIntegerField(default=0)
    estimated_minutes = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    complexity_score = models.PositiveIntegerField(default=0)
    draft_status = models.CharField(max_length=20, default="draft")
    location_type = models.CharField(max_length=20, default="int")
    day_night = models.CharField(max_length=10, default="day")
    weather = models.CharField(max_length=20, default="clear")
    crowd_level = models.CharField(max_length=20, default="small")
    vfx_complexity = models.CharField(max_length=20, default="none")
    language = models.CharField(max_length=10, default="ckb")
    last_exported_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["project", "number", "ordering"]
        unique_together = ("project", "number")
        db_table = "rwanga_projects_scene"


class Character(BaseModel):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="characters")
    name = models.CharField(max_length=255)
    bio = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]
        db_table = "rwanga_projects_character"


class Location(BaseModel):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="locations")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]
        db_table = "rwanga_projects_location"
