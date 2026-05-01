from django.http import HttpResponse
from django.shortcuts import get_object_or_404, render
from django.views import View

from src.locations.models import Location
from src.locations.services import LocationService


class LocationsListView(View):
    def get(self, request):
        q = request.GET.get("q", "").strip()
        locations = LocationService().list_locations()
        if q:
            locations = locations.filter(name__icontains=q)
        return render(request, "locations/list.html", {"locations": locations, "active_section": "p"})


class LocationAddModalView(View):
    def get(self, request):
        return HttpResponse("<div class='rw-modal'><div class='rw-card'>Add location</div></div>")


class LocationEditModalView(View):
    def get(self, request, location_pk):
        location = get_object_or_404(Location, pk=location_pk)
        return HttpResponse(f"<div class='rw-modal'><div class='rw-card'>Edit location: {location.name}</div></div>")
