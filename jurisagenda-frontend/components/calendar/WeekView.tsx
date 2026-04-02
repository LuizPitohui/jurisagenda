'use client';
import { useMemo } from 'react';
import { parseISO, isSameDay, startOfWeek, addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { fmtTime, EVENT_CONFIG, cn } from '@/lib/utils';
import { useEventDetail, useEventModal } from '@/store';
import type { CalendarEvent } from '@/types';

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 07h–20h

interface Props {
  date:   Date;
  events: CalendarEvent[];
}

export function WeekView({ date, events }: Props) {
  const { show: openDetail } = useEventDetail();
  const { show: openModal  } = useEventModal();

  const weekStart = useMemo(
    () => startOfWeek(date, { weekStartsOn: 0 }),
    [date]
  );

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const today = new Date();

  const forDay = (d: Date) =>
    events
      .filter((e) => isSameDay(parseISO(e.start_datetime), d))
      .sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime());

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Cabeçalho dos dias */}
      <div className="grid border-b" style={{ gridTemplateColumns: '48px repeat(7, 1fr)', borderColor: '#e2d9c8' }}>
        <div className="bg-[#faf8f3] dark:bg-navy-900" />
        {days.map((d, i) => {
          const isToday = isSameDay(d, today);
          return (
            <div
              key={i}
              className="py-2 text-center border-l"
              style={{ borderColor: '#e2d9c8', background: '#faf8f3' }}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: i === 0 || i === 6 ? '#c8bfb2' : '#8a7e70' }}>
                {format(d, 'EEE', { locale: ptBR })}
              </p>
              <span
                className={cn(
                  'text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full mx-auto mt-0.5',
                  isToday ? 'text-white' : 'text-navy-700 dark:text-[#e2eaf4]'
                )}
                style={isToday ? { background: '#0e1e2e' } : {}}
              >
                {format(d, 'd')}
              </span>
            </div>
          );
        })}
      </div>

      {/* Grade de horas */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid relative" style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}>
          {/* Coluna de horas */}
          <div>
            {HOURS.map((h) => (
              <div key={h} className="h-14 flex items-start justify-end pr-2 pt-1">
                <span className="text-[10px]" style={{ color: '#c8bfb2' }}>{h}h</span>
              </div>
            ))}
          </div>

          {/* Colunas dos dias */}
          {days.map((d, di) => {
            const dayEvs = forDay(d);
            const isToday = isSameDay(d, today);
            return (
              <div
                key={di}
                className={cn('border-l relative', isToday && 'bg-blue-50/30 dark:bg-blue-900/5')}
                style={{ borderColor: '#e2d9c8' }}
                onClick={() => openModal({ date: d })}
              >
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="h-14 border-b"
                    style={{ borderColor: '#f0ebe3' }}
                  />
                ))}

                {/* Eventos posicionados */}
                {dayEvs.map((ev) => {
                  const start  = parseISO(ev.start_datetime);
                  const hour   = start.getHours() + start.getMinutes() / 60;
                  const top    = (hour - 7) * 56; // 56px por hora
                  const cfg    = EVENT_CONFIG[ev.event_type];

                  return (
                    <motion.button
                      key={ev.id}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      onClick={(e) => { e.stopPropagation(); openDetail(ev); }}
                      className="absolute left-0.5 right-0.5 rounded-lg px-1.5 py-1 text-left text-[10px] font-semibold overflow-hidden z-10 hover:brightness-95 transition-all"
                      style={{
                        top:        Math.max(0, top),
                        minHeight:  24,
                        background: cfg.color + '20',
                        color:      cfg.color,
                        borderLeft: `3px solid ${cfg.color}`,
                      }}
                      title={ev.title}
                    >
                      <span className="block truncate">{fmtTime(ev.start_datetime)}</span>
                      <span className="block truncate font-bold">{ev.title}</span>
                      {ev.needs_followup && (
                        <AlertCircle size={8} className="absolute top-1 right-1" style={{ color: '#EA580C' }} />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
