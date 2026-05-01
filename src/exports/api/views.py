from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import serializers as drf_serializers


class ExportsHealthAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={
            200: inline_serializer(
                "ExportsHealthResponse",
                fields={"status": drf_serializers.CharField()},
            )
        }
    )
    def get(self, request):
        return Response({"status": "ok"})


exports_health = ExportsHealthAPIView.as_view()
