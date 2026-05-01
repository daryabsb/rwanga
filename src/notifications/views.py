from django.shortcuts import render
from django.views import View

from src.notifications.services import NotificationService


class NotificationsPanelView(View):
    def get(self, request):
        notifications = NotificationService().for_user(user=request.user) if request.user.is_authenticated else []
        return render(request, "notifications/panel.html", {"notifications": notifications})
