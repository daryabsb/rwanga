from django.test import TestCase

from src.progress.services import ProgressService


class ProgressServiceTests(TestCase):
    def test_seed_initial_tasks_creates_expected_titles(self):
        ProgressService.seed_initial_tasks()
        titles = set(ProgressService.list_task_titles())

        self.assertIn("P0 foundation", titles)
        self.assertIn("P0 core app", titles)
        self.assertIn("P0 progress app", titles)
        self.assertIn("P1 accounts", titles)
        self.assertIn("P1 projects", titles)
