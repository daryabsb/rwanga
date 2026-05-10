from django.test import TestCase
from src.accounts.models import User
from src.accounts.services.studio_services import create_studio_for_user
from src.projects.models import Project
from src.projects.services.lifecycle_services import (
    create_project, change_project_status, soft_delete_project,
)


class LifecycleTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="lc@x.com", password="x")
        self.studio = create_studio_for_user(self.user, name="S")

    def test_create_project_default_draft(self):
        p = create_project(studio=self.studio, user=self.user, name="X", project_type="feature")
        self.assertEqual(p.status, "draft")

    def test_change_status_records_actor_and_time(self):
        p = create_project(studio=self.studio, user=self.user, name="Y", project_type="feature")
        change_project_status(p, new_status="active", by_user=self.user)
        p.refresh_from_db()
        self.assertEqual(p.status, "active")
        self.assertEqual(p.status_changed_by, self.user)
        self.assertIsNotNone(p.status_changed_at)

    def test_soft_delete_writes_snapshot(self):
        p = create_project(studio=self.studio, user=self.user, name="Z", project_type="feature")
        soft_delete_project(p, by_user=self.user)
        p = Project.all_with_deleted.get(pk=p.pk)
        self.assertIsNotNone(p.snapshot_on_delete)
        self.assertIsNotNone(p.deleted_at)
