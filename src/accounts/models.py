import uuid

from django.conf import settings
from django.db import models

from src.core.models import BaseModel


class Studio(BaseModel):
    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    logo = models.ImageField(upload_to="studios/logos/", blank=True)
    language = models.CharField(max_length=10, default="ckb")
    timezone = models.CharField(max_length=50, default="Asia/Baghdad")
    plan = models.CharField(max_length=20, default="free")
    subscription_tier = models.CharField(max_length=20, default="beta")

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class ProjectMembership(BaseModel):
    class RoleType(models.TextChoices):
        CREW = "crew", "Crew"
        INTERNAL_REVIEWER = "internal_reviewer", "Internal Reviewer"

    class DepartmentRole(models.TextChoices):
        DIRECTOR = "director", "Director"
        DP = "dp", "DP"
        AD = "ad", "AD"
        ART = "art", "Art"
        SOUND = "sound", "Sound"
        EDITOR = "editor", "Editor"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    project_id = models.UUIDField(default=uuid.uuid4, db_index=True)
    role_type = models.CharField(max_length=32, choices=RoleType.choices)
    department_role = models.CharField(max_length=32, choices=DepartmentRole.choices, blank=True)
    review_scope = models.CharField(max_length=64, blank=True)
    is_active = models.BooleanField(default=True)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="accounts_memberships_invited",
    )
    invited_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)


class ConsultantProfile(BaseModel):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    is_active = models.BooleanField(default=True)
    specialization = models.CharField(max_length=255, blank=True)


class ProjectConsultantAssignment(BaseModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        COMPLETED = "completed", "Completed"

    project_id = models.UUIDField(default=uuid.uuid4, db_index=True)
    consultant = models.ForeignKey(ConsultantProfile, on_delete=models.CASCADE, related_name="assignments")
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)


class SignupProfile(BaseModel):
    class Gender(models.TextChoices):
        MALE = "male", "Male"
        FEMALE = "female", "Female"
        OTHER = "other", "Other"

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="signup_profile")
    nickname = models.CharField(max_length=100, blank=True)
    gender = models.CharField(max_length=16, choices=Gender.choices, blank=True)
