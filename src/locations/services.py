from src.locations.models import Location


class LocationService:
    def list_locations(self):
        return Location.objects.all()
