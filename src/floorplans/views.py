from django.shortcuts import get_object_or_404, render
from django.views import View

from src.projects.models import Project


class FloorPlanListView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        return render(
            request,
            "stub.html",
            {
                "project": project,
                "active_project": project,
                "active_section": "v",
                "stub_name": "Floor plans",
                "icon": "⌂",
                "subtitle": "Floor plan list placeholder.",
            },
        )


class FloorPlanEditorView(View):
    def get(self, request, project_pk, pk):
        project = get_object_or_404(Project, id=project_pk)
        return render(
            request,
            "stub.html",
            {
                "project": project,
                "floorplan_pk": pk,
                "active_project": project,
                "active_section": "v",
                "stub_name": "Floor plan editor",
                "icon": "📐",
                "subtitle": f"Editor placeholder for floor plan {pk}.",
            },
        )
