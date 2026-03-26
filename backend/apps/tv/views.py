"""
tv/views.py — REST endpoints de controle administrativo do painel TV.
O painel TV opera via WebSocket; estes endpoints são apenas controle admin.
TC-004: nenhuma view desta app expõe dados pessoais.
"""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsAdmin, IsAdminOrLawyerOrSecretary

from .models import TVCallLog, TVCallStatus
from .serializers import TVCallLogSerializer
from .services import TVService


class TVQueueView(APIView):
    """GET /api/v1/tv/queue/ — Estado atual da fila (sem dados pessoais)."""
    permission_classes = [IsAdminOrLawyerOrSecretary]

    def get(self, request):
        calls = TVCallLog.objects.active_queue()
        serializer = TVCallLogSerializer(calls, many=True)
        return Response({"queue": serializer.data})


class TVHistoryView(APIView):
    """GET /api/v1/tv/history/ — Histórico paginado de chamadas do dia."""
    permission_classes = [IsAdminOrLawyerOrSecretary]

    def get(self, request):
        calls = TVCallLog.objects.todays_calls()
        serializer = TVCallLogSerializer(calls, many=True)
        return Response({"history": serializer.data, "count": calls.count()})


class TVClearQueueView(APIView):
    """POST /api/v1/tv/clear-queue/ — Limpar fila manualmente (admin)."""
    permission_classes = [IsAdmin]

    def post(self, request):
        updated = TVCallLog.objects.todays_calls().filter(
            status__in=[TVCallStatus.PENDING, TVCallStatus.CALLED]
        ).update(status=TVCallStatus.EXPIRED)
        return Response({"detail": f"{updated} chamadas expiradas."})
