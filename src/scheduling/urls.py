from django.urls import path

from src.scheduling.views import (
    AddDayModalView,
    CallSheetsView,
    CallSheetDetailView,
    ExportStripboardPdfView,
    GenerateCallSheetModalView,
    GenerateCallSheetPdfView,
    ReorderStripsView,
    SendCallSheetWhatsappView,
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
    path("<uuid:project_pk>/reorder-strips/", ReorderStripsView.as_view(), name="reorder_strips"),
    path("<uuid:project_pk>/stripboard/export-pdf/", ExportStripboardPdfView.as_view(), name="export_pdf"),
    path("<uuid:project_pk>/days/<uuid:day_pk>/", ShootDayDetailView.as_view(), name="day_detail"),
    path("<uuid:project_pk>/days/add-modal/", AddDayModalView.as_view(), name="add_day_modal"),
    path("<uuid:project_pk>/call-sheets/generate-modal/", GenerateCallSheetModalView.as_view(), name="generate_call_sheet_modal"),
    path("<uuid:project_pk>/call-sheets/<uuid:call_sheet_pk>/generate-pdf/", GenerateCallSheetPdfView.as_view(), name="generate_pdf"),
    path("<uuid:project_pk>/call-sheets/<uuid:call_sheet_pk>/send-whatsapp/", SendCallSheetWhatsappView.as_view(), name="send_whatsapp"),
    path("<uuid:project_pk>/call-sheets/<uuid:call_sheet_pk>/detail/", CallSheetDetailView.as_view(), name="call_sheet_detail"),
]
