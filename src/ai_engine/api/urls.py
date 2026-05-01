from django.urls import include, path
from rest_framework.routers import DefaultRouter

from src.ai_engine.api.views import AIJobViewSet

router = DefaultRouter()
router.register("jobs", AIJobViewSet, basename="ai-job")

urlpatterns = [
    path("", include(router.urls)),
]
