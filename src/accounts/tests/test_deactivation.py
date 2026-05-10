from django.test import TestCase
from src.accounts.models import User, Studio
from src.accounts.services.studio_services import create_studio_for_user
from src.accounts.services.deactivation_services import deactivate_account


class DeactivationTest(TestCase):
    def test_deactivate_soft_deletes_user_and_owned_studios(self):
        u = User.objects.create_user(email="dead@x.com", password="x")
        # primary auto-created. Add a second owned studio.
        s2 = create_studio_for_user(u, name="Second")
        deactivate_account(u, by_user=u)
        u.refresh_from_db()
        self.assertFalse(u.is_active)
        from src.accounts.models import Studio
        self.assertEqual(Studio.objects.filter(memberships__user=u).count(), 0)
        self.assertEqual(Studio.all_with_deleted.filter(memberships__user=u).count(), 2)

    def test_deactivate_sets_recovery_grace_on_memberships(self):
        from datetime import timedelta
        from django.utils import timezone
        u = User.objects.create_user(email="dead2@x.com", password="x")
        create_studio_for_user(u, name="Second2")
        deactivate_account(u, by_user=u)
        from src.accounts.models import StudioMembership
        memberships = StudioMembership.all_with_deleted.filter(user=u)
        self.assertGreater(memberships.count(), 0)
        for m in memberships:
            self.assertIsNotNone(m.recovery_grace_until)
            delta = m.recovery_grace_until - m.deleted_at
            self.assertAlmostEqual(delta, timedelta(days=30), delta=timedelta(seconds=2))
