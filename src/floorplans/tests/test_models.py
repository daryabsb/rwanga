from django.contrib.auth import get_user_model
from django.test import TestCase

from src.accounts.models import Studio
from src.floorplans.models import FloorPlan
from src.projects.models import Project, Scene


class FloorPlanModelTests(TestCase):
    def test_create_floorplan(self):
        user = get_user_model().objects.create_user(email="fp@example.com", password="pass123", terms=True)
        studio = Studio.objects.create(name="FP", slug="fp")
        project = Project.objects.create(studio=studio, owner=user, title="P", slug="p-fp")
        scene = Scene.objects.create(project=project, number=1, title="S")
        fp = FloorPlan.objects.create(scene=scene, name="Main")
        self.assertEqual(fp.name, "Main")
