from django.test import TestCase
from rest_framework.test import APIClient
from src.accounts.models import User


class AccountsApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(email="testapi@x.com", password="x")
        self.client.force_authenticate(self.user)

    def test_create_studio(self):
        payload = {"name": "Studio API", "slug": "studio-api"}
        response = self.client.post("/api/v1/accounts/studios/", payload, format="json")
        self.assertEqual(response.status_code, 201)

    def test_list_studios(self):
        response = self.client.get("/api/v1/accounts/studios/")
        self.assertEqual(response.status_code, 200)
