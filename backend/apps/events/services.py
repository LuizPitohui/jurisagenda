"""
events/services.py

Toda a lógica de negócio de eventos mora aqui.
View → Service → Model. Nunca lógica complexa na View ou no save().
"""
import logging

from django.db import transaction

from accounts.services import AuditService

from .models import Event, EventStatus

logger = logging.getLogger(__name__)


class EventService:

    @staticmethod
    @transaction.atomic
    def create_event(created_by, **kwargs) -> Event:
        event = Event(**kwargs)
        event.save()
        AuditService.log(
            user=created_by,
            action="CREATE",
            resource_type="Event",
            resource_id=str(event.id),
            metadata={"event_type": event.event_type, "title": event.title},
        )
        logger.info("Evento criado: %s (%s) por %s", event.title, event.event_type, created_by.email)
        return event

    @staticmethod
    @transaction.atomic
    def update_event(event: Event, data: dict, updated_by) -> Event:
        for field, value in data.items():
            setattr(event, field, value)
        # Se tv_enabled foi ativado e não há tv_code, gera
        if event.tv_enabled and not event.tv_code:
            event.tv_code = event.generate_tv_code()
        event.save()
        AuditService.log(
            user=updated_by,
            action="UPDATE",
            resource_type="Event",
            resource_id=str(event.id),
            metadata={"fields": list(data.keys())},
        )
        return event

    @staticmethod
    @transaction.atomic
    def cancel_event(event: Event, cancelled_by) -> Event:
        event.soft_delete()
        AuditService.log(
            user=cancelled_by,
            action="DELETE",
            resource_type="Event",
            resource_id=str(event.id),
        )
        logger.info("Evento cancelado: %s por %s", event.title, cancelled_by.email)
        return event

    @staticmethod
    @transaction.atomic
    def dispatch_tv_call(event: Event, dispatched_by) -> dict:
        """
        Dispara chamada no painel TV via WebSocket.
        Retorna payload enviado ao consumer.
        """
        from tv.services import TVService

        if not event.tv_enabled:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("TV não habilitada para este evento.")

        payload = TVService.build_call_payload(event)
        TVService.broadcast_call(payload)

        AuditService.log(
            user=dispatched_by,
            action="UPDATE",
            resource_type="Event",
            resource_id=str(event.id),
            metadata={"action": "tv_call", "tv_code": event.tv_code},
        )
        return payload

    @staticmethod
    @transaction.atomic
    def confirm_tv_call(event: Event, confirmed_by) -> Event:
        from tv.services import TVService
        event.tv_call_confirmed = True
        event.save(update_fields=["tv_call_confirmed", "updated_at"])
        # Sincroniza com o log do painel TV para parar resends
        TVService.confirm_call(event.tv_code)
        return event
