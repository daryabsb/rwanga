from django.utils import timezone
from django.core.exceptions import PermissionDenied

from src.accounts.models import ConsultantProfile, ProjectMembership
from src.reviews.models import BibleReview, ReviewDecision


class ReviewService:
    @staticmethod
    def _is_consultant(user):
        return ConsultantProfile.objects.filter(user=user, is_active=True).exists()

    @staticmethod
    def _is_director(user, project):
        return ProjectMembership.objects.filter(
            user=user,
            project=project,
            is_active=True,
            department_role=ProjectMembership.DepartmentRole.DIRECTOR,
        ).exists() or project.owner_id == user.id

    @staticmethod
    def create_review(*, project, author):
        if not ProjectMembership.objects.filter(project=project, user=author, is_active=True).exists() and project.owner_id != author.id:
            raise PermissionDenied("Author must be a project member")
        consultant = ConsultantProfile.objects.filter(user=author, is_active=True).first()
        if consultant is None:
            consultant = ConsultantProfile.objects.create(user=author, is_active=True)
        version = (BibleReview.objects.filter(project=project).order_by("-version").values_list("version", flat=True).first() or 0) + 1
        return BibleReview.objects.create(project=project, author=consultant, status=BibleReview.Status.DRAFT, version=version)

    def propose_decision(self, *, bible_review, scene, topic, decision_text, user):
        is_member = ProjectMembership.objects.filter(project=bible_review.project, user=user, is_active=True).exists()
        if not (self._is_consultant(user) or is_member or bible_review.project.owner_id == user.id):
            raise PermissionDenied("Only consultants or project members can propose decisions")
        return ReviewDecision.objects.create(
            bible_review=bible_review,
            scene=scene,
            topic=topic,
            decision_text=decision_text,
            proposed_by=user,
        )

    def lock_decision(self, *, decision, user):
        if not (self._is_consultant(user) or self._is_director(user, decision.bible_review.project)):
            raise PermissionDenied("Only consultants or directors can lock decisions")
        decision.status = ReviewDecision.Status.LOCKED
        decision.locked_by = user
        decision.locked_at = timezone.now()
        decision.save(update_fields=["status", "locked_by", "locked_at", "updated_at"])
        return decision

    def reject_decision(self, *, decision, user):
        if not self._is_director(user, decision.bible_review.project):
            raise PermissionDenied("Only directors can reject decisions")
        decision.status = ReviewDecision.Status.REJECTED
        decision.rejected_by = user
        decision.rejected_at = timezone.now()
        decision.save(update_fields=["status", "rejected_by", "rejected_at", "updated_at"])
        return decision
