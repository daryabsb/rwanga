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
        return HttpResponse('')

class ScriptBreakdownView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        return render(
            request,
            "shared/module_placeholder.html",
            {
                "project": project,
                "active_project": project,
                "active_section": "b",
                "title": "Script breakdown",
                "icon": "🏷",
                "subtitle": "Breakdown UI is pending Phase implementation.",
            },
        )

class ScriptDocsView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        return render(
            request,
            "shared/module_placeholder.html",
            {
                "project": project,
                "active_project": project,
                "active_section": "s",
                "title": "Project docs",
                "icon": "📄",
                "subtitle": "Documentation workspace placeholder.",
            },
        )

class ScriptElementsView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        return render(
            request,
            "shared/module_placeholder.html",
            {
                "project": project,
                "active_project": project,
                "active_section": "b",
                "title": "Script elements",
                "icon": "◇",
                "subtitle": "Element manager placeholder.",
            },
        )
