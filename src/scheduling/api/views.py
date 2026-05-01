from rest_framework import permissions, viewsets

from src.scheduling.api.serializers import CallSheetSerializer, ScheduleBlockSerializer, ShootDaySerializer
from src.scheduling.models import CallSheet, ScheduleBlock, ShootDay


class ShootDayViewSet(viewsets.ModelViewSet):
    queryset = ShootDay.objects.all()
    serializer_class = ShootDaySerializer
    permission_classes = [permissions.IsAuthenticated]


class ScheduleBlockViewSet(viewsets.ModelViewSet):
    queryset = ScheduleBlock.objects.all()
    serializer_class = ScheduleBlockSerializer
    permission_classes = [permissions.IsAuthenticated]


class CallSheetViewSet(viewsets.ModelViewSet):
    queryset = CallSheet.objects.all()
    serializer_class = CallSheetSerializer
    permission_classes = [permissions.IsAuthenticated]
