from django.contrib.auth import authenticate
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import permissions, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import serializers as drf_serializers

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
    queryset = Studio.objects.all()
    serializer_class = StudioSerializer
    permission_classes = [permissions.IsAuthenticated]


class ProjectMembershipViewSet(viewsets.ModelViewSet):
    queryset = ProjectMembership.objects.all()
    serializer_class = ProjectMembershipSerializer
    permission_classes = [permissions.IsAuthenticated]


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


class ObtainTokenAPIView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        request=inline_serializer(
            "ObtainTokenRequest",
            fields={
                "email": drf_serializers.EmailField(),
                "password": drf_serializers.CharField(),
            },
        ),
        responses={
            200: inline_serializer(
                "ObtainTokenResponse",
                fields={
                    "token": drf_serializers.CharField(),
                    "user_id": drf_serializers.CharField(),
                    "email": drf_serializers.EmailField(),
                },
            )
        },
    )
    def post(self, request):
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


obtain_token = ObtainTokenAPIView.as_view()
