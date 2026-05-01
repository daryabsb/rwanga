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
