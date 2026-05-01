from rest_framework import serializers

from src.shots.models import Setup, Shot, StoryboardFrame


class ShotSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shot
        fields = "__all__"


class SetupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Setup
        fields = "__all__"


class StoryboardFrameSerializer(serializers.ModelSerializer):
    class Meta:
        model = StoryboardFrame
        fields = "__all__"
