from django.contrib.auth import get_user_model
from django.test import TestCase

from src.accounts.models import Studio
from src.exports.services import ExportService
from src.projects.models import Project, Scene
from src.shots.models import Shot


class ExportServiceTests(TestCase):
    def setUp(self):
        user = get_user_model().objects.create_user(email="exp@example.com", password="pass123", terms=True)
        studio = Studio.objects.create(name="EX", slug="ex")
        self.project = Project.objects.create(studio=studio, owner=user, title="Proj", slug="proj-ex")
        self.scene = Scene.objects.create(project=self.project, number=1, title="Scene 1")
        Shot.objects.create(scene=self.scene, shot_number="1.1", shot_type="visual", description="Desc")

    def test_scene_viewer_html_contains_scene(self):
        html = ExportService().generate_scene_viewer(self.scene)
        self.assertIn("Scene 1", html)
