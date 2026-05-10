from functools import wraps
from django.http import HttpResponseForbidden
from src.core.rbac import user_can


PRO_FEATURES = {"ask_ai", "studio_api_key", "outbound_mcp"}


def subscription_required(feature):
    def decorator(view_func):
        @wraps(view_func)
        def wrapped(request, *args, **kwargs):
            studio = getattr(request, "active_studio", None)
            if studio is None:
                return HttpResponseForbidden("No active studio")
            sub = getattr(studio, "subscription", None)
            if sub is None:
                return HttpResponseForbidden("No subscription")
            if feature in PRO_FEATURES:
                if sub.plan in ("pro", "studio_unlimited", "enterprise"):
                    return view_func(request, *args, **kwargs)
                if sub.status == "trial":
                    return view_func(request, *args, **kwargs)
                return HttpResponseForbidden(f"Feature '{feature}' requires Pro subscription")
            return view_func(request, *args, **kwargs)
        return wrapped
    return decorator


def rbac_required(area, action):
    def decorator(view_func):
        @wraps(view_func)
        def wrapped(request, *args, **kwargs):
            studio = getattr(request, "active_studio", None)
            if studio is None:
                return HttpResponseForbidden("No active studio")
            if not user_can(request.user, studio, area, action):
                return HttpResponseForbidden(f"RBAC denied: {area}/{action}")
            return view_func(request, *args, **kwargs)
        return wrapped
    return decorator
