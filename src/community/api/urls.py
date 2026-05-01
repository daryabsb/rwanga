from django.urls import include, path
from rest_framework.routers import DefaultRouter

from src.community.api.views import (
    ReviewSessionParticipantViewSet,
    ReviewSessionViewSet,
    SessionCommentViewSet,
    SessionContentViewSet,
    SessionReactionViewSet,
)

router = DefaultRouter()
router.register("sessions", ReviewSessionViewSet, basename="community-session")
router.register("contents", SessionContentViewSet, basename="community-content")
router.register("participants", ReviewSessionParticipantViewSet, basename="community-participant")
router.register("comments", SessionCommentViewSet, basename="community-comment")
router.register("reactions", SessionReactionViewSet, basename="community-reaction")

urlpatterns = [
    path("", include(router.urls)),
]
