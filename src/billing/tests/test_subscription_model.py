from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from src.accounts.models import User
from src.accounts.services.studio_services import create_studio_for_user
from src.billing.models import Subscription


class SubscriptionModelTest(TestCase):
    def test_subscription_default_pro_trial(self):
        u = User.objects.create_user(email="b@x.com", password="x")
        s = create_studio_for_user(u, name="B")
        sub = Subscription.objects.create(owner_studio=s, owner_user=u)
        self.assertEqual(sub.plan, "pro")
        self.assertEqual(sub.status, "trial")
        self.assertAlmostEqual(
            (sub.trial_ends_at - timezone.now()).days, 30, delta=1,
        )
