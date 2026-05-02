from django import forms

from src.reviews.models import BibleReview, InlineComment, ReviewDecision, SceneEvaluation


class InlineCommentForm(forms.ModelForm):
    class Meta:
        model = InlineComment
        fields = ["body", "visibility", "resolved"]


class BibleReviewCreateForm(forms.ModelForm):
    class Meta:
        model = BibleReview
        fields = []


class ReviewDecisionForm(forms.ModelForm):
    class Meta:
        model = ReviewDecision
        fields = ["scene", "topic", "decision_text"]


class SceneEvaluationForm(forms.ModelForm):
    class Meta:
        model = SceneEvaluation
        fields = ["scene", "analysis", "tension_score", "notes", "recommendations"]
