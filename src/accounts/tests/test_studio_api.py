from django.test import TestCase
from rest_framework.test import APIClient
from src.accounts.models import User, Studio


class StudioApiTest(TestCase):
    def test_anonymous_blocked(self):
        c = APIClient()
        r = c.get("/api/v1/accounts/studios/")
        # Should be 401 or 403 — not 200
        self.assertIn(r.status_code, [401, 403])

    def test_authenticated_lists_only_user_studios(self):
        u = User.objects.create_user(email="api1@x.com", password="x")
        # signal creates "My Studio" for u
        # Create an unrelated studio that u has no membership in
        Studio.objects.create(name="Other", slug="other-9k")
        c = APIClient()
        c.force_authenticate(u)
        r = c.get("/api/v1/accounts/studios/")
        self.assertEqual(r.status_code, 200)
        names = [s["name"] for s in r.json()["results"]] if "results" in r.json() else [s["name"] for s in r.json()]
        self.assertIn("My Studio", names)
        self.assertNotIn("Other", names)

    def test_studio_response_includes_subscription_and_no_secrets(self):
        u = User.objects.create_user(email="api2@x.com", password="x")
        c = APIClient()
        c.force_authenticate(u)
        r = c.get("/api/v1/accounts/studios/")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        first = (data["results"] if "results" in data else data)[0]
        self.assertIn("subscription", first)
        sub = first["subscription"]
        self.assertEqual(sub["plan"], "pro")
        self.assertEqual(sub["status"], "trial")
        # secrets must NOT leak
        self.assertNotIn("studio_api_key_hash", first)
        self.assertNotIn("snapshot_on_delete", first)
