from rest_framework import serializers

from src.scripts.models import Script, ScriptElement


class ScriptSerializer(serializers.ModelSerializer):
    class Meta:
        model = Script
        fields = "__all__"


class ScriptElementSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScriptElement
        fields = "__all__"
