import sys

from django.contrib.auth import get_user_model
from django.db.models.signals import post_migrate


def ensure_default_superuser(sender, **kwargs):
    if "test" in sys.argv or "test_coverage" in sys.argv:
        return

    user_model = get_user_model()
    if user_model.objects.count() > 0:
        return

    superuser = user_model.objects.create_superuser("root@root.com", "root")
    if hasattr(superuser, "name"):
        superuser.name = "Super Admin"
        superuser.save(update_fields=["name"])


post_migrate.connect(ensure_default_superuser)
