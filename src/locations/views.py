from django.shortcuts import render
from django.views import View

from src.locations.services import LocationService


class LocationsListView(View):
    def get(self, request):
        locations = LocationService().list_locations()
        return render(request, "locations/list.html", {"locations": locations, "active_section": "p"})
