'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Download, LayoutGrid, List } from 'lucide-react';
import { CalendarGrid }    from '@/components/calendar/CalendarGrid';
import { WeekView }        from '@/components/calendar/WeekView';
import { FilterBar }       from '@/components/calendar/FilterBar';
import { MonthNavigator }  from '@/components/calendar/MonthNavigator';
import { TVQueuePanel }    from '@/components/tv/TVQueuePanel';
import { useCalendar }     from '@/store';
import { eventsApi }       from '@/lib/api';
import { MONTHS, fmtDateTime, EVENT_CONFIG } from '@/lib/utils';
import type { CalendarEvent } from '@/types';

function exportEventsCSV(events: CalendarEvent[], month: number, year: number) {
  const rows: string[][] = [];
  rows.push([`Eventos — ${MONTHS[month - 1]} ${year}`]);
  rows.push([]);
  rows.push(['Título', 'Tipo', 'Status', 'Início', 'Código TV']);
  const sorted = [...events].sort(
    (a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime()
  );
  for (const e of sorted) {
    rows.push([e.title, EVENT_CONFIG[e.event_type]?.label ?? e.event_type, e.status, fmtDateTime(e.start_datetime), e.tv_code ?? '']);
  }
  const csv  = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `eventos-${MONTHS[month - 1].toLowerCase()}-${year}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export default function DashboardPage() {
  const { month, year, filters, assignedFilter } = useCalendar();
  const [view, setView] = useState<'month' | 'week'>('month');

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['calendar', month, year],
    queryFn:  () => eventsApi.calendar(month, year),
  });

  const filtered = events.filter((e) =>
    filters.has(e.event_type) &&
    (!assignedFilter || e.assigned_to === assignedFilter)
  );

  // Para a view semanal, usa a data atual dentro do mês
  const weekDate = new Date(year, month - 1, new Date().getMonth() + 1 === month ? new Date().getDate() : 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="flex gap-5 h-[calc(100vh-112px)]"
    >
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <MonthNavigator />
          <div className="flex items-center gap-2">
            <FilterBar />

            {/* Toggle mensal/semanal */}
            <div className="flex rounded-xl border overflow-hidden" style={{ borderColor: '#e2d9c8' }}>
              <button
                onClick={() => setView('month')}
                className={`px-3 py-1.5 text-xs font-semibold flex items-center gap-1 transition-colors ${view === 'month' ? 'bg-navy-800 text-white' : 'text-navy-500 hover:bg-slate-50'}`}
              >
                <LayoutGrid size={12} /> Mês
              </button>
              <button
                onClick={() => setView('week')}
                className={`px-3 py-1.5 text-xs font-semibold flex items-center gap-1 transition-colors ${view === 'week' ? 'bg-navy-800 text-white' : 'text-navy-500 hover:bg-slate-50'}`}
              >
                <List size={12} /> Semana
              </button>
            </div>

            <button
              onClick={() => exportEventsCSV(filtered, month, year)}
              disabled={isLoading || filtered.length === 0}
              className="btn-secondary btn-sm flex items-center gap-1.5 disabled:opacity-40"
              title="Exportar eventos do mês em CSV"
            >
              <Download size={13} /> CSV
            </button>
          </div>
        </div>
        <div className="card flex-1 overflow-hidden flex flex-col">
          {view === 'month'
            ? <CalendarGrid month={month} year={year} events={filtered} isLoading={isLoading} />
            : <WeekView date={weekDate} events={filtered} />
          }
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
        className="w-72 shrink-0"
      >
        <TVQueuePanel />
      </motion.div>
    </motion.div>
  );
}
