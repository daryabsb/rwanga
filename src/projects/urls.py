from django.urls import path

from src.projects.views import (
    ProjectCreateStepView,
    ProjectCreateWizardView,
    ProjectDashboardView,
    ProjectListView,
    ProjectSceneListPartialView,
    ProjectSceneTabView,
    ProjectSceneView,
    ProjectSettingsView,
)

app_name = "projects"

urlpatterns = [
    path("", ProjectListView.as_view(), name="list"),
    path("create/", ProjectCreateWizardView.as_view(), name="create_wizard"),
    path("create/step/<int:step>/", ProjectCreateStepView.as_view(), name="create_step"),
    path("<uuid:pk>/", ProjectDashboardView.as_view(), name="dashboard"),
    path("<uuid:pk>/workspace/", ProjectDashboardView.as_view(), name="workspace"),
    path("<uuid:pk>/settings/", ProjectSettingsView.as_view(), name="settings"),
    path("<uuid:pk>/scenes/", ProjectSceneListPartialView.as_view(), name="scene_list"),
    path("<uuid:pk>/scenes/", ProjectSceneListPartialView.as_view(), name="scene_list_partial"),
    path("<uuid:pk>/scenes/<uuid:scene_pk>/", ProjectSceneView.as_view(), name="scene"),
    path("<uuid:pk>/scenes/<uuid:scene_pk>/<str:tab>/", ProjectSceneTabView.as_view(), name="scene_tab"),
]
