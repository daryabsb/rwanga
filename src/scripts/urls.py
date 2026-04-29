from django.urls import path
from src.scripts.views import ScriptBreakdownView, ScriptDocsView, ScriptElementsView, ScriptIndexView, ScriptUploadView

app_name = 'scripts'
urlpatterns = [
    path('<uuid:project_pk>/', ScriptIndexView.as_view(), name='index'),
    path('<uuid:project_pk>/upload/', ScriptUploadView.as_view(), name='upload'),
    path('<uuid:project_pk>/breakdown/', ScriptBreakdownView.as_view(), name='breakdown'),
    path('<uuid:project_pk>/docs/', ScriptDocsView.as_view(), name='docs'),
    path('<uuid:project_pk>/elements/', ScriptElementsView.as_view(), name='elements'),
]
