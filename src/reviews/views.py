from django.contrib.contenttypes.models import ContentType
from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404, render
from django.urls import reverse
from django.views import View

from src.projects.models import Project, Scene
from src.reviews.forms import ReviewDecisionForm, SceneEvaluationForm
from src.reviews.models import BibleReview, InlineComment, ReviewDecision
from src.reviews.services import ReviewService


class ReviewsIndexView(View):
    def get(self, request, project_pk=None):
        project = get_object_or_404(Project, id=project_pk) if project_pk else Project.objects.filter(owner=request.user).first()
        reviews = BibleReview.objects.filter(project=project).select_related("author", "author__user")
        return render(request, "reviews/index.html", {"project": project, "reviews": reviews, "active_project": project, "active_section": "p"})


class ReviewCreateView(View):
    def post(self, request):
        project = Project.objects.filter(owner=request.user).first()
        if not request.user.is_authenticated or project is None:
            return HttpResponseRedirect(reverse("accounts:login"))
        review = ReviewService.create_review(project=project, author=request.user)
        return HttpResponseRedirect(reverse("reviews:detail", args=[review.pk]))


class ReviewDetailView(View):
    def get(self, request, pk):
        review = get_object_or_404(BibleReview.objects.select_related("project", "author", "author__user"), id=pk)
        decisions = review.decisions.select_related("scene", "proposed_by", "locked_by", "rejected_by")
        evaluations = review.scene_evaluations.select_related("scene")
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
                "evaluations": evaluations,
                "decision_form": ReviewDecisionForm(),
                "evaluation_form": SceneEvaluationForm(),
                "active_project": review.project,
                "active_section": "p",
            },
        )


class ReviewDecisionStatusView(View):
    def post(self, request, pk, action):
        decision = get_object_or_404(ReviewDecision.objects.select_related("bible_review"), id=pk)
        service = ReviewService()
        if action == "approve":
            service.lock_decision(decision=decision, user=request.user)
        elif action == "reject":
            service.reject_decision(decision=decision, user=request.user)
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


class ReviewDecisionCreateView(View):
    def post(self, request, pk):
        review = get_object_or_404(BibleReview.objects.select_related("project"), pk=pk)
        form = ReviewDecisionForm(request.POST)
        if form.is_valid() and request.user.is_authenticated:
            ReviewService().propose_decision(
                bible_review=review,
                scene=form.cleaned_data.get("scene"),
                topic=form.cleaned_data["topic"],
                decision_text=form.cleaned_data["decision_text"],
                user=request.user,
            )
        return HttpResponseRedirect(reverse("reviews:detail", args=[review.pk]))


class SceneEvaluationCreateView(View):
    def post(self, request, pk):
        review = get_object_or_404(BibleReview, pk=pk)
        form = SceneEvaluationForm(request.POST)
        if form.is_valid():
            evaluation = form.save(commit=False)
            evaluation.bible_review = review
            evaluation.save()
        return HttpResponseRedirect(reverse("reviews:detail", args=[review.pk]))


class SceneCommentsPartialView(View):
    def get(self, request, project_pk, scene_pk):
        project = get_object_or_404(Project, id=project_pk)
        scene = get_object_or_404(Scene, id=scene_pk, project=project)
        comments = InlineComment.objects.filter(content_type__model="scene", object_id=str(scene.id)).select_related("author")
        return render(request, "reviews/_comments.html", {"project": project, "scene": scene, "comments": comments})
