from django.test import TestCase, RequestFactory
from src.accounts.models import User
from src.accounts.services.studio_services import create_studio_for_user
from src.core.decorators import subscription_required


@subscription_required(feature="ask_ai")
def some_view(request):
    return "ok"


class SubscriptionDecoratorTest(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.user = User.objects.create_user(email="d@x.com", password="x")
        self.studio = create_studio_for_user(self.user, name="D")

    def test_pro_trial_passes(self):
        req = self.factory.get("/")
        req.user = self.user
        req.active_studio = self.studio
        result = some_view(req)
        self.assertEqual(result, "ok")
