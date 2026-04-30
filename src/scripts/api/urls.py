from django.urls import include, path
from rest_framework.routers import DefaultRouter

from src.scripts.api.views import ScriptElementViewSet, ScriptViewSet

router = DefaultRouter()
router.register("scripts", ScriptViewSet, basename="script")
router.register("elements", ScriptElementViewSet, basename="script-element")

urlpatterns = [
    path("", include(router.urls)),
    path("projects/<uuid:project_id>/scripts/", ScriptViewSet.as_view({"get": "list", "post": "create"}), name="project-scripts"),
    path(
        "projects/<uuid:project_id>/scripts/<uuid:pk>/",
        ScriptViewSet.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}),
        name="project-script-detail",
    ),
    path(
        "projects/<uuid:project_id>/scripts/<uuid:script_id>/elements/",
        ScriptElementViewSet.as_view({"get": "list", "post": "create"}),
        name="project-script-elements",
    ),
    path(
        "projects/<uuid:project_id>/scripts/<uuid:script_id>/elements/<uuid:pk>/",
        ScriptElementViewSet.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}),
        name="project-script-element-detail",
    ),
]
