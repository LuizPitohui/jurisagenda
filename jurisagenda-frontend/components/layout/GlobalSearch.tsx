'use client';
import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Calendar } from 'lucide-react';
import { eventsApi } from '@/lib/api';
import { fmtDate, EVENT_CONFIG } from '@/lib/utils';
import { useEventDetail } from '@/store';

export function GlobalSearch() {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState('');
  const inputRef          = useRef<HTMLInputElement>(null);
  const ref               = useRef<HTMLDivElement>(null);
  const { show }          = useEventDetail();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setOpen(true); }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else setQuery('');
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const { data: results, isLoading } = useQuery({
    queryKey: ['global-search', query],
    queryFn:  () => eventsApi.list({ search: query, page_size: 8 }),
    enabled:  query.length >= 2,
  });

  const events = results?.results ?? [];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm transition-colors hover:bg-slate-50 dark:hover:bg-navy-800 dark:border-navy-700"
        style={{ borderColor: '#e1e8f0', color: '#9ab0c8' }}
      >
        <Search size={14} />
        <span className="hidden md:block text-xs">Buscar</span>
        <kbd className="hidden md:block text-[10px] px-1.5 py-0.5 rounded border font-mono dark:border-navy-700 dark:bg-navy-800" style={{ borderColor: '#e1e8f0', background: '#f4f6f9' }}>
          ⌘K
        </kbd>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-navy-950/40 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              ref={ref}
              initial={{ opacity: 0, scale: 0.96, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              className="fixed z-50 rounded-2xl shadow-2xl border overflow-hidden bg-white dark:bg-[#162030] dark:border-navy-700"
              style={{ borderColor: '#e1e8f0', top: '15%', left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 560 }}
            >
              {/* Input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-[#e1e8f0] dark:border-navy-700">
                <Search size={16} style={{ color: '#9ab0c8' }} />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar eventos, documentos…"
                  className="flex-1 text-sm outline-none text-navy-800 dark:text-blue-100 placeholder-slate-400 dark:placeholder-navy-500 bg-transparent"
                />
                {query && (
                  <button onClick={() => setQuery('')}>
                    <X size={14} style={{ color: '#9ab0c8' }} />
                  </button>
                )}
                <kbd className="text-[10px] px-1.5 py-0.5 rounded border font-mono dark:border-navy-700 dark:bg-navy-800 dark:text-navy-400" style={{ borderColor: '#e1e8f0', background: '#f4f6f9', color: '#9ab0c8' }}>
                  Esc
                </kbd>
              </div>

              {/* Resultados */}
              <div className="max-h-80 overflow-y-auto">
                {query.length < 2 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm" style={{ color: '#9ab0c8' }}>Digite pelo menos 2 caracteres para buscar</p>
                  </div>
                ) : isLoading ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm" style={{ color: '#9ab0c8' }}>Buscando…</p>
                  </div>
                ) : events.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm" style={{ color: '#9ab0c8' }}>Nenhum resultado para "{query}"</p>
                  </div>
                ) : (
                  <div>
                    <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: '#9ab0c8' }}>
                      Eventos ({events.length})
                    </p>
                    {events.map((event) => {
                      const cfg = EVENT_CONFIG[event.event_type];
                      return (
                        <button
                          key={event.id}
                          onClick={() => { show(event); setOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors text-left"
                        >
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: cfg.bg }}>
                            <Calendar size={14} style={{ color: cfg.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-navy-800 dark:text-blue-100 truncate">{event.title}</p>
                            <p className="text-[10px] mt-0.5" style={{ color: '#9ab0c8' }}>
                              {cfg.label} · {fmtDate(event.start_datetime)}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2 border-t border-[#e1e8f0] dark:border-navy-700 bg-[#f8fafc] dark:bg-[#1a2840] flex items-center gap-4">
                <span className="text-[10px]" style={{ color: '#9ab0c8' }}>
                  <kbd className="font-mono">↵</kbd> abrir · <kbd className="font-mono">Esc</kbd> fechar
                </span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
