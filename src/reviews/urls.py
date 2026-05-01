from django.urls import path

from src.reviews.views import (
    ReviewDecisionCommentView,
    ReviewDecisionStatusView,
    ReviewDetailView,
    ReviewsIndexView,
    SceneCommentsPartialView,
)

app_name = "reviews"

urlpatterns = [
    path("", ReviewsIndexView.as_view(), name="list"),
    path("project/<uuid:project_pk>/", ReviewsIndexView.as_view(), name="index"),
    path("<uuid:pk>/", ReviewDetailView.as_view(), name="detail"),
    path("decisions/<uuid:pk>/<str:action>/", ReviewDecisionStatusView.as_view(), name="decision_action"),
    path("decisions/<uuid:pk>/comment/", ReviewDecisionCommentView.as_view(), name="decision_comment"),
    path("<uuid:project_pk>/scenes/<uuid:scene_pk>/comments/", SceneCommentsPartialView.as_view(), name="scene_comments"),
]
