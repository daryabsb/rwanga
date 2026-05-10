from django.test import TestCase
from src.accounts.models import User, StudioMembership
from src.accounts.services.studio_services import create_studio_for_user
from src.accounts.services.invitation_services import (
    invite_to_studio, accept_studio_invitation, reject_studio_invitation,
)


class StudioInvitationTest(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="o@x.com", password="x")
        self.studio = create_studio_for_user(self.owner, name="O")

    def test_invite_creates_pending_membership(self):
        target = User.objects.create_user(email="t@x.com", password="x")
        m = invite_to_studio(self.studio, target, role="member", tier="production", invited_by=self.owner)
        self.assertEqual(m.status, "pending")
        self.assertTrue(m.magic_link_token)

    def test_accept_marks_active(self):
        target = User.objects.create_user(email="t2@x.com", password="x")
        m = invite_to_studio(self.studio, target, role="member", tier="production", invited_by=self.owner)
        accept_studio_invitation(m.magic_link_token, by_user=target)
        m.refresh_from_db()
        self.assertEqual(m.status, "active")
        self.assertIsNotNone(m.accepted_at)

    def test_reject_deletes_membership(self):
        target = User.objects.create_user(email="t3@x.com", password="x")
        m = invite_to_studio(self.studio, target, role="reviewer", tier="community", invited_by=self.owner)
        token = m.magic_link_token
        reject_studio_invitation(token, by_user=target)
        self.assertFalse(StudioMembership.objects.filter(magic_link_token=token).exists())


class ProjectInvitationTest(TestCase):
    def setUp(self):
        from src.projects.models import Project
        self.owner = User.objects.create_user(email="po@x.com", password="x")
        self.studio = create_studio_for_user(self.owner, name="PIO")
        self.project = Project.objects.create(
            studio=self.studio, title="P", name="P", slug="p-pi-1",
            project_type="feature", created_by=self.owner, owner=self.owner,
        )

    def test_invite_to_project_creates_pending(self):
        from src.accounts.services.invitation_services import invite_to_project
        target = User.objects.create_user(email="pt@x.com", password="x")
        m = invite_to_project(
            self.project, target, role_type="crew", tier="production",
            department="director", invited_by=self.owner,
        )
        self.assertEqual(m.status, "pending")
        self.assertTrue(m.magic_link_token)

    def test_accept_project_invitation_logs_event(self):
        from src.accounts.services.invitation_services import (
            invite_to_project, accept_project_invitation,
        )
        from src.core.models import ProductionLog
        target = User.objects.create_user(email="pt2@x.com", password="x")
        m = invite_to_project(
            self.project, target, role_type="crew", tier="production",
            department="director", invited_by=self.owner,
        )
        accept_project_invitation(m.magic_link_token, by_user=target)
        log = ProductionLog.objects.filter(event_type="project_invitation_accepted").first()
        self.assertIsNotNone(log)
        self.assertEqual(log.actor_id, str(target.id))

    def test_reject_project_invitation_logs_event(self):
        from src.accounts.services.invitation_services import (
            invite_to_project, reject_project_invitation,
        )
        from src.core.models import ProductionLog
        target = User.objects.create_user(email="pt3@x.com", password="x")
        m = invite_to_project(
            self.project, target, role_type="crew", tier="production",
            department="director", invited_by=self.owner,
        )
        token = m.magic_link_token
        reject_project_invitation(token, by_user=target)
        log = ProductionLog.objects.filter(event_type="project_invitation_rejected").first()
        self.assertIsNotNone(log)
        self.assertEqual(log.payload["project_id"], str(self.project.id))
