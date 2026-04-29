from django.test import TestCase
from rest_framework.test import APIClient


class ProgressApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_list_progress_tasks(self):
        response = self.client.get("/api/v1/progress/tasks/")
        self.assertEqual(response.status_code, 200)

    def test_create_progress_task(self):
        payload = {
            "title": "P0 progress app",
            "description": "Build db-backed progress tracking",
            "task_type": "implementation",
            "phase": "P0",
            "status": "in_progress",
            "priority": "high",
        }
        response = self.client.post("/api/v1/progress/tasks/", payload, format="json")
        self.assertEqual(response.status_code, 201)
