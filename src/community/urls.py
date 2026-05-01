from django.urls import path

from src.community.views import CommunityIndexView

app_name = "community"

urlpatterns = [
    path("<uuid:project_pk>/", CommunityIndexView.as_view(), name="index"),
]
