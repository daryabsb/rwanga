from django.http import HttpResponse
from django.views import View

class NotificationsPanelView(View):
    def get(self, request):
        return HttpResponse('<div id="rw-notif-panel"></div>')
