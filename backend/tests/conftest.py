"""
conftest.py — Fixtures e Factories globais para pytest-django.
Padrão Factory Boy para criação de dados de teste isolados e reutilizáveis.
"""
import uuid
from datetime import timedelta

import factory
import pytest
from django.utils import timezone
from rest_framework.test import APIClient


# =============================================================================
# Factories
# =============================================================================

class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = "accounts.User"

    id = factory.LazyFunction(uuid.uuid4)
    email = factory.Sequence(lambda n: f"user{n}@jurisagenda.com.br")
    full_name = factory.Faker("name", locale="pt_BR")
    role = "LAWYER"
    is_active = True

    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        password = kwargs.pop("password", "senha_segura_123!")
        obj = model_class(**kwargs)
        obj.set_password(password)
        obj.save()
        return obj


class AdminUserFactory(UserFactory):
    role = "ADMIN"
    is_staff = True


class TVOperatorFactory(UserFactory):
    role = "TV_OPERATOR"


class SecretaryFactory(UserFactory):
    role = "SECRETARY"


class ClientFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = "clients.Client"

    id = factory.LazyFunction(uuid.uuid4)
    full_name = factory.Faker("name", locale="pt_BR")
    email = factory.Faker("email")
    consent_given = True
    consent_at = factory.LazyFunction(timezone.now)
    privacy_policy_version = "1.0"
    created_by = factory.SubFactory(UserFactory)


class EventFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = "events.Event"

    id = factory.LazyFunction(uuid.uuid4)
    title = factory.Sequence(lambda n: f"Audiência de Instrução #{n}")
    event_type = "AUDIENCIA"
    start_datetime = factory.LazyFunction(lambda: timezone.now() + timedelta(hours=2))
    end_datetime = factory.LazyFunction(lambda: timezone.now() + timedelta(hours=4))
    status = "SCHEDULED"
    assigned_to = factory.SubFactory(UserFactory)
    tv_enabled = False


class TVEventFactory(EventFactory):
    tv_enabled = True
    tv_priority = "NORMAL"


class HighPriorityTVEventFactory(TVEventFactory):
    tv_priority = "HIGH"


class PastEventFactory(EventFactory):
    start_datetime = factory.LazyFunction(lambda: timezone.now() - timedelta(hours=2))
    end_datetime = factory.LazyFunction(lambda: timezone.now() - timedelta(hours=1))


class FollowUpFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = "followups.EventFollowUp"

    id = factory.LazyFunction(uuid.uuid4)
    event = factory.SubFactory(PastEventFactory)
    outcome = "SUCCESS"
    created_by = factory.SubFactory(UserFactory)
    timeline_log = factory.LazyFunction(list)


class EventDocumentFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = "documents.EventDocument"

    id = factory.LazyFunction(uuid.uuid4)
    event = factory.SubFactory(EventFactory)
    file_name = "contrato.pdf"
    minio_key = factory.Sequence(lambda n: f"events/uuid/{n}/contrato.pdf")
    content_type = "application/pdf"
    file_size = 1024 * 500  # 500 KB
    uploaded_by = factory.SubFactory(UserFactory)


# =============================================================================
# Pytest Fixtures
# =============================================================================

@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def lawyer_user(db):
    return UserFactory(role="LAWYER")


@pytest.fixture
def admin_user(db):
    return AdminUserFactory()


@pytest.fixture
def tv_operator(db):
    return TVOperatorFactory()


@pytest.fixture
def secretary(db):
    return SecretaryFactory()


@pytest.fixture
def authenticated_client(api_client, lawyer_user):
    api_client.force_authenticate(user=lawyer_user)
    return api_client


@pytest.fixture
def admin_client(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    return api_client


@pytest.fixture
def tv_operator_client(api_client, tv_operator):
    api_client.force_authenticate(user=tv_operator)
    return api_client


@pytest.fixture
def sample_client(db, lawyer_user):
    return ClientFactory(created_by=lawyer_user)


@pytest.fixture
def sample_event(db, lawyer_user):
    return EventFactory(assigned_to=lawyer_user)


@pytest.fixture
def tv_event(db, lawyer_user):
    return TVEventFactory(assigned_to=lawyer_user)
