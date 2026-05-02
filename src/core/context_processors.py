from src.community.models import ReviewSession
from src.reviews.models import ReviewDecision


def studio_context(request):
    return {
        "active_studio": getattr(request, "studio", None),
        "RWANGA_THEME": getattr(request, "theme", "dark"),
    }


def navigation_context(request):
    if not request.user.is_authenticated:
        return {}

    path = request.path or ""
    if "/reviews/" in path:
        nav_mode = "reviews"
    elif "/community/" in path:
        nav_mode = "community"
    else:
        nav_mode = "project"

    return {
        "nav_mode": nav_mode,
        "pending_decisions_count": ReviewDecision.objects.filter(status=ReviewDecision.Status.PROPOSED).count(),
        "active_sessions_count": ReviewSession.objects.filter(status=ReviewSession.Status.OPEN).count(),
    }
