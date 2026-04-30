from rest_framework import permissions, viewsets

from src.scripts.api.serializers import ScriptElementSerializer, ScriptSerializer
from src.scripts.services import ScriptsService


class ScriptViewSet(viewsets.ModelViewSet):
    serializer_class = ScriptSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        project_id = self.kwargs.get("project_id") or self.request.query_params.get("project")
        return ScriptsService.list_scripts(project_id=project_id)

    def perform_create(self, serializer):
        serializer.instance = ScriptsService.create_script(**serializer.validated_data)

    def perform_update(self, serializer):
        serializer.instance = ScriptsService.update_script(serializer.instance, **serializer.validated_data)

    def perform_destroy(self, instance):
        ScriptsService.delete_script(instance)


class ScriptElementViewSet(viewsets.ModelViewSet):
    serializer_class = ScriptElementSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        project_id = self.kwargs.get("project_id")
        script_id = self.kwargs.get("script_id") or self.request.query_params.get("script")
        return ScriptsService.list_elements(project_id=project_id, script_id=script_id)

    def perform_create(self, serializer):
        serializer.instance = ScriptsService.create_element(**serializer.validated_data)

    def perform_update(self, serializer):
        serializer.instance = ScriptsService.update_element(serializer.instance, **serializer.validated_data)

    def perform_destroy(self, instance):
        ScriptsService.delete_element(instance)
