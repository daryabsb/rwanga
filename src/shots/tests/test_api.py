from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from src.accounts.models import Studio
from src.projects.models import Project, Scene


class ShotApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(email="shot4@example.com", password="pass123", terms=True)
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        studio = Studio.objects.create(name="SS4", slug="ss4")
        self.project = Project.objects.create(studio=studio, owner=self.user, title="P4", slug="p-shot4")
        self.scene = Scene.objects.create(project=self.project, number=1, title="S1")

    def test_create_shot(self):
        payload = {"scene": str(self.scene.pk), "shot_number": "1.1", "shot_type": "visual"}
        response = self.client.post("/api/v1/shots/shots/", payload, format="json")
        self.assertEqual(response.status_code, 201)
