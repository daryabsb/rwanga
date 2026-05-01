from django.urls import path

from src.progress.views import (
    ProgressAgentReportsView,
    ProgressChangelogView,
    ProgressDashboardView,
    ProgressDecisionsView,
    ProgressDiagramsView,
    ProgressDocsView,
    ProgressGapsView,
    ProgressTaskDetailView,
    ProgressTasksView,
    ProgressUpdatesView,
    stub_view,
)

app_name = "progress"

urlpatterns = [
    path("", ProgressDashboardView.as_view(), name="dashboard"),
    path("tasks/", ProgressTasksView.as_view(), name="tasks"),
    path("tasks/<uuid:task_id>/", ProgressTaskDetailView.as_view(), name="task_detail"),
    path("tasks/<uuid:task_id>/status-modal/", stub_view, name="update_task_status_modal"),
    path("updates/", ProgressUpdatesView.as_view(), name="updates"),
    path("gaps/", ProgressGapsView.as_view(), name="gaps"),
    path("decisions/", ProgressDecisionsView.as_view(), name="decisions"),
    path("agent-reports/", ProgressAgentReportsView.as_view(), name="agent_reports"),
    path("changelog/", ProgressChangelogView.as_view(), name="changelog"),
    path("diagrams/", ProgressDiagramsView.as_view(), name="diagrams"),
    path("docs/", ProgressDocsView.as_view(), name="docs"),
]
