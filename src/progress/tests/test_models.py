from django.test import TestCase

from src.progress.models import GapBlocker, ProgressTask


class ProgressModelTests(TestCase):
    def test_create_progress_task(self):
        task = ProgressTask.objects.create(
            title="P0 foundation",
            description="Bootstrap and validate base platform",
            task_type=ProgressTask.TaskType.INFRASTRUCTURE,
            phase="P0",
            status=ProgressTask.Status.PENDING,
            priority=ProgressTask.Priority.CRITICAL,
        )
        self.assertEqual(task.phase, "P0")
        self.assertEqual(task.status, ProgressTask.Status.PENDING)

    def test_gap_blocker_can_link_task(self):
        task = ProgressTask.objects.create(
            title="P0 core app",
            description="Create BaseModel and SoftDeleteModel",
            task_type=ProgressTask.TaskType.IMPLEMENTATION,
            phase="P0",
            status=ProgressTask.Status.IN_PROGRESS,
            priority=ProgressTask.Priority.HIGH,
        )
        blocker = GapBlocker.objects.create(
            title="Spec unclear",
            description="Need clarification for unresolved item",
            gap_type=GapBlocker.GapType.SPEC_UNCLEAR,
            severity=GapBlocker.Severity.MAJOR,
            related_task=task,
            phase="P0",
            status=GapBlocker.Status.OPEN,
        )
        self.assertEqual(blocker.related_task, task)
