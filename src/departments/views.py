from django.http import HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views import View

from src.departments.forms import (
    ContinuityItemForm,
    LightingNoteForm,
    PropForm,
    SoundNoteForm,
    WardrobeItemForm,
)
from src.departments.models import ContinuityItem, LightingNote, Prop, SoundNote, WardrobeItem
from src.departments.services import DepartmentService
from src.projects.models import Project


class LightingView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        grouped = DepartmentService().list_lighting_grouped(project=project)
        form = LightingNoteForm()
        form.fields["shot"].queryset = form.fields["shot"].queryset.filter(scene__project=project)
        return render(request, "departments/lighting.html", {"project": project, "grouped": grouped, "form": form, "active_project": project, "active_section": "sh"})

    def post(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        form = LightingNoteForm(request.POST)
        if form.is_valid() and form.cleaned_data["shot"].scene.project_id == project.id:
            form.save()
        if request.htmx:
            grouped = DepartmentService().list_lighting_grouped(project=project)
            return render(request, "departments/partials/lighting_list.html", {"project": project, "grouped": grouped})
        return redirect("departments:lighting", project_pk=project.pk)


class SoundView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        grouped = DepartmentService().list_sound_grouped(project=project)
        form = SoundNoteForm()
        form.fields["shot"].queryset = form.fields["shot"].queryset.filter(scene__project=project)
        return render(request, "departments/sound.html", {"project": project, "grouped": grouped, "form": form, "active_project": project, "active_section": "sh"})

    def post(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        form = SoundNoteForm(request.POST)
        if form.is_valid() and form.cleaned_data["shot"].scene.project_id == project.id:
            form.save()
        if request.htmx:
            grouped = DepartmentService().list_sound_grouped(project=project)
            return render(request, "departments/partials/sound_list.html", {"project": project, "grouped": grouped})
        return redirect("departments:sound", project_pk=project.pk)


class PropsView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        category = request.GET.get("category") or ""
        props = DepartmentService().list_props(project=project, category=category or None)
        template = "departments/partials/props_list.html" if request.htmx else "departments/props.html"
        return render(request, template, {"project": project, "props": props, "form": PropForm(), "category": category, "active_project": project, "active_section": "sh"})

    def post(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        form = PropForm(request.POST, request.FILES)
        if form.is_valid():
            prop = form.save(commit=False)
            prop.project = project
            prop.save()
            form.save_m2m()
        if request.htmx:
            props = DepartmentService().list_props(project=project)
            return render(request, "departments/partials/props_list.html", {"project": project, "props": props, "category": ""})
        return redirect("departments:props", project_pk=project.pk)


class PropToggleView(View):
    def post(self, request, project_pk, prop_pk):
        project = get_object_or_404(Project, id=project_pk)
        prop = get_object_or_404(Prop, id=prop_pk, project=project)
        checked = request.POST.get("checked", "false").lower() == "true"
        DepartmentService().toggle_prop_status(prop=prop, checked=checked)
        return HttpResponse(status=204)


class WardrobeView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        grouped = DepartmentService().list_wardrobe_grouped(project=project)
        form = WardrobeItemForm()
        form.fields["scene"].queryset = form.fields["scene"].queryset.filter(project=project)
        form.fields["character"].queryset = form.fields["character"].queryset.filter(project=project)
        return render(request, "departments/wardrobe.html", {"project": project, "grouped": grouped, "form": form, "active_project": project, "active_section": "sh"})

    def post(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        form = WardrobeItemForm(request.POST, request.FILES)
        if form.is_valid() and form.cleaned_data["scene"].project_id == project.id:
            form.save()
        if request.htmx:
            grouped = DepartmentService().list_wardrobe_grouped(project=project)
            return render(request, "departments/partials/wardrobe_list.html", {"project": project, "grouped": grouped})
        return redirect("departments:wardrobe", project_pk=project.pk)


class ContinuityView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        direction = request.GET.get("direction") or ""
        grouped = DepartmentService().list_continuity_grouped(project=project, direction=direction or None)
        template = "departments/partials/continuity_list.html" if request.htmx else "departments/continuity.html"
        form = ContinuityItemForm()
        form.fields["scene"].queryset = form.fields["scene"].queryset.filter(project=project)
        return render(request, template, {"project": project, "grouped": grouped, "form": form, "direction": direction, "active_project": project, "active_section": "sh"})

    def post(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        form = ContinuityItemForm(request.POST)
        if form.is_valid() and form.cleaned_data["scene"].project_id == project.id:
            form.save()
        if request.htmx:
            grouped = DepartmentService().list_continuity_grouped(project=project)
            return render(request, "departments/partials/continuity_list.html", {"project": project, "grouped": grouped, "direction": ""})
        return redirect("departments:continuity", project_pk=project.pk)


class ContinuityToggleView(View):
    def post(self, request, project_pk, item_pk):
        project = get_object_or_404(Project, id=project_pk)
        item = get_object_or_404(ContinuityItem, id=item_pk, scene__project=project)
        checked = request.POST.get("checked", "false").lower() == "true"
        DepartmentService().toggle_continuity(item=item, checked=checked)
        return HttpResponse(status=204)


class DepartmentModalStubView(View):
    def get(self, request, project_pk, scene_pk=None, item_pk=None):
        return HttpResponse("<div class='rw-card' style='padding:12px'>Modal placeholder</div>")
