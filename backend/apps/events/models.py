"""
events/models.py

Event — núcleo do sistema JurisAgenda.
Fat Model com Manager customizado, métodos de negócio e propriedades semânticas.
"""
import random
import string
from datetime import timedelta

from django.db import models
from django.utils import timezone

from core.base_models import BaseModel


class EventType(models.TextChoices):
    AUDIENCIA = "AUDIENCIA", "Audiência"
    REUNIAO = "REUNIAO", "Reunião"
    PRAZO = "PRAZO", "Prazo"
    CONTRATO = "CONTRATO", "Contrato"


class EventStatus(models.TextChoices):
    SCHEDULED = "SCHEDULED", "Agendado"
    DONE = "DONE", "Realizado"
    CANCELLED = "CANCELLED", "Cancelado"
    RESCHEDULED = "RESCHEDULED", "Remarcado"


class TVPriority(models.TextChoices):
    NORMAL = "NORMAL", "Normal"
    HIGH = "HIGH", "Alta"


# ---------------------------------------------------------------------------
# Custom Manager
# ---------------------------------------------------------------------------
class EventManager(models.Manager):
    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .select_related("client", "assigned_to")
        )

    def for_calendar(self, year: int, month: int):
        """Retorna eventos do mês, otimizado para o calendário."""
        return self.filter(
            start_datetime__year=year,
            start_datetime__month=month,
        ).exclude(status=EventStatus.CANCELLED)

    def pending_followup(self):
        """
        Eventos SCHEDULED que passaram do horário + 30min e não têm follow-up.
        Usado pela task Celery de verificação automática.
        """
        threshold = timezone.now() - timedelta(minutes=30)
        return (
            self.filter(status=EventStatus.SCHEDULED, start_datetime__lte=threshold)
            .prefetch_related("followup")
            .filter(followup__isnull=True)
        )

    def for_user(self, user):
        return self.filter(assigned_to=user)

    def tv_enabled(self):
        return self.filter(tv_enabled=True, status=EventStatus.SCHEDULED)


# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------
class Event(BaseModel):
    """
    Evento jurídico — entidade central do JurisAgenda.
    Campos dinâmicos por tipo de evento (AUDIENCIA / REUNIAO / PRAZO / CONTRATO).
    """

    title = models.CharField(max_length=255, verbose_name="Título")
    event_type = models.CharField(
        max_length=30, choices=EventType.choices, db_index=True, verbose_name="Tipo"
    )
    start_datetime = models.DateTimeField(db_index=True, verbose_name="Início")
    end_datetime = models.DateTimeField(null=True, blank=True, verbose_name="Fim")
    location = models.CharField(max_length=500, blank=True, verbose_name="Local")
    notes = models.TextField(blank=True, verbose_name="Observações")
    color_tag = models.CharField(max_length=7, blank=True, verbose_name="Cor (hex override)")

    # Campos específicos por tipo
    video_link = models.URLField(blank=True, verbose_name="Link videochamada")  # AUDIENCIA / REUNIAO
    supplier_name = models.CharField(max_length=255, blank=True, verbose_name="Fornecedor")  # CONTRATO
    due_date = models.DateField(null=True, blank=True, verbose_name="Vencimento")  # CONTRATO / PRAZO

    # Relacionamentos
    client = models.ForeignKey(
        "clients.Client",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="events",
    )
    process_number = models.CharField(max_length=50, blank=True, verbose_name="Nº Processo")
    assigned_to = models.ForeignKey(
        "accounts.User",
        on_delete=models.PROTECT,
        related_name="events",
        verbose_name="Responsável",
    )

    # Painel TV
    tv_enabled = models.BooleanField(default=False, verbose_name="Ativar TV")
    tv_priority = models.CharField(
        max_length=10,
        choices=TVPriority.choices,
        default=TVPriority.NORMAL,
        verbose_name="Prioridade TV",
    )
    
    # 🛠️ NOVOS CAMPOS: Antecedência da Chamada TV
    class TVAdvanceUnit(models.TextChoices):
        MINUTES = "MINUTES", "Minutos"
        HOURS = "HOURS", "Horas"
        DAYS = "DAYS", "Dias"

    tv_advance_value = models.PositiveIntegerField(
        default=0,
        verbose_name="Valor de Antecedência TV",
    )
    tv_advance_unit = models.CharField(
        max_length=10,
        choices=TVAdvanceUnit.choices,
        default=TVAdvanceUnit.MINUTES,
        verbose_name="Unidade de Antecedência",
    )
    tv_call_triggered = models.BooleanField(
        default=False,
        verbose_name="Chamada TV Automática Realizada",
    )

    tv_code = models.CharField(max_length=10, blank=True, db_index=True, verbose_name="Código TV")
    tv_call_confirmed = models.BooleanField(default=False, verbose_name="Chamada TV confirmada")

    # Status
    status = models.CharField(
        max_length=20,
        choices=EventStatus.choices,
        default=EventStatus.SCHEDULED,
        db_index=True,
        verbose_name="Status",
    )

    objects = EventManager()

    class Meta:
        verbose_name = "Evento"
        verbose_name_plural = "Eventos"
        ordering = ["start_datetime"]
        indexes = [
            models.Index(fields=["start_datetime", "event_type"]),
            models.Index(fields=["assigned_to", "status"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["tv_code"],
                condition=models.Q(tv_enabled=True),
                name="unique_tv_code_when_enabled",
            )
        ]

    def __str__(self) -> str:
        return f"[{self.get_event_type_display()}] {self.title} — {self.start_datetime:%d/%m/%Y %H:%M}"

    # ------------------------------------------------------------------
    # Business logic (Fat Model)
    # ------------------------------------------------------------------
    @property
    def is_past(self) -> bool:
        return self.start_datetime < timezone.now()

    @property
    def is_overdue_for_followup(self) -> bool:
        """True se passou 30min do início e não tem follow-up registrado."""
        threshold = self.start_datetime + timedelta(minutes=30)
        return (
            self.status == EventStatus.SCHEDULED
            and timezone.now() > threshold
            and not hasattr(self, "followup")
        )

    @property
    def deadline_approaching(self) -> bool:
        """Prazo que vence em menos de 24h."""
        if self.event_type != EventType.PRAZO or not self.due_date:
            return False
        from datetime import date
        return (self.due_date - date.today()).days <= 1

    def generate_tv_code(self) -> str:
        """
        Gera código TV único com prefixo por tipo de evento.
        Ex: A-045 para Audiência, R-012 para Reunião.
        TC-001: tv_code único com prefixo correto.
        TC-002: garante unicidade via retry com constraint DB.
        """
        from django.conf import settings
        prefix = settings.TV_CODE_PREFIXES.get(self.event_type, "X")
        for _ in range(10):  # Máximo de tentativas (R04 — concorrência)
            number = random.randint(1, 999)
            code = f"{prefix}-{number:03d}"
            if not Event.objects.filter(
                tv_code=code,
                tv_enabled=True,
                start_datetime__date=self.start_datetime.date(),
            ).exists():
                return code
        raise ValueError("Não foi possível gerar um tv_code único após 10 tentativas.")

    def soft_delete(self) -> None:
        """Soft-delete: muda status para CANCELLED em vez de excluir."""
        self.status = EventStatus.CANCELLED
        self.save(update_fields=["status", "updated_at"])

    def save(self, *args, **kwargs):
        if self.tv_enabled and not self.tv_code:
            self.tv_code = self.generate_tv_code()
        super().save(*args, **kwargs)
