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
        nav_mode = None

    pending_decisions_count = ReviewDecision.objects.filter(
        status=ReviewDecision.Status.PROPOSED,
        bible_review__project__owner=request.user,
    ).count()
    active_sessions_count = ReviewSession.objects.filter(
        status=ReviewSession.Status.OPEN,
        project__owner=request.user,
    ).count()

    # Studio switcher context
    from src.accounts.models import Studio
    user_studios_qs = Studio.objects.filter(
        memberships__user=request.user, memberships__status="active",
    ).distinct()
    primary_m = request.user.studio_memberships.filter(is_primary=True, status="active").first()
    primary_studio = primary_m.studio if primary_m else None
    active_studio = getattr(request, "active_studio", None)
    is_in_primary_studio = (
        active_studio is not None and primary_studio is not None
        and active_studio.id == primary_studio.id
    )

    return {
        "nav_mode": nav_mode,
        "pending_decisions_count": pending_decisions_count,
        "active_sessions_count": active_sessions_count,
        "user_studios": user_studios_qs,
        "primary_studio": primary_studio,
        "is_in_primary_studio": is_in_primary_studio,
    }
