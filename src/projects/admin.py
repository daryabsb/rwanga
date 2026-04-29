from django.contrib import admin

from src.projects.models import Character, Location, Project, Scene

admin.site.register(Project)
admin.site.register(Scene)
admin.site.register(Character)
admin.site.register(Location)
