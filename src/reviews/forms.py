from django import forms

from src.reviews.models import InlineComment


class InlineCommentForm(forms.ModelForm):
    class Meta:
        model = InlineComment
        fields = ["body", "visibility", "resolved"]
