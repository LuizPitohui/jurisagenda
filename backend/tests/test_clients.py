"""
tests/test_clients.py

Testes de conformidade LGPD para o modelo Client:
anonimização, consentimento, geração de código anônimo.
"""
import pytest
from .conftest import ClientFactory, UserFactory


@pytest.mark.django_db
class TestClientLGPD:

    def test_anonymize_clears_personal_data(self, lawyer_user):
        """Anonimização deve zerar dados pessoais mas preservar o código."""
        client = ClientFactory(
            full_name="Maria Oliveira",
            cpf_cnpj="987.654.321-00",
            email="maria@example.com",
            phone="92 99999-0000",
        )
        original_code = client.code

        client.anonymize()

        assert client.is_anonymized is True
        assert client.full_name.startswith("ANONIMIZADO-")
        assert client.cpf_cnpj == ""
        assert client.email == ""
        assert client.phone == ""
        assert client.code == original_code  # código anônimo preservado

    def test_anonymize_via_service(self, lawyer_user):
        """ClientService.anonymize_client deve delegar ao modelo corretamente."""
        from clients.services import ClientService
        client = ClientFactory(full_name="Carlos Souza", created_by=lawyer_user)

        ClientService.anonymize_client(client, requested_by=lawyer_user)

        client.refresh_from_db()
        assert client.is_anonymized is True

    def test_anonymous_client_not_returned_by_default_manager(self, lawyer_user):
        """Manager padrão filtra clientes anonimizados."""
        from clients.models import Client
        client = ClientFactory(created_by=lawyer_user)
        client.anonymize()

        visible = Client.objects.filter(id=client.id)
        assert not visible.exists(), "Cliente anonimizado não deve aparecer no manager padrão"

    def test_with_anonymized_manager_returns_all(self, lawyer_user):
        """with_anonymized() deve retornar todos, incluindo anonimizados."""
        from clients.models import Client
        client = ClientFactory(created_by=lawyer_user)
        client.anonymize()

        all_clients = Client.objects.with_anonymized().filter(id=client.id)
        assert all_clients.exists()

    def test_consent_required_on_create(self, authenticated_client):
        """Criar cliente sem consentimento LGPD → 400."""
        response = authenticated_client.post(
            "/api/v1/clients/",
            {
                "full_name": "Sem Consentimento",
                "email": "sem@example.com",
                "consent_given": False,
            },
            format="json",
        )
        assert response.status_code == 400
        assert "consent" in str(response.data).lower()

    def test_code_auto_generated_on_create(self, lawyer_user):
        """Código anônimo deve ser gerado automaticamente."""
        from clients.models import Client
        client = ClientFactory(created_by=lawyer_user)
        assert client.code
        assert len(client.code) == 6

    def test_code_is_unique(self, lawyer_user):
        """Códigos gerados para dois clientes devem ser únicos."""
        c1 = ClientFactory(created_by=lawyer_user)
        c2 = ClientFactory(created_by=lawyer_user)
        assert c1.code != c2.code

    def test_anonymize_api_endpoint(self, authenticated_client, sample_client):
        """DELETE /api/v1/clients/{id}/anonymize/ → anonimização, não exclusão."""
        from clients.models import Client
        response = authenticated_client.delete(
            f"/api/v1/clients/{sample_client.id}/anonymize/"
        )
        assert response.status_code == 200

        # Registro permanece no banco
        assert Client.objects.with_anonymized().filter(id=sample_client.id).exists()
