from django.db import models

from src.core.models import BaseModel


class FloorPlan(BaseModel):
    scene = models.ForeignKey("projects.Scene", on_delete=models.CASCADE, related_name="floor_plans")
    name = models.CharField(max_length=100, default="Primary")
    room_width = models.FloatField(default=8.0)
    room_height = models.FloatField(default=4.0)
    furniture = models.JSONField(default=list)
    cameras = models.JSONField(default=list)
    paths = models.JSONField(default=list)
    ai_generated = models.BooleanField(default=False)

    class Meta:
        ordering = ["scene", "name"]
