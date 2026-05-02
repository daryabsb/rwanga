from django.db import models

from src.core.models import BaseModel


class Location(BaseModel):
    class IntExt(models.TextChoices):
        INT = "INT", "INT"
        EXT = "EXT", "EXT"

    class TimeOfDay(models.TextChoices):
        DAY = "DAY", "DAY"
        NIGHT = "NIGHT", "NIGHT"
        DAWN = "DAWN", "DAWN"
        DUSK = "DUSK", "DUSK"

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    address = models.CharField(max_length=255, blank=True)
    int_ext = models.CharField(max_length=8, choices=IntExt.choices, default=IntExt.INT)
    time_of_day = models.CharField(max_length=8, choices=TimeOfDay.choices, default=TimeOfDay.DAY)
    gps_lat = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    gps_lng = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    notes = models.TextField(blank=True)
    images = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["name"]

    @property
    def latitude(self):
        return self.gps_lat

    @property
    def longitude(self):
        return self.gps_lng

    @property
    def projects_count(self):
        return 0
