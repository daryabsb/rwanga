from rest_framework import permissions, status, viewsets
from rest_framework.response import Response

from src.projects.api.serializers import (
    CharacterSerializer,
    LocationSerializer,
    ProjectSerializer,
    SceneSerializer,
)
from src.projects.services import ProjectsService


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ProjectsService.list_projects()

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()

    def perform_destroy(self, instance):
        ProjectsService.delete_project(instance)


class SceneViewSet(viewsets.ModelViewSet):
    serializer_class = SceneSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        project_id = self.kwargs.get("project_id") or self.request.query_params.get("project")
        return ProjectsService.list_scenes(project=project_id)

    def create(self, request, *args, **kwargs):
        project_id = self.kwargs.get("project_id")
        if project_id:
            data = request.data.copy()
            data["project"] = str(project_id)
            if "scene_number" in data and "number" not in data:
                data["number"] = data["scene_number"]
            if "heading" in data and "title" not in data:
                data["title"] = data["heading"]
            if "description" in data and "summary" not in data:
                data["summary"] = data["description"]
            if "page_count" in data and "estimated_minutes" not in data:
                data["estimated_minutes"] = data["page_count"]
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=self.get_success_headers(serializer.data))
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()

    def perform_destroy(self, instance):
        ProjectsService.delete_scene(instance)


class CharacterViewSet(viewsets.ModelViewSet):
    serializer_class = CharacterSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        project_id = self.kwargs.get("project_id") or self.request.query_params.get("project")
        return ProjectsService.list_characters(project=project_id)

    def create(self, request, *args, **kwargs):
        project_id = self.kwargs.get("project_id")
        if project_id:
            data = request.data.copy()
            data["project"] = str(project_id)
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=self.get_success_headers(serializer.data))
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()

    def perform_destroy(self, instance):
        ProjectsService.delete_character(instance)


class LocationViewSet(viewsets.ModelViewSet):
    serializer_class = LocationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        project_id = self.kwargs.get("project_id") or self.request.query_params.get("project")
        return ProjectsService.list_locations(project=project_id)

    def create(self, request, *args, **kwargs):
        project_id = self.kwargs.get("project_id")
        if project_id:
            data = request.data.copy()
            data["project"] = str(project_id)
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=self.get_success_headers(serializer.data))
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()

    def perform_destroy(self, instance):
        ProjectsService.delete_location(instance)
