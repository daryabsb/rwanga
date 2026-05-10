from django.db import transaction
from django.utils import timezone
from src.projects.models import Project
from src.core.audit import log_event
from src.core.services import snapshot_related


@transaction.atomic
def create_project(studio, user, name, project_type, slug=None, **metadata):
    from django.utils.text import slugify
    if not slug:
        base = slugify(name) or "project"
        slug = base
        counter = 1
        while Project.objects.filter(studio=studio, slug=slug).exists():
            counter += 1
            slug = f"{base}-{counter}"
    # NOTE: Project requires legacy fields title and owner; alias to name and user respectively
    project = Project.objects.create(
        studio=studio, name=name, title=name, slug=slug, project_type=project_type,
        created_by=user, owner=user, status="draft", **metadata,
    )
    log_event(
        event_type="project_created", actor_type="user", actor_id=str(user.id),
        actor_name=user.email, studio=studio, project=project,
        target_type="projects.Project", target_id=project.id,
        payload={"name": name, "project_type": project_type},
    )
    return project


def change_project_status(project, new_status, by_user):
    old = project.status
    project.status = new_status
    project.status_changed_at = timezone.now()
    project.status_changed_by = by_user
    project.save(update_fields=["status", "status_changed_at", "status_changed_by"])
    log_event(
        event_type="project_status_changed", actor_type="user", actor_id=str(by_user.id),
        actor_name=by_user.email, studio=project.studio, project=project,
        payload={"old": old, "new": new_status},
    )


@transaction.atomic
def soft_delete_project(project, by_user):
    snapshot = snapshot_related(project, depth=3)
    project.snapshot_on_delete = snapshot
    project.save(update_fields=["snapshot_on_delete"])
    project.soft_delete(by_user=by_user)
    log_event(
        event_type="project_soft_deleted", actor_type="user", actor_id=str(by_user.id),
        actor_name=by_user.email, studio=project.studio, project=project,
        target_type="projects.Project", target_id=project.id,
    )
