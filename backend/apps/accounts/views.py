"""
accounts/views.py

Thin Views: apenas coordenam entrada → service → resposta.
Sem lógica de negócio aqui.
"""
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from core.permissions import IsAdmin

from .models import User
from .serializers import (
    ChangePasswordSerializer,
    CustomTokenObtainPairSerializer,
    UserCreateSerializer,
    UserSerializer,
    UserUpdateSerializer,
)
from .services import AuditService, UserService


class CustomTokenObtainPairView(TokenObtainPairView):
    """POST /api/v1/auth/token/ — Login com e-mail e senha."""
    serializer_class = CustomTokenObtainPairSerializer

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
