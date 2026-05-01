from django.contrib import admin

from src.community.models import (
    ReviewSession,
    ReviewSessionParticipant,
    SessionComment,
    SessionContent,
    SessionReaction,
)

admin.site.register(ReviewSession)
admin.site.register(SessionContent)
admin.site.register(ReviewSessionParticipant)
admin.site.register(SessionComment)
admin.site.register(SessionReaction)
