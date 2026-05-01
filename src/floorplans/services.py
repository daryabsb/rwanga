from src.floorplans.models import FloorPlan


class FloorPlanService:
    def list_for_project(self, *, project):
        return FloorPlan.objects.filter(scene__project=project).select_related("scene")
