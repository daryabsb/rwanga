from django.contrib.auth import get_user_model
from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404, render
from django.urls import reverse
from django.views import View

from src.community.models import ReviewSession, ReviewSessionParticipant, SessionComment, SessionContent, SessionReaction
from src.community.services import CommunityService
from src.projects.models import Project, Scene
from src.reviews.models import BibleReview


class CommunityIndexView(View):
    def get(self, request, project_pk=None):
        if project_pk:
            project = get_object_or_404(Project, id=project_pk)
        else:
            project = Project.objects.filter(owner=request.user).first() if request.user.is_authenticated else None
        sessions = CommunityService().list_sessions(project=project) if project else ReviewSession.objects.none()
        return render(
            request,
            "community/list.html",
            {
                "project": project,
                "sessions": sessions,
                "can_create": request.user.is_authenticated,
                "active_project": project,
                "active_section": "p",
            },
        )


class CommunityCreateView(View):
    def get(self, request):
        return render(request, "community/index.html", {"project": Project.objects.filter(owner=request.user).first(), "sessions": []})

    def post(self, request):
        project = Project.objects.filter(owner=request.user).first()
        if not request.user.is_authenticated or project is None:
            return HttpResponseRedirect(reverse("accounts:login"))
        title = (request.POST.get("title") or "New Session").strip()
        session_type = (request.POST.get("session_type") or ReviewSession.SessionType.SCREENPLAY).strip()
        visibility = (request.POST.get("visibility") or ReviewSession.Visibility.INVITE_ONLY).strip()
        session = CommunityService.create_session(project=project, title=title, session_type=session_type, created_by=request.user, visibility=visibility)
        return HttpResponseRedirect(reverse("community:detail", args=[session.pk]))


class CommunitySessionDetailView(View):
    def get(self, request, pk):
        session = get_object_or_404(ReviewSession.objects.select_related("project", "created_by"), id=pk)
        items = SessionContent.objects.filter(session=session).order_by("order", "created_at")
        notes = SessionComment.objects.filter(session_content__session=session, parent__isnull=True).select_related("author").prefetch_related("replies", "reactions").order_by("-created_at")
        participants = ReviewSessionParticipant.objects.filter(session=session).select_related("user")
        content_blocks = []
        comments = []
        for note in notes:
            note.agree_count = note.reactions.filter(reaction_type=SessionReaction.ReactionType.AGREE).count()
            note.disagree_count = note.reactions.filter(reaction_type=SessionReaction.ReactionType.DISAGREE).count()
            note.question_count = note.reactions.filter(reaction_type=SessionReaction.ReactionType.QUESTION).count()
            note.reaction_counts = {
                "👍": note.agree_count,
                "👎": note.disagree_count,
                "❓": note.question_count,
            }
            note.scene_ref = note.anchor_ref
            comments.append(note)
        for item in items:
            content_blocks.append({"type": "text", "body": item.label})
        return render(
            request,
            "community/detail.html",
            {
                "project": session.project,
                "session": session,
                "items": items,
                "notes": notes,
                "comments": comments,
                "content_blocks": content_blocks,
                "can_comment": request.user.is_authenticated,
                "can_manage": request.user.is_authenticated,
                "participants": participants,
                "scenes": Scene.objects.filter(project=session.project).order_by("number"),
                "reviews": BibleReview.objects.filter(project=session.project).order_by("-created_at"),
                "active_project": session.project,
                "active_section": "p",
            },
        )


class CommunityAddNoteView(View):
    def post(self, request, pk):
        session = get_object_or_404(ReviewSession, id=pk)
        body = (request.POST.get("body") or "").strip()
        content = SessionContent.objects.filter(session=session).order_by("order", "created_at").first()
        if body and content and request.user.is_authenticated:
            SessionComment.objects.create(session_content=content, author=request.user, body=body)
        return HttpResponseRedirect(reverse("community:detail", args=[session.id]))


class CommunityAddContentView(View):
    def post(self, request, pk):
        session = get_object_or_404(ReviewSession, id=pk)
        mode = (request.POST.get("mode") or "").strip()
        if mode == "scene":
            scene_ids = request.POST.getlist("scene_ids")
            scenes = Scene.objects.filter(project=session.project, id__in=scene_ids)
            CommunityService.snapshot_scenes(session=session, scenes=scenes)
        elif mode == "bible":
            review_id = request.POST.get("review_id")
            review = BibleReview.objects.filter(project=session.project, id=review_id).first()
            if review:
                CommunityService.snapshot_bible_review(session=session, bible_review=review)
        return HttpResponseRedirect(reverse("community:detail", args=[session.id]))


class CommunityInviteView(View):
    def post(self, request, pk):
        session = get_object_or_404(ReviewSession, id=pk)
        user_id = request.POST.get("user_id")
        user = get_user_model().objects.filter(id=user_id).first()
        if user and request.user.is_authenticated:
            CommunityService.invite_participant(session=session, user=user, invited_by=request.user)
        return HttpResponseRedirect(reverse("community:detail", args=[session.id]))


class CommunityStatusView(View):
    def post(self, request, pk, action):
        session = get_object_or_404(ReviewSession, id=pk)
        if action == "open":
            CommunityService.open_session(session=session)
        elif action == "close":
            CommunityService.close_session(session=session)
        elif action == "toggle":
            if session.status == ReviewSession.Status.OPEN:
                CommunityService.close_session(session=session)
            else:
                CommunityService.open_session(session=session)
        return HttpResponseRedirect(reverse("community:detail", args=[session.id]))


class CommunityReactView(View):
    def post(self, request, pk=None, comment_pk=None, action="react"):
        if comment_pk and pk is None:
            comment = get_object_or_404(SessionComment, id=comment_pk)
            session = comment.session_content.session
        else:
            session = get_object_or_404(ReviewSession, id=pk)
            comment = get_object_or_404(SessionComment, id=comment_pk, session_content__session=session)
        if action == "reply":
            body = (request.POST.get("body") or "").strip()
            if body and request.user.is_authenticated:
                SessionComment.objects.create(session_content=comment.session_content, author=request.user, body=body, parent=comment)
        else:
            emoji = (request.POST.get("emoji") or "").strip()
            reaction_map = {"👍": SessionReaction.ReactionType.AGREE, "👎": SessionReaction.ReactionType.DISAGREE, "❓": SessionReaction.ReactionType.QUESTION}
            reaction_type = reaction_map.get(emoji) or (request.POST.get("reaction_type") or SessionReaction.ReactionType.AGREE).strip()
            if request.user.is_authenticated:
                SessionReaction.objects.update_or_create(comment=comment, author=request.user, defaults={"reaction_type": reaction_type})
        notes = SessionComment.objects.filter(session_content__session=session, parent__isnull=True).select_related("author").prefetch_related("replies", "reactions").order_by("-created_at")
        comments = []
        for note in notes:
            note.reaction_counts = {
                "👍": note.reactions.filter(reaction_type=SessionReaction.ReactionType.AGREE).count(),
                "👎": note.reactions.filter(reaction_type=SessionReaction.ReactionType.DISAGREE).count(),
                "❓": note.reactions.filter(reaction_type=SessionReaction.ReactionType.QUESTION).count(),
            }
            comments.append(note)
        if request.headers.get("HX-Request"):
            return render(request, "community/_comment_thread.html", {"comments": comments, "session": session, "can_comment": request.user.is_authenticated})
        return HttpResponseRedirect(reverse("community:detail", args=[session.id]))
