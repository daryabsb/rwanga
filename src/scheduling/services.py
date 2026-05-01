from src.scheduling.models import ShootDay


class SchedulingService:
    def list_shoot_days(self, *, project):
        return ShootDay.objects.filter(project=project).order_by("date", "day_number")
