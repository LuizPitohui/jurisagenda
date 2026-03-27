"""
followups/services.py

Árvore de decisão do follow-up e automação da timeline processual.
Toda lógica de negócio aqui — Views são apenas coordenadoras.
"""
import logging

from django.db import transaction

from accounts.services import AuditService
from events.models import Event, EventStatus

from .models import EventFollowUp, OutcomeChoices

logger = logging.getLogger(__name__)


class FollowUpService:

    @staticmethod
    @transaction.atomic
    def create_followup(created_by, event: Event, outcome: str, notes: str = "", failure_reason: str = "") -> EventFollowUp:
        """
        Cria follow-up e registra a entrada inicial na timeline.
        TC-003: outcome=SUCCESS deve criar entrada com timestamp e actor.
        """
        followup = EventFollowUp.objects.create(
            event=event,
            outcome=outcome,
            notes=notes,
            failure_reason=failure_reason,
            created_by=created_by,
        )

        # Entrada automática: início do follow-up
        followup.add_timeline_entry(
            actor_email=created_by.email,
            entry="Follow-up iniciado pelo sistema",
        )

        # Entrada do resultado informado pelo advogado
        outcome_label = dict(OutcomeChoices.choices).get(outcome, outcome)
        entry_text = f"Advogado confirmou: {outcome_label}"
        if failure_reason:
            entry_text += f" (Motivo: {failure_reason})"
        
        followup.add_timeline_entry(
            actor_email=created_by.email,
            entry=entry_text,
        )

        # Atualiza status do evento conforme resultado
        if outcome == OutcomeChoices.SUCCESS:
            event.status = EventStatus.DONE
        elif outcome == OutcomeChoices.POSTPONED:
            event.status = EventStatus.RESCHEDULED
        else:
            event.status = EventStatus.DONE
        event.save(update_fields=["status", "updated_at"])

        AuditService.log(
            user=created_by,
            action="CREATE",
            resource_type="EventFollowUp",
            resource_id=str(followup.id),
            metadata={"event_id": str(event.id), "outcome": outcome},
        )
        logger.info("Follow-up criado para evento %s — outcome: %s", event.id, outcome)
        return followup

    @staticmethod
    @transaction.atomic
    def update_followup(followup: EventFollowUp, data: dict, updated_by) -> EventFollowUp:
        for field, value in data.items():
            setattr(followup, field, value)
        followup.save()

        followup.add_timeline_entry(
            actor_email=updated_by.email,
            entry=f"Follow-up atualizado: {', '.join(data.keys())}",
        )
        return followup

    @staticmethod
    @transaction.atomic
    def reschedule_event(followup: EventFollowUp, rescheduled_by, **event_kwargs) -> Event:
        """
        POST /api/v1/followups/{id}/reschedule/
        Cria novo evento vinculado ao follow-up, pré-preenchido com dados do original.
        """
        original = followup.event

        new_event = Event.objects.create(
            title=original.title,
            event_type=original.event_type,
            client=original.client,
            assigned_to=original.assigned_to,
            process_number=original.process_number,
            tv_enabled=original.tv_enabled,
            tv_priority=original.tv_priority,
            video_link=original.video_link,
            supplier_name=original.supplier_name,
            **event_kwargs,
        )

        followup.next_event = new_event
        followup.save(update_fields=["next_event", "updated_at"])

        followup.add_timeline_entry(
            actor_email=rescheduled_by.email,
            entry=f"Próximo prazo agendado: Evento {new_event.id} ({new_event.start_datetime:%Y-%m-%d})",
        )

        AuditService.log(
            user=rescheduled_by,
            action="CREATE",
            resource_type="Event",
            resource_id=str(new_event.id),
            metadata={"rescheduled_from": str(original.id)},
        )
        logger.info("Evento remarcado: %s → %s", original.id, new_event.id)
        return new_event

    @staticmethod
    def trigger_pending_followups():
        """
        Chamado pela task Celery a cada 15 minutos.
        Notifica via WebSocket os advogados com eventos pendentes de follow-up.
        """
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync

        from events.models import Event

        channel_layer = get_channel_layer()
        pending = Event.objects.pending_followup().select_related("assigned_to")

        notified = 0
        for event in pending:
            user = event.assigned_to
            group_name = f"user_{user.id}"
            try:
                async_to_sync(channel_layer.group_send)(
                    group_name,
                    {
                        "type": "followup.pending",
                        "payload": {
                            "event_id": str(event.id),
                            "title": event.title,
                            "start_datetime": event.start_datetime.isoformat(),
                        },
                    },
                )
                notified += 1
            except Exception as exc:
                logger.warning("Falha ao notificar follow-up para %s: %s", user.email, exc)

        logger.info("Follow-ups pendentes notificados: %d", notified)
        return notified
