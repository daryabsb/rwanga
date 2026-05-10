from django.test import TestCase
from src.accounts.models import Studio


class StudioModelTest(TestCase):
    def test_studio_has_specialty_choice(self):
        s = Studio.objects.create(name="X", slug="x-1", specialty="feature_films")
        self.assertEqual(s.specialty, "feature_films")

    def test_studio_api_key_generation(self):
        s = Studio.objects.create(name="Y", slug="y-1")
        token = s.generate_studio_api_key()
        self.assertTrue(token.startswith("rws_"))
        self.assertIsNotNone(s.studio_api_key_hash)

    def test_snapshot_on_delete_field_exists(self):
        from src.accounts.models import Studio
        f = Studio._meta.get_field("snapshot_on_delete")
        self.assertEqual(f.get_internal_type(), "JSONField")
