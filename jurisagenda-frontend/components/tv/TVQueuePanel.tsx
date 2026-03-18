'use client';
import { Monitor, Wifi, WifiOff, Radio, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useTV } from '@/store';
import { fmtTime, EVENT_CONFIG } from '@/lib/utils';
import type { WSMessage } from '@/types';

export function TVQueuePanel() {
  const { active, history, speaking, setCall, confirm, setSpeaking } = useTV();

  const { connected } = useWebSocket('/ws/tv/', {
    onMessage: (msg: WSMessage) => {
      if (msg.type === 'tv.call') {
        setCall(msg.payload);
        speakTTS(msg.payload.tts_text);
      }
      if (msg.type === 'tv.confirm') {
        confirm(msg.payload.code);
      }
    },
  });

  const speakTTS = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const utter  = new SpeechSynthesisUtterance(text);
    utter.lang   = 'pt-BR';
    setSpeaking(true);
    utter.onend  = () => setSpeaking(false);
    window.speechSynthesis.speak(utter);
  };

  return (
    <div className="card h-full flex flex-col overflow-hidden">

      {/* Cabeçalho */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: '#e2d9c8', background: '#faf8f3' }}
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
      <div className="p-4 border-b" style={{ borderColor: '#e2d9c8' }}>
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
                <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                  <Radio size={8} /> ALTA PRIORIDADE
                </span>
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
              className="rounded-xl p-4 text-center"
              style={{ background: '#faf8f3' }}
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
                className="flex items-center gap-3 p-2.5 rounded-xl"
                style={{ background: '#faf8f3', opacity: 1 - i * 0.25 }}
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
      <div className="p-3 border-t" style={{ borderColor: '#e2d9c8' }}>
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