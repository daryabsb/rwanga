from django.test import TestCase
from django.db import IntegrityError
from src.accounts.models import User, Studio, StudioMembership


class StudioMembershipTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="m@x.com", password="x")
        self.studio = Studio.objects.create(name="S", slug="s-1")

    def test_membership_default_role_member(self):
        m = StudioMembership.objects.create(user=self.user, studio=self.studio)
        self.assertEqual(m.role, "member")
        self.assertEqual(m.tier, "production")

    def test_only_one_primary_per_user(self):
        # Signal auto-creates "My Studio" as the primary when User is created.
        # Attempting a second is_primary membership must raise IntegrityError.
        with self.assertRaises(IntegrityError):
            StudioMembership.objects.create(user=self.user, studio=self.studio, is_primary=True)
