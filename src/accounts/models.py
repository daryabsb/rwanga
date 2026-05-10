from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.conf import settings
from django.db import models

from src.accounts.managers import UserManager
from src.core.models import BaseModel
from src.core.mixins import SoftDeleteModel


class User(PermissionsMixin, AbstractBaseUser):
    email = models.EmailField(max_length=255, unique=True)
    name = models.CharField(max_length=255, null=True, blank=True)
    terms = models.BooleanField(default=False)
    image = models.ImageField(upload_to="users/images/", null=True, blank=True, default="user.png")
    pin = models.SmallIntegerField(default=1699)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    must_change_password_on_first_login = models.BooleanField(default=False)
    created = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        ordering = ["-created"]

    def __str__(self):
        return self.email

    def get_full_name(self):
        return self.name or self.email

    @property
    def nickname(self):
        return (self.name or "").strip()

    @property
    def first_name(self):
        full = (self.name or "").strip()
        return full.split(" ")[0] if full else ""

    @property
    def last_name(self):
        full = (self.name or "").strip()
        parts = full.split(" ")
        return " ".join(parts[1:]) if len(parts) > 1 else ""

    @property
    def phone(self):
        return ""


class Studio(SoftDeleteModel, BaseModel):
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
    ROLE_CHOICES = [
        ("director", "دەرهێنەر"),
        ("production_team", "تیمی بەرهەمهێنان"),
        ("reviewer", "پێداچوونەوەکەر"),
        ("community", "کۆمیونیتی"),
        ("full_access", "هەموو"),
    ]
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
    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="memberships",
        db_constraint=False,
    )
    role_type = models.CharField(max_length=32, choices=RoleType.choices)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="production_team")
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

    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="consultant_assignments",
        db_constraint=False,
    )
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
