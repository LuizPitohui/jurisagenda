"""
tests/test_events.py

Casos de teste críticos do backend (spec seção 8.2.1):
TC-001: Criar evento AUDIENCIA com tv_enabled=true deve gerar tv_code único com prefixo A-
TC-002: Dois eventos não podem ter o mesmo tv_code no mesmo dia
TC-007: Token expirado deve retornar 401 em qualquer endpoint protegido
TC-008: Usuário com role=TV_OPERATOR não pode criar ou editar eventos
"""
import pytest
from django.urls import reverse
from django.utils import timezone
from datetime import timedelta

from .conftest import EventFactory, TVEventFactory


# =============================================================================
# TC-001: tv_code gerado com prefixo correto por tipo de evento
# =============================================================================

@pytest.mark.django_db
class TestTVCodeGeneration:

    def test_audiencia_generates_A_prefix(self, lawyer_user):
        """TC-001: AUDIENCIA → prefixo A-"""
        event = TVEventFactory(event_type="AUDIENCIA", assigned_to=lawyer_user)
        assert event.tv_code.startswith("A-"), (
            f"Esperado prefixo 'A-', obtido: '{event.tv_code}'"
        )

    def test_reuniao_generates_R_prefix(self, lawyer_user):
        """TC-001: REUNIAO → prefixo R-"""
        event = TVEventFactory(event_type="REUNIAO", assigned_to=lawyer_user)
        assert event.tv_code.startswith("R-")

    def test_prazo_generates_P_prefix(self, lawyer_user):
        """TC-001: PRAZO → prefixo P-"""
        from datetime import date
        event = TVEventFactory(
            event_type="PRAZO",
            assigned_to=lawyer_user,
            due_date=date.today() + timedelta(days=5),
            end_datetime=None,
        )
        assert event.tv_code.startswith("P-")

    def test_contrato_generates_C_prefix(self, lawyer_user):
        """TC-001: CONTRATO → prefixo C-"""
        from datetime import date
        event = TVEventFactory(
            event_type="CONTRATO",
            assigned_to=lawyer_user,
            supplier_name="Fornecedor Teste",
            due_date=date.today() + timedelta(days=30),
            end_datetime=None,
        )
        assert event.tv_code.startswith("C-")

    def test_tv_code_format_NNN(self, lawyer_user):
        """TC-001: formato deve ser PREFIX-NNN (3 dígitos numéricos)."""
        event = TVEventFactory(event_type="AUDIENCIA", assigned_to=lawyer_user)
        parts = event.tv_code.split("-")
        assert len(parts) == 2
        prefix, number = parts
        assert prefix == "A"
        assert number.isdigit()
        assert len(number) == 3

    def test_tv_disabled_does_not_generate_code(self, lawyer_user):
        """Evento sem tv_enabled não deve ter tv_code."""
        event = EventFactory(tv_enabled=False, assigned_to=lawyer_user)
        assert event.tv_code == ""

    def test_tv_code_via_api(self, authenticated_client, lawyer_user):
        """TC-001 via API: POST /api/v1/events/ com tv_enabled=true gera tv_code."""
        payload = {
            "title": "Audiência Teste",
            "event_type": "AUDIENCIA",
            "start_datetime": (timezone.now() + timedelta(hours=3)).isoformat(),
            "end_datetime": (timezone.now() + timedelta(hours=5)).isoformat(),
            "assigned_to": str(lawyer_user.id),
            "tv_enabled": True,
            "tv_priority": "NORMAL",
        }
        response = authenticated_client.post("/api/v1/events/", payload, format="json")
        assert response.status_code == 201, response.data
        data = response.json()
        assert data["tv_code"].startswith("A-")


# =============================================================================
# TC-002: Unicidade de tv_code no mesmo dia
# =============================================================================

@pytest.mark.django_db
class TestTVCodeUniqueness:

    def test_two_events_same_day_different_codes(self, lawyer_user):
        """TC-002: Dois eventos TV no mesmo dia devem ter tv_codes distintos."""
        event1 = TVEventFactory(event_type="AUDIENCIA", assigned_to=lawyer_user)
        event2 = TVEventFactory(event_type="AUDIENCIA", assigned_to=lawyer_user)
        assert event1.tv_code != event2.tv_code

    def test_bulk_events_all_unique_codes(self, lawyer_user):
        """TC-002: 20 eventos no mesmo dia devem ter 20 tv_codes únicos."""
        events = [TVEventFactory(event_type="AUDIENCIA", assigned_to=lawyer_user) for _ in range(20)]
        codes = [e.tv_code for e in events]
        assert len(set(codes)) == 20, f"Códigos duplicados encontrados: {codes}"

    def test_same_code_allowed_different_days(self, lawyer_user):
        """
        Dois eventos em dias diferentes podem tecnicamente ter o mesmo código
        (a constraint é por dia — não global).
        Este teste documenta o comportamento esperado.
        """
        from events.models import Event
        yesterday = timezone.now() - timedelta(days=1)
        tomorrow = timezone.now() + timedelta(days=1)

        event_yesterday = TVEventFactory(
            event_type="AUDIENCIA",
            assigned_to=lawyer_user,
            start_datetime=yesterday,
        )
        event_tomorrow = TVEventFactory(
            event_type="AUDIENCIA",
            assigned_to=lawyer_user,
            start_datetime=tomorrow,
        )
        # Ambos devem existir sem erros — unicidade é por dia
        assert event_yesterday.pk is not None
        assert event_tomorrow.pk is not None


# =============================================================================
# TC-007: Token expirado → 401
# =============================================================================

@pytest.mark.django_db
class TestAuthentication:

    def test_unauthenticated_request_returns_401(self, api_client):
        """TC-007: Sem token → 401."""
        response = api_client.get("/api/v1/events/")
        assert response.status_code == 401

    def test_invalid_token_returns_401(self, api_client):
        """TC-007: Token inválido → 401."""
        api_client.credentials(HTTP_AUTHORIZATION="Bearer token_invalido_aqui")
        response = api_client.get("/api/v1/events/")
        assert response.status_code == 401

    def test_authenticated_request_succeeds(self, authenticated_client):
        """Token válido → acesso permitido."""
        response = authenticated_client.get("/api/v1/events/")
        assert response.status_code == 200


# =============================================================================
# TC-008: TV_OPERATOR não pode criar ou editar eventos
# =============================================================================

@pytest.mark.django_db
class TestTVOperatorPermissions:

    def test_tv_operator_cannot_create_event(self, tv_operator_client, lawyer_user):
        """TC-008: TV_OPERATOR → 403 ao tentar criar evento."""
        payload = {
            "title": "Tentativa proibida",
            "event_type": "AUDIENCIA",
            "start_datetime": (timezone.now() + timedelta(hours=2)).isoformat(),
            "end_datetime": (timezone.now() + timedelta(hours=4)).isoformat(),
            "assigned_to": str(lawyer_user.id),
        }
        response = tv_operator_client.post("/api/v1/events/", payload, format="json")
        assert response.status_code == 403, (
            f"TV_OPERATOR deveria receber 403, obteve {response.status_code}"
        )

    def test_tv_operator_cannot_patch_event(self, tv_operator_client, sample_event):
        """TC-008: TV_OPERATOR → 403 ao tentar editar evento."""
        response = tv_operator_client.patch(
            f"/api/v1/events/{sample_event.id}/",
            {"title": "Alteração proibida"},
            format="json",
        )
        assert response.status_code == 403

    def test_tv_operator_can_read_events(self, tv_operator_client):
        """TV_OPERATOR pode ler (GET) — apenas escrita é proibida."""
        response = tv_operator_client.get("/api/v1/events/")
        assert response.status_code == 200


# =============================================================================
# Testes de validação do formulário dinâmico (spec seção 5.2.2)
# =============================================================================

@pytest.mark.django_db
class TestEventDynamicValidation:

    def test_audiencia_requires_end_datetime(self, authenticated_client, lawyer_user):
        """AUDIENCIA sem end_datetime → 400."""
        payload = {
            "title": "Audiência sem fim",
            "event_type": "AUDIENCIA",
            "start_datetime": (timezone.now() + timedelta(hours=2)).isoformat(),
            "assigned_to": str(lawyer_user.id),
        }
        response = authenticated_client.post("/api/v1/events/", payload, format="json")
        assert response.status_code == 400
        assert "end_datetime" in str(response.data)

    def test_contrato_requires_supplier_name(self, authenticated_client, lawyer_user):
        """CONTRATO sem supplier_name → 400."""
        from datetime import date
        payload = {
            "title": "Contrato sem fornecedor",
            "event_type": "CONTRATO",
            "start_datetime": (timezone.now() + timedelta(hours=2)).isoformat(),
            "due_date": (date.today() + timedelta(days=30)).isoformat(),
            "assigned_to": str(lawyer_user.id),
        }
        response = authenticated_client.post("/api/v1/events/", payload, format="json")
        assert response.status_code == 400
        assert "supplier_name" in str(response.data)

    def test_prazo_requires_due_date(self, authenticated_client, lawyer_user):
        """PRAZO sem due_date → 400."""
        payload = {
            "title": "Prazo sem vencimento",
            "event_type": "PRAZO",
            "start_datetime": (timezone.now() + timedelta(hours=2)).isoformat(),
            "assigned_to": str(lawyer_user.id),
        }
        response = authenticated_client.post("/api/v1/events/", payload, format="json")
        assert response.status_code == 400
        assert "due_date" in str(response.data)

    def test_end_before_start_returns_400(self, authenticated_client, lawyer_user):
        """end_datetime antes de start_datetime → 400."""
        now = timezone.now()
        payload = {
            "title": "Horário invertido",
            "event_type": "AUDIENCIA",
            "start_datetime": (now + timedelta(hours=4)).isoformat(),
            "end_datetime": (now + timedelta(hours=2)).isoformat(),
            "assigned_to": str(lawyer_user.id),
        }
        response = authenticated_client.post("/api/v1/events/", payload, format="json")
        assert response.status_code == 400

    def test_soft_delete_sets_status_cancelled(self, authenticated_client, sample_event):
        """DELETE → status=CANCELLED, não exclusão física."""
        from events.models import Event
        response = authenticated_client.delete(f"/api/v1/events/{sample_event.id}/")
        assert response.status_code == 204
        sample_event.refresh_from_db()
        assert sample_event.status == "CANCELLED"
        assert Event.objects.filter(id=sample_event.id).exists()  # ainda no banco
