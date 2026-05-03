from django.urls import path
from src.scheduling.views import CallSheetsView, SchedulingIndexView, SchedulingOptimizeView, StripboardView

app_name = 'scheduling'
urlpatterns = [
    path('<uuid:project_pk>/', SchedulingIndexView.as_view(), name='index'),
    path('<uuid:project_pk>/stripboard/', StripboardView.as_view(), name='stripboard'),
    path('<uuid:project_pk>/call-sheets/', CallSheetsView.as_view(), name='call_sheets'),
    path('<uuid:project_pk>/optimize/', SchedulingOptimizeView.as_view(), name='optimize'),
]
