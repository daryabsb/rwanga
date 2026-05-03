from django.urls import path
from src.departments.views import ContinuityView, LightingView, PropsView, SoundView, WardrobeView

app_name = 'departments'
urlpatterns = [
    path('<uuid:project_pk>/lighting/', LightingView.as_view(), name='lighting'),
    path('<uuid:project_pk>/sound/', SoundView.as_view(), name='sound'),
    path('<uuid:project_pk>/props/', PropsView.as_view(), name='props'),
    path('<uuid:project_pk>/wardrobe/', WardrobeView.as_view(), name='wardrobe'),
    path('<uuid:project_pk>/continuity/', ContinuityView.as_view(), name='continuity'),
]
