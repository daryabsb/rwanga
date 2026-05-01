from django.contrib import admin

from src.scheduling.models import CallSheet, ScheduleBlock, ShootDay

admin.site.register(ShootDay)
admin.site.register(ScheduleBlock)
admin.site.register(CallSheet)
