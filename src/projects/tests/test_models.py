from django.contrib.auth import get_user_model
from django.test import TestCase

from src.accounts.models import Studio
from src.projects.models import Character, Location, Project, Scene


class ProjectsModelTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="owner@example.com", password="pass12345"
        )
        self.studio = Studio.objects.create(name="Studio One", slug="studio-one")

    def test_create_project(self):
        project = Project.objects.create(
            studio=self.studio,
            owner=self.user,
            title="Film A",
            slug="film-a",
        )
        self.assertEqual(project.owner, self.user)

    def test_create_scene_character_location(self):
        project = Project.objects.create(
            studio=self.studio, owner=self.user, title="Film B", slug="film-b"
        )
        scene = Scene.objects.create(project=project, number=1, title="Opening")
        character = Character.objects.create(project=project, name="Hero")
        location = Location.objects.create(project=project, name="Village")
        self.assertEqual(scene.project, project)
        self.assertEqual(character.project, project)
        self.assertEqual(location.project, project)
