from rest_framework import permissions, viewsets

from src.departments.api.serializers import (
    ContinuityItemSerializer,
    LightingNoteSerializer,
    PropSerializer,
    SoundNoteSerializer,
    WardrobeItemSerializer,
)
from src.departments.models import ContinuityItem, LightingNote, Prop, SoundNote, WardrobeItem


class LightingNoteViewSet(viewsets.ModelViewSet):
    queryset = LightingNote.objects.all()
    serializer_class = LightingNoteSerializer
    permission_classes = [permissions.IsAuthenticated]


class SoundNoteViewSet(viewsets.ModelViewSet):
    queryset = SoundNote.objects.all()
    serializer_class = SoundNoteSerializer
    permission_classes = [permissions.IsAuthenticated]


class PropViewSet(viewsets.ModelViewSet):
    queryset = Prop.objects.all()
    serializer_class = PropSerializer
    permission_classes = [permissions.IsAuthenticated]


class WardrobeItemViewSet(viewsets.ModelViewSet):
    queryset = WardrobeItem.objects.all()
    serializer_class = WardrobeItemSerializer
    permission_classes = [permissions.IsAuthenticated]


class ContinuityItemViewSet(viewsets.ModelViewSet):
    queryset = ContinuityItem.objects.all()
    serializer_class = ContinuityItemSerializer
    permission_classes = [permissions.IsAuthenticated]
