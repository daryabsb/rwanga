from src.accounts.models import (
    ConsultantProfile,
    ProjectConsultantAssignment,
    ProjectMembership,
    SignupProfile,
    Studio,
)


class AccountsService:
    @staticmethod
    def create_studio(**kwargs):
        return Studio.objects.create(**kwargs)

    @staticmethod
    def create_project_membership(**kwargs):
        return ProjectMembership.objects.create(**kwargs)

    @staticmethod
    def upsert_consultant_profile(user, **kwargs):
        defaults = {"is_active": True, **kwargs}
        profile, _ = ConsultantProfile.objects.update_or_create(user=user, defaults=defaults)
        return profile

    @staticmethod
    def assign_consultant(**kwargs):
        return ProjectConsultantAssignment.objects.create(**kwargs)

    @staticmethod
    def upsert_signup_profile(user, **kwargs):
        profile, _ = SignupProfile.objects.update_or_create(user=user, defaults=kwargs)
        return profile
