from django.urls import path
from src.notifications.views import MarkAllReadView, MarkReadView, NotificationsListView, NotificationsPanelView

app_name = 'notifications'
urlpatterns = [
    path('panel/', NotificationsPanelView.as_view(), name='panel'),
    path('', NotificationsListView.as_view(), name='list'),
    path('mark-all-read/', MarkAllReadView.as_view(), name='mark_all_read'),
    path('<uuid:notification_pk>/mark-read/', MarkReadView.as_view(), name='mark_read'),
]
