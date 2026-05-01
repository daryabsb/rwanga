from django.urls import include, path
from rest_framework.routers import DefaultRouter

from src.departments.api.views import ContinuityItemViewSet, LightingNoteViewSet, PropViewSet, SoundNoteViewSet, WardrobeItemViewSet

router = DefaultRouter()
router.register("lighting-notes", LightingNoteViewSet, basename="lighting-note")
router.register("sound-notes", SoundNoteViewSet, basename="sound-note")
router.register("props", PropViewSet, basename="prop")
router.register("wardrobe-items", WardrobeItemViewSet, basename="wardrobe-item")
router.register("continuity-items", ContinuityItemViewSet, basename="continuity-item")

urlpatterns = [
    path("", include(router.urls)),
]
