from django.test import TestCase

from src.progress.services import ProgressService


class ProgressServiceTests(TestCase):
    def test_seed_initial_tasks_creates_expected_titles(self):
        ProgressService.seed_initial_tasks()
        titles = set(ProgressService.list_task_titles())

        self.assertGreaterEqual(len(titles), 23)
        self.assertIn("P0.1 Clone HUD2 skeleton", titles)
        self.assertIn("P0.12 Create initial SystemDiagram", titles)
        self.assertIn("P1.1 Create accounts app (models, DRF, views)", titles)
        self.assertIn("P1.11 Update Progress app", titles)
