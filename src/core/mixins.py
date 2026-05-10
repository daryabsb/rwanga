from datetime import timedelta
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
