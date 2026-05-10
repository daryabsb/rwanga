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
