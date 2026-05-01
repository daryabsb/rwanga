from src.departments.models import ContinuityItem, LightingNote, Prop, SoundNote, WardrobeItem


class DepartmentService:
    def project_props(self, *, project):
        return Prop.objects.filter(project=project)

    def scene_lighting_notes(self, *, scene):
        return LightingNote.objects.filter(shot__scene=scene)

    def scene_sound_notes(self, *, scene):
        return SoundNote.objects.filter(shot__scene=scene)

    def scene_wardrobe(self, *, scene):
        return WardrobeItem.objects.filter(scene=scene)

    def scene_continuity(self, *, scene):
        return ContinuityItem.objects.filter(scene=scene)
