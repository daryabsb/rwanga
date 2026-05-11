from django.test import TestCase
from rest_framework.test import APIClient

from src.accounts.models import User
from src.accounts.services.studio_services import create_studio_for_user
from src.projects.models import Project


class ProjectApiTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="papi@x.com", password="x")
        self.studio = create_studio_for_user(self.user, name="PAPI")
        self.project = Project.objects.create(
            studio=self.studio,
            title="T",
            name="T",
            slug="papi-1",
            project_type="feature",
            created_by=self.user,
            owner=self.user,
        )

    def test_anonymous_blocked(self):
        c = APIClient()
        r = c.get("/api/v1/projects/projects/")
        self.assertIn(r.status_code, [401, 403])

    def test_list_only_user_projects(self):
        other_user = User.objects.create_user(email="papi2@x.com", password="x")
        other_studio = create_studio_for_user(other_user, name="OTHER")
        Project.objects.create(
            studio=other_studio,
            title="OT",
            name="OT",
            slug="papi-other",
            project_type="feature",
            created_by=other_user,
            owner=other_user,
        )
        c = APIClient()
        c.force_authenticate(self.user)
        r = c.get("/api/v1/projects/projects/")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        results = data["results"] if "results" in data else data
        titles = [p["title"] for p in results]
        self.assertIn("T", titles)
        self.assertNotIn("OT", titles)

    def test_response_includes_v2_fields(self):
        c = APIClient()
        c.force_authenticate(self.user)
        r = c.get(f"/api/v1/projects/projects/{self.project.pk}/")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        # alias-and-add: both legacy and v2 fields appear
        self.assertEqual(body["title"], "T")
        self.assertEqual(body["name"], "T")
        self.assertEqual(body["project_type"], "feature")
        # metadata fields present (may be null/empty)
        for f in (
            "logline",
            "language",
            "director_credit",
            "estimated_shoot_start",
            "estimated_length_minutes",
            "ai_context_notes",
        ):
            self.assertIn(f, body)
        # v2 alias fields present
        self.assertIn("created_by", body)
        self.assertIn("status_changed_at", body)
        self.assertIn("status_changed_by", body)
