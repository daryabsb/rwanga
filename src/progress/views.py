from django.shortcuts import render
from django.views import View

from src.progress.models import GapBlocker, ProgressTask, ProgressUpdate


class ProgressDashboardView(View):
    def get(self, request):
        context = {
            "task_count": ProgressTask.objects.count(),
            "completed_count": ProgressTask.objects.filter(status=ProgressTask.Status.COMPLETED).count(),
            "blocked_count": ProgressTask.objects.filter(status=ProgressTask.Status.BLOCKED).count(),
            "open_gaps": GapBlocker.objects.filter(status=GapBlocker.Status.OPEN).count(),
            "recent_updates": ProgressUpdate.objects.select_related("task").order_by("-created_at")[:10],
        }
        return render(request, "progress/dashboard.html", context)
