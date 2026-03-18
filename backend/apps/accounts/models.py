"""
accounts/models.py

Fat Model pattern: lógica de negócio relacionada ao usuário mora aqui.
Manager customizado para queries complexas.
"""
import uuid

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class RoleChoices(models.TextChoices):
    ADMIN = "ADMIN", "Administrador"
    LAWYER = "LAWYER", "Advogado"
    SECRETARY = "SECRETARY", "Secretária"
    TV_OPERATOR = "TV_OPERATOR", "Operador de TV"


# ---------------------------------------------------------------------------
# Custom Manager
# ---------------------------------------------------------------------------
class UserManager(BaseUserManager):
    """
    Manager customizado: queries semânticas para uso nas views/services.
    """

    def get_queryset(self):
        return super().get_queryset().filter(is_active=True)

    def create_user(self, email: str, password: str, **extra_fields):
        if not email:
            raise ValueError("O campo email é obrigatório.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email: str, password: str, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", RoleChoices.ADMIN)
        return self.create_user(email, password, **extra_fields)

    def lawyers(self):
        return self.filter(role=RoleChoices.LAWYER)

    def admins(self):
        return self.filter(role=RoleChoices.ADMIN)

    def active_staff(self):
        """Todos que podem operar o sistema (exceto TV_OPERATOR)."""
        return self.exclude(role=RoleChoices.TV_OPERATOR)


# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------
class User(AbstractBaseUser, PermissionsMixin):
    """
    Usuário customizado do JurisAgenda.
    Login via email. PK UUID.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, verbose_name="E-mail")
    full_name = models.CharField(max_length=255, blank=True, null=True, verbose_name="Nome completo")
    oab_number = models.CharField(
        max_length=20, blank=True, verbose_name="Número OAB"
    )
    role = models.CharField(
        max_length=30,
        choices=RoleChoices.choices,
        default=RoleChoices.LAWYER,
        verbose_name="Perfil",
    )
    phone = models.CharField(max_length=20, blank=True, null=True, verbose_name="Telefone")
    avatar_key = models.CharField(max_length=500, blank=True, null=True, verbose_name="Chave do Avatar")
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        verbose_name = "Usuário"
        verbose_name_plural = "Usuários"
        ordering = ["full_name"]

    def __str__(self) -> str:
        return f"{self.full_name} <{self.email}>"

    # ------------------------------------------------------------------
    # Business logic methods (Fat Model)
    # ------------------------------------------------------------------
    @property
    def is_lawyer(self) -> bool:
        return self.role == RoleChoices.LAWYER

    @property
    def is_admin(self) -> bool:
        return self.role == RoleChoices.ADMIN

    @property
    def can_manage_events(self) -> bool:
        """TV_OPERATOR não pode criar/editar eventos."""
        return self.role != RoleChoices.TV_OPERATOR

    def get_display_name(self) -> str:
        return self.full_name or self.email


class AuditLog(models.Model):
    """
    Registro de auditoria para conformidade LGPD.
    Grava toda criação/edição/exclusão com user, timestamp e IP.
    """

    ACTION_CREATE = "CREATE"
    ACTION_UPDATE = "UPDATE"
    ACTION_DELETE = "DELETE"
    ACTION_LOGIN = "LOGIN"
    ACTION_LOGOUT = "LOGOUT"
    ACTION_DOWNLOAD = "DOWNLOAD"

    ACTION_CHOICES = [
        (ACTION_CREATE, "Criação"),
        (ACTION_UPDATE, "Atualização"),
        (ACTION_DELETE, "Exclusão"),
        (ACTION_LOGIN, "Login"),
        (ACTION_LOGOUT, "Logout"),
        (ACTION_DOWNLOAD, "Download"),
    ]

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        User,
        null=True,
        on_delete=models.SET_NULL,
        related_name="audit_logs",
    )
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    resource_type = models.CharField(max_length=100)
    resource_id = models.CharField(max_length=100, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    metadata = models.JSONField(default=dict)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        verbose_name = "Log de Auditoria"
        verbose_name_plural = "Logs de Auditoria"
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["resource_type", "resource_id"]),
            models.Index(fields=["user", "timestamp"]),
        ]

    def __str__(self):
        return f"[{self.timestamp:%Y-%m-%d %H:%M}] {self.user} — {self.action} {self.resource_type}"
