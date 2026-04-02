'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Video, MapPin, User } from 'lucide-react';
import { fmtTime, fmtDate, EVENT_CONFIG, cn } from '@/lib/utils';
import { useEventDetail, useEventModal } from '@/store';
import type { CalendarEvent } from '@/types';

interface Props {
  date:   Date;
  events: CalendarEvent[];
  onClose: () => void;
}

export function DayAgenda({ date, events, onClose }: Props) {
  const { show: openDetail } = useEventDetail();
  const { show: openEdit }   = useEventModal();

  const sorted = [...events].sort(
    (a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime()
  );

  const isToday = new Date().toDateString() === date.toDateString();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/40 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-[#162030] rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2d9c8] dark:border-[#243550]">
            <div>
              <h3 className="font-serif text-lg font-bold text-navy-900 dark:text-[#e2eaf4]">
                {isToday ? 'Hoje' : fmtDate(date, "EEEE, d 'de' MMMM")}
              </h3>
              <p className="text-xs mt-0.5 text-[#a89e90]">
                {sorted.length} evento{sorted.length !== 1 ? 's' : ''} agendado{sorted.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button onClick={onClose} className="btn-ghost btn-sm p-2">
              <X size={16} />
            </button>
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {sorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Clock size={32} className="opacity-20" style={{ color: '#0e1e2e' }} />
                <p className="text-sm text-[#a89e90]">Nenhum evento neste dia</p>
              </div>
            ) : (
              sorted.map((event) => {
                const cfg = EVENT_CONFIG[event.event_type];
                return (
                  <motion.button
                    key={event.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => { openDetail(event); onClose(); }}
                    className="w-full text-left rounded-xl p-4 border-l-4 transition-all hover:shadow-sm"
                    style={{
                      borderLeftColor: cfg.color,
                      background: cfg.bg + '30',
                      borderTop: `1px solid ${cfg.color}22`,
                      borderRight: `1px solid ${cfg.color}22`,
                      borderBottom: `1px solid ${cfg.color}22`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Tipo + horário */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: cfg.color }}>
                            {cfg.label}
                          </span>
                          <span className="text-[10px] text-[#a89e90]">·</span>
                          <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: cfg.color }}>
                            <Clock size={10} />
                            {fmtTime(event.start_datetime)}
                            {event.end_datetime && ` – ${fmtTime(event.end_datetime)}`}
                          </span>
                        </div>

                        {/* Título */}
                        <p className="text-sm font-semibold text-navy-900 dark:text-[#e2eaf4] truncate">
                          {event.title}
                        </p>

                        {/* TV code */}
                        {event.tv_enabled && event.tv_code && (
                          <span
                            className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded"
                            style={{ background: cfg.color + '20', color: cfg.color }}
                          >
                            TV: {event.tv_code}
                          </span>
                        )}
                      </div>

                      {/* Status badge */}
                      <span
                        className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0',
                          event.status === 'DONE'        && 'bg-emerald-100 text-emerald-700',
                          event.status === 'CANCELLED'   && 'bg-red-100 text-red-600',
                          event.status === 'RESCHEDULED' && 'bg-amber-100 text-amber-700',
                          event.status === 'SCHEDULED'   && 'bg-blue-100 text-blue-700',
                        )}
                      >
                        {event.status === 'DONE' ? 'Realizado'
                          : event.status === 'CANCELLED' ? 'Cancelado'
                          : event.status === 'RESCHEDULED' ? 'Remarcado'
                          : 'Agendado'}
                      </span>
                    </div>
                  </motion.button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-[#e2d9c8] dark:border-[#243550] flex justify-between items-center">
            <p className="text-xs text-[#a89e90]">Clique em um evento para ver detalhes</p>
            <button
              onClick={() => { openEdit({ date }); onClose(); }}
              className="btn-primary btn-sm"
            >
              + Novo evento
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
