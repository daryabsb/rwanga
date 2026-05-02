from django import forms

from src.locations.models import Location


class LocationCreateForm(forms.ModelForm):
    class Meta:
        model = Location
        fields = ["name", "description", "address", "int_ext", "time_of_day"]
