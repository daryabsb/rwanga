from rest_framework import permissions, viewsets

from src.locations.api.serializers import LocationSerializer
from src.locations.models import Location


class LocationViewSet(viewsets.ModelViewSet):
    queryset = Location.objects.all()
    serializer_class = LocationSerializer
    permission_classes = [permissions.IsAuthenticated]
