import uuid

from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.utils import timezone


class BaseModel(models.Model):
    """Shared abstract base model for all Rwanga entities."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class SoftDeleteManager(models.Manager):
    """Default manager that hides soft-deleted records."""

    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)


class SoftDeleteModel(BaseModel):
    """Abstract base model supporting soft deletion."""

    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = SoftDeleteManager()
    all_objects = models.Manager()

    class Meta:
        abstract = True

    def soft_delete(self):
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(update_fields=["is_deleted", "deleted_at", "updated_at"])


class Version(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.UUIDField()
    target = GenericForeignKey("content_type", "object_id")
    version_number = models.PositiveIntegerField()
    snapshot_json = models.JSONField()
    actor_type = models.CharField(max_length=32, default="system")
    actor_id = models.UUIDField(null=True, blank=True)
    actor_name = models.CharField(max_length=128, blank=True)
    reason = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        unique_together = [("content_type", "object_id", "version_number")]
        indexes = [models.Index(fields=["content_type", "object_id"])]
        ordering = ["-version_number"]


class ProductionLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    studio = models.ForeignKey("accounts.Studio", on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    project = models.ForeignKey("projects.Project", on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    actor_type = models.CharField(
        max_length=32,
        choices=[("user", "user"), ("ai_agent", "ai_agent"), ("system", "system"), ("external_mcp", "external_mcp")],
        default="system",
    )
    actor_id = models.UUIDField(null=True, blank=True)
    actor_name = models.CharField(max_length=128, blank=True)
    event_type = models.CharField(max_length=64, db_index=True)
    target_type = models.CharField(max_length=64, blank=True)
    target_id = models.UUIDField(null=True, blank=True)
    payload = models.JSONField(default=dict)
    source_ip = models.GenericIPAddressField(null=True, blank=True)
    session_id = models.CharField(max_length=64, blank=True)
    visibility = models.CharField(
        max_length=16,
        choices=[("public", "public"), ("private", "private"), ("training_only", "training_only")],
        default="private",
    )

    class Meta:
        indexes = [
            models.Index(fields=["studio", "timestamp"]),
            models.Index(fields=["project", "timestamp"]),
            models.Index(fields=["actor_type", "timestamp"]),
        ]
        ordering = ["-timestamp"]
