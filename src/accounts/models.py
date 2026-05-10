import hashlib
import secrets

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.conf import settings
from django.db import models

from src.accounts.managers import UserManager
from src.core.models import BaseModel
from src.core.mixins import SoftDeleteModel, Versioned


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


class Studio(SoftDeleteModel, Versioned, BaseModel):
    SPECIALTY_CHOICES = [
        ("feature_films", "Feature Films"),
        ("documentary", "Documentary"),
        ("commercial", "Commercial"),
        ("mixed", "Mixed"),
        ("other", "Other"),
    ]

    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    logo = models.ImageField(upload_to="studios/logos/", blank=True)
    language = models.CharField(max_length=10, default="ckb")
    timezone = models.CharField(max_length=50, default="Asia/Baghdad")
    plan = models.CharField(max_length=20, default="free")
    subscription_tier = models.CharField(max_length=20, default="beta")
    specialty = models.CharField(max_length=32, choices=SPECIALTY_CHOICES, default="feature_films")
    studio_api_key_hash = models.CharField(max_length=128, blank=True, db_index=True)
    studio_api_key_last_four = models.CharField(max_length=4, blank=True)
    snapshot_on_delete = models.JSONField(null=True, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    def generate_studio_api_key(self):
        token = "rws_" + secrets.token_urlsafe(32)
        self.studio_api_key_hash = hashlib.sha256(token.encode()).hexdigest()
        self.studio_api_key_last_four = token[-4:]
        self.save(update_fields=["studio_api_key_hash", "studio_api_key_last_four"])
        return token


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


class StudioMembership(SoftDeleteModel, BaseModel):
    studio = models.ForeignKey(Studio, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="studio_memberships")
    ROLE_CHOICES = [
        ("owner", "Owner"), ("admin", "Admin"), ("member", "Member"),
        ("auditor", "Auditor"), ("reviewer", "Reviewer"),
    ]
    role = models.CharField(max_length=16, choices=ROLE_CHOICES, default="member")
    TIER_CHOICES = [("production", "production"), ("community", "community")]
    tier = models.CharField(max_length=16, choices=TIER_CHOICES, default="production")
    permissions = models.JSONField(default=dict, blank=True)
    STATUS_CHOICES = [("pending", "pending"), ("active", "active"), ("suspended", "suspended")]
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="active")
    is_primary = models.BooleanField(default=False)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+",
    )
    invited_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    magic_link_token = models.CharField(max_length=64, blank=True, unique=True, null=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user"],
                condition=models.Q(is_primary=True),
                name="one_primary_studio_per_user",
            ),
            models.UniqueConstraint(
                fields=["studio", "user"],
                name="unique_studio_user",
            ),
        ]
