from django.urls import path
from src.floorplans.views import FloorPlanEditorView, FloorPlanListView

app_name = 'floorplans'
urlpatterns = [
    path('<uuid:project_pk>/', FloorPlanListView.as_view(), name='list'),
    path('<uuid:project_pk>/<uuid:pk>/', FloorPlanEditorView.as_view(), name='editor'),
]
