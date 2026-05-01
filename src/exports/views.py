from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.views import View

from src.exports.services import ExportService
from src.projects.models import Scene


class SceneViewerView(View):
    def get(self, request, scene_pk):
        scene = get_object_or_404(Scene, id=scene_pk)
        payload = ExportService().build_scene_viewer_payload(scene=scene)
        html = f"<html><body><h1>Scene {payload['scene_number']}</h1><p>{payload['title']}</p></body></html>"
        return HttpResponse(html, content_type="text/html")


class CallSheetExportView(View):
    def get(self, request, shoot_day_pk):
        return HttpResponse(f"call sheet export {shoot_day_pk}")
