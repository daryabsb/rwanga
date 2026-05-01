from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient


class NotificationsApiTests(TestCase):
    def test_create_notification(self):
        user = get_user_model().objects.create_user(email="notif@example.com", password="pass123", terms=True)
        client = APIClient()
        client.force_authenticate(user)
        response = client.post(
            "/api/v1/notifications/notifications/",
            {"user": user.pk, "message": "Hello", "notification_type": "info"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
