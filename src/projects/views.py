from django.http import HttpResponse
from django.shortcuts import get_object_or_404, render
from django.template.loader import render_to_string
from django.views import View

from src.projects.models import Project, Scene
from src.projects.services import ProjectsService


class ProjectListView(View):
    def get(self, request):
        projects = ProjectsService.list_projects()
        return render(request, "projects/list.html", {"projects": projects, "active_project": None})


class ProjectCreateWizardView(View):
    def get(self, request):
        step = int(request.GET.get("step", 1))
        project_id = request.GET.get("project")
        project = Project.objects.filter(id=project_id).first() if project_id else Project.objects.first()
        return render(request, "projects/create_wizard.html", {"step": step, "project": project, "active_project": project})


class ProjectCreateStepView(View):
    def post(self, request, step):
        return HttpResponse("")


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
        return render(
            request,
            "shared/module_placeholder.html",
            {
                "project": project,
                "active_project": project,
                "title": "Project settings",
                "icon": "⚙",
                "subtitle": "Settings panel will be wired to project services.",
            },
        )


class ProjectSceneListPartialView(View):
    def get(self, request, pk):
        project = get_object_or_404(Project, id=pk)
        scenes = Scene.objects.filter(project=project).order_by("number")
        return render(request, "projects/_scene_list.html", {"project": project, "scene_list": scenes})


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
            "active_tab_template": "scenes/tabs/overview.html",
            "crumbs": [{"label": project.title, "url": project.get_absolute_url() if hasattr(project, "get_absolute_url") else ""}],
            "active_jobs": [],
        }
        return render(request, "projects/scene_view.html", context)


class ProjectSceneTabView(View):
    def get(self, request, pk, scene_pk, tab):
        project = get_object_or_404(Project, id=pk)
        scene = get_object_or_404(Scene, id=scene_pk, project=project)
        allowed = {"overview", "shots", "storyboard", "floorplan", "schedule", "lighting", "sound", "props", "wardrobe", "continuity"}
        if tab not in allowed:
            return HttpResponse(status=404)
        html = render_to_string(f"scenes/tabs/{tab}.html", {"project": project, "scene": scene})
        return HttpResponse(html)
