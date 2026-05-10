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
