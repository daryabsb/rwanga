from rest_framework import permissions, viewsets

from src.shots.api.serializers import SetupSerializer, ShotSerializer, StoryboardFrameSerializer
from src.shots.models import Setup, Shot, StoryboardFrame


class ShotViewSet(viewsets.ModelViewSet):
    queryset = Shot.objects.all()
    serializer_class = ShotSerializer
    permission_classes = [permissions.IsAuthenticated]


class SetupViewSet(viewsets.ModelViewSet):
    queryset = Setup.objects.all()
    serializer_class = SetupSerializer
    permission_classes = [permissions.IsAuthenticated]


class StoryboardFrameViewSet(viewsets.ModelViewSet):
    queryset = StoryboardFrame.objects.all()
    serializer_class = StoryboardFrameSerializer
    permission_classes = [permissions.IsAuthenticated]
