from django.shortcuts import render
from django.views import View

class LocationsListView(View):
    def get(self, request):
        return render(
            request,
            "shared/module_placeholder.html",
            {"title": "Locations", "icon": "📍", "subtitle": "Locations workspace placeholder."},
        )
