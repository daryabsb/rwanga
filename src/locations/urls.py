from django.urls import path
from src.locations.views import LocationsListView

app_name = 'locations'
urlpatterns = [path('', LocationsListView.as_view(), name='list')]
