"""
events/views.py — Thin Views.
Cada view coordena entrada → service → resposta. Sem lógica de negócio.
"""
import django_filters
from rest_framework import generics, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet
from rest_framework import mixins

from core.permissions import CannotModifyEvents, IsAdminOrLawyerOrSecretary

from .models import Event, EventStatus
from .serializers import (
    CalendarEventSerializer,
    EventCreateSerializer,
    EventDetailSerializer,
    EventListSerializer,
    EventUpdateSerializer,
)
from .services import EventService


class EventFilter(django_filters.FilterSet):
    month = django_filters.NumberFilter(field_name="start_datetime", lookup_expr="month")
    year = django_filters.NumberFilter(field_name="start_datetime", lookup_expr="year")
    type = django_filters.CharFilter(field_name="event_type")
    assigned_to = django_filters.UUIDFilter(field_name="assigned_to__id")
    status = django_filters.CharFilter(field_name="status")

    class Meta:
        model = Event
        fields = ["month", "year", "type", "assigned_to", "status"]


class EventViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    GenericViewSet,
):
    """
    /api/v1/events/
    GET    list        — Listar com filtros
    POST   create      — Criar evento
    GET    retrieve    — Detalhe
    PATCH  partial_update — Atualização parcial
    DELETE destroy     — Soft-delete (CANCELLED)
    GET    calendar    — Dados do calendário
    POST   tv_call     — Disparar chamada TV
    POST   confirm_call — Confirmar chamada TV
    """
    permission_classes = [IsAdminOrLawyerOrSecretary, CannotModifyEvents]
    filterset_class = EventFilter
    search_fields = ["title", "process_number", "client__full_name"]
    ordering_fields = ["start_datetime", "status", "event_type"]

    def get_queryset(self):
        return Event.objects.select_related(
            "client", "assigned_to"
        ).prefetch_related("documents")

    def get_serializer_class(self):
        if self.action == "create":
            return EventCreateSerializer
        if self.action in ("update", "partial_update"):
            return EventUpdateSerializer
        if self.action == "retrieve":
            return EventDetailSerializer
        if self.action == "calendar":
            return CalendarEventSerializer
        return EventListSerializer

    def destroy(self, request, *args, **kwargs):
        event = self.get_object()
        EventService.cancel_event(event, cancelled_by=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"], url_path="calendar")
    def calendar(self, request):
        """GET /api/v1/events/calendar/?month=4&year=2026"""
        month = request.query_params.get("month")
        year = request.query_params.get("year")

        if not month or not year:
            from django.utils import timezone
            now = timezone.now()
            month, year = now.month, now.year

        qs = Event.objects.for_calendar(int(year), int(month))
        serializer = CalendarEventSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="tv-call")
    def tv_call(self, request, pk=None):
        """POST /api/v1/events/{id}/tv-call/ — Disparar chamada TV."""
        event = self.get_object()
        payload = EventService.dispatch_tv_call(event, dispatched_by=request.user)
        return Response(payload)

    @action(detail=True, methods=["post"], url_path="confirm-call")
    def confirm_call(self, request, pk=None):
        """POST /api/v1/events/{id}/confirm-call/"""
        event = self.get_object()
        EventService.confirm_tv_call(event, confirmed_by=request.user)
        return Response({"detail": "Chamada TV confirmada."})
