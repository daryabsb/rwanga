from django.urls import path

from src.departments.views import (
    DepartmentModalStubView,
    ContinuityToggleView,
    ContinuityView,
    LightingView,
    PropsView,
    PropToggleView,
    SoundView,
    WardrobeView,
)

app_name = "departments"
urlpatterns = [
    path("<uuid:project_pk>/lighting/", LightingView.as_view(), name="lighting"),
    path("<uuid:project_pk>/sound/", SoundView.as_view(), name="sound"),
    path("<uuid:project_pk>/props/", PropsView.as_view(), name="props"),
    path("<uuid:project_pk>/props/<uuid:prop_pk>/toggle/", PropToggleView.as_view(), name="toggle_prop"),
    path("<uuid:project_pk>/wardrobe/", WardrobeView.as_view(), name="wardrobe"),
    path("<uuid:project_pk>/continuity/", ContinuityView.as_view(), name="continuity"),
    path("<uuid:project_pk>/continuity/<uuid:item_pk>/toggle/", ContinuityToggleView.as_view(), name="toggle_continuity"),
    path("<uuid:project_pk>/scenes/<uuid:scene_pk>/lighting/add-modal/", DepartmentModalStubView.as_view(), name="add_lighting_modal"),
    path("<uuid:project_pk>/lighting/<uuid:item_pk>/edit-modal/", DepartmentModalStubView.as_view(), name="edit_lighting_modal"),
    path("<uuid:project_pk>/scenes/<uuid:scene_pk>/sound/add-modal/", DepartmentModalStubView.as_view(), name="add_sound_modal"),
    path("<uuid:project_pk>/sound/<uuid:item_pk>/edit-modal/", DepartmentModalStubView.as_view(), name="edit_sound_modal"),
    path("<uuid:project_pk>/scenes/<uuid:scene_pk>/props/add-modal/", DepartmentModalStubView.as_view(), name="add_prop_modal"),
    path("<uuid:project_pk>/scenes/<uuid:scene_pk>/wardrobe/add-modal/", DepartmentModalStubView.as_view(), name="add_wardrobe_modal"),
    path("<uuid:project_pk>/wardrobe/<uuid:item_pk>/edit-modal/", DepartmentModalStubView.as_view(), name="edit_wardrobe_modal"),
    path("<uuid:project_pk>/scenes/<uuid:scene_pk>/continuity/add-modal/", DepartmentModalStubView.as_view(), name="add_continuity_modal"),
]
