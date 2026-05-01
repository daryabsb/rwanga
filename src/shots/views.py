from django.http import HttpResponse
from django.shortcuts import get_object_or_404, render
from django.views import View

from src.projects.models import Project
from src.shots.models import StoryboardFrame
from src.shots.services import ShotService


class ShotListView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        filters = {"type": request.GET.get("type", "all"), "scene": request.GET.get("scene", "")}
        shots = ShotService().list_project_shots(project=project, shot_type=filters["type"], scene_id=filters["scene"] or None)
        return render(request, "shots/list.html", {"project": project, "shots": shots, "filters": filters, "active_project": project, "active_section": "v"})


class StoryboardsView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        scene_id = request.GET.get("scene")
        frames = StoryboardFrame.objects.filter(shot__scene__project=project).select_related("shot", "shot__scene")
        if scene_id:
            frames = frames.filter(shot__scene_id=scene_id)
        return render(request, "shots/storyboards.html", {"project": project, "storyboard_frames": frames, "active_project": project, "active_section": "v"})


class ShotEditView(View):
    def get(self, request, project_pk, shot_pk):
        return HttpResponse(f'<tr class="rw-shot-row"><td colspan="7">Shot edit placeholder {shot_pk}</td></tr>')


class ShotExportPdfView(View):
    def get(self, request, project_pk):
        return HttpResponse(f"Shot export placeholder for {project_pk}")
