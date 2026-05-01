from django.conf import settings
from django.db import models

from src.core.models import BaseModel


class ReviewSession(BaseModel):
    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="review_sessions")
    title = models.CharField(max_length=255)
    session_type = models.CharField(max_length=32, default="community")
    status = models.CharField(max_length=20, default="draft")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="created_review_sessions")
    visibility = models.CharField(max_length=20, default="private")


class SessionContent(BaseModel):
    session = models.ForeignKey(ReviewSession, on_delete=models.CASCADE, related_name="contents")
    content_type = models.CharField(max_length=50)
    content_data = models.JSONField(default=dict, blank=True)
    label = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)
    version = models.PositiveIntegerField(default=1)


class ReviewSessionParticipant(BaseModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="review_session_participations")
    session = models.ForeignKey(ReviewSession, on_delete=models.CASCADE, related_name="participants")
    role = models.CharField(max_length=32, default="reviewer")
    invited_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="session_invites_sent")
    invited_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)


class SessionComment(BaseModel):
    session_content = models.ForeignKey(SessionContent, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="session_comments")
    anchor_type = models.CharField(max_length=32, blank=True)
    anchor_ref = models.CharField(max_length=255, blank=True)
    body = models.TextField()
    parent = models.ForeignKey("self", on_delete=models.CASCADE, null=True, blank=True, related_name="replies")


class SessionReaction(BaseModel):
    comment = models.ForeignKey(SessionComment, on_delete=models.CASCADE, related_name="reactions")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="session_reactions")
    reaction_type = models.CharField(max_length=20, default="like")
