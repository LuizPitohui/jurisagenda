'use client';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Gavel, Users, Clock, FileText,
  MapPin, Video, Calendar, User,
  Tv, Tag, Trash2, Pencil, Loader2, History, Printer, Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useEventDetail, useEventModal } from '@/store';
import { eventsApi } from '@/lib/api';
import { EVENT_CONFIG, STATUS_CONFIG, fmtDateTime, fmtDate, fmtRelative } from '@/lib/utils';

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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showHistory,   setShowHistory]   = useState(false);

  const { data: historyData } = useQuery({
    queryKey: ['event-history', calEvent?.id],
    queryFn:  () => eventsApi.history(calEvent!.id),
    enabled:  !!calEvent?.id && open && showHistory,
  });

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', calEvent?.id],
    queryFn:  () => eventsApi.get(calEvent!.id),
    enabled:  !!calEvent?.id && open,
  });

  const deleteMutation = useMutation({
    mutationFn: () => eventsApi.delete(calEvent!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar'] });
      qc.invalidateQueries({ queryKey: ['events'] });
      hide();
      // Toast com ação de desfazer
      toast.success('Evento cancelado.', {
        duration: 6000,
        action: {
          label: 'Desfazer',
          onClick: async () => {
            try {
              await eventsApi.restore(calEvent!.id);
              qc.invalidateQueries({ queryKey: ['calendar'] });
              qc.invalidateQueries({ queryKey: ['events'] });
              toast.success('Evento restaurado.');
            } catch {
              toast.error('Não foi possível restaurar o evento.');
            }
          },
        },
      });
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

  const duplicateMutation = useMutation({
    mutationFn: () => eventsApi.duplicate(calEvent!.id),
    onSuccess: (newEvent) => {
      qc.invalidateQueries({ queryKey: ['calendar'] });
      qc.invalidateQueries({ queryKey: ['events'] });
      toast.success('Evento duplicado!', {
        action: {
          label: 'Editar cópia',
          onClick: () => { hide(); openEdit({ editId: newEvent.id }); },
        },
      });
    },
    onError: () => toast.error('Erro ao duplicar evento.'),
  });

  if (!open || !calEvent) return null;

  const cfg         = EVENT_CONFIG[calEvent.event_type];
  const Icon        = ICONS[calEvent.event_type];
  const statusCfg   = STATUS_CONFIG[calEvent.status];

  const portal = createPortal(
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
                      {event.tv_priority === 'HIGH' ? 'Alta prioridade' : 'Normal'}
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

                {/* Histórico de alterações */}
                <div className="border-t pt-4" style={{ borderColor: '#e2d9c8' }}>
                  <button
                    onClick={() => setShowHistory(h => !h)}
                    className="flex items-center gap-2 text-xs font-semibold w-full text-left"
                    style={{ color: '#6b8099' }}
                  >
                    <History size={13} />
                    {showHistory ? 'Ocultar histórico' : 'Ver histórico de alterações'}
                  </button>

                  {showHistory && (
                    <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                      {(historyData?.history ?? []).length === 0 ? (
                        <p className="text-xs text-center py-4" style={{ color: '#a89e90' }}>Nenhum registro encontrado</p>
                      ) : (historyData?.history ?? []).map((log: any) => (
                        <div key={log.id} className="flex items-start gap-2.5 text-xs">
                          <div
                            className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                            style={{ background: log.action === 'CREATE' ? '#16a34a' : log.action === 'DELETE' ? '#dc2626' : '#2563eb' }}
                          />
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold text-navy-700">{log.user}</span>
                            <span style={{ color: '#a89e90' }}> · {log.action === 'CREATE' ? 'criou' : log.action === 'DELETE' ? 'cancelou' : 'editou'}</span>
                          </div>
                          <span className="shrink-0" style={{ color: '#c8bfb2' }}>{fmtRelative(log.timestamp)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
              onClick={() => setConfirmDelete(true)}
              disabled={deleteMutation.isPending}
              className="btn-ghost btn-sm text-red-500 hover:bg-red-50"
            >
              {deleteMutation.isPending
                ? <Loader2 size={13} className="animate-spin" />
                : <Trash2 size={13} />
              }
            </button>

            {/* Duplicar */}
            <button
              onClick={() => duplicateMutation.mutate()}
              disabled={duplicateMutation.isPending}
              className="btn-ghost btn-sm gap-1.5"
              title="Duplicar evento"
            >
              {duplicateMutation.isPending
                ? <Loader2 size={13} className="animate-spin" />
                : <Copy size={13} />
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

            {/* Imprimir */}
            <button
              onClick={() => {
                if (!event) return;
                const w = window.open('', '_blank');
                if (!w) return;
                w.document.write(`
                  <html><head><title>${event.title}</title>
                  <style>body{font-family:Georgia,serif;padding:32px;max-width:600px;margin:0 auto}
                  h1{font-size:22px;margin-bottom:4px}
                  .badge{display:inline-block;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:bold;background:${cfg.bg};color:${cfg.color};border:1px solid ${cfg.color}44}
                  .row{display:flex;gap:8px;margin:8px 0;font-size:13px}
                  .label{color:#888;min-width:120px}
                  .notes{background:#faf8f3;border-left:3px solid ${cfg.color};padding:10px;border-radius:4px;font-size:13px;margin-top:16px}
                  hr{border:none;border-top:1px solid #e2d9c8;margin:16px 0}
                  </style></head><body>
                  <p class="badge">${cfg.label}</p>
                  <h1>${event.title}</h1>
                  <hr/>
                  <div class="row"><span class="label">Data/Hora:</span><span>${fmtDateTime(event.start_datetime)}${event.end_datetime ? ' → ' + fmtDateTime(event.end_datetime) : ''}</span></div>
                  ${event.assigned_to_name ? `<div class="row"><span class="label">Responsável:</span><span>${event.assigned_to_name}</span></div>` : ''}
                  ${event.process_number ? `<div class="row"><span class="label">Processo:</span><span>${event.process_number}</span></div>` : ''}
                  ${event.video_link ? `<div class="row"><span class="label">Videochamada:</span><span>${event.video_link}</span></div>` : ''}
                  ${event.due_date ? `<div class="row"><span class="label">Vencimento:</span><span>${fmtDate(event.due_date)}</span></div>` : ''}
                  ${event.tv_enabled ? `<div class="row"><span class="label">Código TV:</span><span>${event.tv_code}</span></div>` : ''}
                  ${event.notes ? `<div class="notes">${event.notes}</div>` : ''}
                  <hr/><p style="font-size:11px;color:#aaa">Gerado por JurisAgenda · ${new Date().toLocaleString('pt-BR')}</p>
                  </body></html>
                `);
                w.document.close();
                w.print();
              }}
              className="btn-secondary btn-sm gap-1.5"
            >
              <Printer size={13} /> Imprimir
            </button>

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

  return (
    <>
      {portal}
      <ConfirmDialog
        open={confirmDelete}
        title="Cancelar evento"
        message="O evento será marcado como cancelado. Esta ação pode ser revertida pelo administrador."
        confirmLabel="Cancelar evento"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => { deleteMutation.mutate(); setConfirmDelete(false); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}