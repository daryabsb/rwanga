from rest_framework import permissions, viewsets

from src.progress.api.serializers import (
    AgentReportSerializer,
    ChangeRecordSerializer,
    DesignDecisionSerializer,
    GapBlockerSerializer,
    ProgressTaskSerializer,
    ProgressUpdateSerializer,
    SystemDiagramSerializer,
)
from src.progress.models import (
    AgentReport,
    ChangeRecord,
    DesignDecision,
    GapBlocker,
    ProgressTask,
    ProgressUpdate,
    SystemDiagram,
)


class ProgressTaskViewSet(viewsets.ModelViewSet):
    queryset = ProgressTask.objects.all()
    serializer_class = ProgressTaskSerializer
    permission_classes = [permissions.AllowAny]


class ProgressUpdateViewSet(viewsets.ModelViewSet):
    queryset = ProgressUpdate.objects.all()
    serializer_class = ProgressUpdateSerializer
    permission_classes = [permissions.AllowAny]


class GapBlockerViewSet(viewsets.ModelViewSet):
    queryset = GapBlocker.objects.all()
    serializer_class = GapBlockerSerializer
    permission_classes = [permissions.AllowAny]


class AgentReportViewSet(viewsets.ModelViewSet):
    queryset = AgentReport.objects.all()
    serializer_class = AgentReportSerializer
    permission_classes = [permissions.AllowAny]


class ChangeRecordViewSet(viewsets.ModelViewSet):
    queryset = ChangeRecord.objects.all()
    serializer_class = ChangeRecordSerializer
    permission_classes = [permissions.AllowAny]


class DesignDecisionViewSet(viewsets.ModelViewSet):
    queryset = DesignDecision.objects.all()
    serializer_class = DesignDecisionSerializer
    permission_classes = [permissions.AllowAny]


class SystemDiagramViewSet(viewsets.ModelViewSet):
    queryset = SystemDiagram.objects.all()
    serializer_class = SystemDiagramSerializer
    permission_classes = [permissions.AllowAny]
