from django.db.models.signals import post_save
from django.dispatch import receiver
from src.accounts.models import User
from src.accounts.services.studio_services import create_studio_for_user


@receiver(post_save, sender=User)
def create_primary_studio_on_signup(sender, instance, created, **kwargs):
    if not created:
        return
    if instance.studio_memberships.filter(is_primary=True).exists():
        return
    create_studio_for_user(instance, name="My Studio", is_primary=True)
