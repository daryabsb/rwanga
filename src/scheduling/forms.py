from django import forms

from src.scheduling.models import ShootDay


class ShootDayForm(forms.ModelForm):
    class Meta:
        model = ShootDay
        fields = ["project", "date", "day_number", "notes"]
