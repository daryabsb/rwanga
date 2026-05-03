from django.test import TestCase
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
