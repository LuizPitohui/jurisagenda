'use client';
import { useMemo, useState } from 'react';
import { parseISO, isSameDay, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Gavel, Users, Clock, FileText, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { buildCalendarGrid, WEEKDAYS, fmtTime, cn } from '@/lib/utils';
import { useEventModal, useEventDetail } from '@/store';
import type { CalendarEvent } from '@/types';

const ICONS = {
  AUDIENCIA: Gavel,
  REUNIAO:   Users,
  PRAZO:     Clock,
  CONTRATO:  FileText,
};

interface Props {
  month:      number;
  year:       number;
  events:     CalendarEvent[];
  isLoading?: boolean;
}

export function CalendarGrid({ month, year, events, isLoading }: Props) {
  const { show: openModal  } = useEventModal();
  const { show: openDetail } = useEventDetail();
  const [morePopover, setMorePopover] = useState<{ date: Date; events: CalendarEvent[] } | null>(null);
  const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useMemo(() => ({ x: 0, y: 0 }), []);

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    dragOffset.x = e.clientX - popoverPos.x;
    dragOffset.y = e.clientY - popoverPos.y;

    const onMove = (ev: MouseEvent) => {
      setPopoverPos({ x: ev.clientX - dragOffset.x, y: ev.clientY - dragOffset.y });
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const today = new Date();
  const cells = useMemo(() => buildCalendarGrid(year, month), [year, month]);

  const forDay = (d: Date) =>
    events.filter((e) => isSameDay(parseISO(e.start_datetime), d));

  if (isLoading) {
    return (
      <div className="flex-1 grid grid-cols-7">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="px-3 py-2 border-b text-xs font-semibold text-center uppercase tracking-wider"
            style={{ borderColor: '#e2d9c8', color: '#a89e90', background: '#faf8f3' }}
          >
            {d}
          </div>
        ))}
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="cal-cell p-2 space-y-1.5">
            <div className="skel h-3 w-5" />
            <div className="skel h-5 w-full" />
            <div className="skel h-5 w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">

      {/* Cabeçalho dos dias da semana */}
      <div className="grid grid-cols-7 border-b" style={{ borderColor: '#e2d9c8' }}>
        {WEEKDAYS.map((d, i) => (
          <div
            key={d}
            className="py-2.5 text-center text-xs font-bold uppercase tracking-wider"
            style={{
              color:      i === 0 || i === 6 ? '#c8bfb2' : '#8a7e70',
              background: '#faf8f3',
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Células do calendário */}
      <div className="grid grid-cols-7 flex-1" style={{ gridAutoRows: '1fr' }}>
        {cells.map((cell, idx) => {
          const dayEvents = forDay(cell.date);
          const isToday   = isSameDay(cell.date, today);
          const isOther   = cell.which !== 'curr';
          const hasMore   = dayEvents.length > 3;

          return (
            <div
              key={idx}
              className={cn(
                'cal-cell flex flex-col gap-0.5',
                isOther  && 'cal-cell-other',
                !isOther && !isToday && 'cal-cell-curr',
                isToday  && 'cal-cell-today',
                idx % 7 !== 6 && 'border-r',
              )}
              style={{ borderColor: '#e2d9c8' }}
              onClick={() => { if (!isOther) openModal({ date: cell.date }); }}
            >
              {/* Número do dia */}
              <div className="flex items-center justify-between mb-0.5">
                <span
                  className={cn(
                    'text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full transition-colors',
                    isToday  && 'text-white',
                    !isToday && !isOther && 'text-navy-700',
                    isOther  && 'text-navy-300',
                  )}
                  style={isToday ? { background: '#0e1e2e' } : {}}
                >
                  {cell.day}
                </span>
              </div>

              {/* Chips de eventos */}
              <div
                className="space-y-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                {dayEvents.slice(0, 3).map((ev) => {
                  const Icon = ICONS[ev.event_type];


                  return (
                    <motion.button
                      key={ev.id}
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={() => openDetail(ev)}
                      className={cn('chip w-full text-left', `chip-${ev.event_type}`)}
                      style={ev.needs_followup ? { outline: '1px solid #FB923C' } : {}}
                      title={ev.title}
                    >
                      <Icon size={9} className="shrink-0" />
                      <span className="truncate flex-1">
                        {fmtTime(ev.start_datetime)} {ev.title}
                      </span>
                      {ev.needs_followup && (
                        <AlertCircle size={9} style={{ color: '#EA580C' }} className="shrink-0" />
                      )}
                    </motion.button>
                  );
                })}

                {hasMore && (
                  <button
                    className="text-[10px] px-1 cursor-pointer hover:underline text-left"
                    style={{ color: '#a89e90' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPopoverPos({
                        x: window.innerWidth / 2 - 144,
                        y: window.innerHeight / 2 - 150,
                      });
                      setMorePopover({ date: cell.date, events: dayEvents });
                    }}
                  >
                    +{dayEvents.length - 3} mais
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Popover de todos os eventos do dia */}
      <AnimatePresence>
        {morePopover && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMorePopover(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed z-50 bg-white rounded-2xl shadow-xl border p-4 w-72"
              style={{
                borderColor: '#e2d9c8',
                left: popoverPos.x,
                top: popoverPos.y,
                cursor: dragging ? 'grabbing' : 'grab',
                userSelect: 'none',
              }}
            >
              <div
                className="flex items-center justify-between mb-3"
                onMouseDown={handleDragStart}
              >
                <p className="text-sm font-semibold text-navy-800">
                  {format(morePopover.date, "d 'de' MMMM", { locale: ptBR })}
                </p>
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => setMorePopover(null)}
                  className="p-1 rounded-lg hover:bg-cream-100"
                  style={{ color: '#a89e90' }}
                >
                  <X size={14} />
                </button>
              </div>
              <div className="space-y-1" onMouseDown={(e) => e.stopPropagation()}>
                {morePopover.events.map((ev) => {
                  const Icon = ICONS[ev.event_type];
                  return (
                    <button
                      key={ev.id}
                      onClick={() => { openDetail(ev); setMorePopover(null); }}
                      className={cn('chip w-full text-left', `chip-${ev.event_type}`)}
                    >
                      <Icon size={9} className="shrink-0" />
                      <span className="truncate flex-1">
                        {fmtTime(ev.start_datetime)} {ev.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}