from django.urls import path

from src.community.views import (
    CommunityAddContentView,
    CommunityAddNoteView,
    CommunityCreateView,
    CommunityIndexView,
    CommunityInviteView,
    CommunityReactView,
    CommunitySessionDetailView,
    CommunityStatusView,
)

app_name = "community"

urlpatterns = [
    path("", CommunityIndexView.as_view(), name="list"),
    path("create/", CommunityCreateView.as_view(), name="create"),
    path("<uuid:project_pk>/", CommunityIndexView.as_view(), name="project_list"),
    path("<uuid:project_pk>/", CommunityIndexView.as_view(), name="index"),
    path("sessions/<uuid:pk>/", CommunitySessionDetailView.as_view(), name="detail"),
    path("sessions/<uuid:pk>/notes/", CommunityAddNoteView.as_view(), name="add_note"),
    path("sessions/<uuid:pk>/content/", CommunityAddContentView.as_view(), name="add_content"),
    path("sessions/<uuid:pk>/invite/", CommunityInviteView.as_view(), name="invite"),
    path("sessions/<uuid:pk>/status/<str:action>/", CommunityStatusView.as_view(), name="status"),
    path("sessions/<uuid:pk>/toggle-status/", CommunityStatusView.as_view(), {"action": "toggle"}, name="toggle_status"),
    path("sessions/<uuid:pk>/comments/", CommunityAddNoteView.as_view(), name="comment"),
    path("comments/<uuid:comment_pk>/reply/", CommunityReactView.as_view(), {"action": "reply"}, name="reply"),
    path("comments/<uuid:comment_pk>/react/", CommunityReactView.as_view(), {"action": "react"}, name="react"),
    path("sessions/<uuid:pk>/comments/<uuid:comment_pk>/react/", CommunityReactView.as_view(), name="react"),
]
