from django.test import TestCase
from src.accounts.models import User, ProjectMembership
from src.accounts.services.studio_services import create_studio_for_user
from src.projects.models import Project


class ProjectMembershipTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="pm@x.com", password="x")
        self.studio = create_studio_for_user(self.user, name="S")
        self.project = Project.objects.create(
            studio=self.studio, title="P", name="P", slug="p-pm",
            project_type="feature", created_by=self.user, owner=self.user,
        )

    def test_tier_default_production(self):
        m = ProjectMembership.objects.create(
            user=self.user, project=self.project, role_type="crew",
        )
        self.assertEqual(m.tier, "production")

    def test_tier_can_be_community(self):
        m = ProjectMembership.objects.create(
            user=self.user, project=self.project, role_type="internal_reviewer", tier="community",
        )
        self.assertEqual(m.tier, "community")
