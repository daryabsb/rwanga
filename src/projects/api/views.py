from rest_framework import permissions, viewsets

from src.projects.api.serializers import (
    CharacterSerializer,
    LocationSerializer,
    ProjectSerializer,
    SceneSerializer,
)
from src.projects.services import ProjectsService


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return ProjectsService.list_projects()

    def perform_create(self, serializer):
        serializer.instance = ProjectsService.create_project(**serializer.validated_data)

    def perform_update(self, serializer):
        serializer.instance = ProjectsService.update_project(
            serializer.instance,
            **serializer.validated_data,
        )

    def perform_destroy(self, instance):
        ProjectsService.delete_project(instance)


class SceneViewSet(viewsets.ModelViewSet):
    serializer_class = SceneSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return ProjectsService.list_scenes()

    def perform_create(self, serializer):
        serializer.instance = ProjectsService.create_scene(**serializer.validated_data)

    def perform_update(self, serializer):
        serializer.instance = ProjectsService.update_scene(
            serializer.instance,
            **serializer.validated_data,
        )

    def perform_destroy(self, instance):
        ProjectsService.delete_scene(instance)


class CharacterViewSet(viewsets.ModelViewSet):
    serializer_class = CharacterSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return ProjectsService.list_characters()

    def perform_create(self, serializer):
        serializer.instance = ProjectsService.create_character(**serializer.validated_data)

    def perform_update(self, serializer):
        serializer.instance = ProjectsService.update_character(
            serializer.instance,
            **serializer.validated_data,
        )

    def perform_destroy(self, instance):
        ProjectsService.delete_character(instance)


class LocationViewSet(viewsets.ModelViewSet):
    serializer_class = LocationSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return ProjectsService.list_locations()

    def perform_create(self, serializer):
        serializer.instance = ProjectsService.create_location(**serializer.validated_data)

    def perform_update(self, serializer):
        serializer.instance = ProjectsService.update_location(
            serializer.instance,
            **serializer.validated_data,
        )

    def perform_destroy(self, instance):
        ProjectsService.delete_location(instance)
