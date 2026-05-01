from django.contrib import admin

from src.reviews.models import BibleReview, InlineComment, ReviewDecision, SceneEvaluation

admin.site.register(InlineComment)
admin.site.register(BibleReview)
admin.site.register(SceneEvaluation)
admin.site.register(ReviewDecision)
