from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from src.core.mixins import SoftDeleteModel


class SoftDeleteMixinTest(TestCase):
    def test_default_manager_excludes_soft_deleted(self):
        from src.accounts.models import Studio  # uses SoftDeleteModel
        s = Studio.objects.create(name="Test", slug="test-1")
        s.soft_delete(by_user=None)
        self.assertNotIn(s, Studio.objects.all())
        self.assertIn(s, Studio.all_with_deleted.all())

    def test_recovery_grace_until_set_on_soft_delete(self):
        from src.accounts.models import Studio
        s = Studio.objects.create(name="Test2", slug="test-2")
        s.soft_delete(by_user=None)
        self.assertIsNotNone(s.deleted_at)
        self.assertEqual(
            (s.recovery_grace_until - s.deleted_at).days, 30
        )
