from rest_framework import serializers

from src.accounts.models import (
    ConsultantProfile,
    ProjectConsultantAssignment,
    ProjectMembership,
    SignupProfile,
    Studio,
    StudioMembership,
    User,
)
from src.billing.api.serializers import SubscriptionSerializer


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = "__all__"
        extra_kwargs = {"password": {"write_only": True}}

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        return User.objects.create_user(password=password, **validated_data)


class StudioSerializer(serializers.ModelSerializer):
    subscription = SubscriptionSerializer(read_only=True)
    is_primary = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Studio
        fields = [
            "id", "name", "slug", "specialty", "logo", "language", "timezone",
            "created_at", "updated_at",
            "studio_api_key_last_four",
            "subscription",
            "is_primary",
            "member_count",
        ]
        read_only_fields = [
            "id", "slug", "created_at", "updated_at",
            "studio_api_key_last_four", "subscription", "is_primary", "member_count",
        ]

    def get_is_primary(self, obj):
        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            return StudioMembership.objects.filter(
                studio=obj,
                user=request.user,
                is_primary=True,
            ).exists()
        return False

    def get_member_count(self, obj):
        return obj.memberships.filter(status="active").count()


class ProjectMembershipSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectMembership
        fields = [
            "id",
            "user",
            "project",
            "role_type",
            "role",
            "department_role",
            "review_scope",
            "is_active",
            # v2 fields
            "tier",
            "status",
            "permissions",
            # invitation tracking
            "invited_by",
            "invited_at",
            "accepted_at",
            # base timestamps
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "invited_at",
            "accepted_at",
        ]


class ConsultantProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConsultantProfile
        fields = "__all__"


class ProjectConsultantAssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectConsultantAssignment
        fields = "__all__"


class SignupProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = SignupProfile
        fields = "__all__"
