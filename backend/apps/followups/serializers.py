"""followups/serializers.py"""
from rest_framework import serializers

from events.serializers import EventListSerializer

from .models import EventFollowUp, OutcomeChoices


class TimelineEntrySerializer(serializers.Serializer):
    ts = serializers.DateTimeField()
    actor = serializers.EmailField()
    entry = serializers.CharField()


class FollowUpSerializer(serializers.ModelSerializer):
    event_data = EventListSerializer(source="event", read_only=True)
    timeline_log = TimelineEntrySerializer(many=True, read_only=True)
    is_resolved = serializers.BooleanField(read_only=True)

    # Campos de conveniência para o frontend
    event_title = serializers.CharField(source="event.title", read_only=True)
    event_type = serializers.CharField(source="event.event_type", read_only=True)
    event_start = serializers.DateTimeField(source="event.start_datetime", read_only=True)
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True)
    next_event_title = serializers.CharField(source="next_event.title", read_only=True, allow_null=True)

    class Meta:
        model = EventFollowUp
        fields = [
            "id", "event", "event_data", "event_title", "event_type", "event_start",
            "outcome", "notes", "failure_reason", "next_event", "next_event_title",
            "timeline_log", "is_resolved", "created_by", "created_by_name",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "timeline_log", "created_by", "created_at", "updated_at"]


class FollowUpCreateSerializer(serializers.ModelSerializer):
    """Registra resultado de evento e cria timeline automática."""

    class Meta:
        model = EventFollowUp
        fields = ["event", "outcome", "notes", "failure_reason"]

    def validate_event(self, event):
        if hasattr(event, "followup"):
            raise serializers.ValidationError(
                "Este evento já possui um follow-up registrado."
            )
        return event

    def create(self, validated_data):
        from .services import FollowUpService
        return FollowUpService.create_followup(
            created_by=self.context["request"].user,
            **validated_data,
        )


class FollowUpUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventFollowUp
        fields = ["outcome", "notes"]

    def update(self, instance, validated_data):
        from .services import FollowUpService
        return FollowUpService.update_followup(
            instance, validated_data, updated_by=self.context["request"].user
        )


class RescheduleSerializer(serializers.Serializer):
    """Payload para recriar evento vinculado ao follow-up."""
    # Aliases para suportar ambos os formatos (frontend usa new_*)
    new_start_datetime = serializers.DateTimeField(write_only=True)
    new_end_datetime = serializers.DateTimeField(required=False, allow_null=True, write_only=True)
    
    # Mantendo compatibilidade legada se necessário
    start_datetime = serializers.DateTimeField(required=False)
    end_datetime = serializers.DateTimeField(required=False, allow_null=True)
    
    notes = serializers.CharField(required=False, allow_blank=True)
    location = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        # Mapeia new_* para os nomes esperados pelo serviço se fornecidos
        if "new_start_datetime" in data:
            data["start_datetime"] = data.pop("new_start_datetime")
        if "new_end_datetime" in data:
            data["end_datetime"] = data.pop("new_end_datetime")
        
        if not data.get("start_datetime"):
            raise serializers.ValidationError({"new_start_datetime": "Este campo é obrigatório."})
            
        return data
