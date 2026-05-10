from django.test import TestCase
from src.core.services import snapshot_related


class SnapshotTest(TestCase):
    def test_snapshot_captures_related_data(self):
        from src.accounts.models import Studio, User
        u = User.objects.create_user(email="t@example.com", password="x")
        s = Studio.objects.create(name="X", slug="snap-1")
        snapshot = snapshot_related(s, depth=1)
        self.assertIn("self", snapshot)
        self.assertEqual(snapshot["self"]["name"], "X")
        self.assertIn("related", snapshot)
