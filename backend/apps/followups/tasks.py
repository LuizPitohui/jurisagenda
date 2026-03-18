"""
followups/tasks.py

Tasks Celery para automação de follow-ups.
Verificação a cada 15 minutos (spec seção 5.4.1).
"""
import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    name="followups.check_pending_followups",
    queue="followup",
    max_retries=3,
    default_retry_delay=60,
)
def check_pending_followups(self):
    """
    Task agendada via Celery Beat para rodar a cada 15 minutos.
    Verifica eventos SCHEDULED cujo start_datetime ultrapassou 30min
    e que não possuem EventFollowUp associado. Notifica via WebSocket.
    """
    try:
        from .services import FollowUpService
        count = FollowUpService.trigger_pending_followups()
        logger.info("check_pending_followups concluída — %d notificações enviadas", count)
        return {"notified": count}
    except Exception as exc:
        logger.error("Falha em check_pending_followups: %s", exc, exc_info=True)
        raise self.retry(exc=exc)


@shared_task(
    name="followups.resend_high_priority_tv_calls",
    queue="tv",
)
def resend_high_priority_tv_calls():
    """
    Reenvia chamadas TV de alta prioridade a cada 30s até confirmação.
    Spec seção 5.2.3: tv_priority=HIGH reenvia até tv_call_confirmed=True.
    """
    from events.models import Event, EventStatus, TVPriority

    pending = Event.objects.filter(
        tv_enabled=True,
        tv_priority=TVPriority.HIGH,
        tv_call_confirmed=False,
        status=EventStatus.SCHEDULED,
    ).select_related("assigned_to")

    from tv.services import TVService

    resent = 0
    for event in pending:
        try:
            payload = TVService.build_call_payload(event)
            TVService.broadcast_call(payload)
            resent += 1
        except Exception as exc:
            logger.warning("Falha ao reenviar TV call para evento %s: %s", event.id, exc)

    logger.info("TV calls HIGH reenviadas: %d", resent)
    return {"resent": resent}
