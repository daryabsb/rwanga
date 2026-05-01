from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.test import TestCase

from src.accounts.models import ConsultantProfile, Studio
from src.projects.models import Project, Scene
from src.reviews.models import BibleReview, InlineComment, ReviewDecision


class ReviewsModelTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(email="reviewer@example.com", password="pass123", terms=True)
        self.studio = Studio.objects.create(name="S", slug="s")
        self.project = Project.objects.create(studio=self.studio, owner=self.user, title="P", slug="p")
        self.scene = Scene.objects.create(project=self.project, number=1, title="Scene 1")
        self.consultant = ConsultantProfile.objects.create(user=self.user, is_active=True)

    def test_inline_comment_create(self):
        ct = ContentType.objects.get_for_model(Scene)
        comment = InlineComment.objects.create(content_type=ct, object_id=str(self.scene.id), author=self.user, body="note")
        self.assertEqual(comment.body, "note")

    def test_review_decision_defaults(self):
        review = BibleReview.objects.create(project=self.project, author=self.consultant)
        decision = ReviewDecision.objects.create(bible_review=review, topic="pace", decision_text="Trim", proposed_by=self.user)
        self.assertEqual(decision.status, ReviewDecision.Status.PROPOSED)
