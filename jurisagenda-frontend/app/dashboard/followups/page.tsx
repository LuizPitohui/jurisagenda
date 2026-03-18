'use client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Bell, CheckCircle, XCircle, Clock, ChevronRight } from 'lucide-react';
import { followupsApi } from '@/lib/api';
import { EVENT_CONFIG, fmtDateTime, fmtRelative } from '@/lib/utils';
import type { FollowUp } from '@/types';

const OUTCOME_CONFIG = {
  SUCCESS:  { label: 'Realizado',  icon: CheckCircle, color: '#16A34A', bg: '#DCFCE7' },
  FAILURE:  { label: 'Não realizado', icon: XCircle,  color: '#DC2626', bg: '#FEE2E2' },
  POSTPONED:{ label: 'Adiado',     icon: Clock,       color: '#CA8A04', bg: '#FEF9C3' },
};

function FollowUpCard({ followup }: { followup: FollowUp }) {
  const eventCfg   = EVENT_CONFIG[followup.event_type];
  const outcomeCfg = OUTCOME_CONFIG[followup.outcome];
  const OutcomeIcon = outcomeCfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-5 hover:shadow-lifted transition-shadow cursor-pointer group"
    >
      <div className="flex items-start gap-4">

        {/* Ícone do tipo */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: eventCfg.bg, color: eventCfg.color }}
        >
          <span className="text-lg">
            {followup.event_type === 'AUDIENCIA' ? '⚖️'
             : followup.event_type === 'REUNIAO'  ? '👥'
             : followup.event_type === 'PRAZO'    ? '⏰'
             : '📄'}
          </span>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: eventCfg.color }}
            >
              {eventCfg.label}
            </span>
            <span
              className="badge"
              style={{ background: outcomeCfg.bg, color: outcomeCfg.color, borderColor: outcomeCfg.color + '33' }}
            >
              <OutcomeIcon size={10} />
              {outcomeCfg.label}
            </span>
          </div>

          <h3 className="font-serif font-semibold text-navy-900 truncate">
            {followup.event_title}
          </h3>

          <p className="text-xs mt-1" style={{ color: '#a89e90' }}>
            Evento em {fmtDateTime(followup.event_start)}
          </p>

          {/* Motivo de falha */}
          {followup.failure_reason && (
            <p
              className="text-xs mt-2 px-2 py-1 rounded-lg"
              style={{ background: '#FEE2E2', color: '#991B1B' }}
            >
              {followup.failure_reason}
            </p>
          )}

          {/* Próximo evento */}
          {followup.next_event_title && (
            <div
              className="flex items-center gap-1.5 mt-2 text-xs font-medium"
              style={{ color: '#2563EB' }}
            >
              <ChevronRight size={12} />
              Remarcado: {followup.next_event_title}
            </div>
          )}
        </div>

        {/* Data */}
        <div className="text-right shrink-0">
          <p className="text-xs" style={{ color: '#a89e90' }}>
            {fmtRelative(followup.created_at)}
          </p>
          <p className="text-xs mt-1" style={{ color: '#c8bfb2' }}>
            {followup.created_by_name}
          </p>
        </div>

      </div>

      {/* Timeline preview */}
      {followup.timeline_log.length > 0 && (
        <div
          className="mt-4 pt-4 border-t"
          style={{ borderColor: '#e2d9c8' }}
        >
          <p
            className="text-[10px] font-bold uppercase tracking-widest mb-2"
            style={{ color: '#a89e90' }}
          >
            Última entrada da timeline
          </p>
          <div className="flex items-start gap-2">
            <div
              className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
              style={{ background: eventCfg.color }}
            />
            <p className="text-xs text-navy-700 leading-relaxed">
              {followup.timeline_log[followup.timeline_log.length - 1]?.entry}
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default function FollowUpsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['followups'],
    queryFn:  () => followupsApi.list(),
  });

  const followups = data?.results ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold text-navy-900">
            Follow-ups
          </h2>
          <p className="text-sm mt-1" style={{ color: '#a89e90' }}>
            Histórico de resultados pós-evento
          </p>
        </div>

        {!isLoading && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold"
            style={{ background: '#f0f4f9', color: '#1e3f5c' }}
          >
            <Bell size={14} />
            {followups.length} registros
          </div>
        )}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-5 space-y-3">
              <div className="flex gap-4">
                <div className="skel w-10 h-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="skel h-4 w-32" />
                  <div className="skel h-5 w-64" />
                  <div className="skel h-3 w-48" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : followups.length === 0 ? (
        <div
          className="card p-16 text-center"
          style={{ background: '#faf8f3' }}
        >
          <Bell size={48} className="mx-auto mb-4 opacity-20" style={{ color: '#0e1e2e' }} />
          <p className="font-serif text-xl font-semibold text-navy-800 mb-2">
            Nenhum follow-up ainda
          </p>
          <p className="text-sm" style={{ color: '#a89e90' }}>
            Os follow-ups aparecem aqui após eventos serem realizados
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {followups.map((fu) => (
            <FollowUpCard key={fu.id} followup={fu} />
          ))}
        </div>
      )}

    </div>
  );
}