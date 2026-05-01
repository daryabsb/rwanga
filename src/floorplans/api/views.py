from rest_framework import permissions, viewsets

from src.floorplans.api.serializers import FloorPlanSerializer
from src.floorplans.models import FloorPlan


class FloorPlanViewSet(viewsets.ModelViewSet):
    queryset = FloorPlan.objects.all()
    serializer_class = FloorPlanSerializer
    permission_classes = [permissions.IsAuthenticated]
