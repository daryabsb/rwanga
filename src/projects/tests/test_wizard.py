from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from src.projects.models import Project


class ProjectWizardTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="wizard@example.com", password="pass12345"
        )
        self.client.force_login(self.user)

    def test_step1_creates_project_and_stores_session(self):
        response = self.client.post(
            reverse("projects:create_step", args=[1]),
            {
                "title": "تاقیکردنەوەی پڕۆژە",
                "title_latin": "Test Film",
                "project_type": "feature",
                "director_name": "Director",
                "logline": "Sample logline",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Project.objects.count(), 1)
        project = Project.objects.first()
        self.assertEqual(project.title, "تاقیکردنەوەی پڕۆژە")
        self.assertEqual(project.status, "draft")
        self.assertEqual(self.client.session.get("wizard_project_id"), str(project.pk))

    def test_step1_requires_title(self):
        response = self.client.post(
            reverse("projects:create_step", args=[1]),
            {"title": "", "project_type": "feature"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Project.objects.count(), 0)

    def test_step4_redirects_to_dashboard_and_activates_project(self):
        self.client.post(
            reverse("projects:create_step", args=[1]),
            {
                "title": "Wizard Flow Film",
                "title_latin": "Wizard Flow Film",
                "project_type": "short",
            },
        )
        project = Project.objects.first()
        self.client.post(
            reverse("projects:create_step", args=[2]),
            {"project_id": str(project.pk), "skip": "true"},
        )
        self.client.post(
            reverse("projects:create_step", args=[3]),
            {"project_id": str(project.pk), "modules": ["scripts", "shots"]},
        )
        response = self.client.post(
            reverse("projects:create_step", args=[4]),
            {
                "project_id": str(project.pk),
                "email": ["crew@example.com"],
                "role": ["ad"],
            },
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(
            response.url,
            reverse("projects:dashboard", args=[project.pk]),
        )
        project.refresh_from_db()
        self.assertEqual(project.status, "active")
