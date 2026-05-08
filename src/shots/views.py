from django.http import HttpResponse
from django.shortcuts import get_object_or_404, render
from django.views import View

from src.projects.models import Project


class ShotListView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        ctx = {
            'project': project,
            'active_project': project,
            'active_section': 'v',
            'shots': [],
            'filters': {'type': request.GET.get('type', 'all'), 'scene': request.GET.get('scene', '')},
        }
        if getattr(request, 'htmx', False):
            return render(request, 'shots/_shots_table.html', ctx)
        return render(request, 'shots/list.html', ctx)


class StoryboardsView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        return render(request, 'shots/storyboards.html', {
            'project': project,
            'active_project': project,
            'active_section': 'v',
            'storyboard_frames': [],
        })


class ShotEditView(View):
    def get(self, request, project_pk, shot_pk):
        return HttpResponse(f'<tr class="rw-shot-row"><td colspan="7">Shot edit placeholder {shot_pk}</td></tr>')
