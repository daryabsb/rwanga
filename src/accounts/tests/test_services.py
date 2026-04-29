from django.contrib.auth import get_user_model
from django.test import TestCase

from src.accounts.models import ProjectMembership, Studio
from src.accounts.services import AccountsService
from src.projects.models import Project


class AccountsServiceTests(TestCase):
    def test_create_studio_service(self):
        studio = AccountsService.create_studio(name="Studio A", slug="studio-a")
        self.assertEqual(studio.slug, "studio-a")

    def test_create_membership_service(self):
        user = get_user_model().objects.create_user(email="svc1@example.com", password="pass12345")
        studio = Studio.objects.create(name="Studio S", slug="studio-s")
        project = Project.objects.create(studio=studio, owner=user, title="Film S", slug="film-s")
        membership = AccountsService.create_project_membership(
            user=user,
            project=project,
            role_type=ProjectMembership.RoleType.CREW,
            department_role=ProjectMembership.DepartmentRole.DP,
        )
        self.assertEqual(membership.department_role, ProjectMembership.DepartmentRole.DP)
