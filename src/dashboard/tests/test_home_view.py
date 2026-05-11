from django.test import TestCase, Client
from django.urls import reverse
from src.accounts.models import User


class HomeViewTest(TestCase):
    def test_home_redirects_anonymous_to_root(self):
        c = Client()
        r = c.get(reverse("dashboard:home"))
        # LoginRequiredMiddleware → 302 to /
        self.assertEqual(r.status_code, 302)

    def test_home_renders_for_authenticated_user(self):
        u = User.objects.create_user(email="h@x.com", password="x")
        c = Client()
        c.force_login(u)
        r = c.get(reverse("dashboard:home"))
        self.assertEqual(r.status_code, 200)
        body = r.content.decode()
        self.assertIn("Good", body)  # greeting
        self.assertIn("Recent Projects", body)
        self.assertIn("My Tasks", body)
        self.assertIn("Recent Activity", body)
        self.assertIn("col-lg-4", body)  # responsive grid

    def test_root_redirects_authenticated_to_dashboard(self):
        u = User.objects.create_user(email="r@x.com", password="x")
        c = Client()
        c.force_login(u)
        r = c.get("/")
        self.assertEqual(r.status_code, 302)
        self.assertIn("/dashboard/", r.url)
