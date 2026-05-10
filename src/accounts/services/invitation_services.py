import secrets
from django.utils import timezone
from src.accounts.models import StudioMembership, ProjectMembership
from src.core.audit import log_event


def invite_to_studio(studio, user, role, tier, invited_by):
    token = secrets.token_urlsafe(32)
    m = StudioMembership.objects.create(
        studio=studio, user=user, role=role, tier=tier, status="pending",
        invited_by=invited_by, invited_at=timezone.now(),
        magic_link_token=token,
    )
    log_event(
        event_type="studio_invitation_sent", actor_type="user",
        actor_id=str(invited_by.id), actor_name=invited_by.email,
        studio=studio,
        payload={"invited_user_id": str(user.id), "role": role, "tier": tier},
    )
    return m


def accept_studio_invitation(token, by_user):
    m = StudioMembership.objects.get(magic_link_token=token, user=by_user)
    m.status = "active"
    m.accepted_at = timezone.now()
    m.magic_link_token = None
    m.save(update_fields=["status", "accepted_at", "magic_link_token"])
    log_event(
        event_type="studio_invitation_accepted", actor_type="user",
        actor_id=str(by_user.id), actor_name=by_user.email,
        studio=m.studio,
    )
    return m


def reject_studio_invitation(token, by_user):
    m = StudioMembership.objects.get(magic_link_token=token, user=by_user)
    studio_id = m.studio_id
    m.delete()
    log_event(
        event_type="studio_invitation_rejected", actor_type="user",
        actor_id=str(by_user.id), actor_name=by_user.email,
        payload={"studio_id": str(studio_id)},
    )


def invite_to_project(project, user, role_type, tier, department, invited_by):
    token = secrets.token_urlsafe(32)
    m = ProjectMembership.objects.create(
        project=project, user=user, role_type=role_type, department_role=department,
        tier=tier, status="pending", invited_by=invited_by, invited_at=timezone.now(),
        magic_link_token=token,
    )
    log_event(
        event_type="project_invitation_sent", actor_type="user",
        actor_id=str(invited_by.id), actor_name=invited_by.email,
        studio=project.studio, project=project,
        payload={"invited_user_id": str(user.id), "role_type": role_type, "tier": tier},
    )
    return m


def accept_project_invitation(token, by_user):
    m = ProjectMembership.objects.get(magic_link_token=token, user=by_user)
    m.status = "active"
    m.accepted_at = timezone.now()
    m.magic_link_token = None
    m.save(update_fields=["status", "accepted_at", "magic_link_token"])
    log_event(
        event_type="project_invitation_accepted", actor_type="user",
        actor_id=str(by_user.id), actor_name=by_user.email,
        studio=m.project.studio, project=m.project,
    )
    return m


def reject_project_invitation(token, by_user):
    m = ProjectMembership.objects.get(magic_link_token=token, user=by_user)
    project = m.project
    studio = project.studio
    project_id = project.id
    studio_id = studio.id
    m.delete()
    log_event(
        event_type="project_invitation_rejected", actor_type="user",
        actor_id=str(by_user.id), actor_name=by_user.email,
        payload={
            "project_id": str(project_id),
            "studio_id": str(studio_id),
        },
    )
