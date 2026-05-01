from src.community.models import ReviewSession


class CommunityService:
    def list_sessions(self, *, project):
        return ReviewSession.objects.filter(project=project)
