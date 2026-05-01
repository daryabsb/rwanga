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
        return HttpResponse(
            """
<div class="modal fade" id="addLocationModal" tabindex="-1">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">Add location</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body">
        <p class="mb-0">Location create form wiring is pending.</p>
      </div>
    </div>
  </div>
</div>
"""
        )


class LocationEditModalView(View):
    def get(self, request, location_pk):
        location = get_object_or_404(Location, pk=location_pk)
        return HttpResponse(
            f"""
<div class="modal fade" id="editLocationModal" tabindex="-1">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">Edit location: {location.name}</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body">
        <p class="mb-0">Location edit form wiring is pending.</p>
      </div>
    </div>
  </div>
</div>
"""
        )
