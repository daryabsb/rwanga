from django.shortcuts import render
from django.views import View

from src.progress.models import GapBlocker, ProgressTask, ProgressUpdate


class ProgressDashboardView(View):
    def get(self, request):
        Status = ProgressTask.Status
        tasks_qs = ProgressTask.objects.all()
        context = {
            "tasks_summary": {
                "total": tasks_qs.count(),
                "pending": tasks_qs.filter(status=Status.PENDING).count(),
                "in_progress": tasks_qs.filter(status=Status.IN_PROGRESS).count(),
                "completed": tasks_qs.filter(status=Status.COMPLETED).count(),
                "blocked": tasks_qs.filter(status=Status.BLOCKED).count(),
            },
            "open_gaps": GapBlocker.objects.filter(status=GapBlocker.Status.OPEN),
            "recent_updates": ProgressUpdate.objects.select_related("task").order_by("-created_at")[:10],
        }
        return render(request, "progress/dashboard.html", context)


def tasks_view(request):
    return render(request, "progress/tasks.html", {})


def task_detail_view(request, task_id):
    return render(request, "progress/task_detail.html", {"task_id": task_id})


def updates_view(request):
    return render(request, "progress/updates.html", {})


def changelog_view(request):
    return render(request, "progress/changelog.html", {})


def decisions_view(request):
    return render(request, "progress/decisions.html", {})


def docs_view(request):
    return render(request, "progress/docs.html", {})


def doc_detail_view(request, doc_id):
    return render(request, "progress/docs.html", {"doc_id": doc_id})


def gaps_view(request):
    return render(request, "progress/gaps.html", {})


def diagrams_view(request):
    return render(request, "progress/diagrams.html", {})


def diagram_detail_view(request, diagram_id):
    return render(request, "progress/diagrams.html", {"diagram_id": diagram_id})


def agent_reports_view(request):
    return render(request, "progress/agent_reports.html", {})


def update_task_status_modal_view(request, task_id):
    return render(request, "progress/task_detail.html", {"task_id": task_id})
