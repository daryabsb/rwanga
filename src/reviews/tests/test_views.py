from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from src.accounts.models import Studio
from src.projects.models import Project


class ReviewsViewTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(email="view-review@example.com", password="pass123", terms=True)
        self.client.force_login(self.user)
        studio = Studio.objects.create(name="S4", slug="s4")
        self.project = Project.objects.create(studio=studio, owner=self.user, title="Proj", slug="proj-4")

    def test_index_renders(self):
        response = self.client.get(reverse("reviews:index", args=[self.project.pk]))
        self.assertEqual(response.status_code, 200)
