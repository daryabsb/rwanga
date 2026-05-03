from src.progress.models import ProgressTask, ProgressUpdate


class ProgressService:
    @staticmethod
    def seed_initial_tasks():
        initial = [
            {
                "title": "P0 foundation",
                "description": "Bootstrap skeleton, settings, and runtime validation",
                "task_type": ProgressTask.TaskType.INFRASTRUCTURE,
                "phase": "P0",
                "priority": ProgressTask.Priority.CRITICAL,
            },
            {
                "title": "P0 core app",
                "description": "Implement BaseModel and SoftDeleteModel",
                "task_type": ProgressTask.TaskType.IMPLEMENTATION,
                "phase": "P0",
                "priority": ProgressTask.Priority.HIGH,
            },
            {
                "title": "P0 progress app",
                "description": "Build db-backed project tracking app",
                "task_type": ProgressTask.TaskType.IMPLEMENTATION,
                "phase": "P0",
                "priority": ProgressTask.Priority.CRITICAL,
            },
            {
                "title": "P1 accounts",
                "description": "Implement accounts domain",
                "task_type": ProgressTask.TaskType.IMPLEMENTATION,
                "phase": "P1",
                "priority": ProgressTask.Priority.HIGH,
            },
            {
                "title": "P1 projects",
                "description": "Implement projects and scenes domain",
                "task_type": ProgressTask.TaskType.IMPLEMENTATION,
                "phase": "P1",
                "priority": ProgressTask.Priority.HIGH,
            },
        ]

        for item in initial:
            ProgressTask.objects.get_or_create(
                title=item["title"],
                defaults={**item, "status": ProgressTask.Status.PENDING},
            )

    @staticmethod
    def list_task_titles():
        return ProgressTask.objects.values_list("title", flat=True)

    @staticmethod
    def record_foundation_completion():
        task, _ = ProgressTask.objects.get_or_create(
            title="P0 foundation",
            defaults={
                "description": "Bootstrap skeleton, settings, and runtime validation",
                "task_type": ProgressTask.TaskType.INFRASTRUCTURE,
                "phase": "P0",
                "status": ProgressTask.Status.COMPLETED,
                "priority": ProgressTask.Priority.CRITICAL,
            },
        )
        task.status = ProgressTask.Status.COMPLETED
        task.save(update_fields=["status", "updated_at"])

        ProgressUpdate.objects.create(
            task=task,
            update_type=ProgressUpdate.UpdateType.IMPLEMENTATION,
            body="Foundation slice completed: skeleton, settings, core app, and basic validation.",
            files_affected=[
                "manage.py",
                "src/settings",
                "src/core/models.py",
            ],
            tests_run=["python manage.py test src.core.tests.test_models", "python manage.py check"],
        )
