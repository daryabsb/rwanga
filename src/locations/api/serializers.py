from rest_framework import serializers

from src.locations.models import Location


class StandaloneLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = "__all__"
