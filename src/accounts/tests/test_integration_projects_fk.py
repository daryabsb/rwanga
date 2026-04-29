from django.contrib.auth import get_user_model
from django.test import TestCase

from src.accounts.models import ConsultantProfile, ProjectConsultantAssignment, ProjectMembership, Studio
from src.projects.models import Project


class AccountsProjectsIntegrationTests(TestCase):
    def test_membership_uses_project_fk(self):
        user = get_user_model().objects.create_user(
            email="integrate@example.com", password="pass12345"
        )
        studio = Studio.objects.create(name="Integration Studio", slug="integration-studio")
        project = Project.objects.create(
            studio=studio, owner=user, title="Integration Project", slug="integration-project"
        )
        membership = ProjectMembership.objects.create(
            user=user,
            project=project,
            role_type=ProjectMembership.RoleType.CREW,
            department_role=ProjectMembership.DepartmentRole.DIRECTOR,
        )
        self.assertEqual(membership.project, project)

    def test_consultant_assignment_uses_project_fk(self):
        user = get_user_model().objects.create_user(
            email="consult-fk@example.com", password="pass12345"
        )
        studio = Studio.objects.create(name="Consultant FK Studio", slug="consultant-fk-studio")
        project = Project.objects.create(
            studio=studio, owner=user, title="Consultant FK Project", slug="consultant-fk-project"
        )
        consultant = ConsultantProfile.objects.create(user=user, is_active=True)
        assignment = ProjectConsultantAssignment.objects.create(
            project=project,
            consultant=consultant,
            assigned_by=user,
            status=ProjectConsultantAssignment.Status.ACTIVE,
        )
        self.assertEqual(assignment.project, project)
