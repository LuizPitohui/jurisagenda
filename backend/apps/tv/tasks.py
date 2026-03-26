"""
tv/tasks.py

Tarefas automáticas do painel TV:
1. check_and_trigger_tv_calls: Disparo automático baseado no horário do evento + antecedência.
2. resend_high_priority_calls: Re-envio de chamadas de alta prioridade não confirmadas.
"""
import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from events.models import Event, EventStatus
from tv.services import TVService

logger = logging.getLogger(__name__)


@shared_task(name="tv.tasks.check_and_trigger_tv_calls")
def check_and_trigger_tv_calls():
    """
    Varre eventos do dia que possuem TV habilitada e ainda não foram disparados.
    Calcula se já está no momento da chamada (considerando a antecedência).
    """
    now = timezone.now()
    today = now.date()

    # Filtra eventos agendados para hoje com TV habilitada e ainda não disparada
    events = Event.objects.filter(
        tv_enabled=True,
        tv_call_triggered=False,
        status=EventStatus.SCHEDULED,
        start_datetime__date=today
    )

    triggered_count = 0
    for event in events:
        # Calcula antecedência em minutos
        advance_minutes = event.tv_advance_value
        if event.tv_advance_unit == Event.TVAdvanceUnit.HOURS:
            advance_minutes *= 60
        elif event.tv_advance_unit == Event.TVAdvanceUnit.DAYS:
            advance_minutes *= 1440

        trigger_time = event.start_datetime - timedelta(minutes=advance_minutes)

        if now >= trigger_time:
            try:
                logger.info("Disparando chamada TV automática para evento %s (code: %s)", event.id, event.tv_code)
                payload = TVService.build_call_payload(event)
                TVService.broadcast_call(payload)
                
                # Marca como disparado para não repetir
                event.tv_call_triggered = True
                event.save(update_fields=["tv_call_triggered", "updated_at"])
                triggered_count += 1
            except Exception as exc:
                logger.error("Erro ao disparar chamada TV para evento %s: %s", event.id, exc)

    return f"{triggered_count} chamadas TV disparadas."


@shared_task(name="tv.tasks.resend_high_priority_calls")
def resend_high_priority_calls():
    """
    Re-envia o broadcast de chamadas de alta prioridade (HIGH) que não foram confirmadas.
    O intervalo é definido em settings.TV_HIGH_PRIORITY_RESEND_INTERVAL.
    """
    from django.conf import settings
    from tv.models import TVCallLog, TVCallStatus

    interval_seconds = getattr(settings, "TV_HIGH_PRIORITY_RESEND_INTERVAL", 30)
    threshold = timezone.now() - timedelta(seconds=interval_seconds)

    # Busca logs de chamadas HIGH ainda pendentes/chamadas (não confirmadas/expiradas)
    # que foram feitas há mais de 'interval_seconds'
    logs = TVCallLog.objects.filter(
        priority="HIGH",
        status=TVCallStatus.CALLED,
        called_at__lte=threshold,
        confirmed_at__isnull=True
    ).select_related("event")

    resent_count = 0
    for log in logs:
        # Verifica se o evento ainda está ativo e não foi confirmado globalmente
        if log.event and log.event.status == EventStatus.SCHEDULED and not log.event.tv_call_confirmed:
            try:
                payload = TVService.build_call_payload(log.event)
                # Re-envia sem gerar um NOVO log (para evitar poluição no histórico)
                # Para isso, precisamos que o broadcast_call suporte pular o persist_log ou
                # fazemos o broadcast manual aqui por enquanto.
                TVService.broadcast_call(payload, persist=False)
                resent_count += 1
            except Exception as exc:
                logger.error("Erro ao re-enviar chamada HIGH para log %s: %s", log.id, exc)

    return f"{resent_count} chamadas HIGH re-enviadas."
