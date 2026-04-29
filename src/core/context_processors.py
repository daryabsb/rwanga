def studio_context(request):
    return {
        "active_studio": getattr(request, "studio", None),
        "RWANGA_THEME": getattr(request, "theme", "dark"),
    }
