from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase

from src.accounts.models import Studio
from src.ai_engine.models import AIJob
from src.ai_engine.tasks import run_breakdown
from src.projects.models import Project
from src.scripts.models import Script


class RunBreakdownTaskTests(TestCase):
    @patch("src.ai_engine.tasks.broadcast_job_progress")
    @patch("src.ai_engine.tasks.get_text_provider")
    @patch("src.ai_engine.tasks.get_translation_provider")
    def test_run_breakdown_updates_job(self, mock_trans_provider, mock_text_provider, _mock_broadcast):
        user = get_user_model().objects.create_user(email="ai@example.com", password="pass123", terms=True)
        studio = Studio.objects.create(name="AI", slug="ai")
        project = Project.objects.create(studio=studio, owner=user, title="Proj", slug="proj-ai")
        script = Script.objects.create(project=project, title="Script", content="CONTENT")
        job = AIJob.objects.create(project=project, type=AIJob.JobType.BREAKDOWN, status=AIJob.Status.QUEUED)

        mock_trans_provider.return_value.translate.return_value = "translated"
        mock_text_provider.return_value.generate_text.return_value = '[{"scene_number":1,"summary":"x"}]'

        run_breakdown(script_id=str(script.id), job_id=str(job.id))

        job.refresh_from_db()
        self.assertEqual(job.status, AIJob.Status.DONE)
        self.assertEqual(job.progress, 100)
        self.assertIn("scenes", job.result)
