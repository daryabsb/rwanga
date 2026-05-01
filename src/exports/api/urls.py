from django.urls import path

from src.exports.api.views import exports_health

urlpatterns = [
    path("health/", exports_health, name="exports-health"),
]
