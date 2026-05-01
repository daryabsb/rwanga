from django.db import models

from src.core.models import BaseModel


class LightingNote(BaseModel):
    shot = models.ForeignKey("shots.Shot", on_delete=models.CASCADE, related_name="lighting_notes")
    note = models.TextField()
    color_temp = models.CharField(max_length=20, blank=True)
    equipment = models.CharField(max_length=255, blank=True)


class SoundNote(BaseModel):
    shot = models.ForeignKey("shots.Shot", on_delete=models.CASCADE, related_name="sound_notes")
    note = models.TextField()
    sound_type = models.CharField(max_length=32, blank=True)


class Prop(BaseModel):
    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="props")
    scenes = models.ManyToManyField("projects.Scene", related_name="props", blank=True)
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=1, default="A")
    status = models.CharField(max_length=20, default="needed")
    notes = models.TextField(blank=True)
    image = models.ImageField(upload_to="departments/props/", blank=True)


class WardrobeItem(BaseModel):
    character = models.ForeignKey("projects.Character", on_delete=models.CASCADE, related_name="wardrobe_items")
    scene = models.ForeignKey("projects.Scene", on_delete=models.CASCADE, related_name="wardrobe_items")
    outfit_name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    image = models.ImageField(upload_to="departments/wardrobe/", blank=True)


class ContinuityItem(BaseModel):
    scene = models.ForeignKey("projects.Scene", on_delete=models.CASCADE, related_name="continuity_items")
    direction = models.CharField(max_length=3, choices=(("in", "In"), ("out", "Out")))
    description = models.TextField()
    checked = models.BooleanField(default=False)
