"""
events/reports.py — Relatórios analíticos para o escritório jurídico.
GET /api/v1/events/reports/
"""
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsAdminOrLawyerOrSecretary
from .models import Event, EventStatus


class EventReportsView(APIView):
    permission_classes = [IsAdminOrLawyerOrSecretary]

    def get(self, request):
        now  = timezone.now()
        year = int(request.query_params.get('year', now.year))
        qs   = Event.objects.filter(start_datetime__year=year)

        # ── Totais gerais ──────────────────────────────────────────────
        total         = qs.count()
        this_month    = qs.filter(start_datetime__month=now.month).count()
        upcoming      = qs.filter(start_datetime__gte=now, status=EventStatus.SCHEDULED).count()
        with_tv       = qs.filter(tv_enabled=True).count()
        deadline_soon = Event.objects.filter(
            due_date__gte=now.date(),
            due_date__lte=(now + timezone.timedelta(days=7)).date(),
            status=EventStatus.SCHEDULED,
        ).count()

        # ── Por tipo ───────────────────────────────────────────────────
        by_type = list(
            qs.values('event_type').annotate(total=Count('id')).order_by('event_type')
        )

        # ── Por status ─────────────────────────────────────────────────
        by_status = list(
            qs.values('status').annotate(total=Count('id'))
        )

        # ── Por mês ────────────────────────────────────────────────────
        by_month = []
        for month in range(1, 13):
            mqs = qs.filter(start_datetime__month=month)
            by_month.append({
                'month':     month,
                'total':     mqs.count(),
                'AUDIENCIA': mqs.filter(event_type='AUDIENCIA').count(),
                'REUNIAO':   mqs.filter(event_type='REUNIAO').count(),
                'PRAZO':     mqs.filter(event_type='PRAZO').count(),
                'CONTRATO':  mqs.filter(event_type='CONTRATO').count(),
                'DONE':      mqs.filter(status=EventStatus.DONE).count(),
                'CANCELLED': mqs.filter(status=EventStatus.CANCELLED).count(),
            })

        # ── Por responsável (top 8) ────────────────────────────────────
        by_user = list(
            qs.values('assigned_to__full_name')
              .annotate(total=Count('id'))
              .order_by('-total')[:8]
        )

        # ── Prazos próximos 4 semanas ──────────────────────────────────
        deadlines_4w = []
        for week in range(4):
            start = (now + timezone.timedelta(weeks=week)).date()
            end   = (now + timezone.timedelta(weeks=week + 1)).date()
            deadlines_4w.append({
                'week':  f'Sem {week + 1}',
                'total': Event.objects.filter(
                    due_date__gte=start,
                    due_date__lt=end,
                    status=EventStatus.SCHEDULED,
                ).count(),
            })

        # ── Taxa de realização (eventos DONE vs total com data passada) ─
        past_events = qs.filter(start_datetime__lt=now)
        done_count  = past_events.filter(status=EventStatus.DONE).count()
        past_total  = past_events.count()
        completion_rate = round((done_count / past_total * 100) if past_total else 0, 1)

        return Response({
            'year':            year,
            'total':           total,
            'this_month':      this_month,
            'upcoming':        upcoming,
            'with_tv':         with_tv,
            'deadline_soon':   deadline_soon,
            'completion_rate': completion_rate,
            'by_type':         by_type,
            'by_status':       by_status,
            'by_month':        by_month,
            'by_user':         by_user,
            'deadlines_4w':    deadlines_4w,
        })
