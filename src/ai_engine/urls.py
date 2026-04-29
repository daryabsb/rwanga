from django.urls import path

from src.ai_engine.views import GenerateSceneView, JobResultView, JobStatusView, RerunBreakdownView

app_name = 'ai_engine'
urlpatterns = [
    path('generate-scene/<uuid:scene_pk>/', GenerateSceneView.as_view(), name='generate_scene'),
    path('rerun-breakdown/<uuid:script_pk>/', RerunBreakdownView.as_view(), name='rerun_breakdown'),
    path('job/<uuid:job_id>/result/', JobResultView.as_view(), name='job_result'),
    path('job/<uuid:job_id>/status/', JobStatusView.as_view(), name='job_status'),
]
