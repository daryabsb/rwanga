from rest_framework import serializers

from src.projects.models import Character, Location, Project, Scene
from src.projects.services import ProjectService
from src.projects.services import ProjectsService


class ProjectSerializer(serializers.ModelSerializer):
    title_latin = serializers.CharField(required=False, allow_blank=True, write_only=True)
    project_type = serializers.CharField(required=False, allow_blank=True, write_only=True)
    logline = serializers.CharField(required=False, allow_blank=True, write_only=True)
    director_name = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = Project
        fields = [
            "id",
            "studio",
            "owner",
            "title",
            "slug",
            "synopsis",
            "status",
            "canonical_bible",
            "bible_version",
            "bible_status",
            "bible_finalized_at",
            "bible_finalized_by",
            "created_at",
            "updated_at",
            "title_latin",
            "project_type",
            "logline",
            "director_name",
        ]
        read_only_fields = []

    def create(self, validated_data):
        request = self.context.get("request")
        if request and getattr(request, "user", None) and request.user.is_authenticated:
            service = ProjectService(user=request.user)
            return service.create_project(
                title=validated_data["title"],
                title_latin=validated_data.get("title_latin", ""),
                project_type=validated_data.get("project_type", "feature"),
                logline=validated_data.get("logline", ""),
                director_name=validated_data.get("director_name", ""),
            )

        for key in ["title_latin", "project_type", "logline", "director_name"]:
            validated_data.pop(key, None)
        return ProjectsService.create_project(**validated_data)

    def update(self, instance, validated_data):
        service = ProjectService(user=self.context.get("request").user if self.context.get("request") else None)
        if "title" in validated_data:
            instance.title = validated_data["title"]
        if "status" in validated_data:
            instance.status = validated_data["status"]
        if "logline" in validated_data:
            instance.synopsis = validated_data["logline"]
        instance.save(update_fields=["title", "status", "synopsis", "updated_at"])
        service._merge_project_metadata(
            instance,
            {
                "title_latin": validated_data.get("title_latin"),
                "project_type": validated_data.get("project_type"),
                "director_name": validated_data.get("director_name"),
            },
        )
        return instance


class SceneSerializer(serializers.ModelSerializer):
    project = serializers.PrimaryKeyRelatedField(queryset=Project.objects.all(), required=False)

    class Meta:
        model = Scene
        fields = "__all__"
        extra_kwargs = {"project": {"required": False}}

    def to_internal_value(self, data):
        mutable = dict(data)
        if "scene_number" in mutable and "number" not in mutable:
            mutable["number"] = mutable["scene_number"]
        if "heading" in mutable and "title" not in mutable:
            mutable["title"] = mutable["heading"]
        if "description" in mutable and "summary" not in mutable:
            mutable["summary"] = mutable["description"]
        if "page_count" in mutable and "estimated_minutes" not in mutable:
            mutable["estimated_minutes"] = mutable["page_count"]
        return super().to_internal_value(mutable)

    def create(self, validated_data):
        meta = {}
        for key in ["int_ext", "location_name", "time_of_day", "page_count"]:
            if key in self.initial_data:
                meta[key] = self.initial_data.get(key)
        scene = super().create(validated_data)
        if meta:
            scene.metadata = {**(scene.metadata or {}), **meta}
            scene.save(update_fields=["metadata", "updated_at"])
        return scene

    def update(self, instance, validated_data):
        meta = {}
        for key in ["int_ext", "location_name", "time_of_day", "page_count"]:
            if key in self.initial_data:
                meta[key] = self.initial_data.get(key)
        scene = super().update(instance, validated_data)
        if meta:
            scene.metadata = {**(scene.metadata or {}), **meta}
            scene.save(update_fields=["metadata", "updated_at"])
        return scene


class CharacterSerializer(serializers.ModelSerializer):
    project = serializers.PrimaryKeyRelatedField(queryset=Project.objects.all(), required=False)
    name_latin = serializers.CharField(required=False, allow_blank=True, write_only=True)
    description = serializers.CharField(source="bio", required=False, allow_blank=True)
    character_type = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = Character
        fields = "__all__"
        extra_kwargs = {"project": {"required": False}}

    def create(self, validated_data):
        validated_data.pop("name_latin", None)
        validated_data.pop("character_type", None)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop("name_latin", None)
        validated_data.pop("character_type", None)
        return super().update(instance, validated_data)


class LocationSerializer(serializers.ModelSerializer):
    project = serializers.PrimaryKeyRelatedField(queryset=Project.objects.all(), required=False)
    name_latin = serializers.CharField(required=False, allow_blank=True, write_only=True)
    int_ext = serializers.CharField(required=False, allow_blank=True, write_only=True)
    address = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = Location
        fields = "__all__"
        extra_kwargs = {"project": {"required": False}}

    def create(self, validated_data):
        validated_data.pop("name_latin", None)
        validated_data.pop("int_ext", None)
        validated_data.pop("address", None)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop("name_latin", None)
        validated_data.pop("int_ext", None)
        validated_data.pop("address", None)
        return super().update(instance, validated_data)
