from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.views import View

from src.projects.models import Project


class SchedulingIndexView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        return render(
            request,
            "stub.html",
            {
                "project": project,
                "active_project": project,
                "active_section": "p",
                "stub_name": "Scheduling",
                "icon": "📅",
                "subtitle": "Scheduling board placeholder.",
            },
        )


class StripboardView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        return render(
            request,
            "stub.html",
            {
                "project": project,
                "active_project": project,
                "active_section": "p",
                "stub_name": "Stripboard",
                "icon": "≡",
                "subtitle": "Stripboard placeholder.",
            },
        )


class CallSheetsView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        return render(
            request,
            "stub.html",
            {
                "project": project,
                "active_project": project,
                "active_section": "sh",
                "stub_name": "Call sheets",
                "icon": "📋",
                "subtitle": "Call sheet module placeholder.",
            },
        )


class SchedulingOptimizeView(View):
    def post(self, request, project_pk):
        return JsonResponse({"status": "queued", "project_pk": str(project_pk)})
