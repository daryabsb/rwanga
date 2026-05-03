from django.http import HttpResponse
from django.shortcuts import get_object_or_404, render
from django.views import View

from src.projects.models import Project


class ShotListView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        return render(
            request,
            "stub.html",
            {
                "project": project,
                "active_project": project,
                "active_section": "v",
                "stub_name": "Shot list",
                "icon": "🎞",
                "subtitle": "Shot list workspace placeholder.",
            },
        )


class StoryboardsView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        return render(
            request,
            "stub.html",
            {
                "project": project,
                "active_project": project,
                "active_section": "v",
                "stub_name": "Storyboards",
                "icon": "🖼",
                "subtitle": "Storyboard workspace placeholder.",
            },
        )


class ShotEditView(View):
    def get(self, request, project_pk, shot_pk):
        return HttpResponse(f'<tr class="rw-shot-row"><td colspan="6">Shot edit placeholder {shot_pk}</td></tr>')
