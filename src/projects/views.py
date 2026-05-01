from django.http import HttpResponse, HttpResponseRedirect
from django.shortcuts import get_object_or_404, render
from django.urls import reverse
from django.views import View

from src.accounts.models import ProjectMembership
from src.projects.forms import ModuleSelectionForm, ProjectBasicsForm, ScriptUploadForm, TeamInviteForm
from src.projects.models import Project, Scene
from src.projects.services import ProjectService


class ProjectListView(View):
    def get(self, request):
        if request.user.is_authenticated:
            owned_projects = (
                Project.objects.filter(owner=request.user)
                .select_related("studio", "owner")
                .order_by("title")
            )
            member_projects = (
                Project.objects.filter(memberships__user=request.user, memberships__is_active=True)
                .exclude(owner=request.user)
                .select_related("studio", "owner")
                .distinct()
                .order_by("title")
            )
            invitations = (
                ProjectMembership.objects.filter(
                    user=request.user,
                    is_active=True,
                    accepted_at__isnull=True,
                )
                .exclude(project__owner=request.user)
                .exclude(project__memberships__user=request.user, project__memberships__accepted_at__isnull=False)
                .select_related("project", "project__studio")
                .order_by("-created_at")
            )
        else:
            owned_projects = Project.objects.none()
            member_projects = Project.objects.none()
            invitations = ProjectMembership.objects.none()
        return render(
            request,
            "projects/list.html",
            {
                "owned_projects": owned_projects,
                "member_projects": member_projects,
                "invitations": invitations,
                "active_project": None,
                "active_section": "h",
            },
        )


class ProjectCreateWizardView(View):
    @staticmethod
    def get_wizard_steps():
        return [
            {"num": 1, "label": "بنەڕەتەکان"},
            {"num": 2, "label": "دەستنووس"},
            {"num": 3, "label": "مۆدیولەکان"},
            {"num": 4, "label": "تیم"},
        ]

    @staticmethod
    def get_available_modules():
        return [
            {"key": "scripts", "icon": "📄", "name": "دەستنووس", "desc": "بارکردن و داڕشتنی دەستنووس", "required": True, "default": True, "ai": True, "rwanga": False},
            {"key": "shots", "icon": "🎬", "name": "شۆتەکان", "desc": "لیستی شۆت و ستۆریبۆرد", "required": False, "default": True, "ai": False, "rwanga": False},
            {"key": "floorplans", "icon": "📐", "name": "پلانەکانی زەوی", "desc": "نەخشەی لۆکەیشن و کامێرا", "required": False, "default": True, "ai": True, "rwanga": True},
            {"key": "scheduling", "icon": "📅", "name": "خشتەبەندی", "desc": "ڕۆژانی وێنەگرتن و کۆڵشیت", "required": False, "default": False, "ai": False, "rwanga": False},
            {"key": "departments", "icon": "🏷", "name": "بەشەکان", "desc": "ڕووناکی، دەنگ، جلوبەرگ، کەلوپەل", "required": False, "default": False, "ai": False, "rwanga": False},
            {"key": "ai_engine", "icon": "🤖", "name": "AI ئێنجین", "desc": "داڕشتنی خۆکار و پێشنیاری AI", "required": False, "default": False, "ai": True, "rwanga": True},
        ]

    def _render_wizard(self, request, *, step, project=None):
        return render(
            request,
            "projects/create_wizard.html",
            {
                "step": step,
                "project": project,
                "active_project": project,
                "wizard_steps": self.get_wizard_steps(),
                "available_modules": self.get_available_modules(),
            },
        )

    def get(self, request):
        step = int(request.GET.get("step", 1))
        project_id = request.GET.get("project")
        if not project_id:
            project_id = request.session.get("wizard_project_id")
        project = Project.objects.filter(id=project_id).first() if project_id else None
        return self._render_wizard(request, step=step, project=project)


class ProjectCreateStepView(View):
    @staticmethod
    def _to_bool(value):
        if isinstance(value, bool):
            return value
        if value is None:
            return False
        return str(value).lower() in {"1", "true", "yes", "on"}

    def _render(self, request, *, step, project):
        return ProjectCreateWizardView()._render_wizard(request, step=step, project=project)

    def post(self, request, step):
        if not request.user.is_authenticated:
            return HttpResponseRedirect(reverse("accounts:login"))
        service = ProjectService(user=request.user)

        if step == 1:
            form = ProjectBasicsForm(request.POST)
            if not form.is_valid():
                return self._render(request, step=1, project=None)
            project = service.create_project(
                title=form.cleaned_data["title"],
                title_latin=form.cleaned_data.get("title_latin", ""),
                project_type=form.cleaned_data.get("project_type", "feature"),
                logline=form.cleaned_data.get("logline", ""),
                director_name=form.cleaned_data.get("director_name", ""),
            )
            request.session["wizard_project_id"] = str(project.pk)
            return self._render(request, step=2, project=project)

        if step == 2:
            form = ScriptUploadForm(request.POST, request.FILES)
            if not form.is_valid():
                project_id = request.POST.get("project_id") or request.session.get("wizard_project_id")
                project = Project.objects.filter(id=project_id).first() if project_id else None
                return self._render(request, step=2, project=project)
            project = get_object_or_404(Project, id=form.cleaned_data["project_id"])
            skip = self._to_bool(request.POST.get("skip")) or form.cleaned_data.get("skip", False)
            if skip:
                service.update_script_upload_metadata(project, {"skipped": True})
            elif request.FILES.get("script_file"):
                uploaded = request.FILES["script_file"]
                service.update_script_upload_metadata(
                    project,
                    {
                        "skipped": False,
                        "filename": uploaded.name,
                        "size": uploaded.size,
                        "content_type": uploaded.content_type,
                    },
                )
            return self._render(request, step=3, project=project)

        if step == 3:
            form = ModuleSelectionForm(request.POST)
            if not form.is_valid():
                project_id = request.POST.get("project_id") or request.session.get("wizard_project_id")
                project = Project.objects.filter(id=project_id).first() if project_id else None
                return self._render(request, step=3, project=project)
            project = get_object_or_404(Project, id=form.cleaned_data["project_id"])
            modules = request.POST.getlist("modules")
            service.update_project_modules(project, modules)
            return self._render(request, step=4, project=project)

        if step == 4:
            form = TeamInviteForm(request.POST)
            if not form.is_valid():
                project_id = request.POST.get("project_id") or request.session.get("wizard_project_id")
                project = Project.objects.filter(id=project_id).first() if project_id else None
                return self._render(request, step=4, project=project)
            project = get_object_or_404(Project, id=form.cleaned_data["project_id"])
            emails = request.POST.getlist("email")
            roles = request.POST.getlist("role")
            invites = []
            for email, role in zip(emails, roles):
                if email:
                    invites.append({"email": email, "role": role})
            service.update_team_invites(project, invites)
            project.status = "active"
            project.save(update_fields=["status", "updated_at"])
            request.session.pop("wizard_project_id", None)
            return HttpResponseRedirect(reverse("projects:dashboard", args=[project.pk]))

        return self._render(request, step=1, project=None)


class ProjectDashboardView(View):
    def get(self, request, pk):
        project = get_object_or_404(Project, id=pk)
        active_jobs = []
        context = {
            "project": project,
            "active_project": project,
            "active_jobs": active_jobs,
            "active_section": "v",
        }
        return render(request, "projects/dashboard.html", context)


class ProjectSettingsView(View):
    def get(self, request, pk):
        project = get_object_or_404(Project, id=pk)
        members = ProjectMembership.objects.filter(project=project, is_active=True).select_related("user")
        return render(
            request,
            "projects/settings.html",
            {
                "project": project,
                "members": members,
                "active_project": project,
                "active_section": "v",
            },
        )

    def post(self, request, pk):
        project = get_object_or_404(Project, id=pk)
        if not request.user.is_authenticated:
            return HttpResponseRedirect(reverse("accounts:login"))
        if project.owner_id != request.user.id:
            return HttpResponseRedirect(reverse("projects:settings", args=[project.pk]))
        project.title = (request.POST.get("title") or project.title).strip() or project.title
        status = (request.POST.get("status") or project.status).strip()
        project.status = status or project.status
        logline = (request.POST.get("logline") or "").strip()
        if logline:
            project.synopsis = logline
        project.save(update_fields=["title", "status", "synopsis", "updated_at"])
        return HttpResponseRedirect(reverse("projects:settings", args=[project.pk]))


class ProjectDeleteView(View):
    def get(self, request, pk):
        project = get_object_or_404(Project, id=pk)
        if request.user.is_authenticated and project.owner_id == request.user.id:
            project.delete()
            return HttpResponseRedirect(reverse("projects:list"))
        return render(
            request,
            "projects/settings.html",
            {
                "project": project,
                "active_project": project,
                "members": ProjectMembership.objects.filter(project=project, is_active=True).select_related("user"),
                "active_section": "v",
            },
        )


class ProjectSceneListPartialView(View):
    def get(self, request, pk):
        project = get_object_or_404(Project, id=pk)
        scenes = Scene.objects.filter(project=project).order_by("number")
        return render(
            request,
            "projects/_scene_list.html",
            {
                "project": project,
                "scenes": scenes,
            },
        )


class ProjectSceneView(View):
    def get(self, request, pk, scene_pk):
        project = get_object_or_404(Project, id=pk)
        scene = get_object_or_404(Scene, id=scene_pk, project=project)
        scene_list = Scene.objects.filter(project=project).order_by("number")
        scenes = list(scene_list)
        idx = scenes.index(scene) if scene in scenes else -1
        prev_scene = scenes[idx - 1] if idx > 0 else None
        next_scene = scenes[idx + 1] if idx >= 0 and idx < len(scenes) - 1 else None
        tabs = [
            {"id": "overview", "label": "Overview"},
            {"id": "shots", "label": "Shots"},
            {"id": "storyboard", "label": "Storyboard"},
            {"id": "floorplan", "label": "Floorplan"},
            {"id": "schedule", "label": "Schedule"},
            {"id": "lighting", "label": "Lighting"},
            {"id": "sound", "label": "Sound"},
            {"id": "props", "label": "Props"},
            {"id": "wardrobe", "label": "Wardrobe"},
            {"id": "continuity", "label": "Continuity"},
        ]
        scene.setups_count = scene.shots.count()
        scene.screen_time = scene.estimated_minutes
        scene.int_ext = scene.location_type.upper()
        scene.location_name = scene.title
        scene.time_of_day = scene.day_night
        tab_template = "projects/scenes/tabs/overview.html"
        context = {
            "project": project,
            "scene": scene,
            "active_project": project,
            "active_scene": scene,
            "active_section": "v",
            "scene_list": scene_list,
            "prev_scene": prev_scene,
            "next_scene": next_scene,
            "tabs": tabs,
            "active_tab": "overview",
            "active_tab_template": tab_template,
            "icon": "⌛",
            "stub_name": "Scene tab",
            "sub": "No data yet",
            "crumbs": [{"label": project.title, "url": project.get_absolute_url() if hasattr(project, "get_absolute_url") else ""}],
            "active_jobs": [],
        }
        return render(request, "projects/scene_view.html", context)


class ProjectSceneTabView(View):
    def get(self, request, pk, scene_pk, tab):
        project = get_object_or_404(Project, id=pk)
        scene = get_object_or_404(Scene, id=scene_pk, project=project)
        scene.int_ext = scene.location_type.upper()
        scene.location_name = scene.title
        template_map = {
            "overview": "projects/scenes/tabs/overview.html",
            "shots": "projects/scenes/tabs/shots.html",
            "storyboard": "projects/scenes/tabs/storyboard.html",
            "floorplan": "projects/scenes/tabs/floorplan.html",
            "schedule": "projects/scenes/tabs/schedule.html",
            "lighting": "projects/scenes/tabs/lighting.html",
            "sound": "projects/scenes/tabs/sound.html",
            "props": "projects/scenes/tabs/props.html",
            "wardrobe": "projects/scenes/tabs/wardrobe.html",
            "continuity": "projects/scenes/tabs/continuity.html",
        }
        template_name = template_map.get(tab, "projects/scenes/tabs/overview.html")
        return render(request, template_name, {"project": project, "scene": scene, "active_tab": tab})
