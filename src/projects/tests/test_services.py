from django.contrib.auth import get_user_model
from django.test import TestCase

from src.accounts.models import Studio
from src.projects.models import Character, Location, Scene
from src.projects.services import ProjectsService


class ProjectsServiceTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="service@example.com", password="pass12345"
        )
        self.studio = Studio.objects.create(name="Studio Service", slug="studio-service")

    def test_create_project_service(self):
        project = ProjectsService.create_project(
            studio=self.studio, owner=self.user, title="Svc Film", slug="svc-film"
        )
        self.assertEqual(project.slug, "svc-film")

    def test_scene_character_location_crud_services(self):
        project = ProjectsService.create_project(
            studio=self.studio, owner=self.user, title="Svc Film 2", slug="svc-film-2"
        )
        scene = ProjectsService.create_scene(project=project, number=1, title="Opening")
        character = ProjectsService.create_character(project=project, name="Lead")
        location = ProjectsService.create_location(project=project, name="City")

        scene = ProjectsService.update_scene(scene, title="Opening Updated")
        character = ProjectsService.update_character(character, bio="Main lead")
        location = ProjectsService.update_location(location, description="Downtown")

        self.assertEqual(scene.title, "Opening Updated")
        self.assertEqual(character.bio, "Main lead")
        self.assertEqual(location.description, "Downtown")

        ProjectsService.delete_scene(scene)
        ProjectsService.delete_character(character)
        ProjectsService.delete_location(location)

        self.assertFalse(Scene.objects.filter(id=scene.id).exists())
        self.assertFalse(Character.objects.filter(id=character.id).exists())
        self.assertFalse(Location.objects.filter(id=location.id).exists())
