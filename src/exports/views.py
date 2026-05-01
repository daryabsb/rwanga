from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.views import View

from src.exports.services import ExportService
from src.projects.models import Project, Scene
from src.scheduling.models import ShootDay


class SceneViewerView(View):
    def get(self, request, scene_pk):
        scene = get_object_or_404(Scene, id=scene_pk)
        html = ExportService().generate_scene_viewer(scene)
        return HttpResponse(html, content_type="text/html")


class CallSheetExportView(View):
    def get(self, request, shoot_day_pk):
        shoot_day = get_object_or_404(ShootDay, id=shoot_day_pk)
        try:
            pdf = ExportService().generate_call_sheet_pdf(shoot_day)
        except Exception:
            return HttpResponse("PDF runtime dependencies are unavailable on this host.", status=503)
        response = HttpResponse(pdf, content_type="application/pdf")
        response["Content-Disposition"] = f'inline; filename="call-sheet-day-{shoot_day.day_number}.pdf"'
        return response


class ShotListExportView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        try:
            pdf = ExportService().generate_shot_list_pdf(project)
        except Exception:
            return HttpResponse("PDF runtime dependencies are unavailable on this host.", status=503)
        response = HttpResponse(pdf, content_type="application/pdf")
        response["Content-Disposition"] = f'inline; filename="shot-list-{project.slug}.pdf"'
        return response
