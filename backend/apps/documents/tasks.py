"""documents/tasks.py — Tasks assíncronas de documentos."""
import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    name="documents.scan_document_for_malware",
    queue="documents",
    max_retries=3,
    default_retry_delay=30,
)
def scan_document_for_malware(self, document_id: str):
    """
    Scan ClamAV assíncrono pós-upload.
    Se malware detectado: remove o objeto do MinIO e marca documento como infectado.
    """
    try:
        from .models import EventDocument
        from documents.services import _get_s3_client
        from django.conf import settings

        doc = EventDocument.objects.get(id=document_id)

        # Download temporário do objeto para scan
        import tempfile
        import os

        s3 = _get_s3_client()

        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{doc.extension}") as tmp:
            s3.download_fileobj(settings.MINIO_BUCKET, doc.minio_key, tmp)
            tmp_path = tmp.name

        # Executa ClamAV
        import subprocess
        result = subprocess.run(
            ["clamscan", "--no-summary", tmp_path],
            capture_output=True,
            text=True,
            timeout=60,
        )
        os.unlink(tmp_path)

        if result.returncode == 1:
            # Malware detectado
            logger.warning("MALWARE detectado em documento %s: %s", document_id, result.stdout)
            s3.delete_object(Bucket=settings.MINIO_BUCKET, Key=doc.minio_key)
            doc.soft_delete()
            logger.info("Documento infectado removido: %s", document_id)
        elif result.returncode == 0:
            logger.info("Documento limpo: %s", document_id)
        else:
            logger.warning("ClamAV erro (código %d) para documento %s", result.returncode, document_id)

    except FileNotFoundError:
        # ClamAV não instalado no ambiente — log e continua
        logger.warning("ClamAV não disponível. Scan ignorado para documento %s", document_id)
    except Exception as exc:
        logger.error("Erro no scan de documento %s: %s", document_id, exc, exc_info=True)
        raise self.retry(exc=exc)
