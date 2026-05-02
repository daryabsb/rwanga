from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from src.accounts.models import Studio
from src.community.models import ReviewSession
from src.projects.models import Project


class CommunityViewTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(email="cv@example.com", password="pass123", terms=True)
        self.client.force_login(self.user)
        studio = Studio.objects.create(name="CV", slug="cv")
        self.project = Project.objects.create(studio=studio, owner=self.user, title="P", slug="p-cv")
        self.session = ReviewSession.objects.create(project=self.project, title="Sess", created_by=self.user)

    def test_list_and_detail(self):
        self.assertEqual(self.client.get(reverse("community:list")).status_code, 200)
        self.assertEqual(self.client.get(reverse("community:detail", args=[self.session.pk])).status_code, 200)

    def test_create_session(self):
        response = self.client.post(reverse("community:create"), {"title": "X", "session_type": "screenplay", "visibility": "invite_only"})
        self.assertEqual(response.status_code, 302)
