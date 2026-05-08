from django.http import HttpResponse
from django.urls import path
from src.scripts.views import ScriptBreakdownView, ScriptDocsView, ScriptElementsView, ScriptIndexView, ScriptUploadView

app_name = 'scripts'


def _stub(request, *args, **kwargs):
    return HttpResponse(status=404)


urlpatterns = [
    path('<uuid:project_pk>/', ScriptIndexView.as_view(), name='index'),
    path('<uuid:project_pk>/upload/', ScriptUploadView.as_view(), name='upload'),
    path('<uuid:project_pk>/breakdown/', ScriptBreakdownView.as_view(), name='breakdown'),
    path('<uuid:project_pk>/docs/', ScriptDocsView.as_view(), name='docs'),
    path('<uuid:project_pk>/elements/', ScriptElementsView.as_view(), name='elements'),
    # Stub endpoints — not yet built; templates use safe-form {% url ... as u %}
    path('<uuid:project_pk>/docs/create-modal/', _stub, name='create_doc_modal'),
    path('<uuid:project_pk>/docs/<uuid:doc_pk>/', _stub, name='doc_detail'),
    path('<uuid:project_pk>/docs/<uuid:doc_pk>/edit-modal/', _stub, name='edit_doc_modal'),
    path('<uuid:project_pk>/elements/<slug:element_type>/<uuid:element_pk>/', _stub, name='element_detail'),
]
