from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"status": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/v1/health/", HealthAPIView.as_view(), name="health-api"),
    path("api/v1/accounts/", include("src.accounts.api.urls")),
    path("api/v1/progress/", include("src.progress.api.urls")),
    path("accounts/", include("src.accounts.urls")),
    path("progress/", include("src.progress.urls")),
]
