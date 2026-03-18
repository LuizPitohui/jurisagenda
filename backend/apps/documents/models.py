"""
documents/models.py

EventDocument — referência de arquivos armazenados no MinIO.
Nenhum arquivo é servido diretamente; URLs pré-assinadas com TTL controlam o acesso.
"""
from django.db import models

from core.base_models import BaseModel


class EventDocument(BaseModel):
    """
    Metadados do documento. O arquivo físico fica no MinIO.
    minio_key é o path completo no bucket (ex: events/uuid/contrato.pdf).
    """

    ALLOWED_EXTENSIONS = {
        "application/pdf": "pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
        "application/msword": "doc",
        "image/png": "png",
        "image/jpeg": "jpg",
        "text/plain": "txt",
    }

    event = models.ForeignKey(
        "events.Event",
        on_delete=models.CASCADE,
        related_name="documents",
    )
    file_name = models.CharField(max_length=255, verbose_name="Nome do arquivo")
    minio_key = models.CharField(max_length=500, verbose_name="Chave MinIO")
    content_type = models.CharField(max_length=100, verbose_name="Tipo MIME")
    file_size = models.PositiveBigIntegerField(verbose_name="Tamanho (bytes)")
    uploaded_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.PROTECT,
        related_name="uploaded_documents",
    )
    is_deleted = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Documento"
        verbose_name_plural = "Documentos"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["event", "is_deleted"]),
        ]

    def __str__(self) -> str:
        return f"{self.file_name} ({self.event.title})"

    # ------------------------------------------------------------------
    # Business logic (Fat Model)
    # ------------------------------------------------------------------
    @property
    def file_size_mb(self) -> float:
        return round(self.file_size / (1024 * 1024), 2)

    @property
    def extension(self) -> str:
        return self.ALLOWED_EXTENSIONS.get(self.content_type, "bin")

    @classmethod
    def is_allowed_content_type(cls, content_type: str) -> bool:
        return content_type in cls.ALLOWED_EXTENSIONS

    def soft_delete(self) -> None:
        self.is_deleted = True
        self.save(update_fields=["is_deleted", "updated_at"])
