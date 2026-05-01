from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied
from django.test import TestCase

from src.accounts.models import ConsultantProfile, ProjectMembership, Studio
from src.projects.models import Project
from src.reviews.models import BibleReview, ReviewDecision
from src.reviews.services import ReviewService


class ReviewServiceTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.consultant_user = user_model.objects.create_user(email="consultant@example.com", password="pass123", terms=True)
        self.director_user = user_model.objects.create_user(email="director@example.com", password="pass123", terms=True)
        self.other_user = user_model.objects.create_user(email="other@example.com", password="pass123", terms=True)
        studio = Studio.objects.create(name="S2", slug="s2")
        self.project = Project.objects.create(studio=studio, owner=self.director_user, title="Proj", slug="proj")
        ConsultantProfile.objects.create(user=self.consultant_user, is_active=True)
        ProjectMembership.objects.create(
            user=self.director_user,
            project=self.project,
            role_type=ProjectMembership.RoleType.CREW,
            department_role=ProjectMembership.DepartmentRole.DIRECTOR,
            is_active=True,
        )
        self.review = BibleReview.objects.create(project=self.project, author=ConsultantProfile.objects.get(user=self.consultant_user))
        self.decision = ReviewDecision.objects.create(
            bible_review=self.review,
            topic="topic",
            decision_text="text",
            proposed_by=self.consultant_user,
        )
        self.service = ReviewService()

    def test_consultant_can_lock(self):
        decision = self.service.lock_decision(decision=self.decision, user=self.consultant_user)
        self.assertEqual(decision.status, ReviewDecision.Status.LOCKED)

    def test_director_can_reject(self):
        decision = self.service.reject_decision(decision=self.decision, user=self.director_user)
        self.assertEqual(decision.status, ReviewDecision.Status.REJECTED)

    def test_non_director_cannot_reject(self):
        with self.assertRaises(PermissionDenied):
            self.service.reject_decision(decision=self.decision, user=self.other_user)
