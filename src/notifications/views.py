from django.shortcuts import render
from django.views import View

class NotificationsPanelView(View):
    def get(self, request):
        return render(request, "notifications/panel.html")
