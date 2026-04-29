from django.urls import include, path
from rest_framework.routers import DefaultRouter

from src.progress.api.views import (
    AgentReportViewSet,
    ChangeRecordViewSet,
    DesignDecisionViewSet,
    GapBlockerViewSet,
    ProgressTaskViewSet,
    ProgressUpdateViewSet,
    SystemDiagramViewSet,
)

router = DefaultRouter()
router.register("tasks", ProgressTaskViewSet, basename="progress-task")
router.register("updates", ProgressUpdateViewSet, basename="progress-update")
router.register("gaps", GapBlockerViewSet, basename="progress-gap")
router.register("agent-reports", AgentReportViewSet, basename="progress-agent-report")
router.register("changes", ChangeRecordViewSet, basename="progress-change")
router.register("decisions", DesignDecisionViewSet, basename="progress-decision")
router.register("diagrams", SystemDiagramViewSet, basename="progress-diagram")

urlpatterns = [
    path("", include(router.urls)),
]
