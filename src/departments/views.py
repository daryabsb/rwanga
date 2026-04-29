from django.shortcuts import get_object_or_404, render
from django.views import View

from src.projects.models import Project


class LightingView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        return render(
            request,
            "stub.html",
            {
                "project": project,
                "active_project": project,
                "active_section": "sh",
                "stub_name": "Lighting",
                "icon": "💡",
                "subtitle": "Lighting notes placeholder.",
            },
        )


class SoundView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        return render(
            request,
            "stub.html",
            {
                "project": project,
                "active_project": project,
                "active_section": "sh",
                "stub_name": "Sound",
                "icon": "🔊",
                "subtitle": "Sound notes placeholder.",
            },
        )


class PropsView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        return render(
            request,
            "stub.html",
            {
                "project": project,
                "active_project": project,
                "active_section": "sh",
                "stub_name": "Props",
                "icon": "🎭",
                "subtitle": "Props checklist placeholder.",
            },
        )


class WardrobeView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        return render(
            request,
            "stub.html",
            {
                "project": project,
                "active_project": project,
                "active_section": "sh",
                "stub_name": "Wardrobe",
                "icon": "👗",
                "subtitle": "Wardrobe workspace placeholder.",
            },
        )


class ContinuityView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        return render(
            request,
            "stub.html",
            {
                "project": project,
                "active_project": project,
                "active_section": "sh",
                "stub_name": "Continuity",
                "icon": "🔗",
                "subtitle": "Continuity checklist placeholder.",
            },
        )
