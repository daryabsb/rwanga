from django import forms

from src.shots.models import Shot


class ShotForm(forms.ModelForm):
    class Meta:
        model = Shot
        fields = ["shot_number", "shot_type", "description", "lens", "movement", "duration", "order"]
