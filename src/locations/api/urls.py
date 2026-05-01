from django.urls import include, path
from rest_framework.routers import DefaultRouter

from src.locations.api.views import LocationViewSet

router = DefaultRouter()
router.register("locations", LocationViewSet, basename="location")

urlpatterns = [
    path("", include(router.urls)),
]
