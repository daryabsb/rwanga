from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from src.accounts.models import ConsultantProfile, Studio
from src.projects.models import Project
from src.reviews.models import BibleReview


class ReviewsApiTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(email="api-review@example.com", password="pass123", terms=True)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        studio = Studio.objects.create(name="S3", slug="s3")
        project = Project.objects.create(studio=studio, owner=self.user, title="Proj", slug="proj-3")
        consultant = ConsultantProfile.objects.create(user=self.user, is_active=True)
        self.review = BibleReview.objects.create(project=project, author=consultant)

    def test_list_reviews(self):
        response = self.client.get("/api/v1/reviews/bible-reviews/")
        self.assertEqual(response.status_code, 200)

    def test_create_inline_comment_requires_payload(self):
        response = self.client.post("/api/v1/reviews/inline-comments/", {}, format="json")
        self.assertEqual(response.status_code, 400)
