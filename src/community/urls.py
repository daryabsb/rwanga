from django.urls import path

from src.community.views import CommunityAddNoteView, CommunityIndexView, CommunitySessionDetailView

app_name = "community"

urlpatterns = [
    path("", CommunityIndexView.as_view(), name="list"),
    path("<uuid:project_pk>/", CommunityIndexView.as_view(), name="index"),
    path("sessions/<uuid:pk>/", CommunitySessionDetailView.as_view(), name="detail"),
    path("sessions/<uuid:pk>/notes/", CommunityAddNoteView.as_view(), name="add_note"),
]
