from rest_framework import permissions, viewsets

from src.community.api.serializers import (
    ReviewSessionParticipantSerializer,
    ReviewSessionSerializer,
    SessionCommentSerializer,
    SessionContentSerializer,
    SessionReactionSerializer,
)
from src.community.models import ReviewSession, ReviewSessionParticipant, SessionComment, SessionContent, SessionReaction


class ReviewSessionViewSet(viewsets.ModelViewSet):
    queryset = ReviewSession.objects.all()
    serializer_class = ReviewSessionSerializer
    permission_classes = [permissions.IsAuthenticated]


class SessionContentViewSet(viewsets.ModelViewSet):
    queryset = SessionContent.objects.all()
    serializer_class = SessionContentSerializer
    permission_classes = [permissions.IsAuthenticated]


class ReviewSessionParticipantViewSet(viewsets.ModelViewSet):
    queryset = ReviewSessionParticipant.objects.all()
    serializer_class = ReviewSessionParticipantSerializer
    permission_classes = [permissions.IsAuthenticated]


class SessionCommentViewSet(viewsets.ModelViewSet):
    queryset = SessionComment.objects.all()
    serializer_class = SessionCommentSerializer
    permission_classes = [permissions.IsAuthenticated]


class SessionReactionViewSet(viewsets.ModelViewSet):
    queryset = SessionReaction.objects.all()
    serializer_class = SessionReactionSerializer
    permission_classes = [permissions.IsAuthenticated]
