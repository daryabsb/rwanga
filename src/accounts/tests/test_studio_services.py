from django.test import TestCase
from src.accounts.models import User, Studio, StudioMembership
from src.accounts.services.studio_services import (
    create_studio_for_user, list_studios_for_user, soft_delete_studio, transfer_ownership,
)


class StudioServicesTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="o@x.com", password="x")

    def test_create_studio_creates_studio_and_owner_membership(self):
        s = create_studio_for_user(self.user, name="My", specialty="feature_films")
        self.assertEqual(s.created_by, self.user)
        m = StudioMembership.objects.get(studio=s, user=self.user)
        self.assertEqual(m.role, "owner")

    def test_list_studios_returns_owned_and_member(self):
        s1 = create_studio_for_user(self.user, name="A")
        other = User.objects.create_user(email="o2@x.com", password="x")
        s2 = create_studio_for_user(other, name="B")
        StudioMembership.objects.create(user=self.user, studio=s2, role="member")
        result = list_studios_for_user(self.user)
        self.assertIn(s1, result)
        self.assertIn(s2, result)

    def test_soft_delete_studio_writes_snapshot(self):
        s = create_studio_for_user(self.user, name="DEL")
        soft_delete_studio(s, by_user=self.user)
        # Use all_with_deleted since the default manager excludes soft-deleted rows
        s = Studio.all_with_deleted.get(pk=s.pk)
        self.assertIsNotNone(s.deleted_at)
        self.assertIsNotNone(s.snapshot_on_delete)

    def test_transfer_ownership_demotes_from_user(self):
        other = User.objects.create_user(email="t-target@x.com", password="x")
        s = create_studio_for_user(self.user, name="T")
        StudioMembership.objects.create(
            studio=s, user=other, role="member", tier="production", status="active",
        )
        transfer_ownership(s, from_user=self.user, to_user=other)
        new_owner_m = StudioMembership.objects.get(studio=s, user=other)
        old_owner_m = StudioMembership.objects.get(studio=s, user=self.user)
        self.assertEqual(new_owner_m.role, "owner")
        self.assertEqual(old_owner_m.role, "member")

    def test_transfer_ownership_raises_if_from_not_owner(self):
        other = User.objects.create_user(email="t-other@x.com", password="x")
        s = create_studio_for_user(self.user, name="U")
        StudioMembership.objects.create(
            studio=s, user=other, role="member", tier="production", status="active",
        )
        with self.assertRaises(ValueError):
            transfer_ownership(s, from_user=other, to_user=self.user)
