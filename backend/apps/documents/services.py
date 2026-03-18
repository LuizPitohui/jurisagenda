"""
documents/services.py

Integração com MinIO via boto3.
Geração de URLs pré-assinadas, upload/download seguro e scan assíncrono.
ADR-002: bucket privado, acesso apenas via presigned URLs.
"""
import logging
import uuid
from typing import Optional

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from django.conf import settings
from django.db import transaction
from rest_framework.exceptions import ValidationError

from accounts.services import AuditService

from .models import EventDocument

logger = logging.getLogger(__name__)


def _get_s3_client():
    """Retorna cliente boto3 configurado para o MinIO."""
    return boto3.client(
        "s3",
        endpoint_url=(
            f"{'https' if settings.MINIO_USE_SSL else 'http'}://{settings.MINIO_ENDPOINT}"
        ),
        aws_access_key_id=settings.MINIO_ACCESS_KEY,
        aws_secret_access_key=settings.MINIO_SECRET_KEY,
        region_name="us-east-1",  # MinIO ignora region mas boto3 exige
    )


class DocumentService:

    @staticmethod
    def generate_presigned_upload_url(
        event_id: str,
        file_name: str,
        content_type: str,
        file_size: int,
        uploaded_by,
    ) -> dict:
        """
        Gera URL pré-assinada para upload direto ao MinIO (TTL: 15min).
        Validações: tipo MIME, tamanho máximo (TC-006: >50MB → 400).
        """
        max_bytes = settings.MINIO_MAX_UPLOAD_SIZE_MB * 1024 * 1024

        if file_size > max_bytes:
            raise ValidationError(
                {
                    "file_size": (
                        f"Arquivo excede o tamanho máximo permitido de "
                        f"{settings.MINIO_MAX_UPLOAD_SIZE_MB}MB. "
                        f"Tamanho recebido: {round(file_size / 1024 / 1024, 2)}MB."
                    )
                }
            )

        if not EventDocument.is_allowed_content_type(content_type):
            raise ValidationError(
                {
                    "content_type": (
                        f"Tipo de arquivo não permitido: {content_type}. "
                        f"Tipos aceitos: PDF, DOCX, DOC, PNG, JPG, TXT."
                    )
                }
            )

        minio_key = f"events/{event_id}/{uuid.uuid4()}/{file_name}"

        try:
            s3 = _get_s3_client()
            presigned_url = s3.generate_presigned_url(
                "put_object",
                Params={
                    "Bucket": settings.MINIO_BUCKET,
                    "Key": minio_key,
                    "ContentType": content_type,
                },
                ExpiresIn=settings.MINIO_PRESIGNED_UPLOAD_TTL,
            )
        except (BotoCoreError, ClientError) as exc:
            logger.error("Erro ao gerar presigned upload URL: %s", exc)
            raise ValidationError({"minio": "Falha ao gerar URL de upload. Tente novamente."})

        return {
            "upload_url": presigned_url,
            "minio_key": minio_key,
            "expires_in": settings.MINIO_PRESIGNED_UPLOAD_TTL,
        }

    @staticmethod
    @transaction.atomic
    def register_document(
        event,
        file_name: str,
        minio_key: str,
        content_type: str,
        file_size: int,
        uploaded_by,
    ) -> EventDocument:
        """
        Registra o documento no banco após upload concluído no MinIO.
        Dispara task assíncrona de scan de malware (ClamAV).
        """
        doc = EventDocument.objects.create(
            event=event,
            file_name=file_name,
            minio_key=minio_key,
            content_type=content_type,
            file_size=file_size,
            uploaded_by=uploaded_by,
        )

        # Dispara scan assíncrono
        from .tasks import scan_document_for_malware
        scan_document_for_malware.delay(str(doc.id))

        AuditService.log(
            user=uploaded_by,
            action="CREATE",
            resource_type="EventDocument",
            resource_id=str(doc.id),
            metadata={"file_name": file_name, "event_id": str(event.id)},
        )
        logger.info("Documento registrado: %s (evento %s)", file_name, event.id)
        return doc

    @staticmethod
    def generate_presigned_download_url(document: EventDocument, requested_by) -> str:
        """
        Gera URL pré-assinada de download (TTL: 1h).
        TC-005: deve retornar redirect 302 com URL válida.
        """
        try:
            s3 = _get_s3_client()
            url = s3.generate_presigned_url(
                "get_object",
                Params={
                    "Bucket": settings.MINIO_BUCKET,
                    "Key": document.minio_key,
                },
                ExpiresIn=settings.MINIO_PRESIGNED_DOWNLOAD_TTL,
            )
        except (BotoCoreError, ClientError) as exc:
            logger.error("Erro ao gerar presigned download URL: %s", exc)
            raise ValidationError({"minio": "Falha ao gerar URL de download."})

        AuditService.log(
            user=requested_by,
            action="DOWNLOAD",
            resource_type="EventDocument",
            resource_id=str(document.id),
            metadata={"file_name": document.file_name},
        )
        return url

    @staticmethod
    @transaction.atomic
    def delete_document(document: EventDocument, deleted_by) -> None:
        """Remove referência no DB e objeto no MinIO."""
        try:
            s3 = _get_s3_client()
            s3.delete_object(Bucket=settings.MINIO_BUCKET, Key=document.minio_key)
        except (BotoCoreError, ClientError) as exc:
            logger.error("Erro ao remover objeto MinIO %s: %s", document.minio_key, exc)

        document.soft_delete()
        AuditService.log(
            user=deleted_by,
            action="DELETE",
            resource_type="EventDocument",
            resource_id=str(document.id),
        )
        logger.info("Documento removido: %s", document.file_name)
