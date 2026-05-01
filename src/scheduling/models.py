from django.db import models

from src.core.models import BaseModel


class ShootDay(BaseModel):
    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="shoot_days")
    date = models.DateField()
    day_number = models.PositiveIntegerField()
    notes = models.TextField(blank=True)


class ScheduleBlock(BaseModel):
    shoot_day = models.ForeignKey(ShootDay, on_delete=models.CASCADE, related_name="blocks")
    scene = models.ForeignKey("projects.Scene", on_delete=models.SET_NULL, null=True, blank=True, related_name="schedule_blocks")
    order = models.PositiveIntegerField(default=0)
    time_start = models.TimeField(null=True, blank=True)
    duration = models.DurationField(null=True, blank=True)
    block_type = models.CharField(max_length=20, default="shoot")
    title = models.CharField(max_length=255)
    shots = models.ManyToManyField("shots.Shot", blank=True, related_name="schedule_blocks")
    notes = models.TextField(blank=True)


class CallSheet(BaseModel):
    shoot_day = models.OneToOneField(ShootDay, on_delete=models.CASCADE, related_name="call_sheet")
    general_call = models.TimeField(null=True, blank=True)
    location = models.ForeignKey("locations.Location", on_delete=models.SET_NULL, null=True, blank=True, related_name="call_sheets")
    weather_data = models.JSONField(default=dict, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    pdf = models.FileField(upload_to="scheduling/call_sheets/", blank=True)
