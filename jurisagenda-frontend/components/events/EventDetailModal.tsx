'use client';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Gavel, Users, Clock, FileText,
  MapPin, Video, Calendar, User,
  Tv, Tag, Trash2, Pencil, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useEventDetail, useEventModal } from '@/store';
import { eventsApi } from '@/lib/api';
import { EVENT_CONFIG, STATUS_CONFIG, fmtDateTime, fmtDate } from '@/lib/utils';

const ICONS = {
  AUDIENCIA: Gavel,
  REUNIAO:   Users,
  PRAZO:     Clock,
  CONTRATO:  FileText,
};

export function EventDetailModal() {
  const { open, event: calEvent, hide } = useEventDetail();
  const { show: openEdit }              = useEventModal();
  const qc                              = useQueryClient();

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', calEvent?.id],
    queryFn:  () => eventsApi.get(calEvent!.id),
    enabled:  !!calEvent?.id && open,
  });

  const deleteMutation = useMutation({
    mutationFn: () => eventsApi.delete(calEvent!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar'] });
      toast.success('Evento cancelado.');
      hide();
    },
    onError: () => toast.error('Erro ao cancelar o evento.'),
  });

  const tvCallMutation = useMutation({
    mutationFn: () => eventsApi.tvCall(calEvent!.id),
    onSuccess: (data: { tv_code: string }) => {
      toast.success(`Chamada disparada: ${data.tv_code}`);
    },
    onError: () => toast.error('Erro ao disparar chamada TV.'),
  });

  if (!open || !calEvent) return null;

  const cfg         = EVENT_CONFIG[calEvent.event_type];
  const Icon        = ICONS[calEvent.event_type];
  const statusCfg   = STATUS_CONFIG[calEvent.status];

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">

        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{    opacity: 0 }}
          className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm"
          onClick={hide}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0,  scale: 1    }}
          exit={{    opacity: 0, y: 12               }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="relative bg-white rounded-2xl w-full max-w-lg z-10 overflow-hidden"
          style={{ boxShadow: 'var(--shadow-modal)' }}
        >
          {/* Barra colorida */}
          <div className="h-1.5" style={{ background: cfg.color }} />

          {/* Cabeçalho */}
          <div
            className="px-6 py-5 border-b"
            style={{ borderColor: '#e2d9c8', background: cfg.bg + '60' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: cfg.color + '20', color: cfg.color }}
                >
                  <Icon size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-xs font-bold uppercase tracking-wider"
                      style={{ color: cfg.color }}
                    >
                      {cfg.label}
                    </span>
                    <span
                      className={`badge ${statusCfg.cls}`}
                    >
                      {statusCfg.label}
                    </span>
                    {calEvent.needs_followup && (
                      <span className="badge bg-orange-50 text-orange-700 border-orange-200">
                        ⚠ Pendente
                      </span>
                    )}
                  </div>
                  <h3 className="font-serif text-lg font-bold text-navy-900 leading-tight">
                    {isLoading ? (
                      <span className="skel h-5 w-48 block" />
                    ) : (
                      event?.title ?? calEvent.title
                    )}
                  </h3>
                </div>
              </div>

              <button onClick={hide} className="btn-ghost btn-sm p-1.5 shrink-0">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Corpo */}
          <div className="p-6 space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="skel h-5 w-full" />
                ))}
              </div>
            ) : event ? (
              <>
                {/* Data/Hora */}
                <div className="flex items-center gap-3 text-sm">
                  <Calendar size={15} style={{ color: cfg.color }} className="shrink-0" />
                  <span className="text-navy-700">
                    {fmtDateTime(event.start_datetime)}
                    {event.end_datetime && ` → ${fmtDateTime(event.end_datetime)}`}
                  </span>
                </div>

                {/* Responsável */}
                {event.assigned_to_name && (
                  <div className="flex items-center gap-3 text-sm">
                    <User size={15} style={{ color: cfg.color }} className="shrink-0" />
                    <span className="text-navy-700">{event.assigned_to_name}</span>
                  </div>
                )}

                {/* Local */}
                {event.location && (
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin size={15} style={{ color: cfg.color }} className="shrink-0" />
                    <span className="text-navy-700">{event.location}</span>
                  </div>
                )}

                {/* Link videochamada */}
                {event.video_link && (
                  <div className="flex items-center gap-3 text-sm">
                    <Video size={15} style={{ color: cfg.color }} className="shrink-0" />
                    <a
                      href={event.video_link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline truncate"
                    >
                      {event.video_link}
                    </a>
                  </div>
                )}

                {/* Fornecedor */}
                {event.supplier_name && (
                  <div className="flex items-center gap-3 text-sm">
                    <Tag size={15} style={{ color: cfg.color }} className="shrink-0" />
                    <span className="text-navy-700">{event.supplier_name}</span>
                  </div>
                )}

                {/* Data vencimento */}
                {event.due_date && (
                  <div className="flex items-center gap-3 text-sm">
                    <Clock size={15} style={{ color: cfg.color }} className="shrink-0" />
                    <span className="text-navy-700">
                      Vencimento: {fmtDate(event.due_date)}
                    </span>
                  </div>
                )}

                {/* TV */}
                {event.tv_enabled && (
                  <div className="flex items-center gap-3 text-sm">
                    <Tv size={15} style={{ color: cfg.color }} className="shrink-0" />
                    <span className="text-navy-700">
                      Código TV: <strong>{event.tv_code}</strong>
                      {' · '}
                      {event.tv_priority === 'HIGH' ? '🔔 Alta prioridade' : '📢 Normal'}
                    </span>
                  </div>
                )}

                {/* Processo */}
                {event.process_number && (
                  <div className="flex items-center gap-3 text-sm">
                    <FileText size={15} style={{ color: cfg.color }} className="shrink-0" />
                    <span className="text-navy-700">Proc. {event.process_number}</span>
                  </div>
                )}

                {/* Notas */}
                {event.notes && (
                  <div
                    className="rounded-xl p-3 text-sm text-navy-700"
                    style={{ background: '#faf8f3', borderLeft: `3px solid ${cfg.color}` }}
                  >
                    {event.notes}
                  </div>
                )}
              </>
            ) : null}
          </div>

          {/* Rodapé com ações */}
          <div
            className="flex items-center gap-2 px-6 py-4 border-t"
            style={{ borderColor: '#e2d9c8', background: '#fafaf8' }}
          >
            {/* Deletar */}
            <button
              onClick={() => {
                if (confirm('Cancelar este evento?')) deleteMutation.mutate();
              }}
              disabled={deleteMutation.isPending}
              className="btn-ghost btn-sm text-red-500 hover:bg-red-50"
            >
              {deleteMutation.isPending
                ? <Loader2 size={13} className="animate-spin" />
                : <Trash2 size={13} />
              }
            </button>

            <div className="flex-1" />

            {/* Disparar TV */}
            {event?.tv_enabled && (
              <button
                onClick={() => tvCallMutation.mutate()}
                disabled={tvCallMutation.isPending}
                className="btn-secondary btn-sm gap-1.5"
              >
                {tvCallMutation.isPending
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Tv size={13} />
                }
                Chamar TV
              </button>
            )}

            {/* Editar */}
            <button
              onClick={() => { hide(); openEdit({ editId: calEvent.id }); }}
              className="btn-primary btn-sm gap-1.5"
              style={{ background: cfg.color }}
            >
              <Pencil size={13} />
              Editar
            </button>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}