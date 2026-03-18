"""
clients/models.py

Client — parte envolvida nos processos.
Código anônimo (tv_code) nunca exposto no painel TV junto com nome real.
Conformidade LGPD: anonimização em vez de exclusão física.
"""
import random
import string

from django.db import models

from core.base_models import BaseModel


class ClientManager(models.Manager):
    def get_queryset(self):
        # Filtra clientes não anonimizados por padrão
        return super().get_queryset().filter(is_anonymized=False)

    def with_anonymized(self):
        return super().get_queryset()

    def by_code(self, code: str):
        return self.get(code=code)

    def search(self, query: str):
        return self.filter(
            models.Q(full_name__icontains=query)
            | models.Q(email__icontains=query)
            | models.Q(cpf_cnpj__icontains=query)
            | models.Q(code__icontains=query)
        )


class Client(BaseModel):
    """
    Representa um cliente/parte envolvida nos eventos jurídicos.
    O campo `code` é o identificador anônimo exibido no painel de TV.
    O nome real NUNCA trafega para /api/v1/tv/.
    """

    code = models.CharField(max_length=10, unique=True, db_index=True, verbose_name="Código TV")
    full_name = models.CharField(max_length=255, verbose_name="Nome completo")
    cpf_cnpj = models.CharField(max_length=18, blank=True, verbose_name="CPF/CNPJ")
    email = models.EmailField(blank=True, verbose_name="E-mail")
    phone = models.CharField(max_length=20, blank=True, verbose_name="Telefone")
    notes = models.TextField(blank=True, verbose_name="Observações")

    # LGPD
    consent_given = models.BooleanField(default=False, verbose_name="Consentimento LGPD")
    consent_at = models.DateTimeField(null=True, blank=True, verbose_name="Data do consentimento")
    privacy_policy_version = models.CharField(max_length=20, blank=True)
    is_anonymized = models.BooleanField(default=False, verbose_name="Anonimizado (LGPD)")

    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_clients",
    )

    objects = ClientManager()

    class Meta:
        verbose_name = "Cliente"
        verbose_name_plural = "Clientes"
        ordering = ["full_name"]

    def __str__(self) -> str:
        return f"{self.code} — {self.full_name}"

    # ------------------------------------------------------------------
    # Business logic (Fat Model)
    # ------------------------------------------------------------------
    @staticmethod
    def generate_code(length: int = 6) -> str:
        """Gera um código alfanumérico único para uso no painel TV."""
        chars = string.ascii_uppercase + string.digits
        return "".join(random.choices(chars, k=length))

    def anonymize(self) -> None:
        """
        Anonimização LGPD: zera dados pessoais mas preserva o código e o histórico.
        Não faz exclusão física (direito ao esquecimento preservando integridade processual).
        """
        self.full_name = f"ANONIMIZADO-{self.code}"
        self.cpf_cnpj = ""
        self.email = ""
        self.phone = ""
        self.notes = ""
        self.is_anonymized = True
        self.save(
            update_fields=[
                "full_name", "cpf_cnpj", "email", "phone",
                "notes", "is_anonymized", "updated_at",
            ]
        )

    def save(self, *args, **kwargs):
        if not self.code:
            # Garante unicidade do código na criação
            code = Client.generate_code()
            while Client.objects.with_anonymized().filter(code=code).exists():
                code = Client.generate_code()
            self.code = code
        super().save(*args, **kwargs)
