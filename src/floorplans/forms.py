from django import forms

from src.floorplans.models import FloorPlan


class FloorPlanForm(forms.ModelForm):
    class Meta:
        model = FloorPlan
        fields = ["scene", "name", "room_width", "room_height", "furniture", "cameras", "paths", "ai_generated"]
