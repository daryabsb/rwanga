from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient


class LocationsApiTests(TestCase):
    def test_create_location(self):
        user = get_user_model().objects.create_user(email="loc@example.com", password="pass123", terms=True)
        client = APIClient()
        client.force_authenticate(user)
        response = client.post("/api/v1/locations/locations/", {"name": "Loc A"}, format="json")
        self.assertEqual(response.status_code, 201)
