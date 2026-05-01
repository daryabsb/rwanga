from django import forms

from src.departments.models import ContinuityItem, LightingNote, Prop, SoundNote, WardrobeItem


class LightingNoteForm(forms.ModelForm):
    class Meta:
        model = LightingNote
        fields = ["shot", "note", "color_temp", "equipment"]


class SoundNoteForm(forms.ModelForm):
    class Meta:
        model = SoundNote
        fields = ["shot", "note", "sound_type"]


class PropForm(forms.ModelForm):
    class Meta:
        model = Prop
        fields = ["name", "category", "status", "notes", "image", "scenes"]


class WardrobeItemForm(forms.ModelForm):
    class Meta:
        model = WardrobeItem
        fields = ["character", "scene", "outfit_name", "description", "notes", "image"]


class ContinuityItemForm(forms.ModelForm):
    class Meta:
        model = ContinuityItem
        fields = ["scene", "direction", "description", "checked"]
