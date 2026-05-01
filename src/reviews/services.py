from django.core.exceptions import PermissionDenied

from src.accounts.models import ConsultantProfile, ProjectMembership
from src.reviews.models import ReviewDecision


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

    def propose_decision(self, *, bible_review, scene, topic, decision_text, user):
        if not self._is_consultant(user):
            raise PermissionDenied("Only consultants can propose decisions")
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
        decision.save(update_fields=["status", "locked_by", "updated_at"])
        return decision

    def reject_decision(self, *, decision, user):
        if not self._is_director(user, decision.bible_review.project):
            raise PermissionDenied("Only directors can reject decisions")
        decision.status = ReviewDecision.Status.REJECTED
        decision.rejected_by = user
        decision.save(update_fields=["status", "rejected_by", "updated_at"])
        return decision
