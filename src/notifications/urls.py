from django.urls import path
from src.notifications.views import NotificationsPanelView

app_name = 'notifications'
urlpatterns = [path('panel/', NotificationsPanelView.as_view(), name='panel')]
