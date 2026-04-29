from django.contrib.auth import get_user_model
from django.test import TestCase


class UserManagerTests(TestCase):
    def test_create_user_with_email(self):
        user = get_user_model().objects.create_user(email="manager@example.com", password="pass12345")
        self.assertEqual(user.email, "manager@example.com")
        self.assertTrue(user.check_password("pass12345"))

    def test_create_superuser(self):
        user = get_user_model().objects.create_superuser("admin@example.com", "pass12345")
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
