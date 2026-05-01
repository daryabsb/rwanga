from rest_framework import serializers

from src.community.models import (
    ReviewSession,
    ReviewSessionParticipant,
    SessionComment,
    SessionContent,
    SessionReaction,
)


class ReviewSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewSession
        fields = "__all__"


class SessionContentSerializer(serializers.ModelSerializer):
    class Meta:
        model = SessionContent
        fields = "__all__"


class ReviewSessionParticipantSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewSessionParticipant
        fields = "__all__"


class SessionCommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = SessionComment
        fields = "__all__"


class SessionReactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SessionReaction
        fields = "__all__"
