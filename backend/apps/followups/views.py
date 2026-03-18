"""followups/views.py — Thin Views."""
from rest_framework import generics, mixins, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from core.permissions import IsAdminOrLawyerOrSecretary

from .models import EventFollowUp
from .serializers import (
    FollowUpCreateSerializer,
    FollowUpSerializer,
    FollowUpUpdateSerializer,
    RescheduleSerializer,
)
from .services import FollowUpService


class FollowUpViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    GenericViewSet,
):
    """
    GET    /api/v1/followups/              — Listar pendentes do usuário
    POST   /api/v1/followups/              — Registrar resultado
    GET    /api/v1/followups/{id}/         — Detalhe com timeline
    PATCH  /api/v1/followups/{id}/         — Atualizar outcome
    POST   /api/v1/followups/{id}/reschedule/ — Criar evento de remarcação
    """
    permission_classes = [IsAdminOrLawyerOrSecretary]

    def get_queryset(self):
        user = self.request.user
        qs = EventFollowUp.objects.select_related(
            "event", "event__client", "created_by", "next_event"
        )
        # Admin vê todos; outros veem apenas os seus
        if user.role != "ADMIN":
            qs = qs.filter(event__assigned_to=user)
        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return FollowUpCreateSerializer
        if self.action in ("update", "partial_update"):
            return FollowUpUpdateSerializer
        return FollowUpSerializer

    @action(detail=True, methods=["post"], url_path="reschedule")
    def reschedule(self, request, pk=None):
        """POST /api/v1/followups/{id}/reschedule/"""
        followup = self.get_object()
        serializer = RescheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_event = FollowUpService.reschedule_event(
            followup=followup,
            rescheduled_by=request.user,
            **serializer.validated_data,
        )

        from events.serializers import EventDetailSerializer
        return Response(
            EventDetailSerializer(new_event).data,
            status=status.HTTP_201_CREATED,
        )
