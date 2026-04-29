from rest_framework import permissions, viewsets

from src.accounts.api.serializers import (
    ConsultantProfileSerializer,
    ProjectConsultantAssignmentSerializer,
    ProjectMembershipSerializer,
    SignupProfileSerializer,
    StudioSerializer,
)
from src.accounts.models import (
    ConsultantProfile,
    ProjectConsultantAssignment,
    ProjectMembership,
    SignupProfile,
    Studio,
)


class StudioViewSet(viewsets.ModelViewSet):
    queryset = Studio.objects.all()
    serializer_class = StudioSerializer
    permission_classes = [permissions.AllowAny]


class ProjectMembershipViewSet(viewsets.ModelViewSet):
    queryset = ProjectMembership.objects.all()
    serializer_class = ProjectMembershipSerializer
    permission_classes = [permissions.AllowAny]


class ConsultantProfileViewSet(viewsets.ModelViewSet):
    queryset = ConsultantProfile.objects.all()
    serializer_class = ConsultantProfileSerializer
    permission_classes = [permissions.AllowAny]


class ProjectConsultantAssignmentViewSet(viewsets.ModelViewSet):
    queryset = ProjectConsultantAssignment.objects.all()
    serializer_class = ProjectConsultantAssignmentSerializer
    permission_classes = [permissions.AllowAny]


class SignupProfileViewSet(viewsets.ModelViewSet):
    queryset = SignupProfile.objects.all()
    serializer_class = SignupProfileSerializer
    permission_classes = [permissions.AllowAny]
