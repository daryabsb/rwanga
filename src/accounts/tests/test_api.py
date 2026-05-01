from django.test import TestCase
from src.accounts.models import User
from rest_framework.test import APIClient


class AccountsApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_create_studio(self):
        payload = {"name": "Studio API", "slug": "studio-api"}
        response = self.client.post("/api/v1/accounts/studios/", payload, format="json")
        self.assertEqual(response.status_code, 201)

    def test_list_studios(self):
        response = self.client.get("/api/v1/accounts/studios/")
        self.assertEqual(response.status_code, 200)

    def test_obtain_token_with_valid_credentials(self):
        user = User.objects.create_user(email="token-user@example.com", password="root", terms=True)
        response = self.client.post(
            "/api/v1/auth/token/",
            {"email": "token-user@example.com", "password": "root"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("token", response.data)
        self.assertEqual(response.data["user_id"], user.pk)
        self.assertEqual(response.data["email"], "token-user@example.com")
