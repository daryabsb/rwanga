from django.shortcuts import get_object_or_404
from django.utils.text import slugify

from src.accounts.models import Studio
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

    @staticmethod
    def _canonical_meta(project):
        canonical = project.canonical_bible if isinstance(project.canonical_bible, dict) else {}
        if "project_meta" not in canonical or not isinstance(canonical.get("project_meta"), dict):
            canonical["project_meta"] = {}
        return canonical

    @staticmethod
    def _ensure_unique_slug(base_slug):
        slug = (base_slug or "project").strip("-") or "project"
        candidate = slug
        idx = 2
        while Project.objects.filter(slug=candidate).exists():
            candidate = f"{slug}-{idx}"
            idx += 1
        return candidate

    def _resolve_studio(self):
        studio = Studio.objects.order_by("created_at").first()
        if studio:
            return studio
        return Studio.objects.create(name="Default Studio", slug="default-studio")

    def create_project(self, title, title_latin="", project_type="feature", logline="", director_name=""):
        owner = self.user
        if owner is None or not getattr(owner, "is_authenticated", False):
            raise ValueError("Authenticated user is required to create a project with ProjectService.")

        slug = self._ensure_unique_slug(slugify(title))
        project = Project.objects.create(
            studio=self._resolve_studio(),
            owner=owner,
            title=title,
            slug=slug,
            synopsis=logline or "",
            status="draft",
        )
        self._merge_project_metadata(
            project,
            {
                "title_latin": title_latin,
                "project_type": project_type,
                "director_name": director_name,
                "logline": logline,
            },
        )
        return project

    def _merge_project_metadata(self, project, metadata):
        canonical = self._canonical_meta(project)
        project_meta = canonical["project_meta"]
        for key, value in (metadata or {}).items():
            if value is not None:
                project_meta[key] = value
        canonical["project_meta"] = project_meta
        project.canonical_bible = canonical
        project.save(update_fields=["canonical_bible", "updated_at"])
        return project

    def update_script_upload_metadata(self, project, payload):
        return self._merge_project_metadata(project, {"script_upload": payload or {}})

    def update_project_modules(self, project, modules):
        return self._merge_project_metadata(project, {"modules": list(modules or [])})

    def update_team_invites(self, project, invites):
        return self._merge_project_metadata(project, {"team_invites": list(invites or [])})
