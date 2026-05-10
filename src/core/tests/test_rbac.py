from django.test import TestCase, RequestFactory
from src.accounts.models import User
from src.accounts.services.studio_services import create_studio_for_user
from src.core.decorators import rbac_required


@rbac_required(area="scheduling", action="edit")
def some_view(request):
    return "ok"


class RBACTest(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.user = User.objects.create_user(email="r@x.com", password="x")
        self.studio = create_studio_for_user(self.user, name="R")

    def test_owner_passes_all_areas(self):
        req = self.factory.get("/")
        req.user = self.user
        req.active_studio = self.studio
        result = some_view(req)
        self.assertEqual(result, "ok")
