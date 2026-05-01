from django.contrib import admin

from src.departments.models import ContinuityItem, LightingNote, Prop, SoundNote, WardrobeItem

admin.site.register(LightingNote)
admin.site.register(SoundNote)
admin.site.register(Prop)
admin.site.register(WardrobeItem)
admin.site.register(ContinuityItem)
