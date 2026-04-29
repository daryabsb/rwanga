from django.shortcuts import render
from django.views import View

from src.projects.services import ProjectsService


class ProjectsDashboardView(View):
    def get(self, request):
        projects = ProjectsService.list_projects()
        return render(request, "projects/dashboard.html", {"projects": projects})


class ProjectWorkspaceView(View):
    def get(self, request, project_id):
        project = ProjectsService.get_project(project_id)
        return render(request, "projects/workspace.html", {"project": project})


class ProjectSceneListView(View):
    def get(self, request, project_id):
        project = ProjectsService.get_project(project_id)
        scenes = ProjectsService.list_scenes(project=project)
        return render(
            request,
            "projects/scene_list.html",
            {"project": project, "scenes": scenes},
        )
