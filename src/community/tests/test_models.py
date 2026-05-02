from django.contrib.auth import get_user_model
from django.test import TestCase

from src.accounts.models import Studio
from src.community.models import ReviewSession, SessionContent
from src.projects.models import Project


class CommunityModelTests(TestCase):
    def test_session_content_is_snapshot_only(self):
        user = get_user_model().objects.create_user(email="cm@example.com", password="pass123", terms=True)
        studio = Studio.objects.create(name="CM", slug="cm")
        project = Project.objects.create(studio=studio, owner=user, title="P", slug="p-cm")
        session = ReviewSession.objects.create(project=project, title="S", created_by=user)
        content = SessionContent.objects.create(session=session, content_type="scene", content_data={"scene_number": 1}, label="Scene 1")
        self.assertIn("scene_number", content.content_data)
