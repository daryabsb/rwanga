from django.urls import path
from src.locations.views import LocationAddModalView, LocationEditModalView, LocationsListView

app_name = 'locations'
urlpatterns = [
    path('', LocationsListView.as_view(), name='list'),
    path('add-modal/', LocationAddModalView.as_view(), name='add_modal'),
    path('<uuid:location_pk>/edit-modal/', LocationEditModalView.as_view(), name='edit_modal'),
]
