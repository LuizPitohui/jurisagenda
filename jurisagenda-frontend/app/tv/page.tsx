'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gavel, Users, Clock, FileText, Wifi, WifiOff } from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useTV } from '@/store';
import { EVENT_CONFIG } from '@/lib/utils';
import type { WSMessage } from '@/types';

const ICONS = {
  AUDIENCIA: Gavel,
  REUNIAO:   Users,
  PRAZO:     Clock,
  CONTRATO:  FileText,
};

function Clock24() {
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="font-mono text-3xl font-bold tracking-widest text-white/80">
      {time}
    </span>
  );
}

export default function TVPage() {
  const { active, history, speaking, setCall, confirm, setSpeaking } = useTV();

  const { connected } = useWebSocket('/ws/tv/', {
    onMessage: (msg: WSMessage) => {
      if (msg.type === 'tv.init') {
        // inicializa histórico com dados do servidor
      }
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
    utter.rate   = 0.9;
    utter.pitch  = 1.0;
    setSpeaking(true);
    utter.onend  = () => setSpeaking(false);
    window.speechSynthesis.speak(utter);
  };

  const activeCfg  = active  ? EVENT_CONFIG[active.event_type]  : null;
  const ActiveIcon = active  ? ICONS[active.event_type]         : null;

  return (
    <div className="tv-screen select-none">

      {/* Efeitos visuais de tela */}
      <div className="tv-scan-line"  />
      <div className="tv-vignette"   />

      {/* Conteúdo principal */}
      <div className="relative z-10 flex h-screen">

        {/* ── Área central (chamada ativa) ── */}
        <div className="flex-1 flex flex-col items-center justify-center px-16">

          {/* Header */}
          <div className="absolute top-8 left-8 right-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white">
                  <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="text-white font-serif font-bold text-lg leading-none">JurisAgenda</p>
                <p className="text-white/40 text-xs uppercase tracking-widest">Recepção</p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full"
                style={
                  connected
                    ? { background: 'rgba(22,163,74,0.2)',  color: '#4ade80', border: '1px solid rgba(22,163,74,0.3)'  }
                    : { background: 'rgba(220,38,38,0.2)',  color: '#f87171', border: '1px solid rgba(220,38,38,0.3)'  }
                }
              >
                {connected ? <Wifi size={11} /> : <WifiOff size={11} />}
                {connected ? 'Conectado' : 'Desconectado'}
              </div>
              <Clock24 />
            </div>
          </div>

          {/* Chamada ativa */}
          <AnimatePresence mode="wait">
            {active && activeCfg && ActiveIcon ? (
              <motion.div
                key={active.code}
                initial={{ opacity: 0, scale: 0.8, y: 30 }}
                animate={{ opacity: 1, scale: 1,   y: 0  }}
                exit={{    opacity: 0, scale: 0.9,  y: -20 }}
                transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                className="text-center"
              >
                {/* Ícone do tipo */}
                <div
                  className="mx-auto mb-8 w-24 h-24 rounded-3xl flex items-center justify-center"
                  style={{
                    background: activeCfg.color + '20',
                    border:     `2px solid ${activeCfg.color}40`,
                    boxShadow:  `0 0 60px ${activeCfg.color}30`,
                  }}
                >
                  <ActiveIcon
                    size={48}
                    style={{ color: activeCfg.color }}
                  />
                </div>

                {/* Tipo de evento */}
                <p
                  className="text-2xl font-semibold mb-4 uppercase tracking-[0.2em]"
                  style={{ color: activeCfg.color }}
                >
                  {activeCfg.label}
                </p>

                {/* Código principal */}
                <div
                  className="tv-code mb-6"
                  style={{
                    color:      activeCfg.color,
                    textShadow: `0 0 80px ${activeCfg.color}50`,
                  }}
                >
                  {active.code}
                </div>

                {/* Alta prioridade */}
                {active.priority === 'HIGH' && (
                  <motion.div
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wider"
                    style={{ background: 'rgba(220,38,38,0.2)', color: '#f87171', border: '1px solid rgba(220,38,38,0.4)' }}
                  >
                    🔔 Alta Prioridade
                  </motion.div>
                )}

                {/* Indicador de voz */}
                {speaking && (
                  <div className="mt-6 flex justify-center">
                    <div className="wave-bars" style={{ color: activeCfg.color }}>
                      <span /><span /><span /><span /><span />
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{    opacity: 0 }}
                className="text-center"
              >
                <div
                  className="mx-auto mb-8 w-32 h-32 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <svg viewBox="0 0 24 24" fill="none" className="w-16 h-16 opacity-20">
                    <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" stroke="white" strokeWidth="1" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-white/20 text-2xl font-serif">
                  Aguardando chamadas…
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Painel lateral: histórico ── */}
        <div
          className="w-80 h-full flex flex-col border-l p-6"
          style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)' }}
        >
          <p
            className="text-xs font-bold uppercase tracking-[0.2em] mb-6"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            Últimas Chamadas
          </p>

          <div className="space-y-3">
            <AnimatePresence>
              {history.length === 0 ? (
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  Sem histórico ainda
                </p>
              ) : (
                history.map((call, i) => {
                  const hCfg  = EVENT_CONFIG[call.event_type];
                  const HIcon = ICONS[call.event_type];
                  return (
                    <motion.div
                      key={`${call.code}-${i}`}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1 - i * 0.25, x: 0 }}
                      className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: hCfg.color + '20', color: hCfg.color }}
                      >
                        <HIcon size={16} />
                      </div>
                      <div>
                        <p
                          className="font-serif font-bold text-lg leading-none"
                          style={{ color: hCfg.color }}
                        >
                          {call.code}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          {hCfg.label}
                        </p>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>

          {/* Rodapé LGPD */}
          <div className="mt-auto pt-6 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.2)' }}>
              Este painel exibe apenas códigos anônimos. Nenhum dado pessoal é exposto. Em conformidade com a LGPD — Lei nº 13.709/2018.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}