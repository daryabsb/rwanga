from django.contrib.auth import get_user_model
from django.test import TestCase

from src.accounts.models import Studio
from src.floorplans.services import FloorPlanService
from src.projects.models import Project, Scene
from src.floorplans.models import FloorPlan


class FloorPlanServiceTests(TestCase):
    def test_list_for_project(self):
        user = get_user_model().objects.create_user(email="fp2@example.com", password="pass123", terms=True)
        studio = Studio.objects.create(name="FP2", slug="fp2")
        project = Project.objects.create(studio=studio, owner=user, title="P2", slug="p-fp2")
        scene = Scene.objects.create(project=project, number=1, title="S")
        FloorPlan.objects.create(scene=scene, name="Main")
        self.assertEqual(FloorPlanService().list_for_project(project=project).count(), 1)
