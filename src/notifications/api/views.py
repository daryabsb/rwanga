from rest_framework import permissions, viewsets

from src.notifications.api.serializers import NotificationSerializer
from src.notifications.models import Notification


class NotificationViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
