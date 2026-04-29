from django.urls import path

from src.progress.views import ProgressDashboardView

app_name = "progress"

urlpatterns = [
    path("", ProgressDashboardView.as_view(), name="dashboard"),
]
