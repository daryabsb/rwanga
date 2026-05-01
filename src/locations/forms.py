from django import forms

from src.locations.models import Location


class LocationForm(forms.ModelForm):
    class Meta:
        model = Location
        fields = ["name", "address", "gps_lat", "gps_lng", "notes", "images"]
