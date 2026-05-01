from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from src.accounts.models import Studio
from src.projects.models import Project


class SchedulingApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(email="sched@example.com", password="pass123", terms=True)
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        studio = Studio.objects.create(name="SC", slug="sc")
        self.project = Project.objects.create(studio=studio, owner=self.user, title="Proj", slug="proj-sc")

    def test_create_shoot_day(self):
        response = self.client.post(
            "/api/v1/scheduling/shoot-days/",
            {"project": str(self.project.pk), "date": "2026-01-01", "day_number": 1},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
