"""
events/reports.py — Relatórios analíticos para o escritório jurídico.
GET /api/v1/events/reports/
"""
from django.db.models import Count
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsAdminOrLawyerOrSecretary
from .models import Event, EventStatus

EVENT_TYPES = ['AUDIENCIA', 'REUNIAO', 'PRAZO', 'CONTRATO']


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

        # ── Comparativo mês anterior ───────────────────────────────────
        prev_month     = now.month - 1 if now.month > 1 else 12
        prev_year      = year if now.month > 1 else year - 1
        prev_month_qs  = Event.objects.filter(
            start_datetime__year=prev_year,
            start_datetime__month=prev_month,
        )
        prev_month_total = prev_month_qs.count()
        this_month_delta = this_month - prev_month_total

        # ── Por tipo — ano completo ────────────────────────────────────
        by_type = list(
            qs.values('event_type').annotate(total=Count('id')).order_by('event_type')
        )

        # ── Por tipo — mês atual (quantitativo exato) ──────────────────
        mqs = qs.filter(start_datetime__month=now.month)
        this_month_by_type = {t: mqs.filter(event_type=t).count() for t in EVENT_TYPES}

        # ── Estimativas semanais (média do ano até agora) ──────────────
        # Semanas decorridas no ano até hoje
        day_of_year   = now.timetuple().tm_yday
        weeks_elapsed = max(day_of_year / 7, 1)

        # Se estamos consultando ano passado, usa 52 semanas
        if year < now.year:
            weeks_elapsed = 52

        weekly_estimates = {
            t: round(
                qs.filter(event_type=t).count() / weeks_elapsed, 1
            )
            for t in EVENT_TYPES
        }

        # ── Por status ─────────────────────────────────────────────────
        by_status = list(
            qs.values('status').annotate(total=Count('id'))
        )

        # ── Por mês ────────────────────────────────────────────────────
        by_month = []
        for month in range(1, 13):
            mqs_m = qs.filter(start_datetime__month=month)
            by_month.append({
                'month':     month,
                'total':     mqs_m.count(),
                'AUDIENCIA': mqs_m.filter(event_type='AUDIENCIA').count(),
                'REUNIAO':   mqs_m.filter(event_type='REUNIAO').count(),
                'PRAZO':     mqs_m.filter(event_type='PRAZO').count(),
                'CONTRATO':  mqs_m.filter(event_type='CONTRATO').count(),
                'DONE':      mqs_m.filter(status=EventStatus.DONE).count(),
                'CANCELLED': mqs_m.filter(status=EventStatus.CANCELLED).count(),
            })

        # ── Por responsável (top 8) com stats ─────────────────────────
        by_user = []
        for u in qs.values('assigned_to__id', 'assigned_to__full_name').annotate(total=Count('id')).order_by('-total')[:8]:
            user_qs   = qs.filter(assigned_to__id=u['assigned_to__id'])
            past      = user_qs.filter(start_datetime__lt=now)
            done      = past.filter(status=EventStatus.DONE).count()
            past_cnt  = past.count()
            by_user.append({
                **u,
                'done':            done,
                'completion_rate': round((done / past_cnt * 100) if past_cnt else 0, 1),
            })

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

        # ── Taxa de realização ─────────────────────────────────────────
        past_events = qs.filter(start_datetime__lt=now)
        done_count  = past_events.filter(status=EventStatus.DONE).count()
        past_total  = past_events.count()
        completion_rate = round((done_count / past_total * 100) if past_total else 0, 1)

        return Response({
            'year':                year,
            'total':               total,
            'this_month':          this_month,
            'this_month_delta':    this_month_delta,
            'prev_month_total':    prev_month_total,
            'this_month_by_type':  this_month_by_type,
            'upcoming':            upcoming,
            'with_tv':             with_tv,
            'deadline_soon':       deadline_soon,
            'completion_rate':     completion_rate,
            'weekly_estimates':    weekly_estimates,
            'by_type':             by_type,
            'by_status':           by_status,
            'by_month':            by_month,
            'by_user':             by_user,
            'deadlines_4w':        deadlines_4w,
        })
