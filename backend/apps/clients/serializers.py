from rest_framework import serializers

from .models import Client


class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = [
            "id", "code", "full_name", "cpf_cnpj", "email",
            "phone", "notes", "consent_given", "created_at",
        ]
        read_only_fields = ["id", "code", "created_at"]


class ClientCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = ["full_name", "cpf_cnpj", "email", "phone", "notes", "consent_given"]

    def validate_consent_given(self, value):
        if not value:
            raise serializers.ValidationError(
                "O consentimento LGPD é obrigatório para o cadastro do cliente."
            )
        return value

    def create(self, validated_data):
        from .services import ClientService
        return ClientService.create_client(
            created_by=self.context["request"].user, **validated_data
        )


class ClientMinimalSerializer(serializers.ModelSerializer):
    """Serializer mínimo — usado em nested para não vazar dados sensíveis."""
    class Meta:
        model = Client
        fields = ["id", "code"]
