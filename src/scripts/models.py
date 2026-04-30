from django.db import models

from src.core.models import BaseModel


class Script(BaseModel):
    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="scripts")
    title = models.CharField(max_length=255)
    content = models.TextField(blank=True)
    file = models.FileField(upload_to="scripts/files/", blank=True)
    script_format = models.CharField(max_length=32, default="plain")

    class Meta:
        ordering = ["-created_at"]


class ScriptElement(BaseModel):
    class ElementType(models.TextChoices):
        ACTION = "action", "Action"
        DIALOGUE = "dialogue", "Dialogue"
        HEADING = "heading", "Heading"
        CHARACTER = "character", "Character"
        TRANSITION = "transition", "Transition"
        PARENTHETICAL = "parenthetical", "Parenthetical"

    script = models.ForeignKey(Script, on_delete=models.CASCADE, related_name="elements")
    scene = models.ForeignKey("projects.Scene", on_delete=models.SET_NULL, null=True, blank=True, related_name="script_elements")
    character = models.ForeignKey("projects.Character", on_delete=models.SET_NULL, null=True, blank=True, related_name="script_elements")
    element_type = models.CharField(max_length=32, choices=ElementType.choices)
    content = models.TextField()
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "created_at"]
