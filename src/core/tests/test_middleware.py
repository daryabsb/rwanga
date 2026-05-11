from django.test import TestCase, RequestFactory
from src.accounts.models import User
from src.core.middleware import StudioContextMiddleware


class MiddlewareTest(TestCase):
    def test_active_studio_defaults_to_primary(self):
        u = User.objects.create_user(email="mw@x.com", password="x")
        primary = u.studio_memberships.get(is_primary=True).studio
        rf = RequestFactory()
        req = rf.get("/")
        req.user = u
        req.session = {}
        mw = StudioContextMiddleware(get_response=lambda r: None)
        mw(req)
        self.assertEqual(req.active_studio, primary)
