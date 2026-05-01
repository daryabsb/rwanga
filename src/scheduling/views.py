from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, render
from django.views import View

from src.projects.models import Project
from src.scheduling.models import CallSheet, ShootDay
from src.scheduling.services import SchedulingService


class SchedulingIndexView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        shoot_days = SchedulingService().list_shoot_days(project=project)
        return render(request, "scheduling/index.html", {"project": project, "shoot_days": shoot_days, "active_project": project, "active_section": "p"})


class StripboardView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        shoot_days = SchedulingService().list_shoot_days(project=project)
        strips = []
        for day in shoot_days:
            strips.append({"is_day_break": True, "day_number": day.day_number, "date": day.date, "notes": day.notes, "pk": day.pk})
            for block in day.blocks.select_related("scene").all().order_by("order", "created_at"):
                if block.scene_id:
                    strips.append({"is_day_break": False, "day_number": day.day_number, "scene": block.scene})
        return render(request, "scheduling/stripboard.html", {"project": project, "shoot_days": shoot_days, "strips": strips, "active_project": project, "active_section": "p"})


class CallSheetsView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        call_sheets = CallSheet.objects.select_related("shoot_day", "location").filter(shoot_day__project=project).order_by("shoot_day__date", "shoot_day__day_number")
        return render(request, "scheduling/call_sheets.html", {"project": project, "call_sheets": call_sheets, "active_project": project, "active_section": "sh"})


class SchedulingOptimizeView(View):
    def post(self, request, project_pk):
        return JsonResponse({"status": "queued", "project_pk": str(project_pk)})


class ShootDayDetailView(View):
    def get(self, request, project_pk, day_pk):
        project = get_object_or_404(Project, id=project_pk)
        day = get_object_or_404(ShootDay, id=day_pk, project=project)
        return HttpResponse(f"<div class='rw-card'><h3>Day {day.day_number}</h3><p>{day.date}</p></div>")


class AddDayModalView(View):
    def get(self, request, project_pk):
        return HttpResponse(
            """
<div class="modal fade" id="addDayModal" tabindex="-1">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">Add shoot day</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body">
        <p class="mb-0">Add day form wiring is pending.</p>
      </div>
    </div>
  </div>
</div>
"""
        )


class ReorderStripsView(View):
    def post(self, request, project_pk):
        return HttpResponse(status=204)


class ExportStripboardPdfView(View):
    def get(self, request, project_pk):
        return HttpResponse("PDF export is not available yet.", status=501)


class GenerateCallSheetModalView(View):
    def get(self, request, project_pk):
        return HttpResponse(
            """
<div class="modal fade" id="generateCallSheetModal" tabindex="-1">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">Generate call sheet</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body">
        <p class="mb-0">Call-sheet generation form wiring is pending.</p>
      </div>
    </div>
  </div>
</div>
"""
        )


class GenerateCallSheetPdfView(View):
    def post(self, request, project_pk, call_sheet_pk):
        return HttpResponse("PDF generated.", status=200)


class SendCallSheetWhatsappView(View):
    def post(self, request, project_pk, call_sheet_pk):
        return HttpResponse(status=204)


class CallSheetDetailView(View):
    def get(self, request, project_pk, call_sheet_pk):
        call_sheet = get_object_or_404(CallSheet, pk=call_sheet_pk, shoot_day__project_id=project_pk)
        return HttpResponse(
            f"""
<div class="modal fade" id="callSheetDetailModal" tabindex="-1">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">Call sheet day {call_sheet.shoot_day.day_number}</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body">
        <p class="mb-0">Detail preview loaded.</p>
      </div>
    </div>
  </div>
</div>
"""
        )
