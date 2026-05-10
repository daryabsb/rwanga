from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from src.accounts.models import StudioMembership, Studio
from src.core.services import snapshot_related
from src.core.audit import log_event


@transaction.atomic
def deactivate_account(user, by_user):
    owned_studios = Studio.objects.filter(memberships__user=user, memberships__role="owner")
    for s in owned_studios:
        s.snapshot_on_delete = snapshot_related(s, depth=2)
        s.save(update_fields=["snapshot_on_delete"])
        s.soft_delete(by_user=by_user)
    now = timezone.now()
    StudioMembership.all_with_deleted.filter(user=user).update(
        deleted_at=now,
        deleted_by=by_user,
        recovery_grace_until=now + timedelta(days=StudioMembership.GRACE_DAYS),
    )
    user.is_active = False
    user.save(update_fields=["is_active"])
    log_event(
        event_type="account_deactivated", actor_type="user",
        actor_id=str(by_user.id), actor_name=by_user.email,
        payload={"target_user_id": str(user.id)},
    )
