from django.contrib.contenttypes.models import ContentType
from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404, render
from django.urls import reverse
from django.views import View

from src.projects.models import Project, Scene
from src.reviews.models import BibleReview, InlineComment, ReviewDecision


class ReviewsIndexView(View):
    def get(self, request, project_pk=None):
        project = get_object_or_404(Project, id=project_pk) if project_pk else Project.objects.filter(owner=request.user).first()
        reviews = BibleReview.objects.filter(project=project).select_related("author", "author__user")
        return render(request, "reviews/index.html", {"project": project, "reviews": reviews, "active_project": project, "active_section": "p"})


class ReviewDetailView(View):
    def get(self, request, pk):
        review = get_object_or_404(BibleReview.objects.select_related("project", "author", "author__user"), id=pk)
        decisions = review.decisions.select_related("scene", "proposed_by")
        ct = ContentType.objects.get_for_model(ReviewDecision)
        decision_ids = [str(d.id) for d in decisions]
        comments = InlineComment.objects.filter(content_type=ct, object_id__in=decision_ids).select_related("author", "parent")
        comments_by_decision = {}
        for comment in comments:
            comments_by_decision.setdefault(comment.object_id, []).append(comment)
        for decision in decisions:
            decision.inline_comments = comments_by_decision.get(str(decision.id), [])
        return render(
            request,
            "reviews/detail.html",
            {
                "project": review.project,
                "review": review,
                "decisions": decisions,
                "active_project": review.project,
                "active_section": "p",
            },
        )


class ReviewDecisionStatusView(View):
    def post(self, request, pk, action):
        decision = get_object_or_404(ReviewDecision.objects.select_related("bible_review"), id=pk)
        if action == "approve":
            decision.status = ReviewDecision.Status.LOCKED
            decision.locked_by = request.user if request.user.is_authenticated else None
            decision.save(update_fields=["status", "locked_by", "updated_at"])
        elif action == "reject":
            decision.status = ReviewDecision.Status.REJECTED
            decision.rejected_by = request.user if request.user.is_authenticated else None
            decision.save(update_fields=["status", "rejected_by", "updated_at"])
        return HttpResponseRedirect(reverse("reviews:detail", args=[decision.bible_review_id]))


class ReviewDecisionCommentView(View):
    def post(self, request, pk):
        decision = get_object_or_404(ReviewDecision.objects.select_related("bible_review"), id=pk)
        body = (request.POST.get("body") or "").strip()
        if body and request.user.is_authenticated:
            InlineComment.objects.create(
                content_type=ContentType.objects.get_for_model(ReviewDecision),
                object_id=str(decision.id),
                author=request.user,
                body=body,
            )
        return HttpResponseRedirect(reverse("reviews:detail", args=[decision.bible_review_id]))


class SceneCommentsPartialView(View):
    def get(self, request, project_pk, scene_pk):
        project = get_object_or_404(Project, id=project_pk)
        scene = get_object_or_404(Scene, id=scene_pk, project=project)
        comments = InlineComment.objects.filter(content_type__model="scene", object_id=str(scene.id)).select_related("author")
        return render(request, "reviews/_comments.html", {"project": project, "scene": scene, "comments": comments})
