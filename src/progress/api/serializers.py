from rest_framework import serializers

from src.progress.models import (
    AgentReport,
    ChangeRecord,
    DesignDecision,
    GapBlocker,
    ProgressTask,
    ProgressUpdate,
    SystemDiagram,
)


class ProgressTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProgressTask
        fields = "__all__"


class ProgressUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProgressUpdate
        fields = "__all__"


class GapBlockerSerializer(serializers.ModelSerializer):
    class Meta:
        model = GapBlocker
        fields = "__all__"


class AgentReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentReport
        fields = "__all__"


class ChangeRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChangeRecord
        fields = "__all__"


class DesignDecisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DesignDecision
        fields = "__all__"


class SystemDiagramSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemDiagram
        fields = "__all__"
