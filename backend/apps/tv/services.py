"""
tv/services.py

Lógica do painel TV: construção de payload, broadcast WebSocket,
gestão da fila. Sem dados pessoais em nenhuma mensagem (LGPD).
"""
import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils import timezone

logger = logging.getLogger(__name__)

TV_GROUP = "tv_panel"  # grupo WebSocket global do painel TV


class TVService:

    @staticmethod
    def build_call_payload(event) -> dict:
        """
        Constrói o payload WebSocket para o painel TV.
        TC-004: NUNCA inclui nome, CPF, processo ou qualquer dado pessoal.
        Apenas: code, event_type, priority, tts_text, timestamp.
        """
        tts_text = TVService._build_tts_text(event.tv_code)

        return {
            "type": "tv.call",
            "payload": {
                "event_id": str(event.id),
                "code": event.tv_code,
                "event_type": event.event_type,
                "priority": event.tv_priority,
                "tts_text": tts_text,
                "timestamp": timezone.now().isoformat(),
            },
        }

    @staticmethod
    def _build_tts_text(tv_code: str) -> str:
        """
        Converte código TV para texto legível por TTS.
        Ex: 'A-045' → 'Chamada A zero quarenta e cinco'
        """
        parts = tv_code.split("-")
        if len(parts) == 2:
            prefix, number = parts
            number_words = TVService._number_to_words(int(number))
            return f"Chamada {prefix} {number_words}"
        return f"Chamada {tv_code}"

    @staticmethod
    def _number_to_words(n: int) -> str:
        """Converte número para extenso (português BR) para leitura TTS."""
        units = ["zero", "um", "dois", "três", "quatro", "cinco",
                 "seis", "sete", "oito", "nove"]
        teens = ["dez", "onze", "doze", "treze", "quatorze", "quinze",
                 "dezesseis", "dezessete", "dezoito", "dezenove"]
        tens = ["", "dez", "vinte", "trinta", "quarenta", "cinquenta",
                "sessenta", "setenta", "oitenta", "noventa"]

        if n < 10:
            return units[n]
        if n < 20:
            return teens[n - 10]
        if n < 100:
            t, u = divmod(n, 10)
            return tens[t] + (" e " + units[u] if u else "")
        if n < 1000:
            h, remainder = divmod(n, 100)
            hundreds = ["", "cem", "duzentos", "trezentos", "quatrocentos",
                        "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"]
            return hundreds[h] + (" e " + TVService._number_to_words(remainder) if remainder else "")
        return str(n)

    @staticmethod
    def broadcast_call(payload: dict, persist: bool = True) -> None:
        """
        Envia mensagem para todos os consumers WebSocket conectados ao grupo TV.
        Persiste o log da chamada no banco (se persist=True).
        """
        channel_layer = get_channel_layer()
        try:
            async_to_sync(channel_layer.group_send)(TV_GROUP, payload)
            logger.info("TV call broadcast: %s", payload.get("payload", {}).get("code"))
        except Exception as exc:
            logger.error("Falha no broadcast TV: %s", exc)
            raise

        # Persiste log (sem dados pessoais) se solicitado
        if persist:
            TVService._persist_call_log(payload["payload"])

    @staticmethod
    def _persist_call_log(payload: dict) -> None:
        from .models import TVCallLog
        from events.models import Event

        try:
            from .models import TVCallStatus
            event = Event.objects.filter(tv_code=payload["code"]).first()
            TVCallLog.objects.create(
                tv_code=payload["code"],
                event_type=payload["event_type"],
                priority=payload["priority"],
                event=event,
                status=TVCallStatus.CALLED,
            )
        except Exception as exc:
            logger.warning("Falha ao persistir TVCallLog: %s", exc)

    @staticmethod
    def confirm_call(tv_code: str) -> None:
        """Marca a chamada TV como confirmada e notifica o painel via WebSocket."""
        from .models import TVCallLog, TVCallStatus

        TVCallLog.objects.filter(tv_code=tv_code, status=TVCallStatus.CALLED).update(
            status=TVCallStatus.CONFIRMED,
            confirmed_at=timezone.now(),
        )

        channel_layer = get_channel_layer()
        try:
            async_to_sync(channel_layer.group_send)(
                TV_GROUP,
                {
                    "type": "tv.confirm",
                    "payload": {"code": tv_code},
                },
            )
        except Exception as exc:
            logger.warning("Falha ao broadcast TV confirm: %s", exc)

    @staticmethod
    def get_queue_state() -> dict:
        """
        GET /api/v1/tv/queue/
        Retorna estado atual da fila. TC-004: sem dados pessoais.
        """
        from .models import TVCallLog
        calls = TVCallLog.objects.active_queue()
        return {
            "active": TVQueueSerializer_safe(calls[:1]),
            "history": TVQueueSerializer_safe(calls[1:]),
        }


def TVQueueSerializer_safe(queryset) -> list:
    """Serializa chamadas TV garantindo que nenhum dado pessoal trafegue."""
    return [
        {
            "id": str(c.id),
            "tv_code": c.tv_code,
            "event_type": c.event_type,
            "priority": c.priority,
            "status": c.status,
            "called_at": c.called_at.isoformat(),
        }
        for c in queryset
    ]
