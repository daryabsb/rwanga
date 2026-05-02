from django.utils import timezone

from src.community.models import ReviewSession, ReviewSessionParticipant, SessionContent
from src.reviews.models import BibleReview


class CommunityService:
    def list_sessions(self, *, project):
        return ReviewSession.objects.filter(project=project)

    @staticmethod
    def create_session(*, project, title, session_type, created_by, visibility="invite_only"):
        return ReviewSession.objects.create(
            project=project,
            title=title,
            session_type=session_type,
            created_by=created_by,
            status=ReviewSession.Status.DRAFT,
            visibility=visibility,
        )

    @staticmethod
    def snapshot_scenes(*, session, scenes):
        contents = []
        for i, scene in enumerate(scenes):
            contents.append(
                SessionContent.objects.create(
                    session=session,
                    content_type="scene",
                    content_data={
                        "scene_number": scene.number,
                        "slugline": scene.title,
                        "synopsis": scene.summary,
                    },
                    label=f"Scene {scene.number}",
                    order=i,
                )
            )
        return contents

    @staticmethod
    def snapshot_bible_review(*, session, bible_review: BibleReview):
        decisions = list(bible_review.decisions.values("topic", "decision_text", "status"))
        return SessionContent.objects.create(
            session=session,
            content_type="bible",
            content_data={
                "title": f"Bible Review v{bible_review.version}",
                "version": bible_review.version,
                "status": bible_review.status,
                "decisions": decisions,
            },
            label=f"Bible Review v{bible_review.version}",
            order=0,
        )

    @staticmethod
    def invite_participant(*, session, user, invited_by):
        return ReviewSessionParticipant.objects.create(
            session=session,
            user=user,
            role="external_reviewer",
            invited_by=invited_by,
            invited_at=timezone.now(),
            is_active=True,
        )

    @staticmethod
    def open_session(*, session):
        session.status = ReviewSession.Status.OPEN
        session.save(update_fields=["status", "updated_at"])
        return session

    @staticmethod
    def close_session(*, session):
        session.status = ReviewSession.Status.CLOSED
        session.save(update_fields=["status", "updated_at"])
        return session
