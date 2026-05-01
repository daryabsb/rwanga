from django.contrib.auth import authenticate
from rest_framework import permissions, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

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
    permission_classes = [permissions.AllowAny]


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


@api_view(["POST"])
@permission_classes([AllowAny])
def obtain_token(request):
    email = request.data.get("email", "").strip()
    password = request.data.get("password", "")

    if not email or not password:
        return Response({"error": "Email and password are required"}, status=status.HTTP_400_BAD_REQUEST)

    user = authenticate(request, email=email, password=password)
    if user is None:
        user = authenticate(request, username=email, password=password)

    if user is None:
        return Response({"error": "Invalid email or password"}, status=status.HTTP_401_UNAUTHORIZED)

    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key, "user_id": user.pk, "email": user.email})
