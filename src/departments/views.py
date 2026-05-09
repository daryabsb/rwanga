from django.shortcuts import get_object_or_404, render
from django.views import View

from src.projects.models import Project


class LightingView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        return render(
            request,
            "departments/lighting.html",
            {
                "project": project,
                "active_project": project,
                "active_section": "sh",
            },
        )


class SoundView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        return render(
            request,
            "departments/sound.html",
            {
                "project": project,
                "active_project": project,
                "active_section": "sh",
            },
        )


class PropsView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        return render(
            request,
            "departments/props.html",
            {
                "project": project,
                "active_project": project,
                "active_section": "sh",
            },
        )


class WardrobeView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        return render(
            request,
            "departments/wardrobe.html",
            {
                "project": project,
                "active_project": project,
                "active_section": "sh",
            },
        )


class ContinuityView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        return render(
            request,
            "departments/continuity.html",
            {
                "project": project,
                "active_project": project,
                "active_section": "sh",
            },
        )


def toggle_continuity_view(request, project_pk, item_pk):
    return render(request, "departments/partials/continuity_list.html", {})


def toggle_prop_view(request, project_pk, prop_pk):
    return render(request, "departments/partials/props_list.html", {})


def edit_lighting_modal_view(request, pk):
    return render(request, "departments/lighting.html", {})


def edit_sound_modal_view(request, pk):
    return render(request, "departments/sound.html", {})


def edit_wardrobe_modal_view(request, pk):
    return render(request, "departments/wardrobe.html", {})
