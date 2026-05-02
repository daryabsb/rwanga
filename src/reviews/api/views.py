from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.generics import get_object_or_404
from rest_framework.views import APIView
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


class BibleReviewByProjectAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_id):
        queryset = BibleReview.objects.filter(project_id=project_id)
        return Response(BibleReviewSerializer(queryset, many=True).data)

    def post(self, request, project_id):
        serializer = BibleReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(project_id=project_id)
        return Response(serializer.data, status=201)


class BibleReviewDetailByProjectAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_id, id):
        review = get_object_or_404(BibleReview, project_id=project_id, id=id)
        return Response(BibleReviewSerializer(review).data)

    def patch(self, request, project_id, id):
        review = get_object_or_404(BibleReview, project_id=project_id, id=id)
        serializer = BibleReviewSerializer(review, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ReviewDecisionByReviewAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, review_id):
        queryset = ReviewDecision.objects.filter(bible_review_id=review_id)
        return Response(ReviewDecisionSerializer(queryset, many=True).data)

    def post(self, request, review_id):
        serializer = ReviewDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(bible_review_id=review_id)
        return Response(serializer.data, status=201)


class ReviewDecisionDetailByReviewAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, review_id, id):
        decision = get_object_or_404(ReviewDecision, bible_review_id=review_id, id=id)
        serializer = ReviewDecisionSerializer(decision, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
