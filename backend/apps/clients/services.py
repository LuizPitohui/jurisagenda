"""clients/services.py — Lógica de negócio de clientes."""
import logging

from django.db import transaction
from django.utils import timezone

from accounts.services import AuditService

from .models import Client

logger = logging.getLogger(__name__)


class ClientService:
    @staticmethod
    @transaction.atomic
    def create_client(created_by, **kwargs) -> Client:
        consent_given = kwargs.get("consent_given", False)
        client = Client(created_by=created_by, **kwargs)
        if consent_given:
            client.consent_at = timezone.now()
            client.privacy_policy_version = "1.0"
        client.save()
        AuditService.log(
            user=created_by,
            action="CREATE",
            resource_type="Client",
            resource_id=str(client.id),
        )
        logger.info("Cliente criado: %s por %s", client.code, created_by.email)
        return client

    @staticmethod
    @transaction.atomic
    def anonymize_client(client: Client, requested_by) -> None:
        """Anonimização LGPD — direito ao esquecimento."""
        client.anonymize()
        AuditService.log(
            user=requested_by,
            action="DELETE",
            resource_type="Client",
            resource_id=str(client.id),
            metadata={"action": "anonymization"},
        )
        logger.info("Cliente anonimizado: %s por %s", client.code, requested_by.email)
