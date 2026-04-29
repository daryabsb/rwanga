from django.http import HttpResponse
from django.shortcuts import render
from django.views import View

class SceneViewerView(View):
    def get(self, request, scene_pk):
        return render(request, "exports/scene_viewer.html", {"scene_pk": scene_pk})


class CallSheetExportView(View):
    def get(self, request, shoot_day_pk):
        return HttpResponse(f"call sheet export {shoot_day_pk}")
