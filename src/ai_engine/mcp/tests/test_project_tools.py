"""
src.ai_engine.mcp.tests.test_project_tools
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Smoke tests for list_projects, get_project, and create_project MCP tool
dispatch logic. Tests verify the underlying ORM queries and service calls
used by the tool handlers, mirroring the pattern in test_studio_tools.py.
"""
from django.test import TestCase

from src.accounts.models import Studio, StudioMembership, User
from src.accounts.services.studio_services import create_studio_for_user
from src.projects.models import Project
from src.projects.services.lifecycle_services import create_project


class ListProjectsQueryTest(TestCase):
    """Verify the ORM query backing list_projects returns correct results."""

    def setUp(self):
        self.user = User.objects.create_user(email="mcp_proj_list@x.com", password="x")
        self.studio = create_studio_for_user(self.user, name="Proj List Studio", is_primary=False)
        self.project = create_project(
            studio=self.studio, user=self.user, name="Test Film", project_type="feature"
        )

    def test_owner_project_returned(self):
        from django.db.models import Q
        qs = Project.objects.filter(
            Q(owner=self.user) | Q(created_by=self.user) | Q(memberships__user=self.user)
        ).distinct()
        self.assertIn(self.project, qs)

    def test_studio_id_filter_scopes_results(self):
        from django.db.models import Q
        # Create a second studio + project
        other_studio = create_studio_for_user(self.user, name="Other Studio", is_primary=False)
        other_project = create_project(
            studio=other_studio, user=self.user, name="Other Film", project_type="feature"
        )
        qs = Project.objects.filter(
            Q(owner=self.user) | Q(created_by=self.user) | Q(memberships__user=self.user)
        ).distinct().filter(studio_id=self.studio.id)
        self.assertIn(self.project, qs)
        self.assertNotIn(other_project, qs)


class GetProjectQueryTest(TestCase):
    """Verify the ORM query backing get_project enforces access control."""

    def setUp(self):
        self.owner = User.objects.create_user(email="mcp_proj_owner@x.com", password="x")
        self.studio = create_studio_for_user(self.owner, name="Get Proj Studio", is_primary=False)
        self.project = create_project(
            studio=self.studio, user=self.owner, name="Access Film", project_type="feature"
        )
        self.outsider = User.objects.create_user(email="mcp_proj_outsider@x.com", password="x")

    def test_outsider_gets_no_result(self):
        from django.db.models import Q
        result = Project.objects.filter(
            Q(owner=self.outsider) | Q(created_by=self.outsider) | Q(memberships__user=self.outsider)
        ).filter(pk=self.project.pk).first()
        self.assertIsNone(result)

    def test_owner_gets_project(self):
        from django.db.models import Q
        result = Project.objects.filter(
            Q(owner=self.owner) | Q(created_by=self.owner) | Q(memberships__user=self.owner)
        ).filter(pk=self.project.pk).select_related("studio").first()
        self.assertIsNotNone(result)
        self.assertEqual(result.pk, self.project.pk)


class CreateProjectServiceTest(TestCase):
    """Verify that create_project service produces a draft project."""

    def setUp(self):
        self.user = User.objects.create_user(email="mcp_proj_create@x.com", password="x")
        self.studio = create_studio_for_user(self.user, name="Create Proj Studio", is_primary=False)

    def test_create_project_returns_draft(self):
        project = create_project(
            studio=self.studio, user=self.user, name="New Film", project_type="feature"
        )
        self.assertIsNotNone(project.pk)
        self.assertEqual(project.status, "draft")
        self.assertEqual(project.studio, self.studio)
        self.assertEqual(project.owner, self.user)

    def test_create_project_studio_membership_guard(self):
        """User without active studio membership should not be able to reach create_project
        via the tool (the tool guards before calling the service). Verify the ORM guard works."""
        outsider = User.objects.create_user(email="mcp_outsider2@x.com", password="x")
        # The tool does: Studio.objects.get(pk=studio_id, memberships__user=outsider, memberships__status="active")
        with self.assertRaises(Studio.DoesNotExist):
            Studio.objects.get(
                pk=self.studio.pk,
                memberships__user=outsider,
                memberships__status="active",
            )
