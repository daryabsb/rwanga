from django.urls import path

from src.projects.views import ProjectSceneListView, ProjectsDashboardView, ProjectWorkspaceView

app_name = "projects"

urlpatterns = [
    path("", ProjectsDashboardView.as_view(), name="dashboard"),
    path("<uuid:project_id>/", ProjectWorkspaceView.as_view(), name="workspace"),
    path("<uuid:project_id>/scenes/", ProjectSceneListView.as_view(), name="scene-list"),
]
