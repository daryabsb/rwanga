from django.http import HttpResponse
from django.shortcuts import get_object_or_404, render
from django.views import View
from src.projects.models import Scene

class SceneViewerView(View):
    def get(self, request, scene_pk):
        scene = get_object_or_404(Scene, id=scene_pk)
        return render(
            request,
            "stub.html",
            {
                "active_project": scene.project,
                "active_scene": scene,
                "active_section": "v",
                "stub_name": "Scene viewer export",
            },
        )


class CallSheetExportView(View):
    def get(self, request, shoot_day_pk):
        return HttpResponse(f"call sheet export {shoot_day_pk}")
