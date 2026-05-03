from django.conf import settings
from django.contrib import admin
from django.conf.urls.static import static
from django.urls import include, path
from django.views.generic import RedirectView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"status": "ok"})


urlpatterns = [
    path("", RedirectView.as_view(url="/projects/", permanent=False)),
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/v1/health/", HealthAPIView.as_view(), name="health-api"),
    path("api/v1/accounts/", include("src.accounts.api.urls")),
    path("api/v1/projects/", include("src.projects.api.urls")),
    path("api/v1/progress/", include("src.progress.api.urls")),
    path("accounts/", include("src.accounts.urls")),
    path("accounts/", include("allauth.urls")),
    path("projects/", include("src.projects.urls")),
    path("scripts/", include("src.scripts.urls")),
    path("shots/", include("src.shots.urls")),
    path("floorplans/", include("src.floorplans.urls")),
    path("scheduling/", include("src.scheduling.urls")),
    path("locations/", include("src.locations.urls")),
    path("departments/", include("src.departments.urls")),
    path("reviews/", include("src.reviews.urls")),
    path("ai/", include("src.ai_engine.urls")),
    path("exports/", include("src.exports.urls")),
    path("notifications/", include("src.notifications.urls")),
    path("community/", include("src.community.urls")),
    path("progress/", include("src.progress.urls")),
]

if settings.DEBUG:
    if getattr(settings, "STATICFILES_DIRS", None):
        urlpatterns += static(settings.STATIC_URL, document_root=settings.STATICFILES_DIRS[0])
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
