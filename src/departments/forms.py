from django import forms

from src.departments.models import Prop


class PropForm(forms.ModelForm):
    class Meta:
        model = Prop
        fields = ["project", "name", "category", "status", "notes", "scenes"]
