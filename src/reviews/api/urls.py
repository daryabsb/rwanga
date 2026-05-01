from django.urls import include, path
from rest_framework.routers import DefaultRouter

from src.reviews.api.views import BibleReviewViewSet, InlineCommentViewSet, ReviewDecisionViewSet, SceneEvaluationViewSet

router = DefaultRouter()
router.register("inline-comments", InlineCommentViewSet, basename="inline-comment")
router.register("bible-reviews", BibleReviewViewSet, basename="bible-review")
router.register("scene-evaluations", SceneEvaluationViewSet, basename="scene-evaluation")
router.register("review-decisions", ReviewDecisionViewSet, basename="review-decision")

urlpatterns = [
    path("", include(router.urls)),
]
