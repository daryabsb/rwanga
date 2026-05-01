from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from src.reviews.api.serializers import (
    BibleReviewSerializer,
    InlineCommentSerializer,
    ReviewDecisionSerializer,
    SceneEvaluationSerializer,
)
from src.reviews.models import BibleReview, InlineComment, ReviewDecision, SceneEvaluation
from src.reviews.services import ReviewService


class InlineCommentViewSet(viewsets.ModelViewSet):
    queryset = InlineComment.objects.all()
    serializer_class = InlineCommentSerializer
    permission_classes = [permissions.IsAuthenticated]


class BibleReviewViewSet(viewsets.ModelViewSet):
    queryset = BibleReview.objects.all()
    serializer_class = BibleReviewSerializer
    permission_classes = [permissions.IsAuthenticated]


class SceneEvaluationViewSet(viewsets.ModelViewSet):
    queryset = SceneEvaluation.objects.all()
    serializer_class = SceneEvaluationSerializer
    permission_classes = [permissions.IsAuthenticated]


class ReviewDecisionViewSet(viewsets.ModelViewSet):
    queryset = ReviewDecision.objects.all()
    serializer_class = ReviewDecisionSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=True, methods=["post"])
    def lock(self, request, pk=None):
        decision = self.get_object()
        ReviewService().lock_decision(decision=decision, user=request.user)
        return Response(self.get_serializer(decision).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        decision = self.get_object()
        ReviewService().reject_decision(decision=decision, user=request.user)
        return Response(self.get_serializer(decision).data)
