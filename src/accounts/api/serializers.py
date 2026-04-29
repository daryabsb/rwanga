from rest_framework import serializers

from src.accounts.models import (
    ConsultantProfile,
    ProjectConsultantAssignment,
    ProjectMembership,
    SignupProfile,
    Studio,
)


class StudioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Studio
        fields = "__all__"


class ProjectMembershipSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectMembership
        fields = "__all__"


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
