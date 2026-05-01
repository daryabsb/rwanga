from django.urls import include, path
from rest_framework.routers import DefaultRouter

from src.shots.api.views import SetupViewSet, ShotViewSet, StoryboardFrameViewSet

router = DefaultRouter()
router.register("shots", ShotViewSet, basename="shot")
router.register("setups", SetupViewSet, basename="setup")
router.register("storyboard-frames", StoryboardFrameViewSet, basename="storyboard-frame")

urlpatterns = [
    path("", include(router.urls)),
]
