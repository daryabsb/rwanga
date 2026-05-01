from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.views import View

from src.ai_engine.models import AIJob
from src.projects.models import Project, Scene


class GenerateSceneView(View):
    def post(self, request, scene_pk):
        scene = get_object_or_404(Scene, id=scene_pk)
        job = AIJob.objects.create(project=scene.project, type=AIJob.JobType.BREAKDOWN, status=AIJob.Status.QUEUED)
        return JsonResponse({"status": "queued", "scene_pk": str(scene_pk), "job_id": str(job.id)})


class RerunBreakdownView(View):
    def post(self, request, script_pk):
        project = get_object_or_404(Project, scripts__id=script_pk)
        job = AIJob.objects.create(project=project, type=AIJob.JobType.BREAKDOWN, status=AIJob.Status.QUEUED)
        return JsonResponse({"status": "queued", "script_pk": str(script_pk), "job_id": str(job.id)})


class RunBreakdownView(View):
    def post(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        job = AIJob.objects.create(project=project, type=AIJob.JobType.BREAKDOWN, status=AIJob.Status.QUEUED)
        return JsonResponse({"status": "queued", "project_pk": str(project_pk), "job_id": str(job.id)})


class JobResultView(View):
    def get(self, request, job_id):
        job = get_object_or_404(AIJob, id=job_id)
        return render(request, "components/_ai_progress.html", {"job": job})


class JobStatusView(View):
    def get(self, request, job_id):
        job = get_object_or_404(AIJob, id=job_id)
        return JsonResponse({"status": job.status, "job_id": str(job.id), "progress": job.progress})
