from src.shots.models import Shot


class ShotService:
    def list_project_shots(self, *, project, shot_type=None, scene_id=None):
        qs = Shot.objects.filter(scene__project=project).select_related("scene").order_by("scene__number", "order")
        if shot_type and shot_type != "all":
            qs = qs.filter(shot_type=shot_type)
        if scene_id:
            qs = qs.filter(scene_id=scene_id)
        return qs
