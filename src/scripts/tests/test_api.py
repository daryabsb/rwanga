from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from src.accounts.models import Studio
from src.projects.models import Character, Project, Scene
from src.scripts.models import Script


class ScriptsApiTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(email="scripts-api@example.com", password="pass12345")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.studio = Studio.objects.create(name="Scripts API Studio", slug="scripts-api-studio")
        self.project = Project.objects.create(
            studio=self.studio,
            owner=self.user,
            title="Scripts API Film",
            slug="scripts-api-film",
        )
        self.scene = Scene.objects.create(project=self.project, number=1, title="S1")
        self.character = Character.objects.create(project=self.project, name="Hero")

    def test_create_script(self):
        url = f"/api/v1/scripts/projects/{self.project.id}/scripts/"
        response = self.client.post(url, {"project": str(self.project.id), "title": "Draft 1", "content": "INT. ROOM - DAY", "script_format": "fountain"}, format="multipart")
        self.assertEqual(response.status_code, 201)

    def test_create_script_element(self):
        script = Script.objects.create(project=self.project, title="Draft", content="...")
        url = f"/api/v1/scripts/projects/{self.project.id}/scripts/{script.id}/elements/"
        payload = {
            "script": str(script.id),
            "scene": str(self.scene.id),
            "character": str(self.character.id),
            "element_type": "dialogue",
            "content": "Hello",
            "order": 1,
        }
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, 201)
