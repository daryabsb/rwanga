from django.http import HttpResponse
from django.urls import path
from src.scheduling.views import CallSheetsView, SchedulingIndexView, SchedulingOptimizeView, StripboardView

app_name = 'scheduling'


def _stub(request, *args, **kwargs):
    return HttpResponse(status=404)


urlpatterns = [
    path('<uuid:project_pk>/', SchedulingIndexView.as_view(), name='index'),
    path('<uuid:project_pk>/stripboard/', StripboardView.as_view(), name='stripboard'),
    path('<uuid:project_pk>/call-sheets/', CallSheetsView.as_view(), name='call_sheets'),
    path('<uuid:project_pk>/optimize/', SchedulingOptimizeView.as_view(), name='optimize'),
    # Stub endpoints — not yet built; templates use safe-form {% url ... as u %}
    path('<uuid:project_pk>/call-sheets/generate-modal/', _stub, name='generate_call_sheet_modal'),
    path('<uuid:project_pk>/call-sheets/<uuid:cs_pk>/generate-pdf/', _stub, name='generate_pdf'),
    path('<uuid:project_pk>/call-sheets/<uuid:cs_pk>/send-whatsapp/', _stub, name='send_whatsapp'),
    path('<uuid:project_pk>/call-sheets/<uuid:cs_pk>/', _stub, name='call_sheet_detail'),
    path('<uuid:project_pk>/days/<uuid:day_pk>/', _stub, name='day_detail'),
    path('<uuid:project_pk>/days/add-modal/', _stub, name='add_day_modal'),
    path('<uuid:project_pk>/stripboard/reorder/', _stub, name='reorder_strips'),
    path('<uuid:project_pk>/stripboard/export-pdf/', _stub, name='export_pdf'),
]
