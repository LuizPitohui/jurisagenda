'use client';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useFollowUpModal } from '@/store';
import { followupsApi } from '@/lib/api';
import { EVENT_CONFIG, fmtDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

type Step = 'outcome' | 'schedule_next' | 'failure_reason' | 'reschedule' | 'done';

export function FollowUpModal() {
  const { open, payload, close } = useFollowUpModal();
  const qc                       = useQueryClient();

  const [step,          setStep]          = useState<Step>('outcome');
  const [followUpId,    setFollowUpId]    = useState<string | null>(null);
  const [failureReason, setFailureReason] = useState('');

  const { register, handleSubmit, reset } = useForm<{
    notes:              string;
    new_start_datetime: string;
    new_end_datetime:   string;
  }>();

  const cfg = payload ? EVENT_CONFIG[payload.event_type] : null;

  // Passo 1: registrar resultado
  const outcomeMutation = useMutation({
    mutationFn: (outcome: 'SUCCESS' | 'FAILURE') =>
      followupsApi.create({
        event:   payload!.event_id,
        outcome,
        failure_reason: outcome === 'FAILURE' ? failureReason : undefined,
      }),
    onSuccess: (data, outcome) => {
      setFollowUpId(data.id);
      qc.invalidateQueries({ queryKey: ['calendar'] });
      qc.invalidateQueries({ queryKey: ['followups'] });
      
      if (outcome === 'SUCCESS') {
        setStep('schedule_next');
      } else {
        // Se já está no passo de failure_reason, significa que o usuário clicou em 'Sim, remarcar' ou 'Não remarcar'
        if (step === 'failure_reason') {
           // Se o usuário quer remarcar, vai para o form de reschedule
           // Note: O botão 'Sim, remarcar' chama outcomeMutation.mutate('FAILURE')
           // Precisamos saber se ele clicou em remarcar ou não.
           // Vou ajustar a lógica do botão para setar um estado temporário ou usar o step atual.
           setStep('reschedule');
        } else {
           setStep('failure_reason');
        }
      }
    },
    onError: () => toast.error('Erro ao registrar follow-up.'),
  });

  // Passo 2b: remarcar evento
  const rescheduleMutation = useMutation({
    mutationFn: (data: { new_start_datetime: string; new_end_datetime?: string; notes?: string }) =>
      followupsApi.reschedule(followUpId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar'] });
      toast.success('Evento remarcado com sucesso!');
      handleClose();
    },
    onError: () => toast.error('Erro ao remarcar evento.'),
  });

  const handleClose = () => {
    setStep('outcome');
    setFollowUpId(null);
    setFailureReason('');
    reset();
    close();
  };

  const onReschedule = handleSubmit((data) => {
    rescheduleMutation.mutate({
      new_start_datetime: data.new_start_datetime,
      new_end_datetime:   data.new_end_datetime || undefined,
      notes:              data.notes            || undefined,
    });
  });

  if (!open || !payload) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">

        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{    opacity: 0 }}
          className="absolute inset-0 bg-navy-950/50 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0,  scale: 1    }}
          exit={{    opacity: 0, y: 12               }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="relative bg-white rounded-2xl w-full max-w-md z-10 overflow-hidden"
          style={{ boxShadow: 'var(--shadow-modal)' }}
        >
          {/* Barra colorida */}
          <div className="h-1.5" style={{ background: cfg?.color ?? '#2563EB' }} />

          {/* Cabeçalho */}
          <div
            className="flex items-start justify-between px-6 py-5 border-b"
            style={{ borderColor: '#e2d9c8' }}
          >
            <div>
              <p
                className="text-xs font-bold uppercase tracking-widest mb-1"
                style={{ color: cfg?.color }}
              >
                Follow-up · {cfg?.label}
              </p>
              <h3 className="font-serif text-lg font-bold text-navy-900 leading-tight">
                {payload.event_title}
              </h3>
              <p className="text-xs mt-1" style={{ color: '#a89e90' }}>
                {fmtDateTime(payload.started_at)}
              </p>
            </div>
            <button onClick={handleClose} className="btn-ghost btn-sm p-1.5 shrink-0">
              <X size={16} />
            </button>
          </div>

          {/* Conteúdo por passo */}
          <div className="p-6">
            <AnimatePresence mode="wait">

              {/* ── Passo 1: O evento foi realizado? ── */}
              {step === 'outcome' && (
                <motion.div
                  key="outcome"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0  }}
                  exit={{    opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <p className="text-sm font-semibold text-navy-800">
                    O evento foi realizado com sucesso?
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => outcomeMutation.mutate('SUCCESS')}
                      disabled={outcomeMutation.isPending}
                      className={cn(
                        'flex flex-col items-center gap-2 p-4 rounded-xl border-2',
                        'transition-all font-semibold text-sm',
                        'border-emerald-200 hover:border-emerald-400',
                        'bg-emerald-50 text-emerald-700',
                        'hover:bg-emerald-100',
                      )}
                    >
                      {outcomeMutation.isPending
                        ? <Loader2 size={24} className="animate-spin" />
                        : <CheckCircle size={24} />
                      }
                      Sim, realizado
                    </button>

                    <button
                      onClick={() => setStep('failure_reason')}
                      className={cn(
                        'flex flex-col items-center gap-2 p-4 rounded-xl border-2',
                        'transition-all font-semibold text-sm',
                        'border-red-200 hover:border-red-400',
                        'bg-red-50 text-red-700',
                        'hover:bg-red-100',
                      )}
                    >
                      <XCircle size={24} />
                      Não realizado
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── Passo 2a: Sucesso → Agendar próximo? ── */}
              {step === 'schedule_next' && (
                <motion.div
                  key="schedule_next"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0  }}
                  exit={{    opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-2 text-emerald-700 text-sm font-semibold">
                    <CheckCircle size={16} />
                    Evento registrado como realizado!
                  </div>

                  <p className="text-sm font-semibold text-navy-800">
                    Deseja agendar o próximo prazo ou evento?
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setStep('reschedule')}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-navy-200 hover:border-navy-400 bg-navy-50 text-navy-700 hover:bg-navy-100 transition-all font-semibold text-sm"
                    >
                      <Clock size={24} />
                      Sim, agendar
                    </button>

                    <button
                      onClick={() => {
                        toast.success('Follow-up concluído!');
                        handleClose();
                      }}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-slate-200 hover:border-slate-400 bg-slate-50 text-slate-600 transition-all font-semibold text-sm"
                    >
                      <X size={24} />
                      Não, encerrar
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── Passo 2b: Motivo da falha ── */}
              {step === 'failure_reason' && (
                <motion.div
                  key="failure_reason"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0  }}
                  exit={{    opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <p className="text-sm font-semibold text-navy-800">
                    Qual o motivo do não comparecimento?
                  </p>

                  <textarea
                    value={failureReason}
                    onChange={(e) => setFailureReason(e.target.value)}
                    rows={3}
                    className="field-input resize-none"
                    placeholder="Descreva o motivo…"
                  />

                  <p className="text-sm font-semibold text-navy-800">
                    Deseja remarcar o evento?
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => outcomeMutation.mutate('FAILURE')}
                      disabled={outcomeMutation.isPending || !failureReason.trim()}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-navy-200 hover:border-navy-400 bg-navy-50 text-navy-700 transition-all font-semibold text-sm disabled:opacity-40"
                    >
                      {outcomeMutation.isPending
                        ? <Loader2 size={24} className="animate-spin" />
                        : <Clock size={24} />
                      }
                      Sim, remarcar
                    </button>

                    <button
                      onClick={() => {
                        if (!failureReason.trim()) {
                          toast.error('Informe o motivo antes de continuar.');
                          return;
                        }
                        // Registra o follow-up e fecha o modal sem remarcar
                        followupsApi.create({
                          event: payload!.event_id,
                          outcome: 'FAILURE',
                          failure_reason: failureReason,
                        }).then(() => {
                          qc.invalidateQueries({ queryKey: ['calendar'] });
                          qc.invalidateQueries({ queryKey: ['followups'] });
                          toast.success('Follow-up registrado.');
                          handleClose();
                        }).catch(() => toast.error('Erro ao registrar follow-up.'));
                      }}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-slate-200 hover:border-slate-400 bg-slate-50 text-slate-600 transition-all font-semibold text-sm"
                    >
                      <X size={24} />
                      Não remarcar
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── Passo 3: Formulário de remarcação ── */}
              {step === 'reschedule' && (
                <motion.div
                  key="reschedule"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0  }}
                  exit={{    opacity: 0, x: -20 }}
                >
                  <form onSubmit={onReschedule} className="space-y-4">
                    <p className="text-sm font-semibold text-navy-800">
                      Nova data para o evento
                    </p>

                    <div>
                      <label className="field-label">Data/Hora *</label>
                      <input
                        {...register('new_start_datetime', { required: true })}
                        type="datetime-local"
                        className="field-input"
                      />
                    </div>

                    <div>
                      <label className="field-label">Data/Hora Fim (opcional)</label>
                      <input
                        {...register('new_end_datetime')}
                        type="datetime-local"
                        className="field-input"
                      />
                    </div>

                    <div>
                      <label className="field-label">Observações (opcional)</label>
                      <textarea
                        {...register('notes')}
                        rows={2}
                        className="field-input resize-none"
                        placeholder="Informações adicionais…"
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setStep('schedule_next')}
                        className="btn-secondary flex-1"
                      >
                        Voltar
                      </button>
                      <button
                        type="submit"
                        disabled={rescheduleMutation.isPending}
                        className="btn-primary flex-1"
                        style={{ background: cfg?.color }}
                      >
                        {rescheduleMutation.isPending
                          ? <><Loader2 size={15} className="animate-spin" /> Salvando…</>
                          : 'Confirmar Remarcação'
                        }
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

            </AnimatePresence>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}