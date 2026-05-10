from django.test import TestCase
from src.accounts.models import User
from src.accounts.services.studio_services import create_studio_for_user
from src.billing.models import Subscription


class BillingSignalsTest(TestCase):
    def test_studio_creation_creates_subscription(self):
        u = User.objects.create_user(email="bs@x.com", password="x")
        s = create_studio_for_user(u, name="X")
        sub = Subscription.objects.get(owner_studio=s)
        self.assertEqual(sub.plan, "pro")
        self.assertEqual(sub.status, "trial")
