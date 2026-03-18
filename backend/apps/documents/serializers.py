"""documents/serializers.py"""
from rest_framework import serializers

from .models import EventDocument


class EventDocumentSerializer(serializers.ModelSerializer):
    file_size_mb = serializers.FloatField(read_only=True)
    uploaded_by_name = serializers.CharField(source="uploaded_by.full_name", read_only=True)

    class Meta:
        model = EventDocument
        fields = [
            "id", "event", "file_name", "content_type",
            "file_size", "file_size_mb", "uploaded_by", "uploaded_by_name",
            "created_at",
        ]
        read_only_fields = ["id", "uploaded_by", "created_at"]


class PresignedUploadRequestSerializer(serializers.Serializer):
    """Payload para solicitar URL de upload pré-assinada."""
    event_id = serializers.UUIDField()
    file_name = serializers.CharField(max_length=255)
    content_type = serializers.CharField(max_length=100)
    file_size = serializers.IntegerField(min_value=1)


class PresignedUploadResponseSerializer(serializers.Serializer):
    upload_url = serializers.URLField()
    minio_key = serializers.CharField()
    expires_in = serializers.IntegerField()


class DocumentRegisterSerializer(serializers.Serializer):
    """
    Após upload direto ao MinIO, o frontend notifica o backend
    para registrar o documento no banco.
    """
    event_id = serializers.UUIDField()
    file_name = serializers.CharField(max_length=255)
    minio_key = serializers.CharField(max_length=500)
    content_type = serializers.CharField(max_length=100)
    file_size = serializers.IntegerField(min_value=1)
