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
        if project.bible_status == "final":
            raise ValueError("Bible is final and cannot be reviewed again")
        if not ProjectMembership.objects.filter(project=project, user=author, is_active=True).exists() and project.owner_id != author.id:
            raise PermissionDenied("Author must be a project member")
        consultant = ConsultantProfile.objects.filter(user=author, is_active=True).first()
        if consultant is None:
            consultant = ConsultantProfile.objects.create(user=author, is_active=True)
        version = (BibleReview.objects.filter(project=project).order_by("-version").values_list("version", flat=True).first() or 0) + 1
        review = BibleReview.objects.create(
            project=project,
            author=consultant,
            status=BibleReview.Status.DRAFT,
            version=version,
            content=project.canonical_bible or {},
            bible_snapshot_version=project.bible_version,
        )
        project.bible_status = "in_review"
        project.save(update_fields=["bible_status", "updated_at"])
        return review

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

    def lock_decision(self, *, decision, user, comment=""):
        if not (self._is_consultant(user) or self._is_director(user, decision.bible_review.project)):
            raise PermissionDenied("Only consultants or directors can lock decisions")
        decision.status = ReviewDecision.Status.LOCKED
        decision.locked_by = user
        decision.locked_at = timezone.now()
        decision.lock_comment = comment or ""
        decision.save(update_fields=["status", "locked_by", "locked_at", "lock_comment", "updated_at"])
        return decision


    def repropose_decision(self, *, original_decision, user, new_topic=None, new_text=None):
        if original_decision.status != ReviewDecision.Status.REJECTED:
            raise PermissionDenied("Only rejected decisions can be reproposed")
        is_member = ProjectMembership.objects.filter(project=original_decision.bible_review.project, user=user, is_active=True).exists()
        if not (self._is_consultant(user) or is_member or original_decision.bible_review.project.owner_id == user.id):
            raise PermissionDenied("Only consultants or project members can repropose decisions")
        return ReviewDecision.objects.create(
            bible_review=original_decision.bible_review,
            scene=original_decision.scene,
            topic=new_topic or original_decision.topic,
            decision_text=new_text or original_decision.decision_text,
            status=ReviewDecision.Status.PROPOSED,
            proposed_by=user,
            reproposed_from=original_decision,
        )

    @staticmethod
    def deliver_review(*, review, delivered_by):
        project = review.project
        if project.bible_status == "final":
            raise ValueError("Bible is already final")
        project.canonical_bible = review.content if isinstance(review.content, dict) else {"text": review.content}
        project.bible_version = (project.bible_version or 0) + 1
        project.bible_status = "draft"
        project.save(update_fields=["canonical_bible", "bible_version", "bible_status", "updated_at"])
        review.status = BibleReview.Status.DELIVERED
        review.save(update_fields=["status", "updated_at"])
        return review

    @staticmethod
    def finalize_bible(*, project, finalized_by):
        active_reviews = BibleReview.objects.filter(project=project).exclude(status__in=[BibleReview.Status.DELIVERED, BibleReview.Status.DRAFT])
        if active_reviews.exists():
            raise ValueError("There are active reviews")
        project.bible_status = "final"
        project.bible_finalized_at = timezone.now()
        project.bible_finalized_by = finalized_by
        project.save(update_fields=["bible_status", "bible_finalized_at", "bible_finalized_by", "updated_at"])
        return project

    @staticmethod
    def set_bible_from_content(*, project, content, set_by=None):
        if project.bible_status == "final":
            raise ValueError("Bible is already final")
        project.canonical_bible = content if isinstance(content, dict) else {"text": content}
        project.bible_version = (project.bible_version or 0) + 1
        project.bible_status = "draft"
        project.save(update_fields=["canonical_bible", "bible_version", "bible_status", "updated_at"])
        return project

    def reject_decision(self, *, decision, user, reason=""):
        if not self._is_director(user, decision.bible_review.project):
            raise PermissionDenied("Only directors can reject decisions")
        decision.status = ReviewDecision.Status.REJECTED
        decision.rejected_by = user
        decision.rejected_at = timezone.now()
        decision.reject_reason = reason or ""
        decision.save(update_fields=["status", "rejected_by", "rejected_at", "reject_reason", "updated_at"])
        return decision
