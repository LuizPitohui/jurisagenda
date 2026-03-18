"""
Modelos base reutilizáveis em todas as apps (DRY).
"""
import uuid

from django.db import models


class TimestampedModel(models.Model):
    """
    Mixin abstrato que adiciona created_at e updated_at a qualquer modelo.
    """

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class UUIDModel(models.Model):
    """
    Mixin abstrato que substitui o PK inteiro por UUID v4.
    Combina com TimestampedModel.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class BaseModel(UUIDModel, TimestampedModel):
    """Modelo base padrão do JurisAgenda: UUID PK + timestamps."""

    class Meta:
        abstract = True
