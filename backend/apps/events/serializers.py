"""events/serializers.py"""
from rest_framework import serializers

from accounts.serializers import UserSerializer
from clients.serializers import ClientMinimalSerializer

from .models import Event, EventStatus, EventType


class EventListSerializer(serializers.ModelSerializer):
    """Serializer leve para listagem e calendário."""
    assigned_to_name = serializers.CharField(source="assigned_to.full_name", read_only=True)
    client_code = serializers.CharField(source="client.code", read_only=True, allow_null=True)

    class Meta:
        model = Event
        fields = [
            "id", "title", "event_type", "start_datetime", "end_datetime",
            "status", "tv_enabled", "tv_code", "tv_priority",
            "color_tag", "assigned_to", "assigned_to_name",
            "client", "client_code", "deadline_approaching",
        ]
        read_only_fields = ["id", "tv_code"]


class EventDetailSerializer(serializers.ModelSerializer):
    """Serializer completo para detalhe do evento."""
    assigned_to_data = UserSerializer(source="assigned_to", read_only=True)
    client_data = ClientMinimalSerializer(source="client", read_only=True)
    is_overdue_for_followup = serializers.BooleanField(read_only=True)

    class Meta:
        model = Event
        fields = [
            "id", "title", "event_type", "start_datetime", "end_datetime",
            "location", "notes", "color_tag",
            "video_link", "supplier_name", "due_date",
            "client", "client_data", "process_number",
            "assigned_to", "assigned_to_data",
            "tv_enabled", "tv_priority", "tv_code", "tv_call_confirmed",
            "status", "is_overdue_for_followup", "deadline_approaching",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "tv_code", "tv_call_confirmed", "created_at", "updated_at"]


class EventCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = [
            "title", "event_type", "start_datetime", "end_datetime",
            "location", "notes", "color_tag",
            "video_link", "supplier_name", "due_date",
            "client", "process_number", "assigned_to",
            "tv_enabled", "tv_priority",
        ]

    def validate(self, attrs):
        event_type = attrs.get("event_type")

        # Validação de campos obrigatórios por tipo (spec seção 5.2.2)
        if event_type == EventType.AUDIENCIA:
            if not attrs.get("end_datetime"):
                raise serializers.ValidationError(
                    {"end_datetime": "Obrigatório para Audiência."}
                )
        if event_type in (EventType.CONTRATO, EventType.PRAZO):
            if not attrs.get("due_date"):
                raise serializers.ValidationError(
                    {"due_date": "Data de vencimento obrigatória para Prazo/Contrato."}
                )
        if event_type == EventType.CONTRATO:
            if not attrs.get("supplier_name"):
                raise serializers.ValidationError(
                    {"supplier_name": "Fornecedor obrigatório para Contrato."}
                )

        # end_datetime deve ser após start_datetime
        start = attrs.get("start_datetime")
        end = attrs.get("end_datetime")
        if start and end and end <= start:
            raise serializers.ValidationError(
                {"end_datetime": "O fim deve ser após o início."}
            )

        return attrs

    def create(self, validated_data):
        from .services import EventService
        return EventService.create_event(
            created_by=self.context["request"].user, **validated_data
        )


class EventUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = [
            "title", "start_datetime", "end_datetime", "location",
            "notes", "color_tag", "video_link", "supplier_name",
            "due_date", "client", "process_number", "assigned_to",
            "tv_enabled", "tv_priority", "status",
        ]

    def update(self, instance, validated_data):
        from .services import EventService
        return EventService.update_event(instance, validated_data, updated_by=self.context["request"].user)


class CalendarEventSerializer(serializers.ModelSerializer):
    """Serializer mínimo para renderização do calendário (R05 — performance)."""
    needs_followup = serializers.BooleanField(read_only=True)

    class Meta:
        model = Event
        fields = [
            "id", "title", "event_type", "start_datetime",
            "status", "color_tag", "tv_enabled", "assigned_to",
            "needs_followup",
        ]
