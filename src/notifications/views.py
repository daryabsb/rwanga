from django.http import HttpResponse
from django.shortcuts import get_object_or_404, render
from django.views import View
from django.db import DatabaseError

from src.notifications.models import Notification
from src.notifications.services import NotificationService


class NotificationsPanelView(View):
    def get(self, request):
        try:
            notifications = NotificationService().for_user(user=request.user) if request.user.is_authenticated else []
            unread_count = notifications.filter(read=False).count() if request.user.is_authenticated else 0
        except DatabaseError:
            notifications = []
            unread_count = 0
        return render(request, "notifications/panel.html", {"notifications": notifications, "unread_count": unread_count})


class NotificationsListView(View):
    def get(self, request):
        try:
            notifications = NotificationService().for_user(user=request.user) if request.user.is_authenticated else []
            unread_count = notifications.filter(read=False).count() if request.user.is_authenticated else 0
        except DatabaseError:
            notifications = []
            unread_count = 0
        return render(request, "notifications/panel.html", {"notifications": notifications, "unread_count": unread_count})


class MarkAllReadView(View):
    def post(self, request):
        try:
            if request.user.is_authenticated:
                Notification.objects.filter(user=request.user, read=False).update(read=True)
            notifications = NotificationService().for_user(user=request.user) if request.user.is_authenticated else []
        except DatabaseError:
            notifications = []
        return render(request, "notifications/panel.html", {"notifications": notifications, "unread_count": 0})


class MarkReadView(View):
    def post(self, request, notification_pk):
        try:
            if request.user.is_authenticated:
                notification = get_object_or_404(Notification, pk=notification_pk, user=request.user)
                if not notification.read:
                    notification.read = True
                    notification.save(update_fields=["read"])
        except DatabaseError:
            pass
        return HttpResponse(status=204)
