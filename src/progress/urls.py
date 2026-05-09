from django.urls import path

from src.progress import views
from src.progress.views import ProgressDashboardView

app_name = "progress"

urlpatterns = [
    path("", ProgressDashboardView.as_view(), name="dashboard"),
    path("tasks/", views.tasks_view, name="tasks"),
    path("tasks/<uuid:task_id>/", views.task_detail_view, name="task_detail"),
    path("updates/", views.updates_view, name="updates"),
    path("changelog/", views.changelog_view, name="changelog"),
    path("decisions/", views.decisions_view, name="decisions"),
    path("docs/", views.docs_view, name="docs"),
    path("docs/<uuid:doc_id>/", views.doc_detail_view, name="doc_detail"),
    path("gaps/", views.gaps_view, name="gaps"),
    path("diagrams/", views.diagrams_view, name="diagrams"),
    path("diagrams/<uuid:diagram_id>/", views.diagram_detail_view, name="diagram_detail"),
    path("agent-reports/", views.agent_reports_view, name="agent_reports"),
    path("tasks/<uuid:task_id>/update-status/", views.update_task_status_modal_view, name="update_task_status_modal"),
]
