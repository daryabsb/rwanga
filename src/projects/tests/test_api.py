from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from src.accounts.models import Studio
from src.projects.models import Project


class ProjectsApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            email="api-owner@example.com", password="pass12345"
        )
        self.studio = Studio.objects.create(name="Studio API", slug="studio-api")
        self.client.force_authenticate(user=self.user)

    def test_create_project(self):
        payload = {
            "studio": str(self.studio.id),
            "owner": self.user.id,
            "title": "API Film",
            "slug": "api-film",
        }
        response = self.client.post("/api/v1/projects/projects/", payload, format="json")
        self.assertEqual(response.status_code, 201)

    def test_list_projects(self):
        response = self.client.get("/api/v1/projects/projects/")
        self.assertEqual(response.status_code, 200)

    def test_projects_full_crud(self):
        project = Project.objects.create(
            studio=self.studio, owner=self.user, title="Project CRUD", slug="project-crud"
        )
        detail_url = f"/api/v1/projects/projects/{project.id}/"
        patch_response = self.client.patch(detail_url, {"title": "Project CRUD Updated"}, format="json")
        self.assertEqual(patch_response.status_code, 200)
        delete_response = self.client.delete(detail_url)
        self.assertEqual(delete_response.status_code, 204)

    def test_scenes_full_crud(self):
        project = Project.objects.create(
            studio=self.studio, owner=self.user, title="Scene Film", slug="scene-film"
        )
        create_payload = {"project": str(project.id), "number": 1, "title": "Scene A"}
        create_response = self.client.post("/api/v1/projects/scenes/", create_payload, format="json")
        self.assertEqual(create_response.status_code, 201)
        scene_id = create_response.data["id"]
        detail_url = f"/api/v1/projects/scenes/{scene_id}/"
        retrieve_response = self.client.get(detail_url)
        self.assertEqual(retrieve_response.status_code, 200)
        patch_response = self.client.patch(detail_url, {"title": "Scene A+"}, format="json")
        self.assertEqual(patch_response.status_code, 200)
        delete_response = self.client.delete(detail_url)
        self.assertEqual(delete_response.status_code, 204)

    def test_characters_full_crud(self):
        project = Project.objects.create(
            studio=self.studio, owner=self.user, title="Character Film", slug="character-film"
        )
        create_payload = {"project": str(project.id), "name": "Hero"}
        create_response = self.client.post(
            "/api/v1/projects/characters/", create_payload, format="json"
        )
        self.assertEqual(create_response.status_code, 201)
        character_id = create_response.data["id"]
        detail_url = f"/api/v1/projects/characters/{character_id}/"
        retrieve_response = self.client.get(detail_url)
        self.assertEqual(retrieve_response.status_code, 200)
        patch_response = self.client.patch(detail_url, {"bio": "Lead role"}, format="json")
        self.assertEqual(patch_response.status_code, 200)
        delete_response = self.client.delete(detail_url)
        self.assertEqual(delete_response.status_code, 204)

    def test_locations_full_crud(self):
        project = Project.objects.create(
            studio=self.studio, owner=self.user, title="Location Film", slug="location-film"
        )
        create_payload = {"project": str(project.id), "name": "Village"}
        create_response = self.client.post("/api/v1/projects/locations/", create_payload, format="json")
        self.assertEqual(create_response.status_code, 201)
        location_id = create_response.data["id"]
        detail_url = f"/api/v1/projects/locations/{location_id}/"
        retrieve_response = self.client.get(detail_url)
        self.assertEqual(retrieve_response.status_code, 200)
        patch_response = self.client.patch(detail_url, {"description": "Outer village"}, format="json")
        self.assertEqual(patch_response.status_code, 200)
        delete_response = self.client.delete(detail_url)
        self.assertEqual(delete_response.status_code, 204)
