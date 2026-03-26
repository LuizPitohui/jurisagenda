"""
tests/test_tv_tasks.py
Testa a lógica das tarefas Celery do painel TV.
"""
import pytest
from datetime import timedelta
from django.utils import timezone
from unittest.mock import patch, MagicMock, ANY
from tv.tasks import check_and_trigger_tv_calls, resend_high_priority_calls
from .conftest import TVEventFactory

@pytest.mark.django_db
class TestTVTasks:

    @patch("tv.services.TVService.broadcast_call")
    def test_trigger_call_at_event_time_no_advance(self, mock_broadcast, lawyer_user):
        """Evento com antecedência 0 deve ser disparado quando now >= start_datetime."""
        now = timezone.now()
        event = TVEventFactory(
            start_datetime=now - timedelta(seconds=1),  # já começou
            tv_enabled=True,
            tv_advance_value=0,
            tv_advance_unit="MINUTES",
            tv_call_triggered=False,
            assigned_to=lawyer_user
        )

        result = check_and_trigger_tv_calls()
        
        event.refresh_from_db()
        assert event.tv_call_triggered is True
        
        # Verifica se o payload contém o event_id
        mock_broadcast.assert_called_once()
        args, kwargs = mock_broadcast.call_args
        payload = args[0]
        assert "event_id" in payload["payload"]
        assert payload["payload"]["event_id"] == str(event.id)
        
        assert "1 chamadas TV disparadas" in result

    @patch("tv.services.TVService.broadcast_call")
    def test_trigger_call_with_advance_minutes(self, mock_broadcast, lawyer_user):
        """Evento com 15 min de antecedência deve ser disparado se faltar <= 15 min."""
        now = timezone.now()
        # Evento daqui a 10 min, antecedência de 15 min -> DEVE disparar
        event = TVEventFactory(
            start_datetime=now + timedelta(minutes=10),
            tv_enabled=True,
            tv_advance_value=15,
            tv_advance_unit="MINUTES",
            tv_call_triggered=False,
            assigned_to=lawyer_user
        )

        check_and_trigger_tv_calls()
        
        event.refresh_from_db()
        assert event.tv_call_triggered is True
        mock_broadcast.assert_called_once()

    @patch("tv.services.TVService.broadcast_call")
    def test_does_not_trigger_before_advance(self, mock_broadcast, lawyer_user):
        """Evento com 15 min de antecedência NÃO deve ser disparado se faltar 20 min."""
        now = timezone.now()
        # Evento daqui a 20 min, antecedência de 15 min -> NÃO deve disparar
        event = TVEventFactory(
            start_datetime=now + timedelta(minutes=20),
            tv_enabled=True,
            tv_advance_value=15,
            tv_advance_unit="MINUTES",
            tv_call_triggered=False,
            assigned_to=lawyer_user
        )

        check_and_trigger_tv_calls()
        
        event.refresh_from_db()
        assert event.tv_call_triggered is False
        mock_broadcast.assert_not_called()

    @patch("tv.services.TVService.broadcast_call")
    def test_resend_high_priority_call(self, mock_broadcast, lawyer_user):
        """Chamada HIGH não confirmada deve ser re-enviada."""
        from tv.models import TVCallLog, TVCallStatus
        
        event = TVEventFactory(
            tv_enabled=True,
            tv_priority="HIGH",
            tv_call_confirmed=False,
            assigned_to=lawyer_user
        )
        
        # Cria log simulado de 1 minuto atrás
        log = TVCallLog.objects.create(
            tv_code=event.tv_code,
            event_type=event.event_type,
            priority="HIGH",
            status=TVCallStatus.CALLED,
            event=event
        )
        # Força o called_at para o passado
        TVCallLog.objects.filter(id=log.id).update(
            called_at=timezone.now() - timedelta(minutes=1)
        )

        resend_high_priority_calls()
        
        # broadcast_call deve ter sido chamado com persist=False
        mock_broadcast.assert_called_with(ANY, persist=False)
