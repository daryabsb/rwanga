from django.urls import path
from src.departments import views
from src.departments.views import ContinuityView, LightingView, PropsView, SoundView, WardrobeView

app_name = 'departments'
urlpatterns = [
    path('<uuid:project_pk>/lighting/', LightingView.as_view(), name='lighting'),
    path('<uuid:project_pk>/sound/', SoundView.as_view(), name='sound'),
    path('<uuid:project_pk>/props/', PropsView.as_view(), name='props'),
    path('<uuid:project_pk>/wardrobe/', WardrobeView.as_view(), name='wardrobe'),
    path('<uuid:project_pk>/continuity/', ContinuityView.as_view(), name='continuity'),
    path('<uuid:project_pk>/continuity/<uuid:item_pk>/toggle/', views.toggle_continuity_view, name='toggle_continuity'),
    path('<uuid:project_pk>/props/<uuid:prop_pk>/toggle/', views.toggle_prop_view, name='toggle_prop'),
    path('lighting-notes/<uuid:pk>/edit/', views.edit_lighting_modal_view, name='edit_lighting_modal'),
    path('sound-notes/<uuid:pk>/edit/', views.edit_sound_modal_view, name='edit_sound_modal'),
    path('wardrobe/<uuid:pk>/edit/', views.edit_wardrobe_modal_view, name='edit_wardrobe_modal'),
]
