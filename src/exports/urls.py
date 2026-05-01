from django.urls import path
from src.exports.views import CallSheetExportView, SceneViewerView, ShotListExportView

app_name = 'exports'
urlpatterns = [
    path('scene-viewer/<uuid:scene_pk>/', SceneViewerView.as_view(), name='scene_viewer'),
    path('call-sheet/<uuid:shoot_day_pk>/', CallSheetExportView.as_view(), name='call_sheet'),
    path('shot-list/<uuid:project_pk>/', ShotListExportView.as_view(), name='shot_list'),
]
