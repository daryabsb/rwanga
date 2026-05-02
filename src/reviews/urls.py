from django.urls import path

from src.reviews.views import (
    ReviewCommentsTabView,
    ReviewCreateView,
    ReviewDecisionCommentView,
    ReviewDecisionCreateView,
    ReviewDecisionStatusView,
    ReviewDetailView,
    ReviewEvaluationsTabView,
    ReviewsIndexView,
    ReviewSetStatusView,
    SceneEvaluationCreateView,
    ReviewBibleTabView,
    ReviewDecisionsTabView,
    SceneCommentsPartialView,
)

app_name = "reviews"

urlpatterns = [
    path("", ReviewsIndexView.as_view(), name="list"),
    path("create/", ReviewCreateView.as_view(), name="create"),
    path("project/<uuid:project_pk>/", ReviewsIndexView.as_view(), name="project_list"),
    path("project/<uuid:project_pk>/", ReviewsIndexView.as_view(), name="index"),
    path("<uuid:pk>/", ReviewDetailView.as_view(), name="detail"),
    path("<uuid:pk>/<str:tab>/", ReviewDetailView.as_view(), name="tab"),
    path("<uuid:pk>/decisions/", ReviewDecisionsTabView.as_view(), name="decisions_tab"),
    path("<uuid:pk>/evaluations/", ReviewEvaluationsTabView.as_view(), name="evaluations_tab"),
    path("<uuid:pk>/comments/", ReviewCommentsTabView.as_view(), name="comments_tab"),
    path("<uuid:pk>/bible/", ReviewBibleTabView.as_view(), name="bible_tab"),
    path("<uuid:pk>/decisions/create/", ReviewDecisionCreateView.as_view(), name="decision_create"),
    path("<uuid:pk>/decisions/create/", ReviewDecisionCreateView.as_view(), name="create_decision"),
    path("<uuid:pk>/evaluations/create/", SceneEvaluationCreateView.as_view(), name="evaluation_create"),
    path("<uuid:pk>/evaluations/create/", SceneEvaluationCreateView.as_view(), name="create_evaluation"),
    path("<uuid:pk>/status/<str:status>/", ReviewSetStatusView.as_view(), name="set_status"),
    path("decisions/<uuid:pk>/<str:action>/", ReviewDecisionStatusView.as_view(), name="decision_action"),
    path("decisions/<uuid:pk>/lock/", ReviewDecisionStatusView.as_view(), {"action": "lock"}, name="lock_decision"),
    path("decisions/<uuid:pk>/reject/", ReviewDecisionStatusView.as_view(), {"action": "reject"}, name="reject_decision"),
    path("decisions/<uuid:pk>/repropose/", ReviewDecisionStatusView.as_view(), {"action": "repropose"}, name="repropose_decision"),
    path("decisions/<uuid:pk>/comment/", ReviewDecisionCommentView.as_view(), name="decision_comment"),
    path("<uuid:project_pk>/scenes/<uuid:scene_pk>/comments/", SceneCommentsPartialView.as_view(), name="scene_comments"),
]
