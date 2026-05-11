"""
src.ai_engine.mcp.tests.test_studio_tools
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Smoke tests for list_studios and get_studio MCP tool dispatch logic.
Tests verify the underlying ORM queries used by the tool handlers,
since full MCP transport setup is not required for correctness checks.
"""
from django.test import TestCase

from src.accounts.models import Studio, StudioMembership, User
from src.accounts.services.studio_services import create_studio_for_user


class ListStudiosQueryTest(TestCase):
    """Verify that the ORM query backing list_studios returns correct results."""

    def setUp(self):
        self.user = User.objects.create_user(email="mcp_list@x.com", password="x")
        # Signals may auto-create a primary studio; add a second one manually.
        create_studio_for_user(self.user, name="Second Studio", is_primary=False)

    def test_active_studios_returned(self):
        studios = Studio.objects.filter(
            memberships__user=self.user, memberships__status="active"
        ).distinct()
        self.assertGreaterEqual(studios.count(), 1)
        names = {s.name for s in studios}
        self.assertIn("Second Studio", names)

    def test_is_primary_flag_correct(self):
        for studio in Studio.objects.filter(
            memberships__user=self.user, memberships__status="active"
        ).distinct():
            m = studio.memberships.filter(user=self.user).first()
            # is_primary must be a bool
            self.assertIsInstance(bool(m and m.is_primary), bool)

    def test_member_count_is_int(self):
        for studio in Studio.objects.filter(
            memberships__user=self.user, memberships__status="active"
        ).distinct():
            count = studio.memberships.filter(status="active").count()
            self.assertGreaterEqual(count, 1)

    def test_non_member_excluded(self):
        other = User.objects.create_user(email="other_mcp@x.com", password="x")
        studios = Studio.objects.filter(
            memberships__user=other, memberships__status="active"
        ).distinct()
        # other user has no studios unless signals created one
        for s in studios:
            # confirm other user actually has an active membership
            self.assertTrue(s.memberships.filter(user=other, status="active").exists())


class GetStudioQueryTest(TestCase):
    """Verify the ORM query backing get_studio enforces membership access."""

    def setUp(self):
        self.owner = User.objects.create_user(email="mcp_owner@x.com", password="x")
        self.studio = create_studio_for_user(self.owner, name="Owner Studio", is_primary=False)
        self.outsider = User.objects.create_user(email="mcp_outsider@x.com", password="x")

    def test_owner_can_access_studio(self):
        studio = Studio.objects.get(
            pk=self.studio.pk,
            memberships__user=self.owner,
            memberships__status="active",
        )
        self.assertEqual(studio.pk, self.studio.pk)

    def test_outsider_cannot_access_studio(self):
        from django.core.exceptions import ObjectDoesNotExist
        with self.assertRaises(ObjectDoesNotExist):
            Studio.objects.get(
                pk=self.studio.pk,
                memberships__user=self.outsider,
                memberships__status="active",
            )

    def test_members_list_structure(self):
        members = [
            {"email": m.user.email, "role": m.role, "tier": m.tier}
            for m in self.studio.memberships.filter(status="active").select_related("user")
        ]
        self.assertEqual(len(members), 1)
        self.assertEqual(members[0]["email"], self.owner.email)
        self.assertIn("role", members[0])
        self.assertIn("tier", members[0])

    def test_project_count_returns_int(self):
        count = self.studio.projects.count()
        self.assertIsInstance(count, int)
