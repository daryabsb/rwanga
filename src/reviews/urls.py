from django.urls import path

from src.reviews.views import (
    ReviewCreateView,
    ReviewDecisionCommentView,
    ReviewDecisionCreateView,
    ReviewDecisionStatusView,
    ReviewDetailView,
    ReviewsIndexView,
    SceneEvaluationCreateView,
    SceneCommentsPartialView,
)

app_name = "reviews"

urlpatterns = [
    path("", ReviewsIndexView.as_view(), name="list"),
    path("create/", ReviewCreateView.as_view(), name="create"),
    path("project/<uuid:project_pk>/", ReviewsIndexView.as_view(), name="index"),
    path("<uuid:pk>/", ReviewDetailView.as_view(), name="detail"),
    path("<uuid:pk>/decisions/create/", ReviewDecisionCreateView.as_view(), name="decision_create"),
    path("<uuid:pk>/evaluations/create/", SceneEvaluationCreateView.as_view(), name="evaluation_create"),
    path("decisions/<uuid:pk>/<str:action>/", ReviewDecisionStatusView.as_view(), name="decision_action"),
    path("decisions/<uuid:pk>/comment/", ReviewDecisionCommentView.as_view(), name="decision_comment"),
    path("<uuid:project_pk>/scenes/<uuid:scene_pk>/comments/", SceneCommentsPartialView.as_view(), name="scene_comments"),
]
