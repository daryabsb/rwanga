from django.test import TestCase
from src.accounts.services.studio_services import create_studio_for_user
from src.accounts.models import User
from src.projects.models import Project


class ProjectModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="p@x.com", password="x")
        self.studio = create_studio_for_user(self.user, name="S")

    def test_project_status_default_draft(self):
        p = Project.objects.create(
            studio=self.studio, title="P", name="P", slug="p-1",
            project_type="feature", created_by=self.user, owner=self.user,
        )
        self.assertEqual(p.status, "draft")

    def test_project_has_metadata_optional_fields(self):
        p = Project.objects.create(
            studio=self.studio, title="P2", name="P2", slug="p-2",
            project_type="feature", created_by=self.user, owner=self.user,
        )
        for field in ("logline", "language", "director_credit", "estimated_shoot_start", "estimated_length_minutes", "ai_context_notes"):
            self.assertTrue(hasattr(p, field), f"missing field {field}")

    def test_name_latin_field_present(self):
        p = Project.objects.create(
            studio=self.studio, title="مشروع", name="مشروع", name_latin="mashrou",
            slug="p-3", project_type="feature", created_by=self.user, owner=self.user,
        )
        self.assertEqual(p.name_latin, "mashrou")
