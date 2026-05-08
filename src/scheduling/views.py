from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.views import View

from src.projects.models import Project


class SchedulingIndexView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        return render(request, 'scheduling/index.html', {
            'project': project,
            'active_project': project,
            'active_section': 'p',
            'shoot_days': [],
        })


class StripboardView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        return render(request, 'scheduling/stripboard.html', {
            'project': project,
            'active_project': project,
            'active_section': 'p',
            'strips': [],
        })


class CallSheetsView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        return render(request, 'scheduling/call_sheets.html', {
            'project': project,
            'active_project': project,
            'active_section': 'sh',
            'call_sheets': [],
        })


class SchedulingOptimizeView(View):
    def post(self, request, project_pk):
        return JsonResponse({"status": "queued", "project_pk": str(project_pk)})
