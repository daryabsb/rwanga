from django.test import TestCase
from src.core.audit import log_event
from src.core.models import ProductionLog


class AuditTest(TestCase):
    def test_log_event_creates_row(self):
        log_event(
            event_type="test_event",
            actor_type="system",
            payload={"key": "value"},
        )
        self.assertEqual(ProductionLog.objects.count(), 1)
        entry = ProductionLog.objects.first()
        self.assertEqual(entry.event_type, "test_event")
        self.assertEqual(entry.payload["key"], "value")
