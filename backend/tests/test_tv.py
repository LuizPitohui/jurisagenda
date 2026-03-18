"""
tests/test_tv.py

TC-004: Endpoint /tv/queue/ não deve retornar nenhum campo de dados pessoais.
Testa também o build_call_payload e a conformidade LGPD do painel TV.
"""
import pytest
from unittest.mock import MagicMock, patch

from .conftest import TVEventFactory, FollowUpFactory


# Campos pessoais que NUNCA devem aparecer em qualquer resposta TV
PERSONAL_DATA_FIELDS = [
    "full_name", "client_name", "name",
    "cpf", "cnpj", "cpf_cnpj",
    "email", "phone", "telefone",
    "process_number", "numero_processo",
    "address", "endereco",
]


@pytest.mark.django_db
class TestTVLGPDCompliance:

    def test_tc004_queue_contains_no_personal_data(self, authenticated_client):
        """TC-004: GET /api/v1/tv/queue/ sem campos de dados pessoais."""
        response = authenticated_client.get("/api/v1/tv/queue/")
        assert response.status_code == 200

        response_text = str(response.json()).lower()
        for field in PERSONAL_DATA_FIELDS:
            assert field not in response_text, (
                f"VIOLAÇÃO LGPD: campo '{field}' encontrado na resposta /tv/queue/"
            )

    def test_tc004_history_contains_no_personal_data(self, authenticated_client):
        """TC-004: GET /api/v1/tv/history/ sem campos de dados pessoais."""
        response = authenticated_client.get("/api/v1/tv/history/")
        assert response.status_code == 200

        response_text = str(response.json()).lower()
        for field in PERSONAL_DATA_FIELDS:
            assert field not in response_text, (
                f"VIOLAÇÃO LGPD: campo '{field}' encontrado na resposta /tv/history/"
            )

    def test_build_call_payload_no_personal_data(self, lawyer_user):
        """build_call_payload nunca deve incluir dados pessoais."""
        from tv.services import TVService
        from clients.models import Client
        from .conftest import ClientFactory

        client = ClientFactory(
            full_name="João da Silva Pereira",
            cpf_cnpj="123.456.789-00",
            email="joao@example.com",
        )
        event = TVEventFactory(
            event_type="AUDIENCIA",
            assigned_to=lawyer_user,
            client=client,
            process_number="1234.56.78.90",
        )

        payload = TVService.build_call_payload(event)
        payload_str = str(payload).lower()

        # Dados pessoais explicitamente testados
        assert "joão" not in payload_str
        assert "silva" not in payload_str
        assert "123.456.789" not in payload_str
        assert "joao@example" not in payload_str
        assert "1234.56.78.90" not in payload_str

        # Apenas código anônimo
        assert "code" in payload["payload"]
        assert payload["payload"]["code"] == event.tv_code

    def test_payload_contains_required_fields(self, lawyer_user):
        """Payload TV deve ter: code, event_type, priority, tts_text, timestamp."""
        from tv.services import TVService

        event = TVEventFactory(event_type="AUDIENCIA", assigned_to=lawyer_user)
        payload = TVService.build_call_payload(event)

        required = ["code", "event_type", "priority", "tts_text", "timestamp"]
        for field in required:
            assert field in payload["payload"], f"Campo obrigatório ausente: '{field}'"

    def test_tts_text_format(self, lawyer_user):
        """TTS text deve ser legível em português para síntese de voz."""
        from tv.services import TVService

        event = TVEventFactory(event_type="AUDIENCIA", assigned_to=lawyer_user)
        payload = TVService.build_call_payload(event)
        tts = payload["payload"]["tts_text"]

        assert tts.startswith("Chamada A"), f"TTS inesperado: '{tts}'"
        assert len(tts) > 5

    def test_number_to_words_conversion(self):
        """TVService._number_to_words deve converter números para extenso corretamente."""
        from tv.services import TVService

        assert TVService._number_to_words(1) == "um"
        assert TVService._number_to_words(10) == "dez"
        assert TVService._number_to_words(45) == "quarenta e cinco"
        assert TVService._number_to_words(100) == "cem"
        assert TVService._number_to_words(0) == "zero"


@pytest.mark.django_db
class TestTVCallBroadcast:

    @patch("tv.services.get_channel_layer")
    def test_broadcast_call_sends_to_channel_layer(self, mock_get_layer, lawyer_user):
        """broadcast_call deve enviar mensagem para o channel layer."""
        from tv.services import TVService

        mock_layer = MagicMock()
        mock_get_layer.return_value = mock_layer

        event = TVEventFactory(event_type="AUDIENCIA", assigned_to=lawyer_user)
        payload = TVService.build_call_payload(event)

        with patch("tv.services.async_to_sync") as mock_async:
            mock_async.return_value = MagicMock()
            TVService.broadcast_call(payload)
            mock_async.assert_called_once()

    def test_tv_call_log_persisted_without_personal_data(self, lawyer_user):
        """TVCallLog gravado deve conter apenas dados anônimos."""
        from tv.models import TVCallLog

        event = TVEventFactory(event_type="AUDIENCIA", assigned_to=lawyer_user)

        # Simula persistência direta
        from tv.services import TVService
        payload_data = {
            "code": event.tv_code,
            "event_type": event.event_type,
            "priority": event.tv_priority,
            "tts_text": "Chamada A quarenta e cinco",
            "timestamp": "2026-04-15T09:00:00Z",
        }
        TVService._persist_call_log(payload_data)

        log = TVCallLog.objects.filter(tv_code=event.tv_code).first()
        assert log is not None
        assert log.tv_code == event.tv_code
        # Verifica que não há campos pessoais no model
        assert not hasattr(log, "client_name")
        assert not hasattr(log, "cpf_cnpj")
        assert not hasattr(log, "process_number")
