"""
tv/views.py — REST endpoints de controle administrativo do painel TV.
O painel TV opera via WebSocket; estes endpoints são apenas controle admin.
TC-004: nenhuma view desta app expõe dados pessoais.
"""
import base64
import json

import requests
from django.conf import settings
from django.http import HttpResponse
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


class TVTTSView(APIView):
    """
    GET /api/v1/tv/tts/?text=Chamada+A+zero+um
    Retorna áudio MP3 gerado pelo Google Cloud TTS.
    Endpoint público — painel TV não requer autenticação.
    """
    permission_classes = []
    authentication_classes = []

    def get(self, request):
        text = request.query_params.get("text", "")
        if not text:
            return Response({"error": "text é obrigatório"}, status=status.HTTP_400_BAD_REQUEST)

        api_key = getattr(settings, "GOOGLE_TTS_API_KEY", "")
        if not api_key:
            return Response({"error": "Google TTS não configurado"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        try:
            resp = requests.post(
                f"https://texttospeech.googleapis.com/v1/text:synthesize?key={api_key}",
                json={
                    "input": {"text": text},
                    "voice": {
                        "languageCode": "pt-BR",
                        "name": "pt-BR-Neural2-C",
                        "ssmlGender": "FEMALE",
                    },
                    "audioConfig": {
                        "audioEncoding": "MP3",
                        "speakingRate": 0.95,
                        "pitch": 0.0,
                    },
                },
                timeout=10,
            )
            resp.raise_for_status()
            audio_content = base64.b64decode(resp.json()["audioContent"])
            return HttpResponse(audio_content, content_type="audio/mpeg")
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_502_BAD_GATEWAY)
