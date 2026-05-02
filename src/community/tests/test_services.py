from django.contrib.auth import get_user_model
from django.test import TestCase

from src.accounts.models import Studio
from src.community.services import CommunityService
from src.projects.models import Project, Scene


class CommunityServiceTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(email="cs@example.com", password="pass123", terms=True)
        studio = Studio.objects.create(name="CS", slug="cs")
        self.project = Project.objects.create(studio=studio, owner=self.user, title="P", slug="p-cs")
        self.scene = Scene.objects.create(project=self.project, number=1, title="S1")

    def test_create_and_open_close_session(self):
        session = CommunityService.create_session(project=self.project, title="Sess", session_type="screenplay", created_by=self.user)
        self.assertEqual(session.status, "draft")
        CommunityService.open_session(session=session)
        session.refresh_from_db()
        self.assertEqual(session.status, "open")
        CommunityService.close_session(session=session)
        session.refresh_from_db()
        self.assertEqual(session.status, "closed")

    def test_snapshot_scenes(self):
        session = CommunityService.create_session(project=self.project, title="Sess", session_type="screenplay", created_by=self.user)
        contents = CommunityService.snapshot_scenes(session=session, scenes=[self.scene])
        self.assertEqual(len(contents), 1)
        self.assertEqual(contents[0].content_type, "scene")
