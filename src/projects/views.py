from django.http import HttpResponse
from django.shortcuts import get_object_or_404, render
from django.views import View

from src.projects.models import Project, Scene


class ProjectListView(View):
    def get(self, request):
        projects = Project.objects.order_by("title")
        return render(
            request,
            "projects/list.html",
            {
                "projects": projects,
                "active_project": None,
                "active_section": "h",
            },
        )


class ProjectCreateWizardView(View):
    def get(self, request):
        step = int(request.GET.get("step", 1))
        project_id = request.GET.get("project")
        project = Project.objects.filter(id=project_id).first() if project_id else Project.objects.first()
        return render(request, "projects/create_wizard.html", {"step": step, "project": project, "active_project": project})


class ProjectCreateStepView(View):
    def post(self, request, step):
        next_step = step + 1 if step < 4 else 4
        return render(request, "projects/create_wizard.html", {"step": next_step, "project": None, "active_project": None})


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
            "stub.html",
            {
                "project": project,
                "active_project": project,
                "stub_name": "Project settings",
                "icon": "⚙",
                "subtitle": "Settings panel will be wired to project services.",
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
            "active_tab_template": "components/_empty_state.html",
            "icon": "⌛",
            "stub_name": "Scene tab",
            "sub": "Coming soon",
            "crumbs": [{"label": project.title, "url": project.get_absolute_url() if hasattr(project, "get_absolute_url") else ""}],
            "active_jobs": [],
        }
        return render(request, "projects/scene_view.html", context)


class ProjectSceneTabView(View):
    def get(self, request, pk, scene_pk, tab):
        return HttpResponse(
            f'<div class="rw-empty-state"><h3 style="margin:0 0 8px 0">{tab.title()}</h3>'
            '<p style="margin:0;color:var(--rw-text-2)">Module content will be connected in its phase.</p></div>'
        )
