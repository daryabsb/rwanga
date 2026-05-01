from django.shortcuts import get_object_or_404, render
from django.views import View

from src.community.services import CommunityService
from src.projects.models import Project


class CommunityIndexView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        sessions = CommunityService().list_sessions(project=project)
        return render(request, "community/index.html", {"project": project, "sessions": sessions, "active_project": project})
