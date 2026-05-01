from django.contrib.auth import get_user_model
from django.test import TestCase

from src.accounts.models import Studio
from src.projects.models import Project, Scene
from src.shots.models import Shot
from src.shots.services import ShotService


class ShotServiceTests(TestCase):
    def test_filter_by_type(self):
        user = get_user_model().objects.create_user(email="shot2@example.com", password="pass123", terms=True)
        studio = Studio.objects.create(name="SS2", slug="ss2")
        project = Project.objects.create(studio=studio, owner=user, title="P2", slug="p-shot2")
        scene = Scene.objects.create(project=project, number=1, title="S1")
        Shot.objects.create(scene=scene, shot_number="1", shot_type="dialogue")
        Shot.objects.create(scene=scene, shot_number="2", shot_type="visual")
        qs = ShotService().list_project_shots(project=project, shot_type="dialogue")
        self.assertEqual(qs.count(), 1)
