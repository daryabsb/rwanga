from django.urls import path

from src.scheduling.views import (
    AddDayModalView,
    CallSheetsView,
    SchedulingIndexView,
    SchedulingOptimizeView,
    ShootDayDetailView,
    StripboardView,
)

app_name = "scheduling"
urlpatterns = [
    path("<uuid:project_pk>/", SchedulingIndexView.as_view(), name="index"),
    path("<uuid:project_pk>/stripboard/", StripboardView.as_view(), name="stripboard"),
    path("<uuid:project_pk>/call-sheets/", CallSheetsView.as_view(), name="call_sheets"),
    path("<uuid:project_pk>/optimize/", SchedulingOptimizeView.as_view(), name="optimize"),
    path("<uuid:project_pk>/days/<uuid:day_pk>/", ShootDayDetailView.as_view(), name="day_detail"),
    path("<uuid:project_pk>/days/add-modal/", AddDayModalView.as_view(), name="add_day_modal"),
]
