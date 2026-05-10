from django.db.models.signals import post_save
from django.dispatch import receiver
from src.accounts.models import Studio
from src.billing.models import Subscription


@receiver(post_save, sender=Studio)
def create_subscription_on_studio_create(sender, instance, created, **kwargs):
    if not created:
        return
    Subscription.objects.get_or_create(
        owner_studio=instance,
        defaults={"owner_user": instance.created_by},
    )
