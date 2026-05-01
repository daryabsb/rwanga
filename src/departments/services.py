from collections import defaultdict

from src.departments.models import ContinuityItem, LightingNote, Prop, SoundNote, WardrobeItem


class DepartmentService:
    def list_lighting_grouped(self, *, project):
        notes = LightingNote.objects.filter(shot__scene__project=project).select_related("shot", "shot__scene")
        grouped = defaultdict(list)
        for note in notes:
            grouped[note.shot.scene].append(note)
        return grouped

    def list_sound_grouped(self, *, project):
        notes = SoundNote.objects.filter(shot__scene__project=project).select_related("shot", "shot__scene")
        grouped = defaultdict(list)
        for note in notes:
            grouped[note.shot.scene].append(note)
        return grouped

    def list_props(self, *, project, category=None):
        qs = Prop.objects.filter(project=project).prefetch_related("scenes")
        if category:
            qs = qs.filter(category=category)
        return qs

    def list_wardrobe_grouped(self, *, project):
        items = WardrobeItem.objects.filter(scene__project=project).select_related("character", "scene")
        grouped = defaultdict(list)
        for item in items:
            grouped[item.character].append(item)
        return grouped

    def list_continuity_grouped(self, *, project, direction=None):
        qs = ContinuityItem.objects.filter(scene__project=project).select_related("scene")
        if direction:
            qs = qs.filter(direction=direction)
        grouped = defaultdict(list)
        for item in qs:
            grouped[item.scene].append(item)
        return grouped

    def toggle_prop_status(self, *, prop, checked):
        prop.status = "sourced" if checked else "needed"
        prop.save(update_fields=["status", "updated_at"])
        return prop

    def toggle_continuity(self, *, item, checked):
        item.checked = checked
        item.save(update_fields=["checked", "updated_at"])
        return item
