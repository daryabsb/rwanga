class StudioContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.studio = None
        request.theme = request.COOKIES.get("rwanga_theme", "dark")
        return self.get_response(request)
