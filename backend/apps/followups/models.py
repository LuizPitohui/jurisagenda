"""
followups/models.py

EventFollowUp — registro pós-evento com árvore de decisão e timeline processual.
"""
from django.db import models
from django.utils import timezone

from core.base_models import BaseModel


class OutcomeChoices(models.TextChoices):
    SUCCESS = "SUCCESS", "Realizado com sucesso"
    FAILURE = "FAILURE", "Não realizado"
    POSTPONED = "POSTPONED", "Adiado/Remarcado"


class FollowUpManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().select_related("event", "created_by", "next_event")

    def pending_for_user(self, user):
        """Follow-ups sem outcome definido para um advogado específico."""
        return self.filter(event__assigned_to=user, outcome__isnull=True)

    def completed(self):
        return self.exclude(outcome__isnull=True)


class EventFollowUp(BaseModel):
    """
    Registro pós-evento.
    OneToOne com Event — cada evento tem no máximo um follow-up.
    Timeline automática em JSON armazena o histórico de decisões.
    """

    event = models.OneToOneField(
        "events.Event",
        on_delete=models.CASCADE,
        related_name="followup",
    )
    outcome = models.CharField(
        max_length=20,
        choices=OutcomeChoices.choices,
        null=True,
        blank=True,
        verbose_name="Resultado",
    )
    notes = models.TextField(blank=True, verbose_name="Observações")
    next_event = models.ForeignKey(
        "events.Event",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="origin_followup",
        verbose_name="Próximo evento",
    )
    timeline_log = models.JSONField(default=list, verbose_name="Linha do tempo")
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.PROTECT,
        related_name="followups_created",
    )

    objects = FollowUpManager()

    class Meta:
        verbose_name = "Follow-up"
        verbose_name_plural = "Follow-ups"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Follow-up: {self.event.title} — {self.get_outcome_display() or 'Pendente'}"

    # ------------------------------------------------------------------
    # Business logic (Fat Model)
    # ------------------------------------------------------------------
    def add_timeline_entry(self, actor_email: str, entry: str) -> None:
        """Adiciona entrada imutável na timeline processual."""
        self.timeline_log.append(
            {
                "ts": timezone.now().isoformat(),
                "actor": actor_email,
                "entry": entry,
            }
        )
        self.save(update_fields=["timeline_log", "updated_at"])

    @property
    def is_resolved(self) -> bool:
        return self.outcome is not None
