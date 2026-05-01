from django.urls import include, path
from rest_framework.routers import DefaultRouter

from src.scheduling.api.views import CallSheetViewSet, ScheduleBlockViewSet, ShootDayViewSet

router = DefaultRouter()
router.register("shoot-days", ShootDayViewSet, basename="shoot-day")
router.register("schedule-blocks", ScheduleBlockViewSet, basename="schedule-block")
router.register("call-sheets", CallSheetViewSet, basename="call-sheet")

urlpatterns = [
    path("", include(router.urls)),
]
