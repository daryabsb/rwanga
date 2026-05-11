from src.accounts.models import Studio


class StudioContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.active_studio = None
        request.theme = request.COOKIES.get("rwanga_theme", "dark")
        if request.user.is_authenticated:
            sid = request.session.get("active_studio_id") if hasattr(request, "session") else None
            if sid:
                try:
                    request.active_studio = Studio.objects.get(
                        id=sid, memberships__user=request.user, memberships__status="active",
                    )
                except Studio.DoesNotExist:
                    pass
            if request.active_studio is None:
                primary_m = request.user.studio_memberships.filter(is_primary=True, status="active").first()
                if primary_m:
                    request.active_studio = primary_m.studio
        # Preserve legacy `request.studio` for old templates referencing it
        request.studio = request.active_studio
        return self.get_response(request)
