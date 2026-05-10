from django.test import TestCase
from src.accounts.models import Studio


class VersioningTest(TestCase):
    def test_save_creates_version(self):
        s = Studio.objects.create(name="Original", slug="v-test-1")
        self.assertEqual(s.versions.count(), 1)
        s.name = "Renamed"
        s.save()
        self.assertEqual(s.versions.count(), 2)
        self.assertEqual(s.versions.order_by("-version_number").first().snapshot_json["name"], "Renamed")

    def test_revert_restores_field_state(self):
        s = Studio.objects.create(name="Original", slug="v-test-2")
        s.name = "Renamed"
        s.save()
        first_version = s.versions.order_by("version_number").first()
        s.revert_to(first_version.version_number)
        s.refresh_from_db()
        self.assertEqual(s.name, "Original")
