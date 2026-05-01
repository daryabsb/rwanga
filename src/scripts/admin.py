from django.contrib import admin

from src.scripts.models import Breakdown, Script, ScriptElement

admin.site.register(Script)
admin.site.register(ScriptElement)
admin.site.register(Breakdown)
