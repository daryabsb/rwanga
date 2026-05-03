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
        return render(
            request,
            "stub.html",
            {
                "project": project,
                "active_project": project,
                "active_section": "b",
                "stub_name": "Script breakdown",
                "icon": "🏷",
                "subtitle": "Breakdown UI is pending Phase implementation.",
            },
        )

class ScriptDocsView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        return render(
            request,
            "stub.html",
            {
                "project": project,
                "active_project": project,
                "active_section": "s",
                "stub_name": "Project docs",
                "icon": "📄",
                "subtitle": "Documentation workspace placeholder.",
            },
        )

class ScriptElementsView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        return render(
            request,
            "stub.html",
            {
                "project": project,
                "active_project": project,
                "active_section": "b",
                "stub_name": "Script elements",
                "icon": "◇",
                "subtitle": "Element manager placeholder.",
            },
        )
