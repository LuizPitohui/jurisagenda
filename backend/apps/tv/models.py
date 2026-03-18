"""
tv/models.py

TVCallLog — histórico de chamadas do painel TV.
Sem dados pessoais — apenas código anônimo (LGPD: TC-004).
"""
from django.db import models

from core.base_models import BaseModel


class TVCallStatus(models.TextChoices):
    PENDING = "PENDING", "Pendente"
    CALLED = "CALLED", "Chamado"
    CONFIRMED = "CONFIRMED", "Confirmado"
    EXPIRED = "EXPIRED", "Expirado"


class TVCallLogManager(models.Manager):
    def todays_calls(self):
        from django.utils import timezone
        today = timezone.now().date()
        return self.filter(called_at__date=today).order_by("-called_at")

    def active_queue(self):
        """Últimas 3 chamadas + a ativa (para renderização do painel)."""
        return self.todays_calls().filter(
            status__in=[TVCallStatus.CALLED, TVCallStatus.PENDING]
        )[:4]


class TVCallLog(BaseModel):
    """
    Registro imutável de cada chamada no painel TV.
    NUNCA armazena nome, CPF ou qualquer dado pessoal (LGPD).
    Apenas código anônimo, tipo do evento e timestamp.
    """

    tv_code = models.CharField(max_length=10, db_index=True, verbose_name="Código TV")
    event_type = models.CharField(max_length=30, verbose_name="Tipo do evento")
    priority = models.CharField(max_length=10, verbose_name="Prioridade")
    status = models.CharField(
        max_length=15,
        choices=TVCallStatus.choices,
        default=TVCallStatus.PENDING,
        verbose_name="Status",
    )
    called_at = models.DateTimeField(auto_now_add=True, verbose_name="Chamado em")
    confirmed_at = models.DateTimeField(null=True, blank=True, verbose_name="Confirmado em")

    # FK para o evento — NÃO serializada no endpoint /tv/ (TC-004)
    event = models.ForeignKey(
        "events.Event",
        on_delete=models.SET_NULL,
        null=True,
        related_name="tv_calls",
    )

    objects = TVCallLogManager()

    class Meta:
        verbose_name = "Chamada TV"
        verbose_name_plural = "Chamadas TV"
        ordering = ["-called_at"]
        indexes = [
            models.Index(fields=["called_at", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.tv_code} [{self.event_type}] — {self.called_at:%H:%M}"
