from django.conf import settings
from django.db import models

from src.core.models import BaseModel
from src.core.mixins import SoftDeleteModel, Versioned


class Project(SoftDeleteModel, Versioned, BaseModel):
    studio = models.ForeignKey("accounts.Studio", on_delete=models.CASCADE, related_name="projects")

    # Legacy field names — preserved during alias-and-add transition (controller's call)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="owned_projects")
    title = models.CharField(max_length=255)
    synopsis = models.TextField(blank=True)

    # v2 new fields (alongside legacy)
    name = models.CharField(max_length=255, blank=True)
    name_latin = models.CharField(max_length=255, blank=True, db_index=True)

    slug = models.SlugField(max_length=255)  # was unique=True, now uniqueness via UniqueConstraint(studio, slug)

    PROJECT_TYPE_CHOICES = [("feature", "Feature"), ("short", "Short")]
    project_type = models.CharField(max_length=16, choices=PROJECT_TYPE_CHOICES, default="feature")

    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("active", "Active"),
        ("in_production", "In Production"),
        ("wrap", "Wrap"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
        ("on_hold", "On Hold"),
    ]
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="draft", db_index=True)
    status_changed_at = models.DateTimeField(null=True, blank=True)
    status_changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_projects",
    )
    snapshot_on_delete = models.JSONField(null=True, blank=True)

    # Optional metadata (spec §2.3)
    logline = models.TextField(blank=True)
    language = models.CharField(max_length=8, blank=True)
    target_rating = models.CharField(max_length=16, blank=True)
    director_credit = models.CharField(max_length=255, blank=True)
    poster = models.ImageField(upload_to="projects/posters/", null=True, blank=True)
    estimated_shoot_start = models.DateField(null=True, blank=True)
    estimated_length_minutes = models.PositiveIntegerField(null=True, blank=True)
    ai_context_notes = models.TextField(blank=True)

    # Legacy bible-related fields preserved
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
        constraints = [
            models.UniqueConstraint(fields=["studio", "slug"], name="unique_project_slug_per_studio"),
        ]

    def __str__(self):
        return self.name or self.title  # Prefer new name, fall back to legacy title


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
