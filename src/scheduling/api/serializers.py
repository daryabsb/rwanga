from rest_framework import serializers

from src.scheduling.models import CallSheet, ScheduleBlock, ShootDay


class ShootDaySerializer(serializers.ModelSerializer):
    class Meta:
        model = ShootDay
        fields = "__all__"


class ScheduleBlockSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScheduleBlock
        fields = "__all__"


class CallSheetSerializer(serializers.ModelSerializer):
    class Meta:
        model = CallSheet
        fields = "__all__"
