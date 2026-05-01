import json
import uuid

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils.text import slugify

from src.accounts.models import ProjectMembership, Studio
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


class ProjectService:
    def __init__(self, user=None):
        self.user = user

    @transaction.atomic
    def create_project(
        self,
        *,
        title,
        title_latin="",
        project_type="feature",
        logline="",
        director_name="",
        studio=None,
    ) -> Project:
        studio = studio or self._get_or_create_studio()
        project = Project.objects.create(
            studio=studio,
            owner=self.user,
            title=title,
            slug=self._build_unique_slug(title),
            synopsis=logline or "",
            status="draft",
        )
        ProjectMembership.objects.get_or_create(
            user=self.user,
            project=project,
            defaults={
                "role_type": ProjectMembership.RoleType.CREW,
                "department_role": ProjectMembership.DepartmentRole.DIRECTOR,
                "is_active": True,
            },
        )
        self._merge_project_metadata(
            project,
            {
                "title_latin": title_latin or "",
                "project_type": project_type or "feature",
                "director_name": director_name or "",
            },
        )
        return project

    def update_project_modules(self, project: Project, modules: list[str]) -> Project:
        self._merge_project_metadata(project, {"modules": modules or []})
        return project

    def update_script_upload_metadata(self, project: Project, metadata: dict) -> Project:
        self._merge_project_metadata(project, {"script_upload": metadata})
        return project

    def update_team_invites(self, project: Project, invites: list[dict]) -> Project:
        self._merge_project_metadata(project, {"invites": invites})
        return project

    def _get_or_create_studio(self):
        if self.user is None:
            raise ValueError("ProjectService requires an authenticated user")

        owned = Project.objects.filter(owner=self.user).select_related("studio").first()
        if owned:
            return owned.studio

        member = (
            ProjectMembership.objects.filter(user=self.user)
            .select_related("project__studio")
            .first()
        )
        if member and member.project and member.project.studio:
            return member.project.studio

        base_name = self.user.get_full_name() or self.user.email
        name = f"{base_name}'s Studio"
        base_slug = slugify(base_name) or "studio"
        slug = base_slug
        while Studio.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{uuid.uuid4().hex[:6]}"
        return Studio.objects.create(name=name, slug=slug)

    def _build_unique_slug(self, title: str) -> str:
        base = slugify(title) or "project"
        slug = base
        while Project.objects.filter(slug=slug).exists():
            slug = f"{base}-{uuid.uuid4().hex[:6]}"
        return slug

    def _extract_metadata(self, synopsis: str) -> dict:
        marker = "\n\n[RWANGA_META]"
        if marker not in (synopsis or ""):
            return {}
        raw = synopsis.split(marker, 1)[1].strip()
        if not raw:
            return {}
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {}

    def _extract_logline(self, synopsis: str) -> str:
        marker = "\n\n[RWANGA_META]"
        if marker not in (synopsis or ""):
            return synopsis or ""
        return synopsis.split(marker, 1)[0]

    def _merge_project_metadata(self, project: Project, updates: dict) -> None:
        # Model drift workaround: Project lacks a JSON metadata field.
        # Persist metadata in a machine-readable trailer within synopsis.
        metadata = self._extract_metadata(project.synopsis)
        metadata.update(updates or {})
        logline = self._extract_logline(project.synopsis)
        project.synopsis = f"{logline}\n\n[RWANGA_META]\n{json.dumps(metadata, ensure_ascii=False)}"
        project.save(update_fields=["synopsis", "updated_at"])
