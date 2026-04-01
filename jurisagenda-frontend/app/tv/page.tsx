'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gavel, Users, Clock, FileText, Wifi, WifiOff } from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useTV } from '@/store';
import { EVENT_CONFIG } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { tvApi } from '@/lib/api';
import type { WSMessage } from '@/types';
import { speakGoogleTTS } from '@/lib/tts';

const ICONS = {
  AUDIENCIA: Gavel,
  REUNIAO: Users,
  PRAZO: Clock,
  CONTRATO: FileText,
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
    <span className="font-mono text-3xl font-bold tracking-widest text-gray-800">
      {time}
    </span>
  );
}

export default function TVPage() {
  const { active, history, speaking, setCall, confirm, setSpeaking, setHistory } = useTV();
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  // Tenta desbloquear autoplay automaticamente ao montar
  useEffect(() => {
    const unlock = async () => {
      try {
        // Cria um AudioContext silencioso para desbloquear o autoplay
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        await ctx.resume();
        const buf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
        setAudioUnlocked(true);
      } catch {
        // Se falhar, aguarda interação do usuário
      }
    };
    unlock();
  }, []);

  // Busca histórico do dia ao montar (só se autenticado)
  const { data: historyData } = useQuery({
    queryKey: ['tv-history'],
    queryFn: tvApi.history,
    refetchOnWindowFocus: false,
    enabled: typeof window !== 'undefined' && !!sessionStorage.getItem('access'),
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
    speakGoogleTTS(text, () => setSpeaking(true), () => setSpeaking(false));
  };

  const activeCfg = active ? EVENT_CONFIG[active.event_type] : null;
  const ActiveIcon = active ? ICONS[active.event_type] : null;

  return (
    <div className="tv-screen select-none bg-slate-50 text-gray-900 overflow-hidden">

      {/* Efeitos visuais suaves para tela clara */}
      <div className="tv-scan-line opacity-5" />
      <div className="tv-vignette opacity-20 bg-gradient-to-t from-gray-200 to-transparent mix-blend-multiply" />

      {/* Conteúdo principal */}
      <div className="relative z-10 flex h-screen">

        {/* ── Área central (chamada ativa) ── */}
        <div className="relative flex-1 flex flex-col items-center justify-center px-16">

          {/* Header */}
          <div className="absolute top-8 left-8 right-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center bg-white shadow-sm border border-gray-200"
              >
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-gray-800">
                  <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="text-gray-900 font-serif font-bold text-lg leading-none">JurisAgenda</p>
                <p className="text-gray-500 text-xs uppercase tracking-widest font-semibold">Recepção</p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full"
                style={
                  connected
                    ? { background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }
                    : { background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }
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
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -20 }}
                transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                className="text-center"
              >
                {/* Ícone do tipo */}
                <div
                  className="mx-auto mb-8 w-32 h-32 rounded-3xl flex items-center justify-center bg-white"
                  style={{
                    border: `1px solid ${activeCfg.color}40`,
                    boxShadow: `0 20px 50px -10px ${activeCfg.color}40, 0 0 100px ${activeCfg.color}20`,
                  }}
                >
                  <ActiveIcon
                    size={64}
                    style={{ color: activeCfg.color }}
                  />
                </div>

                {/* Tipo de evento */}
                <p
                  className="text-3xl font-bold mb-4 uppercase tracking-[0.2em]"
                  style={{ color: activeCfg.color }}
                >
                  {activeCfg.label}
                </p>

                {/* Código principal */}
                <div
                  className="tv-code mb-8 font-serif font-black tracking-tighter"
                  style={{
                    color: '#111827', // Texto bem escuro para contraste
                    fontSize: '12rem',
                    lineHeight: '1',
                    textShadow: `0 10px 30px ${activeCfg.color}30`,
                  }}
                >
                  {active.code}
                </div>

                {/* Alta prioridade */}
                {active.priority === 'HIGH' && (
                  <motion.div
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-base font-bold uppercase tracking-wider"
                    style={{ background: '#fee2e2', color: '#b91c1c', border: '2px solid #fca5a5' }}
                  >
                    Alta Prioridade
                  </motion.div>
                )}

                {/* Indicador de voz */}
                {speaking && (
                  <div className="mt-8 flex justify-center">
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
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <div
                  className="mx-auto mb-8 w-40 h-40 rounded-full flex items-center justify-center bg-white shadow-sm border border-gray-100"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="w-20 h-20 text-gray-200">
                    <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-gray-400 text-3xl font-serif font-medium">
                  Aguardando chamadas…
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Painel lateral: histórico ── */}
        <div
          className="w-96 h-full flex flex-col border-l border-gray-200 p-8 bg-white/50 backdrop-blur-sm"
        >
          <p
            className="text-xs font-bold uppercase tracking-[0.2em] mb-8 text-gray-500"
          >
            Últimas Chamadas
          </p>

          <div className="space-y-4">
            <AnimatePresence>
              {history.length === 0 ? (
                <p className="text-sm text-gray-400 italic text-center mt-10">
                  Sem histórico ainda
                </p>
              ) : (
                history.map((call, i) => {
                  const hCfg = EVENT_CONFIG[call.event_type];
                  const HIcon = ICONS[call.event_type];
                  return (
                    <motion.div
                      key={`${call.code}-${i}`}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1 - i * 0.25, x: 0 }}
                      className="flex items-center gap-4 p-4 rounded-2xl bg-white shadow-sm border border-gray-100"
                    >
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: hCfg.color + '15', color: hCfg.color }}
                      >
                        <HIcon size={24} />
                      </div>
                      <div>
                        <p
                          className="font-serif font-bold text-2xl leading-none"
                          style={{ color: '#1f2937' }}
                        >
                          {call.code}
                        </p>
                        <p className="text-sm mt-1 font-medium" style={{ color: hCfg.color }}>
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
          <div className="mt-auto pt-6 border-t border-gray-200">
            <p className="text-[11px] leading-relaxed text-gray-400 text-justify">
              Este painel exibe apenas códigos anônimos. Nenhum dado pessoal é exposto. Em conformidade com a LGPD — Lei nº 13.709/2018.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}