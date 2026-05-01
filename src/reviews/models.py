from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models

from src.core.models import BaseModel


class InlineComment(BaseModel):
    class Visibility(models.TextChoices):
        TEAM = "team", "Team"
        CONSULTANT = "consultant", "Consultant"

    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.CharField(max_length=64)
    content_object = GenericForeignKey("content_type", "object_id")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="inline_comments")
    body = models.TextField()
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.CASCADE, related_name="replies")
    visibility = models.CharField(max_length=16, choices=Visibility.choices, default=Visibility.TEAM)
    resolved = models.BooleanField(default=False)


class BibleReview(BaseModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SUBMITTED = "submitted", "Submitted"
        APPROVED = "approved", "Approved"

    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="bible_reviews")
    author = models.ForeignKey("accounts.ConsultantProfile", on_delete=models.CASCADE, related_name="bible_reviews")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    version = models.PositiveIntegerField(default=1)
    content = models.JSONField(default=dict, blank=True)


class SceneEvaluation(BaseModel):
    bible_review = models.ForeignKey(BibleReview, on_delete=models.CASCADE, related_name="scene_evaluations")
    scene = models.ForeignKey("projects.Scene", on_delete=models.CASCADE, related_name="scene_evaluations")
    analysis = models.TextField(blank=True)
    tension_score = models.PositiveSmallIntegerField(default=0)
    notes = models.TextField(blank=True)
    recommendations = models.TextField(blank=True)


class ReviewDecision(BaseModel):
    class Status(models.TextChoices):
        PROPOSED = "proposed", "Proposed"
        LOCKED = "locked", "Locked"
        REJECTED = "rejected", "Rejected"

    bible_review = models.ForeignKey(BibleReview, on_delete=models.CASCADE, related_name="decisions")
    scene = models.ForeignKey("projects.Scene", null=True, blank=True, on_delete=models.SET_NULL, related_name="review_decisions")
    topic = models.CharField(max_length=255)
    decision_text = models.TextField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PROPOSED)
    proposed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="decisions_proposed")
    locked_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="decisions_locked")
    rejected_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="decisions_rejected")
