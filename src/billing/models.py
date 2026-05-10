import uuid
from datetime import timedelta
from django.db import models
from django.utils import timezone


def _trial_ends_at_default():
    """Module-level callable so Django can serialize for migrations."""
    return timezone.now() + timedelta(days=30)


class Subscription(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner_studio = models.OneToOneField(
        "accounts.Studio", on_delete=models.CASCADE, related_name="subscription",
    )
    owner_user = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, related_name="billing_subscriptions",
    )
    PLAN_CHOICES = [
        ("free", "Free"), ("pro", "Pro"),
        ("studio_unlimited", "Studio Unlimited"), ("enterprise", "Enterprise"),
    ]
    plan = models.CharField(max_length=24, choices=PLAN_CHOICES, default="pro")
    STATUS_CHOICES = [
        ("trial", "trial"), ("active", "active"),
        ("past_due", "past_due"), ("suspended", "suspended"), ("cancelled", "cancelled"),
    ]
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="trial")
    trial_started_at = models.DateTimeField(default=timezone.now)
    trial_ends_at = models.DateTimeField(default=_trial_ends_at_default)
    billing_email = models.EmailField(blank=True)
    payment_provider = models.CharField(max_length=32, blank=True)
    payment_provider_customer_id = models.CharField(max_length=128, blank=True)
    current_period_start = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    seat_count = models.PositiveIntegerField(default=1)
    seat_limit = models.PositiveIntegerField(default=5)
    feature_flags = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class SubscriptionUsage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subscription = models.ForeignKey(
        Subscription, on_delete=models.CASCADE, related_name="usage_meters",
    )
    period_start = models.DateTimeField()
    period_end = models.DateTimeField()
    METER_KINDS = [
        ("ai_requests", "AI Requests"), ("ai_tokens", "AI Tokens"),
        ("studio_seats", "Studio Seats"), ("api_requests", "API Requests"),
        ("project_count", "Project Count"), ("production_log_size", "Production Log Size"),
    ]
    meter_kind = models.CharField(max_length=32, choices=METER_KINDS)
    consumed = models.PositiveIntegerField(default=0)
    limit = models.PositiveIntegerField(default=0)
    overage_charged_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
