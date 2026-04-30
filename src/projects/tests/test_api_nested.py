from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from src.accounts.models import Studio
from src.projects.models import Project


class ProjectsNestedApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(email="nested-api@example.com", password="pass12345")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.studio = Studio.objects.create(name="Nested Studio", slug="nested-studio")
        self.project = Project.objects.create(studio=self.studio, owner=self.user, title="Nested Film", slug="nested-film")

    def test_create_scene_under_project(self):
        url = f"/api/v1/projects/projects/{self.project.id}/scenes/"
        payload = {"scene_number": 1, "heading": "INT. HOUSE - DAY", "description": "Opening scene"}
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, 201)

    def test_create_character_under_project(self):
        url = f"/api/v1/projects/projects/{self.project.id}/characters/"
        payload = {"name": "Ali", "description": "Lead role", "character_type": "lead"}
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, 201)

    def test_create_location_under_project(self):
        url = f"/api/v1/projects/projects/{self.project.id}/locations/"
        payload = {"name": "Old Market", "description": "Main location", "int_ext": "ext"}
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, 201)
