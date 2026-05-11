from django.test import TestCase, Client
from django.urls import reverse
from src.accounts.models import User
from src.accounts.services.studio_services import create_studio_for_user


class SwitcherViewsTest(TestCase):
    def test_switch_studio_updates_session(self):
        u = User.objects.create_user(email="sw@x.com", password="x")
        s2 = create_studio_for_user(u, name="Second")
        c = Client()
        c.force_login(u)
        c.post(reverse("accounts:switch_studio"), {"studio_id": str(s2.id)})
        self.assertEqual(c.session["active_studio_id"], str(s2.id))

    def test_exit_studio_returns_to_primary(self):
        u = User.objects.create_user(email="ex@x.com", password="x")
        primary = u.studio_memberships.get(is_primary=True).studio
        s2 = create_studio_for_user(u, name="Second2")
        c = Client()
        c.force_login(u)
        # Switch to s2 first
        c.post(reverse("accounts:switch_studio"), {"studio_id": str(s2.id)})
        self.assertEqual(c.session["active_studio_id"], str(s2.id))
        # Now exit
        c.post(reverse("accounts:exit_studio"))
        self.assertEqual(c.session["active_studio_id"], str(primary.id))
