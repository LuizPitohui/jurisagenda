'use client';
import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, X, AlertTriangle, Clock, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { eventsApi } from '@/lib/api';
import { fmtDate, EVENT_CONFIG } from '@/lib/utils';
import { useEventDetail } from '@/store';
import type { CalendarEvent } from '@/types';

const DAYS_AHEAD = 7;

export function DeadlineNotifications() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { show: openDetail } = useEventDetail();

  // Busca eventos dos próximos 7 dias com prazo
  const { data: events = [] } = useQuery({
    queryKey: ['deadline-notifications'],
    queryFn: async () => {
      const now = new Date();
      const future = new Date();
      future.setDate(future.getDate() + DAYS_AHEAD);

      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const all = await eventsApi.calendar(month, year);

      return all.filter((e) => {
        if (!e.due_date && e.event_type !== 'PRAZO' && e.event_type !== 'CONTRATO') return false;
        const date = new Date(e.due_date ?? e.start_datetime);
        return date >= now && date <= future;
      }).sort((a, b) => {
        const da = new Date(a.due_date ?? a.start_datetime);
        const db = new Date(b.due_date ?? b.start_datetime);
        return da.getTime() - db.getTime();
      });
    },
    refetchInterval: 5 * 60 * 1000, // atualiza a cada 5 min
  });

  // Fecha ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const count = events.length;

  const urgency = (e: CalendarEvent) => {
    const date = new Date(e.due_date ?? e.start_datetime);
    const diff = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diff <= 1) return { label: 'Hoje', color: '#dc2626', bg: '#fff0f0' };
    if (diff <= 3) return { label: `${diff}d`, color: '#d69e2e', bg: '#fffbeb' };
    return { label: `${diff}d`, color: '#3182ce', bg: '#ebf4ff' };
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl transition-colors hover:bg-slate-100"
        style={{ color: count > 0 ? '#dc2626' : '#6b8099' }}
      >
        <Bell size={18} />
        {count > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
            style={{ background: '#dc2626' }}
          >
            {count > 9 ? '9+' : count}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 top-full mt-2 w-80 rounded-2xl shadow-xl border bg-white z-50"
            style={{ borderColor: '#e1e8f0' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#e1e8f0' }}>
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} style={{ color: '#dc2626' }} />
                <span className="text-sm font-semibold text-navy-800">Prazos próximos</span>
              </div>
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-slate-100">
                <X size={13} style={{ color: '#9ab0c8' }} />
              </button>
            </div>

            {/* Lista */}
            <div className="max-h-72 overflow-y-auto">
              {count === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <Clock size={28} className="opacity-20" style={{ color: '#0b1929' }} />
                  <p className="text-xs" style={{ color: '#9ab0c8' }}>Nenhum prazo nos próximos {DAYS_AHEAD} dias</p>
                </div>
              ) : (
                events.map((e) => {
                  const u = urgency(e);
                  const cfg = EVENT_CONFIG[e.event_type];
                  return (
                    <button
                      key={e.id}
                      onClick={() => { openDetail(e); setOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b last:border-0"
                      style={{ borderColor: '#f0f5fa' }}
                    >
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: cfg.bg }}>
                        <Calendar size={14} style={{ color: cfg.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-navy-800 truncate">{e.title}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: '#9ab0c8' }}>
                          {cfg.label} · {fmtDate(e.due_date ?? e.start_datetime)}
                        </p>
                      </div>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                        style={{ background: u.bg, color: u.color }}
                      >
                        {u.label}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {count > 0 && (
              <div className="px-4 py-2.5 border-t text-center" style={{ borderColor: '#e1e8f0' }}>
                <p className="text-[10px]" style={{ color: '#9ab0c8' }}>
                  {count} prazo{count !== 1 ? 's' : ''} nos próximos {DAYS_AHEAD} dias
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
