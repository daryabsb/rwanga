from django.test import TestCase
from src.accounts.models import User, Studio, StudioMembership


class SignupSignalTest(TestCase):
    def test_signup_creates_my_studio(self):
        u = User.objects.create_user(email="new@x.com", password="x")
        s = Studio.objects.get(memberships__user=u, memberships__is_primary=True)
        self.assertEqual(s.name, "My Studio")
        m = StudioMembership.objects.get(user=u, is_primary=True)
        self.assertEqual(m.role, "owner")
