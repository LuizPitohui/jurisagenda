"""
accounts/views.py

Thin Views: apenas coordenam entrada → service → resposta.
Sem lógica de negócio aqui.
"""
from django_ratelimit.decorators import ratelimit
from django.utils.decorators import method_decorator
from rest_framework import generics, permissions, status, parsers
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from core.permissions import IsAdmin

from .models import User
from .serializers import (
    ChangePasswordSerializer,
    CustomTokenObtainPairSerializer,
    UserCreateSerializer,
    UserSelectSerializer,
    UserSerializer,
    UserUpdateSerializer,
)
from .services import AuditService, UserService


class CustomTokenObtainPairView(TokenObtainPairView):
    """POST /api/v1/auth/token/ — Login com e-mail e senha."""
    serializer_class = CustomTokenObtainPairSerializer

    @method_decorator(ratelimit(key='ip', rate='10/m', method='POST', block=True))
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            AuditService.log_from_request(
                request,
                action="LOGIN",
                resource_type="User",
                metadata={"email": request.data.get("email")},
            )
        return response


class LogoutView(APIView):
    """POST /api/v1/auth/logout/ — Invalida refresh token (blacklist)."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from rest_framework_simplejwt.tokens import RefreshToken
        from rest_framework_simplejwt.exceptions import TokenError

        try:
            token = RefreshToken(request.data.get("refresh"))
            token.blacklist()
            AuditService.log_from_request(request, "LOGOUT", "User", str(request.user.id))
            return Response({"detail": "Logout realizado com sucesso."})
        except TokenError:
            return Response({"detail": "Token inválido."}, status=status.HTTP_400_BAD_REQUEST)


class UserListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/v1/auth/users/ — Listar e criar usuários (admin)."""
    permission_classes = [IsAdmin]

    def get_queryset(self):
        return User.objects.all().order_by("full_name")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return UserCreateSerializer
        return UserSerializer


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PATCH/DELETE /api/v1/auth/users/{id}/ — Detalhe do usuário."""
    permission_classes = [IsAdmin]
    queryset = User.objects.all()

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return UserUpdateSerializer
        return UserSerializer

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        UserService.deactivate_user(user, requesting_user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /api/v1/auth/me/ — Perfil do usuário autenticado."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return UserUpdateSerializer
        return UserSerializer


class AvatarUploadView(APIView):
    """POST /api/v1/auth/me/avatar/ — Upload de avatar via MinIO (boto3)."""
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

    def post(self, request):
        import uuid, mimetypes, boto3
        from botocore.exceptions import BotoCoreError, ClientError
        from django.conf import settings

        file = request.FILES.get("avatar")
        if not file:
            return Response({"error": "Arquivo obrigatório."}, status=status.HTTP_400_BAD_REQUEST)

        allowed = {"image/jpeg", "image/png", "image/webp"}

        # Infere pelo nome se o browser enviar application/octet-stream
        ext_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}
        ext = file.name.rsplit(".", 1)[-1].lower() if "." in file.name else ""
        content_type = file.content_type or ""
        if content_type not in allowed:
            content_type = ext_map.get(ext, "") or mimetypes.guess_type(file.name)[0] or ""

        if content_type not in allowed:
            return Response(
                {"error": f"Formato inválido ({content_type or ext or 'desconhecido'}). Use JPG, PNG ou WebP."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if file.size > 2 * 1024 * 1024:
            return Response({"error": "Arquivo muito grande. Máximo 2 MB."}, status=status.HTTP_400_BAD_REQUEST)

        ext = file.name.rsplit(".", 1)[-1].lower() if "." in file.name else "jpg"
        key = f"avatars/{request.user.id}/{uuid.uuid4().hex}.{ext}"

        endpoint_url = (
            f"{'https' if settings.MINIO_USE_SSL else 'http'}://{settings.MINIO_ENDPOINT}"
        )

        # Cliente interno para upload (usa hostname da rede Docker)
        s3 = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=settings.MINIO_ACCESS_KEY,
            aws_secret_access_key=settings.MINIO_SECRET_KEY,
        )

        # Cliente público para gerar URL acessível pelo browser
        public_endpoint = getattr(settings, "MINIO_PUBLIC_ENDPOINT", endpoint_url)
        s3_public = boto3.client(
            "s3",
            endpoint_url=public_endpoint,
            aws_access_key_id=settings.MINIO_ACCESS_KEY,
            aws_secret_access_key=settings.MINIO_SECRET_KEY,
        )

        try:
            # Remove avatar antigo
            old_key = request.user.avatar_key
            if old_key:
                try:
                    s3.delete_object(Bucket=settings.MINIO_BUCKET, Key=old_key)
                except Exception:
                    pass

            s3.upload_fileobj(
                file,
                settings.MINIO_BUCKET,
                key,
                ExtraArgs={"ContentType": content_type},
            )

            # URL pré-assinada com endpoint público (localhost:9000) para o browser
            avatar_url = s3_public.generate_presigned_url(
                "get_object",
                Params={"Bucket": settings.MINIO_BUCKET, "Key": key},
                ExpiresIn=3600,
            )

        except (BotoCoreError, ClientError) as exc:
            return Response({"error": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        request.user.avatar_key = key
        request.user.save(update_fields=["avatar_key", "updated_at"])

        return Response({"avatar_url": avatar_url, "avatar_key": key})


class ChangePasswordView(APIView):
    """POST /api/v1/auth/me/change-password/"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        UserService.change_password(
            user=request.user,
            old_password=serializer.validated_data["old_password"],
            new_password=serializer.validated_data["new_password"],
        )
        return Response({"detail": "Senha alterada com sucesso."})


class UserSelectView(generics.ListAPIView):
    """GET /api/v1/auth/users/select/ — Lista mínima para selects (todos os roles)."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserSelectSerializer

    def get_queryset(self):
        return User.objects.exclude(role='TV_OPERATOR').order_by('full_name')


class ForgotPasswordView(APIView):
    """POST /api/v1/auth/forgot-password/ — Envia e-mail com token de reset."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        from django.core.cache import cache
        from django.core.mail import send_mail
        from django.conf import settings
        import secrets

        email = request.data.get("email", "").strip().lower()
        if not email:
            return Response({"detail": "E-mail obrigatório."}, status=status.HTTP_400_BAD_REQUEST)

        # Sempre retorna 200 para não revelar se o e-mail existe (segurança)
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({"detail": "Se o e-mail existir, você receberá as instruções."})

        token     = secrets.token_urlsafe(32)
        cache_key = f"pwd_reset:{token}"
        cache.set(cache_key, str(user.id), timeout=3600)  # 1 hora

        app_url    = getattr(settings, "APP_URL", "http://localhost")
        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@jurisagenda.com.br")
        reset_url  = f"{app_url}/reset-password?token={token}"

        try:
            send_mail(
                subject="[JurisAgenda] Redefinição de senha",
                message=f"""Olá, {user.full_name or user.email}!

Recebemos uma solicitação para redefinir a senha da sua conta.

Clique no link abaixo para criar uma nova senha (válido por 1 hora):
{reset_url}

Se você não solicitou isso, ignore este e-mail.

Atenciosamente,
JurisAgenda
""",
                from_email=from_email,
                recipient_list=[user.email],
                fail_silently=False,
            )
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning("Falha ao enviar e-mail de reset: %s", exc)

        return Response({"detail": "Se o e-mail existir, você receberá as instruções."})


class ResetPasswordView(APIView):
    """POST /api/v1/auth/reset-password/ — Redefine senha com token."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        from django.core.cache import cache
        import uuid

        token    = request.data.get("token", "").strip()
        password = request.data.get("password", "")

        if not token or not password:
            return Response({"detail": "Token e senha são obrigatórios."}, status=status.HTTP_400_BAD_REQUEST)

        if len(password) < 8:
            return Response({"detail": "A senha deve ter pelo menos 8 caracteres."}, status=status.HTTP_400_BAD_REQUEST)

        cache_key = f"pwd_reset:{token}"
        user_id   = cache.get(cache_key)

        if not user_id:
            return Response({"detail": "Token inválido ou expirado."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(id=uuid.UUID(user_id))
        except (User.DoesNotExist, ValueError):
            return Response({"detail": "Token inválido."}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(password)
        user.save(update_fields=["password", "updated_at"])
        cache.delete(cache_key)  # Token de uso único

        return Response({"detail": "Senha redefinida com sucesso."})
