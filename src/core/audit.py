from src.core.models import ProductionLog


def log_event(
    event_type, actor_type="system", actor_id=None, actor_name="",
    studio=None, project=None, target_type="", target_id=None,
    payload=None, source_ip=None, session_id="", visibility="private",
):
    """Append an event to production_log. Single-source audit helper.
    Use everywhere a meaningful state change happens."""
    return ProductionLog.objects.create(
        event_type=event_type,
        actor_type=actor_type,
        actor_id=actor_id,
        actor_name=actor_name,
        studio=studio,
        project=project,
        target_type=target_type,
        target_id=target_id,
        payload=payload or {},
        source_ip=source_ip,
        session_id=session_id,
        visibility=visibility,
    )
