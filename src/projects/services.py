from django.shortcuts import get_object_or_404

from src.projects.models import Character, Location, Project, Scene


class ProjectsService:
    @staticmethod
    def list_projects():
        return Project.objects.select_related("studio", "owner").all()

    @staticmethod
    def get_project(project_id):
        return get_object_or_404(Project.objects.select_related("studio", "owner"), id=project_id)

    @staticmethod
    def create_project(**kwargs):
        return Project.objects.create(**kwargs)

    @staticmethod
    def update_project(instance, **kwargs):
        for field, value in kwargs.items():
            setattr(instance, field, value)
        instance.save()
        return instance

    @staticmethod
    def delete_project(instance):
        instance.delete()

    @staticmethod
    def list_scenes(project=None):
        queryset = Scene.objects.select_related("project").all()
        if project is not None:
            queryset = queryset.filter(project=project)
        return queryset.order_by("number", "ordering")

    @staticmethod
    def get_scene(scene_id):
        return get_object_or_404(Scene.objects.select_related("project"), id=scene_id)

    @staticmethod
    def create_scene(**kwargs):
        return Scene.objects.create(**kwargs)

    @staticmethod
    def update_scene(instance, **kwargs):
        for field, value in kwargs.items():
            setattr(instance, field, value)
        instance.save()
        return instance

    @staticmethod
    def delete_scene(instance):
        instance.delete()

    @staticmethod
    def list_characters(project=None):
        queryset = Character.objects.select_related("project").all()
        if project is not None:
            queryset = queryset.filter(project=project)
        return queryset.order_by("name")

    @staticmethod
    def get_character(character_id):
        return get_object_or_404(Character.objects.select_related("project"), id=character_id)

    @staticmethod
    def create_character(**kwargs):
        return Character.objects.create(**kwargs)

    @staticmethod
    def update_character(instance, **kwargs):
        for field, value in kwargs.items():
            setattr(instance, field, value)
        instance.save()
        return instance

    @staticmethod
    def delete_character(instance):
        instance.delete()

    @staticmethod
    def list_locations(project=None):
        queryset = Location.objects.select_related("project").all()
        if project is not None:
            queryset = queryset.filter(project=project)
        return queryset.order_by("name")

    @staticmethod
    def get_location(location_id):
        return get_object_or_404(Location.objects.select_related("project"), id=location_id)

    @staticmethod
    def create_location(**kwargs):
        return Location.objects.create(**kwargs)

    @staticmethod
    def update_location(instance, **kwargs):
        for field, value in kwargs.items():
            setattr(instance, field, value)
        instance.save()
        return instance

    @staticmethod
    def delete_location(instance):
        instance.delete()
