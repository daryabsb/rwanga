from django.urls import include, path
from rest_framework.routers import DefaultRouter

from src.projects.api.views import CharacterViewSet, LocationViewSet, ProjectViewSet, SceneViewSet

router = DefaultRouter()
router.register("projects", ProjectViewSet, basename="project")
router.register("scenes", SceneViewSet, basename="scene")
router.register("characters", CharacterViewSet, basename="character")
router.register("locations", LocationViewSet, basename="location")

urlpatterns = [
    path("", include(router.urls)),
]
