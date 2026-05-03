from django.contrib.auth import get_user_model
from django.test import TestCase

from src.accounts.models import Studio
from src.projects.models import Project, Scene


class ProjectsViewTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="view-owner@example.com", password="pass12345"
        )
        self.studio = Studio.objects.create(name="Studio View", slug="studio-view")
        self.project = Project.objects.create(
            studio=self.studio, owner=self.user, title="View Film", slug="view-film"
        )
        Scene.objects.create(project=self.project, number=1, title="Scene 1")

    def test_dashboard_view(self):
        response = self.client.get("/projects/")
        self.assertEqual(response.status_code, 200)

    def test_workspace_view(self):
        response = self.client.get(f"/projects/{self.project.id}/")
        self.assertEqual(response.status_code, 200)

    def test_scene_list_view(self):
        response = self.client.get(f"/projects/{self.project.id}/scenes/")
        self.assertEqual(response.status_code, 200)
