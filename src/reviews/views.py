from django.contrib.contenttypes.models import ContentType
from django.http import HttpResponse, HttpResponseRedirect
from django.shortcuts import get_object_or_404, render
from django.urls import reverse
from django.views import View

from src.projects.models import Project, Scene
from src.reviews.forms import ReviewDecisionForm, SceneEvaluationForm
from src.reviews.models import BibleReview, InlineComment, ReviewDecision, SceneEvaluation
from src.reviews.services import ReviewService


class ReviewsIndexView(View):
    def get(self, request, project_pk=None):
        if project_pk:
            project = get_object_or_404(Project, id=project_pk)
        else:
            project = Project.objects.filter(owner=request.user).first() if request.user.is_authenticated else None
        reviews = BibleReview.objects.filter(project=project).select_related("author", "author__user") if project else BibleReview.objects.none()
        for review in reviews:
            review.title = f"Bible Review v{review.version}"
            review.locked_decisions_count = review.decisions.filter(status=ReviewDecision.Status.LOCKED).count()
            review.rejected_decisions_count = review.decisions.filter(status=ReviewDecision.Status.REJECTED).count()
            review.evaluations = review.scene_evaluations
        return render(
            request,
            "reviews/list.html",
            {
                "project": project,
                "reviews": reviews,
                "can_create": request.user.is_authenticated,
                "active_project": project,
                "active_section": "p",
            },
        )


class ReviewCreateView(View):
    def get(self, request):
        projects = Project.objects.filter(owner=request.user).order_by("title") if request.user.is_authenticated else Project.objects.none()
        return render(
            request,
            "reviews/_create_modal.html",
            {
                "projects": projects,
                "active_project": projects.first() if projects else None,
                "form": type("FormLike", (), {"title": type("Val", (), {"value": ""}), "bible_content": type("Val", (), {"value": ""}), "errors": {}})(),
            },
        )

    def post(self, request):
        project_id = request.POST.get("project")
        project = Project.objects.filter(id=project_id).first() if project_id else Project.objects.filter(owner=request.user).first()
        if not request.user.is_authenticated or project is None:
            return HttpResponseRedirect(reverse("accounts:login"))
        review = ReviewService.create_review(project=project, author=request.user)
        custom_title = (request.POST.get("title") or "").strip()
        if custom_title:
            review.content = {**(review.content or {}), "title": custom_title}
        bible_content = (request.POST.get("bible_content") or "").strip()
        if bible_content:
            review.content = {**(review.content or {}), "bible_content": bible_content}
        if custom_title or bible_content:
            review.save(update_fields=["content", "updated_at"])
        return HttpResponseRedirect(reverse("reviews:detail", args=[review.pk]))


class ReviewDetailView(View):
    @staticmethod
    def _tab_template(tab):
        return {
            "decisions": "reviews/_decisions_list.html",
            "evaluations": "reviews/_evaluations_list.html",
            "comments": "reviews/_comments_list.html",
            "bible": "reviews/_bible_tab.html",
        }.get(tab, "reviews/_decisions_list.html")

    def get(self, request, pk, tab="decisions"):
        review = get_object_or_404(BibleReview.objects.select_related("project", "author", "author__user"), id=pk)
        decisions = review.decisions.select_related("scene", "proposed_by", "locked_by", "rejected_by").order_by("-created_at")
        evaluations = review.scene_evaluations.select_related("scene")
        ct = ContentType.objects.get_for_model(ReviewDecision)
        decision_ids = [str(d.id) for d in decisions]
        comments = InlineComment.objects.filter(content_type=ct, object_id__in=decision_ids).select_related("author", "parent")
        comments_by_decision = {}
        for comment in comments:
            comments_by_decision.setdefault(comment.object_id, []).append(comment)
        for decision in decisions:
            decision.inline_comments = comments_by_decision.get(str(decision.id), [])
            if decision.scene:
                decision.scene.int_ext = decision.scene.location_type.upper()
                decision.scene.location_name = decision.scene.title
                decision.scene.time_of_day = decision.scene.day_night
        for evaluation in evaluations:
            if evaluation.scene:
                evaluation.scene.int_ext = evaluation.scene.location_type.upper()
                evaluation.scene.location_name = evaluation.scene.title
                evaluation.scene.time_of_day = evaluation.scene.day_night
            evaluation.author = review.author.user
        review.title = review.content.get("title") or f"Bible Review v{review.version}"
        review.locked_decisions_count = decisions.filter(status=ReviewDecision.Status.LOCKED).count()
        review.rejected_decisions_count = decisions.filter(status=ReviewDecision.Status.REJECTED).count()
        review.comments = type("Obj", (), {"count": lambda _self: comments.count()})()
        active_tab = tab if tab in {"decisions", "evaluations", "comments", "bible"} else "decisions"
        if request.headers.get("HX-Request"):
            tab_context = {
                "review": review,
                "decisions": decisions,
                "evaluations": evaluations,
                "comments": comments,
                "can_manage": request.user.is_authenticated,
                "can_review": request.user.is_authenticated,
            }
            return render(request, self._tab_template(active_tab), tab_context)
        return render(
            request,
            "reviews/detail.html",
            {
                "project": review.project,
                "review": review,
                "decisions": decisions,
                "evaluations": evaluations,
                "comments": comments,
                "decision_form": ReviewDecisionForm(),
                "evaluation_form": SceneEvaluationForm(),
                "can_manage": request.user.is_authenticated,
                "can_review": request.user.is_authenticated,
                "active_tab": active_tab,
                "active_tab_template": self._tab_template(active_tab),
                "active_project": review.project,
                "active_section": "p",
            },
        )


class ReviewDecisionStatusView(View):
    def post(self, request, pk, action):
        decision = get_object_or_404(ReviewDecision.objects.select_related("bible_review"), id=pk)
        service = ReviewService()
        if action in {"approve", "lock"}:
            comment = (request.POST.get("comment") or "").strip()
            service.lock_decision(decision=decision, user=request.user, comment=comment)
        elif action == "reject":
            reason = (request.POST.get("reason") or "").strip()
            if not reason:
                return HttpResponse('<div class="rw-alert rw-alert-red">هۆکاری ڕەتکردنەوە پێویستە</div>', status=422)
            service.reject_decision(decision=decision, user=request.user, reason=reason)
        elif action == "repropose":
            new_topic = (request.POST.get("topic") or "").strip() or decision.topic
            new_text = (request.POST.get("decision_text") or "").strip() or decision.decision_text
            decision = service.repropose_decision(original_decision=decision, user=request.user, new_topic=new_topic, new_text=new_text)
        return render(
            request,
            "reviews/_decision_card.html",
            {"decision": decision, "can_review": request.user.is_authenticated, "can_manage": request.user.is_authenticated},
        ) if request.headers.get("HX-Request") else HttpResponseRedirect(reverse("reviews:detail", args=[decision.bible_review_id]))


class ReviewSetStatusView(View):
    def post(self, request, pk, status):
        review = get_object_or_404(BibleReview, id=pk)
        allowed = {BibleReview.Status.DRAFT, BibleReview.Status.IN_REVIEW, BibleReview.Status.DELIVERED, "closed"}
        if status in allowed:
            review.status = status if status != "closed" else BibleReview.Status.DELIVERED
            review.save(update_fields=["status", "updated_at"])
        return HttpResponseRedirect(reverse("reviews:detail", args=[review.id]))


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


class ReviewDecisionsTabView(View):
    def get(self, request, pk):
        review = get_object_or_404(BibleReview, id=pk)
        decisions = review.decisions.select_related("scene", "proposed_by", "locked_by", "rejected_by").order_by("-created_at")
        for decision in decisions:
            if decision.scene:
                decision.scene.int_ext = decision.scene.location_type.upper()
                decision.scene.location_name = decision.scene.title
                decision.scene.time_of_day = decision.scene.day_night
        return render(request, "reviews/_decisions_list.html", {"review": review, "decisions": decisions, "can_review": request.user.is_authenticated, "can_manage": request.user.is_authenticated})


class ReviewEvaluationsTabView(View):
    def get(self, request, pk):
        review = get_object_or_404(BibleReview, id=pk)
        evaluations = SceneEvaluation.objects.filter(bible_review=review).select_related("scene").order_by("-created_at")
        for evaluation in evaluations:
            if evaluation.scene:
                evaluation.scene.int_ext = evaluation.scene.location_type.upper()
                evaluation.scene.location_name = evaluation.scene.title
                evaluation.scene.time_of_day = evaluation.scene.day_night
            evaluation.author = review.author.user
        return render(request, "reviews/_evaluations_list.html", {"review": review, "evaluations": evaluations})


class ReviewCommentsTabView(View):
    def get(self, request, pk):
        review = get_object_or_404(BibleReview, id=pk)
        ct = ContentType.objects.get_for_model(ReviewDecision)
        decision_ids = list(review.decisions.values_list("id", flat=True))
        comments = InlineComment.objects.filter(content_type=ct, object_id__in=[str(i) for i in decision_ids], parent__isnull=True).select_related("author").order_by("-created_at")
        return render(request, "reviews/_comments_list.html", {"review": review, "comments": comments})


class ReviewBibleTabView(View):
    def get(self, request, pk):
        review = get_object_or_404(BibleReview, id=pk)
        bible_text = (review.content or {}).get("bible_content", "")
        return render(request, "reviews/_bible_tab.html", {"review": review, "bible_text": bible_text})
