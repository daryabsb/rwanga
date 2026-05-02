from django.http import HttpResponse
from django.shortcuts import get_object_or_404, render
from django.views import View

from src.locations.forms import LocationCreateForm
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
        return render(request, "locations/_add_modal.html", {"form": LocationCreateForm()})

    def post(self, request):
        form = LocationCreateForm(request.POST)
        if form.is_valid():
            form.save()
            locations = LocationService().list_locations()
            return render(request, "locations/_add_success_oob.html", {"locations": locations})
        return render(request, "locations/_add_modal.html", {"form": form})


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
