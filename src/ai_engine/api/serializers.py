from rest_framework import serializers

from src.ai_engine.models import AIJob


class AIJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIJob
        fields = "__all__"
