from django.http import HttpResponse
from django.shortcuts import get_object_or_404, render
from django.views import View
from src.projects.models import Project


class ScriptIndexView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        return render(request, 'scripts/upload.html', {'project': project, 'active_project': project})


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
        breakdown = {"scene_count": 0, "characters": [], "locations": [], "props": [], "sfx": [], "vfx": []}
        return render(request, 'scripts/breakdown.html', {'project': project, 'active_project': project, 'active_section': 'b', 'breakdown': breakdown})


class ScriptDocsView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        return render(request, 'scripts/docs.html', {'project': project, 'active_project': project, 'active_section': 's', 'documents': []})


class ScriptElementsView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        return render(request, 'scripts/elements.html', {'project': project, 'active_project': project, 'active_section': 'b', 'elements': []})
