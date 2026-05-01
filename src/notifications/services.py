from src.notifications.models import Notification


class NotificationService:
    def for_user(self, *, user):
        return Notification.objects.filter(user=user)
