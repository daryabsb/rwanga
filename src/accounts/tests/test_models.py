import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase

from src.accounts.models import (
    ConsultantProfile,
    ProjectConsultantAssignment,
    ProjectMembership,
    SignupProfile,
    Studio,
)


class AccountsModelTests(TestCase):
    def test_create_studio(self):
        studio = Studio.objects.create(name="Rwanga Studio", slug="rwanga-studio")
        self.assertEqual(studio.language, "ckb")

    def test_create_project_membership(self):
        user = get_user_model().objects.create_user(username="member1", password="pass12345")
        membership = ProjectMembership.objects.create(
            user=user,
            project_id=uuid.uuid4(),
            role_type=ProjectMembership.RoleType.CREW,
            department_role=ProjectMembership.DepartmentRole.DIRECTOR,
        )
        self.assertEqual(membership.role_type, ProjectMembership.RoleType.CREW)

    def test_create_consultant_profile_and_assignment(self):
        user = get_user_model().objects.create_user(username="consult1", password="pass12345")
        profile = ConsultantProfile.objects.create(user=user, is_active=True)
        assignment = ProjectConsultantAssignment.objects.create(
            project_id=uuid.uuid4(),
            consultant=profile,
            assigned_by=user,
            status=ProjectConsultantAssignment.Status.ACTIVE,
        )
        self.assertEqual(assignment.consultant, profile)

    def test_signup_profile_fields(self):
        user = get_user_model().objects.create_user(username="signup1", password="pass12345")
        profile = SignupProfile.objects.create(user=user, nickname="kino", gender="female")
        self.assertEqual(profile.nickname, "kino")
