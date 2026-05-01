from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from src.accounts.models import Studio
from src.projects.models import Project


class CommunityApiTests(TestCase):
    def test_create_session(self):
        user = get_user_model().objects.create_user(email="community@example.com", password="pass123", terms=True)
        client = APIClient()
        client.force_authenticate(user)
        studio = Studio.objects.create(name="COM", slug="com")
        project = Project.objects.create(studio=studio, owner=user, title="Proj", slug="proj-com")
        response = client.post(
            "/api/v1/community/sessions/",
            {
                "project": str(project.pk),
                "title": "Session 1",
                "session_type": "community",
                "status": "draft",
                "created_by": user.pk,
                "visibility": "private",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
