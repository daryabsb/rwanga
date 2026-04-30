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
    path("projects/<uuid:project_id>/scenes/", SceneViewSet.as_view({"get": "list", "post": "create"}), name="project-scenes"),
    path(
        "projects/<uuid:project_id>/scenes/<uuid:pk>/",
        SceneViewSet.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}),
        name="project-scene-detail",
    ),
    path("projects/<uuid:project_id>/characters/", CharacterViewSet.as_view({"get": "list", "post": "create"}), name="project-characters"),
    path(
        "projects/<uuid:project_id>/characters/<uuid:pk>/",
        CharacterViewSet.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}),
        name="project-character-detail",
    ),
    path("projects/<uuid:project_id>/locations/", LocationViewSet.as_view({"get": "list", "post": "create"}), name="project-locations"),
    path(
        "projects/<uuid:project_id>/locations/<uuid:pk>/",
        LocationViewSet.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}),
        name="project-location-detail",
    ),
]
