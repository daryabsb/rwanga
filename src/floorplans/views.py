from django.shortcuts import get_object_or_404, render
from django.views import View

from src.floorplans.models import FloorPlan
from src.floorplans.services import FloorPlanService
from src.projects.models import Project


class FloorPlanListView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        floorplans = FloorPlanService().list_for_project(project=project)
        return render(request, "floorplans/list.html", {"project": project, "floorplans": floorplans, "active_project": project, "active_section": "v"})


class FloorPlanEditorView(View):
    def get(self, request, project_pk, pk):
        project = get_object_or_404(Project, id=project_pk)
        floorplan = get_object_or_404(FloorPlan, id=pk, scene__project=project)
        return render(request, "floorplans/list.html", {"project": project, "floorplans": [floorplan], "active_project": project, "active_section": "v"})
