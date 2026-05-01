from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404, render
from django.urls import reverse
from django.views import View

from src.community.models import ReviewSession, SessionComment, SessionContent
from src.community.services import CommunityService
from src.projects.models import Project


class CommunityIndexView(View):
    def get(self, request, project_pk=None):
        project = get_object_or_404(Project, id=project_pk) if project_pk else Project.objects.filter(owner=request.user).first()
        sessions = CommunityService().list_sessions(project=project)
        return render(request, "community/index.html", {"project": project, "sessions": sessions, "active_project": project, "active_section": "p"})


class CommunitySessionDetailView(View):
    def get(self, request, pk):
        session = get_object_or_404(ReviewSession.objects.select_related("project", "created_by"), id=pk)
        items = SessionContent.objects.filter(session=session).order_by("order", "created_at")
        notes = SessionComment.objects.filter(session_content__session=session, parent__isnull=True).select_related("author").order_by("-created_at")
        return render(
            request,
            "community/detail.html",
            {"project": session.project, "session": session, "items": items, "notes": notes, "active_project": session.project, "active_section": "p"},
        )


class CommunityAddNoteView(View):
    def post(self, request, pk):
        session = get_object_or_404(ReviewSession, id=pk)
        body = (request.POST.get("body") or "").strip()
        content = SessionContent.objects.filter(session=session).order_by("order", "created_at").first()
        if body and content and request.user.is_authenticated:
            SessionComment.objects.create(session_content=content, author=request.user, body=body)
        return HttpResponseRedirect(reverse("community:detail", args=[session.id]))
