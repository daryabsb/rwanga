from rest_framework import serializers
from src.billing.models import Subscription


class SubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subscription
        fields = [
            "id", "plan", "status",
            "trial_started_at", "trial_ends_at",
            "current_period_start", "current_period_end",
            "seat_count", "seat_limit",
        ]
        read_only_fields = [
            "id", "plan", "status",
            "trial_started_at", "trial_ends_at",
            "current_period_start", "current_period_end",
            "seat_count", "seat_limit",
        ]
