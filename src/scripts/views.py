from django.http import HttpResponse
from django.shortcuts import get_object_or_404, render
from django.views import View
from src.projects.models import Project

class ScriptIndexView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        return render(request, 'scripts/index.html', {'project': project, 'active_project': project, 'scripts': []})


class ScriptUploadView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        return render(request, 'scripts/upload.html', {'project': project, 'active_project': project})

    def post(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        if request.headers.get("HX-Request") == "true":
            return HttpResponse('<div class="rw-empty-state"><p style="margin:0">Upload queued.</p></div>')
        return render(request, 'scripts/upload.html', {'project': project, 'active_project': project})


class ScriptBreakdownView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        return render(request, 'scripts/breakdown.html', {'project': project, 'active_project': project, 'breakdown': None})


class ScriptDocsView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        return render(request, 'scripts/docs.html', {'project': project, 'active_project': project, 'documents': []})


class ScriptElementsView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        ctx = {
            'project': project,
            'active_project': project,
            'elements': {'characters': [], 'locations': [], 'props': [], 'sfx': [], 'vfx': []},
        }
        if getattr(request, 'htmx', False):
            return render(request, 'scripts/_elements_body.html', ctx)
        return render(request, 'scripts/elements.html', ctx)
