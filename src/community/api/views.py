from rest_framework import permissions, viewsets
from rest_framework.generics import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response

from src.community.api.serializers import (
    ReviewSessionParticipantSerializer,
    ReviewSessionSerializer,
    SessionCommentSerializer,
    SessionContentSerializer,
    SessionReactionSerializer,
)
from src.community.models import ReviewSession, ReviewSessionParticipant, SessionComment, SessionContent, SessionReaction
from src.community.services import CommunityService


class ReviewSessionViewSet(viewsets.ModelViewSet):
    queryset = ReviewSession.objects.all()
    serializer_class = ReviewSessionSerializer
    permission_classes = [permissions.IsAuthenticated]


class SessionContentViewSet(viewsets.ModelViewSet):
    queryset = SessionContent.objects.all()
    serializer_class = SessionContentSerializer
    permission_classes = [permissions.IsAuthenticated]


class ReviewSessionParticipantViewSet(viewsets.ModelViewSet):
    queryset = ReviewSessionParticipant.objects.all()
    serializer_class = ReviewSessionParticipantSerializer
    permission_classes = [permissions.IsAuthenticated]


class SessionCommentViewSet(viewsets.ModelViewSet):
    queryset = SessionComment.objects.all()
    serializer_class = SessionCommentSerializer
    permission_classes = [permissions.IsAuthenticated]


class SessionReactionViewSet(viewsets.ModelViewSet):
    queryset = SessionReaction.objects.all()
    serializer_class = SessionReactionSerializer
    permission_classes = [permissions.IsAuthenticated]


class CommunitySessionByProjectAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_id):
        sessions = ReviewSession.objects.filter(project_id=project_id)
        return Response(ReviewSessionSerializer(sessions, many=True).data)

    def post(self, request, project_id):
        payload = request.data.copy()
        payload["project"] = str(project_id)
        payload["created_by"] = request.user.id
        serializer = ReviewSessionSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=201)


class CommunitySessionDetailByProjectAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_id, id):
        session = get_object_or_404(ReviewSession, project_id=project_id, id=id)
        payload = ReviewSessionSerializer(session).data
        payload["content"] = SessionContentSerializer(session.contents.order_by("order", "created_at"), many=True).data
        payload["participants"] = ReviewSessionParticipantSerializer(session.participants.select_related("user"), many=True).data
        payload["comments"] = SessionCommentSerializer(
            SessionComment.objects.filter(session_content__session=session).select_related("author", "session_content"),
            many=True,
        ).data
        return Response(payload)

    def patch(self, request, project_id, id):
        session = get_object_or_404(ReviewSession, project_id=project_id, id=id)
        serializer = ReviewSessionSerializer(session, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class CommunityInviteAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id):
        session = get_object_or_404(ReviewSession, id=id)
        user_id = request.data.get("user_id")
        email = (request.data.get("email") or "").strip()
        user = None
        if user_id:
            user = request.user.__class__.objects.filter(id=user_id).first()
        elif email:
            user = request.user.__class__.objects.filter(email=email).first()
        if user:
            participant = CommunityService.invite_participant(session=session, user=user, invited_by=request.user)
            return Response(ReviewSessionParticipantSerializer(participant).data, status=201)
        return Response({"detail": "user not found"}, status=400)


class CommunitySessionCommentsAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, id):
        comments = SessionComment.objects.filter(session_content__session_id=id)
        return Response(SessionCommentSerializer(comments, many=True).data)

    def post(self, request, id):
        session = get_object_or_404(ReviewSession, id=id)
        serializer = SessionCommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        content = get_object_or_404(SessionContent, id=serializer.validated_data["session_content"].id, session=session)
        serializer.save(author=request.user, session_content=content)
        return Response(serializer.data, status=201)


class CommunityCommentReactAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id, comment_id):
        comment = get_object_or_404(SessionComment, id=comment_id, session_content__session_id=id)
        reaction, _ = SessionReaction.objects.update_or_create(
            comment=comment,
            author=request.user,
            defaults={"reaction_type": request.data.get("reaction_type", "agree")},
        )
        return Response(SessionReactionSerializer(reaction).data, status=201)


class CommunitySessionContentAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id):
        session = get_object_or_404(ReviewSession, id=id)
        serializer = SessionContentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(session=session)
        return Response(serializer.data, status=201)
