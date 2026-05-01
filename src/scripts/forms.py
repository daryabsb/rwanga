from django import forms

from src.scripts.models import Script


class ScriptForm(forms.ModelForm):
    class Meta:
        model = Script
        fields = ["project", "title", "content", "file", "script_format"]
