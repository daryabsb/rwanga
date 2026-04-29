from django.contrib import admin

from src.accounts.models import (
    ConsultantProfile,
    ProjectConsultantAssignment,
    ProjectMembership,
    SignupProfile,
    Studio,
    User,
)

admin.site.register(User)
admin.site.register(Studio)
admin.site.register(ProjectMembership)
admin.site.register(ConsultantProfile)
admin.site.register(ProjectConsultantAssignment)
admin.site.register(SignupProfile)
