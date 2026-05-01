from django.contrib import admin

from src.shots.models import Setup, Shot, StoryboardFrame

admin.site.register(Shot)
admin.site.register(Setup)
admin.site.register(StoryboardFrame)
