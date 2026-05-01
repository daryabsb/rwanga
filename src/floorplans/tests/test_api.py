from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from src.accounts.models import Studio
from src.floorplans.models import FloorPlan
from src.projects.models import Project, Scene


class FloorPlanApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(email="fp4@example.com", password="pass123", terms=True)
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        studio = Studio.objects.create(name="FP4", slug="fp4")
        project = Project.objects.create(studio=studio, owner=self.user, title="P4", slug="p-fp4")
        self.scene = Scene.objects.create(project=project, number=1, title="S")

    def test_create_floorplan(self):
        response = self.client.post("/api/v1/floorplans/floorplans/", {"scene": str(self.scene.pk), "name": "Main"}, format="json")
        self.assertEqual(response.status_code, 201)
