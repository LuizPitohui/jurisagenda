"""
events/tasks.py

Tasks Celery para notificações por e-mail:
1. Lembrete de audiência/reunião no dia seguinte
2. Alerta de prazo vencendo em 24h
"""
import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(name="events.tasks.send_upcoming_event_reminders", queue="default")
def send_upcoming_event_reminders():
    """
    Roda diariamente. Envia e-mail para o responsável de cada evento
    agendado para as próximas 24h que ainda não foi notificado.
    """
    from .models import Event, EventStatus, EventType

    now = timezone.now()
    window_start = now + timedelta(hours=1)
    window_end   = now + timedelta(hours=25)

    events = Event.objects.filter(
        status=EventStatus.SCHEDULED,
        start_datetime__gte=window_start,
        start_datetime__lte=window_end,
        event_type__in=[EventType.AUDIENCIA, EventType.REUNIAO],
    ).select_related("assigned_to", "client")

    sent = 0
    for event in events:
        user = event.assigned_to
        if not user.email:
            continue
        try:
            _send_event_reminder(user, event)
            sent += 1
        except Exception as exc:
            logger.warning("Falha ao enviar lembrete para %s: %s", user.email, exc)

    logger.info("Lembretes de eventos enviados: %d", sent)
    return {"sent": sent}


@shared_task(name="events.tasks.send_deadline_alerts", queue="default")
def send_deadline_alerts():
    """
    Roda diariamente. Envia alerta para prazos e contratos vencendo em até 48h.
    """
    from .models import Event, EventStatus, EventType

    now  = timezone.now()
    today = now.date()
    limit = today + timedelta(days=2)

    events = Event.objects.filter(
        status=EventStatus.SCHEDULED,
        event_type__in=[EventType.PRAZO, EventType.CONTRATO],
        due_date__gte=today,
        due_date__lte=limit,
    ).select_related("assigned_to")

    sent = 0
    for event in events:
        user = event.assigned_to
        if not user.email:
            continue
        try:
            _send_deadline_alert(user, event)
            sent += 1
        except Exception as exc:
            logger.warning("Falha ao enviar alerta de prazo para %s: %s", user.email, exc)

    logger.info("Alertas de prazo enviados: %d", sent)
    return {"sent": sent}


def _send_event_reminder(user, event):
    app_url   = getattr(settings, "APP_URL", "http://localhost")
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@jurisagenda.com.br")

    type_labels = {
        "AUDIENCIA": "Audiência",
        "REUNIAO":   "Reunião",
    }
    type_label = type_labels.get(event.event_type, event.event_type)
    dt = event.start_datetime.strftime("%d/%m/%Y às %H:%M")

    subject = f"[JurisAgenda] Lembrete: {type_label} amanhã — {event.title}"
    message = f"""Olá, {user.full_name or user.email}!

Este é um lembrete automático do JurisAgenda.

Você tem uma {type_label} agendada para amanhã:

Título:    {event.title}
Data/Hora: {dt}
{f"Processo: {event.process_number}" if event.process_number else ""}
{f"Link:     {event.video_link}" if event.video_link else ""}

Acesse o sistema para mais detalhes: {app_url}/dashboard

Atenciosamente,
JurisAgenda
"""
    send_mail(subject, message, from_email, [user.email], fail_silently=False)


def _send_deadline_alert(user, event):
    app_url    = getattr(settings, "APP_URL", "http://localhost")
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@jurisagenda.com.br")

    type_labels = {"PRAZO": "Prazo", "CONTRATO": "Contrato"}
    type_label  = type_labels.get(event.event_type, event.event_type)

    days_left = (event.due_date - timezone.now().date()).days
    urgency   = "HOJE" if days_left == 0 else f"em {days_left} dia{'s' if days_left > 1 else ''}"

    subject = f"[JurisAgenda] ⚠️ {type_label} vence {urgency} — {event.title}"
    message = f"""Atenção, {user.full_name or user.email}!

Um {type_label} está vencendo {urgency}:

Título:      {event.title}
Vencimento:  {event.due_date.strftime("%d/%m/%Y")}
{f"Processo: {event.process_number}" if event.process_number else ""}

Acesse o sistema para tomar as providências necessárias: {app_url}/dashboard

Atenciosamente,
JurisAgenda
"""
    send_mail(subject, message, from_email, [user.email], fail_silently=False)
