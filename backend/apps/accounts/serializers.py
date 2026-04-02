"""
accounts/serializers.py
Validação de dados via DRF Serializers — sem lógica de negócio aqui.
"""
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id", "email", "full_name", "oab_number",
            "role", "is_active", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class UserSelectSerializer(serializers.ModelSerializer):
    """Serializer mínimo para selects — não expõe dados sensíveis."""
    class Meta:
        model = User
        fields = ["id", "full_name", "role"]


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["email", "full_name", "oab_number", "role", "password", "password_confirm"]

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("password_confirm"):
            raise serializers.ValidationError({"password_confirm": "As senhas não conferem."})
        return attrs

    def create(self, validated_data):
        from .services import UserService
        return UserService.create_user(**validated_data)


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["full_name", "oab_number", "role"]


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, validators=[validate_password])
    new_password_confirm = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError(
                {"new_password_confirm": "As senhas não conferem."}
            )
        return attrs


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Adiciona dados do usuário ao payload do token JWT."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["email"] = user.email
        token["full_name"] = user.full_name
        token["role"] = user.role
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data
