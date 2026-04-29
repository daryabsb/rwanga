from django.urls import path
from src.shots.views import ShotEditView, ShotListView, StoryboardsView

app_name = 'shots'
urlpatterns = [
    path('<uuid:project_pk>/', ShotListView.as_view(), name='list'),
    path('<uuid:project_pk>/storyboards/', StoryboardsView.as_view(), name='storyboards'),
    path('<uuid:project_pk>/<uuid:shot_pk>/edit/', ShotEditView.as_view(), name='edit'),
]
