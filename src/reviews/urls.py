from django.urls import path

from src.reviews.views import ReviewsIndexView, SceneCommentsPartialView

app_name = "reviews"

urlpatterns = [
    path("<uuid:project_pk>/", ReviewsIndexView.as_view(), name="index"),
    path("<uuid:project_pk>/scenes/<uuid:scene_pk>/comments/", SceneCommentsPartialView.as_view(), name="scene_comments"),
]
