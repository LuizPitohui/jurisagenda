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

    class Meta:
        model = EventFollowUp
        fields = [
            "id", "event", "event_data", "outcome", "notes",
            "next_event", "timeline_log", "is_resolved",
            "created_by", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "timeline_log", "created_by", "created_at", "updated_at"]


class FollowUpCreateSerializer(serializers.ModelSerializer):
    """Registra resultado de evento e cria timeline automática."""

    class Meta:
        model = EventFollowUp
        fields = ["event", "outcome", "notes"]

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
    start_datetime = serializers.DateTimeField()
    end_datetime = serializers.DateTimeField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    location = serializers.CharField(required=False, allow_blank=True)
