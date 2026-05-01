from django.contrib.auth import get_user_model
from django.test import TestCase

from src.accounts.models import Studio
from src.projects.models import Project, Scene
from src.shots.models import Shot


class ShotModelTests(TestCase):
    def test_create_shot(self):
        user = get_user_model().objects.create_user(email="shot@example.com", password="pass123", terms=True)
        studio = Studio.objects.create(name="SS", slug="ss")
        project = Project.objects.create(studio=studio, owner=user, title="P", slug="p-shot")
        scene = Scene.objects.create(project=project, number=1, title="S1")
        shot = Shot.objects.create(scene=scene, shot_number="1.1")
        self.assertEqual(shot.number, "1.1")
