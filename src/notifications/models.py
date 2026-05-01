from django.conf import settings
from django.db import models

from src.core.models import BaseModel


class Notification(BaseModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    message = models.TextField()
    notification_type = models.CharField(max_length=32, default="info")
    read = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    @property
    def notif_type(self):
        return self.notification_type

    @property
    def is_read(self):
        return self.read

    @property
    def action_url(self):
        return ""
