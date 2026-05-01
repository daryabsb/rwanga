from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, render
from django.views import View

from src.projects.models import Project
from src.scheduling.models import ShootDay
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
        return render(request, "scheduling/stripboard.html", {"project": project, "shoot_days": shoot_days, "active_project": project, "active_section": "p"})


class CallSheetsView(View):
    def get(self, request, project_pk):
        project = get_object_or_404(Project, id=project_pk)
        shoot_days = SchedulingService().list_shoot_days(project=project)
        return render(request, "scheduling/call_sheets.html", {"project": project, "shoot_days": shoot_days, "active_project": project, "active_section": "sh"})


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
        return HttpResponse("<div class='rw-modal'><div class='rw-card'>Add day modal placeholder</div></div>")
