from django.contrib.auth.decorators import login_required
from django.db.models import Q
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

    # Recent projects across ALL studios the user has access to (owner OR member).
    # Not scoped to active_studio — legacy projects may live under different studios
    # than the auto-created "My Studio".
    recent_projects = list(
        Project.objects.filter(
            Q(owner=request.user)
            | Q(created_by=request.user)
            | Q(memberships__user=request.user)
        )
        .distinct()
        .order_by("-updated_at")[:5]
    )

    # Recent activity: events done by this user OR happening in their active studio.
    recent_activity_qs = ProductionLog.objects.filter(
        Q(actor_id=str(request.user.id))
        | (Q(studio=studio) if studio else Q(pk__in=[]))
    ).order_by("-timestamp")
    recent_activity = list(recent_activity_qs[:8])

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
