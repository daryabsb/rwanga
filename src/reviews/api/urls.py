from django.urls import include, path
from rest_framework.routers import DefaultRouter

from src.reviews.api.views import (
    BibleReviewByProjectAPIView,
    BibleReviewDetailByProjectAPIView,
    BibleReviewViewSet,
    InlineCommentViewSet,
    ReviewDecisionByReviewAPIView,
    ReviewDecisionDetailByReviewAPIView,
    ReviewDecisionViewSet,
    SceneEvaluationViewSet,
)

router = DefaultRouter()
router.register("inline-comments", InlineCommentViewSet, basename="inline-comment")
router.register("bible-reviews", BibleReviewViewSet, basename="bible-review")
router.register("scene-evaluations", SceneEvaluationViewSet, basename="scene-evaluation")
router.register("review-decisions", ReviewDecisionViewSet, basename="review-decision")

urlpatterns = [
    path("bible/<uuid:project_id>/", BibleReviewByProjectAPIView.as_view(), name="bible-by-project"),
    path("bible/<uuid:project_id>/<uuid:id>/", BibleReviewDetailByProjectAPIView.as_view(), name="bible-detail-by-project"),
    path("decisions/<uuid:review_id>/", ReviewDecisionByReviewAPIView.as_view(), name="decisions-by-review"),
    path("decisions/<uuid:review_id>/<uuid:id>/", ReviewDecisionDetailByReviewAPIView.as_view(), name="decision-detail-by-review"),
    path("", include(router.urls)),
]
