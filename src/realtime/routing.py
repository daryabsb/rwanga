from django.urls import re_path

from src.realtime.consumers import AIJobConsumer, NotificationConsumer

websocket_urlpatterns = [
    re_path(r"^ws/ai-jobs/(?P<project_id>[0-9a-f-]+)/$", AIJobConsumer.as_asgi()),
    re_path(r"^ws/notifications/(?P<user_id>[0-9a-f-]+)/$", NotificationConsumer.as_asgi()),
]
