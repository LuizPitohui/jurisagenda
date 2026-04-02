"""
accounts/services.py

Camada de serviços: toda lógica de negócio relacionada a usuários.
A View chama o Service. O Service valida, executa e retorna.
O Model apenas persiste. Código testável e isolado.
"""
import logging

from django.contrib.auth.hashers import check_password
from django.core.mail import send_mail
from django.conf import settings
from django.db import transaction
from rest_framework.exceptions import ValidationError

from .models import AuditLog, User

logger = logging.getLogger(__name__)


class UserService:
    """Operações de negócio sobre o modelo User."""

    @staticmethod
    @transaction.atomic
    def create_user(
        email: str,
        full_name: str,
        password: str,
        role: str = "LAWYER",
        oab_number: str = "",
    ) -> User:
        if User.objects.filter(email=email).exists():
            raise ValidationError({"email": "Este e-mail já está cadastrado."})

        user = User.objects.create_user(
            email=email,
            full_name=full_name,
            password=password,
            role=role,
            oab_number=oab_number,
        )
        logger.info("Usuário criado: %s (role=%s)", email, role)

        # Envia e-mail de boas-vindas em background (não bloqueia a resposta)
        try:
            UserService._send_welcome_email(user, password)
        except Exception as exc:
            logger.warning("Falha ao enviar e-mail de boas-vindas para %s: %s", email, exc)

        return user

    @staticmethod
    def _send_welcome_email(user: User, temp_password: str) -> None:
        """Envia e-mail de boas-vindas com credenciais de acesso."""
        role_labels = {
            "ADMIN":       "Administrador",
            "LAWYER":      "Advogado",
            "SECRETARY":   "Secretária",
            "TV_OPERATOR": "Operador de TV",
        }
        role_label = role_labels.get(user.role, user.role)
        app_url    = getattr(settings, "APP_URL", "http://localhost")

        subject = "Bem-vindo ao JurisAgenda — Suas credenciais de acesso"
        message = f"""Olá, {user.full_name or user.email}!

Sua conta no JurisAgenda foi criada com sucesso.

Perfil: {role_label}
E-mail: {user.email}
Senha temporária: {temp_password}

Acesse o sistema em: {app_url}

Por segurança, recomendamos alterar sua senha no primeiro acesso em:
{app_url}/dashboard/settings

Atenciosamente,
Equipe JurisAgenda
"""
        send_mail(
            subject=subject,
            message=message,
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@jurisagenda.com.br"),
            recipient_list=[user.email],
            fail_silently=False,
        )
        logger.info("E-mail de boas-vindas enviado para %s", user.email)

    @staticmethod
    @transaction.atomic
    def change_password(user: User, old_password: str, new_password: str) -> None:
        if not user.check_password(old_password):
            raise ValidationError({"old_password": "Senha atual incorreta."})
        user.set_password(new_password)
        user.save(update_fields=["password", "updated_at"])
        logger.info("Senha alterada para o usuário: %s", user.email)

    @staticmethod
    @transaction.atomic
    def deactivate_user(user: User, requesting_user: User) -> None:
        if user == requesting_user:
            raise ValidationError("Você não pode desativar sua própria conta.")
        user.is_active = False
        user.save(update_fields=["is_active", "updated_at"])
        logger.info("Usuário desativado: %s por %s", user.email, requesting_user.email)


class AuditService:
    """Registra ações no log de auditoria (LGPD)."""

    @staticmethod
    def log(
        user,
        action: str,
        resource_type: str,
        resource_id: str = "",
        ip_address: str = None,
        user_agent: str = "",
        metadata: dict = None,
    ) -> AuditLog:
        return AuditLog.objects.create(
            user=user,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id),
            ip_address=ip_address,
            user_agent=user_agent,
            metadata=metadata or {},
        )

    @staticmethod
    def log_from_request(request, action: str, resource_type: str, resource_id: str = "", metadata: dict = None):
        ip = (
            request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
            or request.META.get("REMOTE_ADDR")
        )
        return AuditService.log(
            user=request.user if request.user.is_authenticated else None,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            ip_address=ip,
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
            metadata=metadata,
        )
