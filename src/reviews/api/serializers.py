from rest_framework import serializers

from src.reviews.models import BibleReview, InlineComment, ReviewDecision, SceneEvaluation


class InlineCommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = InlineComment
        fields = "__all__"


class BibleReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = BibleReview
        fields = "__all__"


class SceneEvaluationSerializer(serializers.ModelSerializer):
    class Meta:
        model = SceneEvaluation
        fields = "__all__"


class ReviewDecisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewDecision
        fields = "__all__"
