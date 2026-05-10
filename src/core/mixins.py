from datetime import timedelta
from django.contrib.contenttypes.fields import GenericRelation
from django.db import models
from django.utils import timezone


class SoftDeleteQuerySet(models.QuerySet):
    def alive(self):
        return self.filter(deleted_at__isnull=True)

    def dead(self):
        return self.filter(deleted_at__isnull=False)


class SoftDeleteManager(models.Manager):
    def get_queryset(self):
        return SoftDeleteQuerySet(self.model, using=self._db).alive()


class SoftDeleteAllManager(models.Manager):
    def get_queryset(self):
        return SoftDeleteQuerySet(self.model, using=self._db)


class SoftDeleteModel(models.Model):
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)
    deleted_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="+",
    )
    recovery_grace_until = models.DateTimeField(null=True, blank=True)

    objects = SoftDeleteManager()
    all_with_deleted = SoftDeleteAllManager()

    GRACE_DAYS = 30

    class Meta:
        abstract = True

    def soft_delete(self, by_user=None):
        now = timezone.now()
        self.deleted_at = now
        self.deleted_by = by_user
        self.recovery_grace_until = now + timedelta(days=self.GRACE_DAYS)
        self.save(update_fields=["deleted_at", "deleted_by", "recovery_grace_until"])

    def restore(self):
        self.deleted_at = None
        self.deleted_by = None
        self.recovery_grace_until = None
        self.save(update_fields=["deleted_at", "deleted_by", "recovery_grace_until"])


class Versioned(models.Model):
    versions = GenericRelation("core.Version", related_query_name="versions")

    class Meta:
        abstract = True

    def _snapshot_fields(self):
        return {
            f.name: getattr(self, f.name)
            for f in self._meta.fields
            if not f.is_relation or f.many_to_one
        }

    def save(self, *args, actor=None, reason="", **kwargs):
        super().save(*args, **kwargs)
        from src.core.models import Version
        from django.contrib.contenttypes.models import ContentType
        ct = ContentType.objects.get_for_model(self.__class__)
        last = Version.objects.filter(content_type=ct, object_id=self.id).first()
        version_number = (last.version_number + 1) if last else 1
        Version.objects.create(
            content_type=ct,
            object_id=self.id,
            version_number=version_number,
            snapshot_json={k: str(v) if v is not None else None for k, v in self._snapshot_fields().items()},
            actor_type="user" if actor else "system",
            actor_id=actor.id if actor else None,
            actor_name=actor.email if actor else "",
            reason=reason,
        )

    def revert_to(self, version_number):
        from src.core.models import Version
        from django.contrib.contenttypes.models import ContentType
        ct = ContentType.objects.get_for_model(self.__class__)
        v = Version.objects.get(content_type=ct, object_id=self.id, version_number=version_number)
        for k, val in v.snapshot_json.items():
            if hasattr(self, k) and not k.endswith("_id") and k != "id":
                setattr(self, k, val)
        self.save(reason=f"reverted to version {version_number}")
