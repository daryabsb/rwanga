from django.urls import path, re_path

from src.ai_engine.views import GenerateSceneView, JobResultView, JobStatusView, RerunBreakdownView, RunBreakdownView

app_name = 'ai_engine'
urlpatterns = [
    path('generate-scene/<uuid:scene_pk>/', GenerateSceneView.as_view(), name='generate_scene'),
    path('run-breakdown/<uuid:project_pk>/', RunBreakdownView.as_view(), name='run_breakdown'),
    path('rerun-breakdown/<uuid:script_pk>/', RerunBreakdownView.as_view(), name='rerun_breakdown'),
    path('job/<uuid:job_id>/result/', JobResultView.as_view(), name='job_result'),
    path('job/<uuid:job_id>/status/', JobStatusView.as_view(), name='job_status'),
    re_path(r'^job/(?P<job_id>.*)/result/$', JobResultView.as_view(), name='job_result_fallback'),
    re_path(r'^job/(?P<job_id>.*)/status/$', JobStatusView.as_view(), name='job_status_fallback'),
]
