from django.shortcuts import render
from django.views import View

from src.progress.models import GapBlocker, ProgressTask, ProgressUpdate


def stub_view(request, *args, **kwargs):
    return render(request, "stub.html", {"stub_name": "Progress"})


class ProgressDashboardView(View):
    def get(self, request):
        tasks_qs = ProgressTask.objects.all()
        context = {
            "task_count": tasks_qs.count(),
            "completed_count": tasks_qs.filter(status=ProgressTask.Status.COMPLETED).count(),
            "blocked_count": tasks_qs.filter(status=ProgressTask.Status.BLOCKED).count(),
            "tasks_summary": {
                "pending": tasks_qs.filter(status=ProgressTask.Status.PENDING).count(),
                "in_progress": tasks_qs.filter(status=ProgressTask.Status.IN_PROGRESS).count(),
                "completed": tasks_qs.filter(status=ProgressTask.Status.COMPLETED).count(),
                "blocked": tasks_qs.filter(status=ProgressTask.Status.BLOCKED).count(),
            },
            "open_gaps": GapBlocker.objects.filter(status=GapBlocker.Status.OPEN),
            "recent_updates": ProgressUpdate.objects.select_related("task").order_by("-created_at")[:10],
        }
        return render(request, "progress/dashboard.html", context)


class ProgressTasksView(View):
    def get(self, request):
        tasks = ProgressTask.objects.order_by("phase", "created_at")
        return render(request, "progress/tasks.html", {"tasks": tasks})


class ProgressTaskDetailView(View):
    def get(self, request, task_id):
        task = ProgressTask.objects.filter(id=task_id).first()
        return render(request, "progress/task_detail.html", {"task": task})


class ProgressUpdatesView(View):
    def get(self, request):
        updates = ProgressUpdate.objects.select_related("task").order_by("-created_at")
        return render(request, "progress/updates.html", {"updates": updates})


class ProgressGapsView(View):
    def get(self, request):
        gaps = GapBlocker.objects.order_by("-created_at")
        return render(request, "progress/gaps.html", {"gaps": gaps})


class ProgressDecisionsView(View):
    def get(self, request):
        return render(request, "progress/decisions.html", {})


class ProgressAgentReportsView(View):
    def get(self, request):
        return render(request, "progress/agent_reports.html", {})


class ProgressChangelogView(View):
    def get(self, request):
        return render(request, "progress/changelog.html", {})


class ProgressDiagramsView(View):
    def get(self, request):
        return render(request, "progress/diagrams.html", {})


class ProgressDocsView(View):
    def get(self, request):
        return render(request, "progress/docs.html", {})
