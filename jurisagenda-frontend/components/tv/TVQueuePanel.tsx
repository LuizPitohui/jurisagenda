'use client';
import { useEffect } from 'react';
import { Monitor, Wifi, WifiOff, Radio, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useTV } from '@/store';
import { fmtTime, EVENT_CONFIG } from '@/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { eventsApi, tvApi } from '@/lib/api';
import { toast } from 'sonner';
import type { WSMessage } from '@/types';
import { speakGoogleTTS } from '@/lib/tts';

export function TVQueuePanel() {
  const { active, history, speaking, setCall, confirm, setSpeaking, setHistory } = useTV();

  // Busca histórico do dia ao montar
  const { data: historyData } = useQuery({
    queryKey: ['tv-history'],
    queryFn: tvApi.history,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (historyData?.history?.length) {
      setHistory(historyData.history.map((c: any) => ({
        code: c.tv_code,
        event_type: c.event_type,
        priority: c.priority,
        tts_text: '',
        timestamp: c.called_at,
        event_id: c.event?.id ?? '',
      })));
    }
  }, [historyData]);

  const qc = useQueryClient();
  const { connected } = useWebSocket('/ws/tv/', {
    onMessage: (msg: WSMessage) => {
      if (msg.type === 'tv.call') {
        setCall(msg.payload);
        speakTTS(msg.payload.tts_text);
        qc.invalidateQueries({ queryKey: ['tv-history'] });
      }
      if (msg.type === 'tv.confirm') {
        confirm(msg.payload.code);
      }
    },
  });

  const mutation = useMutation({
    mutationFn: (id: string) => eventsApi.confirmCall(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['calendar'] });
      qc.invalidateQueries({ queryKey: ['event', id] });
      toast.success('Chamada confirmada com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao confirmar chamada.');
    }
  });

  const speakTTS = (text: string) => {
    speakGoogleTTS(text, () => setSpeaking(true), () => setSpeaking(false));
  };

  return (
    <div className="card h-full flex flex-col overflow-hidden">

      {/* Cabeçalho */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-[#e2d9c8] dark:border-navy-800 bg-[#faf8f3] dark:bg-[#162030]"
      >
        <div className="flex items-center gap-2">
          <Monitor size={15} style={{ color: '#1e3f5c' }} />
          <span className="text-sm font-semibold text-navy-800">Fila TV</span>
        </div>

        <div
          className="flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full"
          style={
            connected
              ? { background: '#DCFCE7', color: '#15803D' }
              : { background: '#FEE2E2', color: '#DC2626' }
          }
        >
          {connected ? <Wifi size={10} /> : <WifiOff size={10} />}
          {connected ? 'Online' : 'Offline'}
        </div>
      </div>

      {/* Chamada ativa */}
      <div className="p-4 border-b border-[#e2d9c8] dark:border-navy-800">
        <p
          className="text-[10px] font-bold uppercase tracking-widest mb-2"
          style={{ color: '#a89e90' }}
        >
          Chamada Ativa
        </p>

        <AnimatePresence mode="wait">
          {active ? (
            <motion.div
              key={active.code}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{    opacity: 0, y: -8 }}
              className="rounded-xl p-4 text-center"
              style={{
                background:   EVENT_CONFIG[active.event_type].bg,
                border:       `1px solid ${EVENT_CONFIG[active.event_type].color}22`,
              }}
            >
              <p
                className="font-serif text-4xl font-bold mb-1"
                style={{ color: EVENT_CONFIG[active.event_type].color }}
              >
                {active.code}
              </p>
              <p
                className="text-xs font-semibold"
                style={{ color: EVENT_CONFIG[active.event_type].color }}
              >
                {EVENT_CONFIG[active.event_type].label}
              </p>

              {active.priority === 'HIGH' && (
                <div className="mt-4 flex flex-col gap-2">
                  <span className="inline-flex items-center justify-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                    <Radio size={8} /> ALTA PRIORIDADE
                  </span>
                  
                  {/* Botão Ciente */}
                  <button
                    onClick={() => mutation.mutate(active.event_id)}
                    disabled={mutation.isPending}
                    className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-white border-2 border-red-200 text-red-700 text-xs font-bold hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {mutation.isPending ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={14} />
                    )}
                    MARCAR COMO CIENTE
                  </button>
                </div>
              )}

              {speaking && (
                <div className="flex justify-center mt-3">
                  <div
                    className="wave-bars"
                    style={{ color: EVENT_CONFIG[active.event_type].color }}
                  >
                    <span /><span /><span /><span /><span />
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl p-4 text-center bg-[#faf8f3] dark:bg-[#1a2840]"
            >
              <p className="text-sm" style={{ color: '#c8bfb2' }}>
                Nenhuma chamada ativa
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Histórico */}
      <div className="flex-1 p-4 overflow-y-auto">
        <p
          className="text-[10px] font-bold uppercase tracking-widest mb-3"
          style={{ color: '#a89e90' }}
        >
          Últimas chamadas
        </p>

        {history.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: '#c8bfb2' }}>
            Sem histórico
          </p>
        ) : (
          <div className="space-y-2">
            {history.map((call, i) => (
              <div
                key={`${call.code}-${i}`}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-[#faf8f3] dark:bg-[#1a2840]"
                style={{ opacity: 1 - i * 0.25 }}
              >
                <span
                  className="font-serif font-bold text-base"
                  style={{ color: EVENT_CONFIG[call.event_type].color }}
                >
                  {call.code}
                </span>
                <div className="flex-1">
                  <p className="text-xs font-medium text-navy-800">
                    {EVENT_CONFIG[call.event_type].label}
                  </p>
                  <p className="text-[10px] flex items-center gap-1" style={{ color: '#a89e90' }}>
                    <Clock size={9} />
                    {fmtTime(call.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Link para o painel TV */}
      <div className="p-3 border-t border-[#e2d9c8] dark:border-navy-800">
        <a
          href="/tv"
          target="_blank"
          className="flex items-center justify-center gap-2 w-full btn-secondary btn-sm"
        >
          <Monitor size={13} />
          Abrir Painel TV
        </a>
      </div>

    </div>
  );
}