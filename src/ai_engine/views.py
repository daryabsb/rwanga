from django.http import JsonResponse
from django.shortcuts import render
from django.views import View

class GenerateSceneView(View):
    def post(self, request, scene_pk):
        return JsonResponse({'status': 'queued', 'scene_pk': str(scene_pk)})

class RerunBreakdownView(View):
    def post(self, request, script_pk):
        return JsonResponse({'status': 'queued', 'script_pk': str(script_pk)})

class JobResultView(View):
    def get(self, request, job_id):
        job = {"id": job_id, "type": "breakdown", "progress": 100, "step": "تەواو بوو"}
        return render(request, "components/_ai_progress.html", {"job": job})


class JobStatusView(View):
    def get(self, request, job_id):
        return JsonResponse({"status": "running", "job_id": str(job_id), "progress": 25})
