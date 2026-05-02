from django.urls import include, path
from rest_framework.routers import DefaultRouter

from src.community.api.views import (
    CommunityCommentReactAPIView,
    CommunityInviteAPIView,
    CommunitySessionByProjectAPIView,
    CommunitySessionCommentsAPIView,
    CommunitySessionDetailByProjectAPIView,
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
    path("sessions/<uuid:project_id>/", CommunitySessionByProjectAPIView.as_view(), name="sessions-by-project"),
    path("sessions/<uuid:project_id>/<uuid:id>/", CommunitySessionDetailByProjectAPIView.as_view(), name="session-detail-by-project"),
    path("sessions/<uuid:id>/invite/", CommunityInviteAPIView.as_view(), name="session-invite"),
    path("sessions/<uuid:id>/comments/", CommunitySessionCommentsAPIView.as_view(), name="session-comments"),
    path("sessions/<uuid:id>/comments/<uuid:comment_id>/react/", CommunityCommentReactAPIView.as_view(), name="session-react"),
    path("", include(router.urls)),
]
