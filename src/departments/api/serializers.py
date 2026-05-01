from rest_framework import serializers

from src.departments.models import ContinuityItem, LightingNote, Prop, SoundNote, WardrobeItem


class LightingNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = LightingNote
        fields = "__all__"


class SoundNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = SoundNote
        fields = "__all__"


class PropSerializer(serializers.ModelSerializer):
    class Meta:
        model = Prop
        fields = "__all__"


class WardrobeItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = WardrobeItem
        fields = "__all__"


class ContinuityItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContinuityItem
        fields = "__all__"
