from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from src.accounts.models import Studio
from src.projects.models import Project


class FloorPlanViewTests(TestCase):
    def test_list_page(self):
        user = get_user_model().objects.create_user(email="fp3@example.com", password="pass123", terms=True)
        self.client.force_login(user)
        studio = Studio.objects.create(name="FP3", slug="fp3")
        project = Project.objects.create(studio=studio, owner=user, title="P3", slug="p-fp3")
        response = self.client.get(reverse("floorplans:list", args=[project.pk]))
        self.assertEqual(response.status_code, 200)
