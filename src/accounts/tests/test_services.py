import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase

from src.accounts.models import ProjectMembership
from src.accounts.services import AccountsService


class AccountsServiceTests(TestCase):
    def test_create_studio_service(self):
        studio = AccountsService.create_studio(name="Studio A", slug="studio-a")
        self.assertEqual(studio.slug, "studio-a")

    def test_create_membership_service(self):
        user = get_user_model().objects.create_user(username="svc1", password="pass12345")
        membership = AccountsService.create_project_membership(
            user=user,
            project_id=uuid.uuid4(),
            role_type=ProjectMembership.RoleType.CREW,
            department_role=ProjectMembership.DepartmentRole.DP,
        )
        self.assertEqual(membership.department_role, ProjectMembership.DepartmentRole.DP)
