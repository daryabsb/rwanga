from django.shortcuts import render
from django.views import View

class LocationsListView(View):
    def get(self, request):
        return render(
            request,
            "stub.html",
            {"stub_name": "Locations", "icon": "📍", "subtitle": "Locations workspace placeholder."},
        )
