from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from django.utils import timezone

from src.core.models import ProductionLog
from src.projects.models import Project


def _greeting_for_hour(hour: int) -> str:
    if hour < 12:
        return "Good morning"
    if hour < 18:
        return "Good afternoon"
    return "Good evening"


@login_required
def home(request):
    now = timezone.localtime()
    greeting = _greeting_for_hour(now.hour)
    display_name = request.user.first_name or request.user.email.split("@")[0]

    studio = getattr(request, "active_studio", None)

    # Recent projects: 5 most recently updated in the active studio
    recent_projects = []
    if studio:
        recent_projects = list(
            Project.objects.filter(studio=studio)
            .order_by("-updated_at")[:5]
        )

    # Recent activity: 8 most recent production_log entries scoped to active studio
    recent_activity = []
    if studio:
        recent_activity = list(
            ProductionLog.objects.filter(studio=studio).order_by("-timestamp")[:8]
        )

    context = {
        "greeting": greeting,
        "display_name": display_name,
        "today": now,
        "recent_projects": recent_projects,
        "recent_activity": recent_activity,
        # Tasks is a placeholder until the entity is designed
        "tasks_placeholder": True,
    }
    return render(request, "dashboard/home.html", context)
