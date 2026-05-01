from django.db import models

from src.core.models import BaseModel


class Shot(BaseModel):
    class ShotType(models.TextChoices):
        DIALOGUE = "dialogue", "Dialogue"
        VISUAL = "visual", "Visual"
        INSERT = "insert", "Insert"

    scene = models.ForeignKey("projects.Scene", on_delete=models.CASCADE, related_name="shots")
    shot_number = models.CharField(max_length=20)
    shot_type = models.CharField(max_length=16, choices=ShotType.choices, default=ShotType.VISUAL)
    description = models.TextField(blank=True)
    lens = models.CharField(max_length=32, blank=True)
    movement = models.CharField(max_length=120, blank=True)
    duration = models.CharField(max_length=20, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["scene", "order", "shot_number"]

    @property
    def number(self):
        return self.shot_number

    @property
    def style(self):
        return self.description


class Setup(BaseModel):
    shot = models.ForeignKey(Shot, on_delete=models.CASCADE, related_name="setups")
    setup_letter = models.CharField(max_length=2)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["setup_letter"]

    @property
    def letter(self):
        return self.setup_letter


class StoryboardFrame(BaseModel):
    shot = models.ForeignKey(Shot, on_delete=models.CASCADE, related_name="storyboard_frames")
    image = models.ImageField(upload_to="shots/storyboards/", blank=True)
    order = models.PositiveIntegerField(default=0)
    ai_generated = models.BooleanField(default=False)

    class Meta:
        ordering = ["shot", "order"]
