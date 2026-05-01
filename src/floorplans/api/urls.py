from django.urls import include, path
from rest_framework.routers import DefaultRouter

from src.floorplans.api.views import FloorPlanViewSet

router = DefaultRouter()
router.register("floorplans", FloorPlanViewSet, basename="floorplan")

urlpatterns = [
    path("", include(router.urls)),
]
