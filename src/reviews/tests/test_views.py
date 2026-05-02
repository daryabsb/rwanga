from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from src.accounts.models import ConsultantProfile, Studio
from src.projects.models import Project
from src.reviews.models import BibleReview, ReviewDecision


class ReviewsViewTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(email="view-review@example.com", password="pass123", terms=True)
        self.client.force_login(self.user)
        studio = Studio.objects.create(name="S4", slug="s4")
        self.project = Project.objects.create(studio=studio, owner=self.user, title="Proj", slug="proj-4")
        self.consultant = ConsultantProfile.objects.create(user=self.user, is_active=True)
        self.review = BibleReview.objects.create(project=self.project, author=self.consultant)

    def test_index_renders(self):
        response = self.client.get(reverse("reviews:index", args=[self.project.pk]))
        self.assertEqual(response.status_code, 200)

    def test_create_review_redirects(self):
        response = self.client.post(reverse("reviews:create"))
        self.assertEqual(response.status_code, 302)

    def test_detail_and_decision_actions(self):
        decision = ReviewDecision.objects.create(
            bible_review=self.review,
            topic="Pace",
            decision_text="Trim",
            proposed_by=self.user,
        )
        detail = self.client.get(reverse("reviews:detail", args=[self.review.pk]))
        self.assertEqual(detail.status_code, 200)
        lock = self.client.post(reverse("reviews:decision_action", args=[decision.pk, "approve"]))
        self.assertEqual(lock.status_code, 302)
