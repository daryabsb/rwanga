from django import forms

from src.community.models import ReviewSession


class ReviewSessionForm(forms.ModelForm):
    class Meta:
        model = ReviewSession
        fields = ["project", "title", "session_type", "status", "visibility"]
