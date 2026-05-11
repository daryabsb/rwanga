from rest_framework import permissions, viewsets

from src.accounts.api.serializers import (
    ConsultantProfileSerializer,
    ProjectConsultantAssignmentSerializer,
    ProjectMembershipSerializer,
    SignupProfileSerializer,
    StudioSerializer,
    UserSerializer,
)
from src.accounts.models import (
    ConsultantProfile,
    ProjectConsultantAssignment,
    ProjectMembership,
    SignupProfile,
    Studio,
    User,
)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]


class StudioViewSet(viewsets.ModelViewSet):
    serializer_class = StudioSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Studio.objects.filter(
            memberships__user=self.request.user,
            memberships__status="active",
        ).distinct()


class ProjectMembershipViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectMembershipSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ProjectMembership.objects.filter(user=self.request.user)


class ConsultantProfileViewSet(viewsets.ModelViewSet):
    queryset = ConsultantProfile.objects.all()
    serializer_class = ConsultantProfileSerializer
    permission_classes = [permissions.IsAuthenticated]


class ProjectConsultantAssignmentViewSet(viewsets.ModelViewSet):
    queryset = ProjectConsultantAssignment.objects.all()
    serializer_class = ProjectConsultantAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]


class SignupProfileViewSet(viewsets.ModelViewSet):
    queryset = SignupProfile.objects.all()
    serializer_class = SignupProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
