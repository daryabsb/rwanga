from rest_framework import permissions, viewsets

from src.ai_engine.api.serializers import AIJobSerializer
from src.ai_engine.models import AIJob


class AIJobViewSet(viewsets.ModelViewSet):
    queryset = AIJob.objects.all()
    serializer_class = AIJobSerializer
    permission_classes = [permissions.IsAuthenticated]
