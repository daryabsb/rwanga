import uuid

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
