"""accounts/urls/auth.py — Rotas de autenticação."""
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView

from accounts.views import (
    AvatarUploadView,
    ChangePasswordView,
    CustomTokenObtainPairView,
    ForgotPasswordView,
    LogoutView,
    MeView,
    ResetPasswordView,
    UserDetailView,
    UserListCreateView,
    UserSelectView,
)

urlpatterns = [
    path("token/", CustomTokenObtainPairView.as_view(), name="token-obtain"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("token/verify/", TokenVerifyView.as_view(), name="token-verify"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("me/", MeView.as_view(), name="me"),
    path("me/avatar/", AvatarUploadView.as_view(), name="me-avatar"),
    path("me/change-password/", ChangePasswordView.as_view(), name="change-password"),
    path("forgot-password/", ForgotPasswordView.as_view(), name="forgot-password"),
    path("reset-password/", ResetPasswordView.as_view(), name="reset-password"),
    path("users/", UserListCreateView.as_view(), name="user-list-create"),
    path("users/select/", UserSelectView.as_view(), name="user-select"),
    path("users/<uuid:pk>/", UserDetailView.as_view(), name="user-detail"),
]
