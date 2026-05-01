from django.db import models

from src.core.models import BaseModel


class Location(BaseModel):
    name = models.CharField(max_length=255)
    address = models.CharField(max_length=255, blank=True)
    gps_lat = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    gps_lng = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    notes = models.TextField(blank=True)
    images = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["name"]
