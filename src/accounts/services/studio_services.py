from django.db import transaction
from django.utils import timezone
from src.accounts.models import Studio, StudioMembership
from src.core.audit import log_event
from src.core.services import snapshot_related


@transaction.atomic
def create_studio_for_user(user, name, specialty="feature_films", is_primary=False, slug=None):
    if not slug:
        from django.utils.text import slugify
        base = slugify(name) or "studio"
        slug = base
        counter = 1
        while Studio.objects.filter(slug=slug).exists():
            counter += 1
            slug = f"{base}-{counter}"
    studio = Studio.objects.create(
        name=name, slug=slug, specialty=specialty, created_by=user,
    )
    StudioMembership.objects.create(
        studio=studio, user=user, role="owner", tier="production",
        is_primary=is_primary, accepted_at=timezone.now(), status="active",
    )
    log_event(
        event_type="studio_created", actor_type="user", actor_id=None,
        actor_name=user.email, studio=studio,
        target_type="accounts.Studio", target_id=studio.id,
        payload={"actor_user_id": str(user.id), "name": name, "specialty": specialty, "is_primary": is_primary},
    )
    return studio


def list_studios_for_user(user):
    return Studio.objects.filter(memberships__user=user, memberships__status="active").distinct()


def soft_delete_studio(studio, by_user):
    if studio.memberships.filter(is_primary=True).exists():
        raise ValueError("Cannot delete primary studio without account deactivation")
    snapshot = snapshot_related(studio, depth=2)
    studio.snapshot_on_delete = snapshot
    studio.save(update_fields=["snapshot_on_delete"])
    studio.soft_delete(by_user=by_user)
    log_event(
        event_type="studio_soft_deleted", actor_type="user", actor_id=None,
        actor_name=by_user.email, studio=studio,
        target_type="accounts.Studio", target_id=studio.id,
        payload={"actor_user_id": str(by_user.id)},
    )


@transaction.atomic
def transfer_ownership(studio, from_user, to_user):
    from_membership = StudioMembership.objects.filter(
        studio=studio, user=from_user, role="owner",
    ).first()
    if from_membership is None:
        raise ValueError("from_user is not an owner of this studio")
    target_membership, _ = StudioMembership.objects.get_or_create(
        studio=studio, user=to_user,
        defaults={"role": "owner", "tier": "production", "status": "active",
                  "accepted_at": timezone.now()},
    )
    if target_membership.role != "owner":
        target_membership.role = "owner"
        target_membership.save(update_fields=["role"])
    from_membership.role = "member"
    from_membership.save(update_fields=["role"])
    log_event(
        event_type="ownership_transferred", actor_type="user", actor_id=None,
        actor_name=from_user.email, studio=studio,
        payload={
            "actor_user_id": str(from_user.id),
            "from_user_id": str(from_user.id),
            "to_user_id": str(to_user.id),
        },
    )
