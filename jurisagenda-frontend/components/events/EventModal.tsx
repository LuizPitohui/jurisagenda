'use client';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Tv, AlertTriangle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useEventModal, useAuth } from '@/store';
import { eventsApi, accountsApi } from '@/lib/api';
import { cn } from '@/lib/utils';

const schema = z.object({
  title:          z.string().min(1, 'Título obrigatório'),
  event_type:     z.enum(['AUDIENCIA', 'REUNIAO', 'PRAZO', 'CONTRATO']),
  start_datetime: z.string().min(1, 'Data/hora obrigatória'),
  end_datetime:   z.string().optional(),
  video_link:     z.string().url('URL inválida').optional().or(z.literal('')),
  supplier_name:  z.string().optional(),
  due_date:       z.string().optional(),
  client:         z.string().optional(),
  process_number: z.string().optional(),
  assigned_to:    z.string().min(1, 'Responsável obrigatório'),
  tv_enabled:     z.boolean(),
  tv_priority:    z.enum(['NORMAL', 'HIGH']),
  notes:          z.string().optional(),
}).superRefine((d, ctx) => {
  if (d.event_type === 'AUDIENCIA') {
    if (!d.end_datetime)
      ctx.addIssue({ code: 'custom', path: ['end_datetime'], message: 'Obrigatório para audiências' });
    if (!d.video_link)
      ctx.addIssue({ code: 'custom', path: ['video_link'],   message: 'Obrigatório para audiências' });
  }
  if (d.event_type === 'CONTRATO') {
    if (!d.supplier_name)
      ctx.addIssue({ code: 'custom', path: ['supplier_name'], message: 'Obrigatório para contratos' });
    if (!d.due_date)
      ctx.addIssue({ code: 'custom', path: ['due_date'],      message: 'Obrigatório para contratos' });
  }
  if (d.event_type === 'PRAZO' && !d.due_date)
    ctx.addIssue({ code: 'custom', path: ['due_date'], message: 'Obrigatório para prazos' });
});

type Form = z.infer<typeof schema>;

const TYPE_COLORS = {
  AUDIENCIA: '#DC2626',
  REUNIAO:   '#2563EB',
  PRAZO:     '#CA8A04',
  CONTRATO:  '#16A34A',
};

const TYPE_LABELS = {
  AUDIENCIA: 'Audiência',
  REUNIAO:   'Reunião',
  PRAZO:     'Prazo',
  CONTRATO:  'Contrato',
};

const TYPE_EMOJIS = {
  AUDIENCIA: '⚖️',
  REUNIAO:   '👥',
  PRAZO:     '⏰',
  CONTRATO:  '📄',
};

export function EventModal() {
  const { open, hide, editId, preDate } = useEventModal();
  const qc       = useQueryClient();
  const { user } = useAuth();

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn:  () => accountsApi.list(),
    enabled:  open,
  });

  const { data: editing } = useQuery({
    queryKey: ['event', editId],
    queryFn:  () => eventsApi.get(editId!),
    enabled:  !!editId && open,
  });

  const {
    register,
    handleSubmit,
    watch,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<Form>({
    resolver:      zodResolver(schema),
    defaultValues: {
      event_type:  'AUDIENCIA',
      tv_enabled:  false,
      tv_priority: 'NORMAL',
      assigned_to: user?.id ?? '',
    },
  });

  const eventType = watch('event_type');
  const tvEnabled = watch('tv_enabled');
  const tvPriority = watch('tv_priority');

  // Pré-preenche data ao clicar em um dia do calendário
  useEffect(() => {
    if (preDate && open && !editId) {
      const iso = preDate.toISOString().slice(0, 16);
      setValue('start_datetime', iso);
    }
  }, [preDate, open, editId, setValue]);

  // Pré-preenche formulário no modo edição
  useEffect(() => {
    if (editing) {
      reset({
        ...editing,
        start_datetime: editing.start_datetime?.slice(0, 16) ?? '',
        end_datetime:   editing.end_datetime?.slice(0, 16)   ?? '',
        due_date:       editing.due_date    ?? '',
        client:         editing.client      ?? '',
        assigned_to:    editing.assigned_to,
      });
    }
  }, [editing, reset]);

  const mutation = useMutation({
    mutationFn: (data: Form) => editId
        ? eventsApi.update(editId, data as never)
        : eventsApi.create(data as never),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar'] });
      qc.invalidateQueries({ queryKey: ['events']   });
      toast.success(editId ? 'Evento atualizado!' : 'Evento criado com sucesso!');
      hide();
      reset();
    },
    onError: () => toast.error('Erro ao salvar o evento.'),
  });

  const onSubmit = (data: Form) => mutation.mutate(data);

  // Visibilidade condicional dos campos por tipo
  const show = {
    end:      eventType === 'AUDIENCIA' || eventType === 'REUNIAO',
    video:    eventType === 'AUDIENCIA' || eventType === 'REUNIAO',
    supplier: eventType === 'CONTRATO',
    due:      eventType === 'CONTRATO'  || eventType === 'PRAZO',
  };

  if (!open) return null;

  const accentColor = TYPE_COLORS[eventType];

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">

        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{    opacity: 0 }}
          className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm"
          onClick={() => { hide(); reset(); }}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0,  scale: 1    }}
          exit={{    opacity: 0, y: 12               }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="relative bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto z-10"
          style={{ boxShadow: 'var(--shadow-modal)' }}
        >
          {/* Barra colorida por tipo */}
          <div
            className="h-1 rounded-t-2xl transition-colors duration-300"
            style={{ background: accentColor }}
          />

          {/* Cabeçalho */}
          <div
            className="flex items-center justify-between px-6 py-5 border-b"
            style={{ borderColor: '#e2d9c8' }}
          >
            <div>
              <h3 className="font-serif text-xl font-bold text-navy-900">
                {editId ? 'Editar Evento' : 'Novo Evento'}
              </h3>
              <p className="text-xs mt-0.5" style={{ color: '#a89e90' }}>
                Preencha os campos conforme o tipo de evento
              </p>
            </div>
            <button
              onClick={() => { hide(); reset(); }}
              className="btn-ghost btn-sm p-2"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">

            {/* Tipo de evento */}
            <div>
              <label className="field-label">Tipo de Evento</label>
              <div className="grid grid-cols-4 gap-2">
                {(['AUDIENCIA', 'REUNIAO', 'PRAZO', 'CONTRATO'] as const).map((t) => (
                  <label
                    key={t}
                    className={cn(
                      'flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2',
                      'cursor-pointer transition-all text-xs font-semibold',
                    )}
                    style={
                      eventType === t
                        ? { background: TYPE_COLORS[t] + '15', color: TYPE_COLORS[t], borderColor: TYPE_COLORS[t] + '66' }
                        : { background: '#faf8f3', color: '#a89e90', borderColor: 'transparent' }
                    }
                  >
                    <input
                      type="radio"
                      {...register('event_type')}
                      value={t}
                      className="sr-only"
                    />
                    <span className="text-xl">{TYPE_EMOJIS[t]}</span>
                    {TYPE_LABELS[t]}
                  </label>
                ))}
              </div>
            </div>

            {/* Título */}
            <div>
              <label className="field-label">Título *</label>
              <input
                {...register('title')}
                className={cn('field-input', errors.title && 'error')}
                placeholder={
                  eventType === 'AUDIENCIA' ? 'Ex: Audiência de Instrução – Proc. 1234'
                  : eventType === 'REUNIAO'  ? 'Ex: Reunião com cliente sobre contrato'
                  : eventType === 'PRAZO'    ? 'Ex: Prazo recursal – Proc. 5678'
                  : 'Ex: Contrato de prestação de serviços'
                }
              />
              {errors.title && <p className="field-error">{errors.title.message}</p>}
            </div>

            {/* Datas */}
            <div className={cn('grid gap-4', show.end ? 'grid-cols-2' : 'grid-cols-1')}>
              <div>
                <label className="field-label">Data/Hora Início *</label>
                <input
                  {...register('start_datetime')}
                  type="datetime-local"
                  className={cn('field-input', errors.start_datetime && 'error')}
                />
                {errors.start_datetime && (
                  <p className="field-error">{errors.start_datetime.message}</p>
                )}
              </div>

              {show.end && (
                <div>
                  <label className="field-label">
                    Data/Hora Fim {eventType === 'AUDIENCIA' ? '*' : '(opcional)'}
                  </label>
                  <input
                    {...register('end_datetime')}
                    type="datetime-local"
                    className={cn('field-input', errors.end_datetime && 'error')}
                  />
                  {errors.end_datetime && (
                    <p className="field-error">{errors.end_datetime.message}</p>
                  )}
                </div>
              )}
            </div>

            {/* Link de videochamada */}
            {show.video && (
              <div>
                <label className="field-label">
                  Link da Videochamada {eventType === 'AUDIENCIA' ? '*' : '(opcional)'}
                </label>
                <input
                  {...register('video_link')}
                  type="url"
                  placeholder="https://meet.google.com/..."
                  className={cn('field-input', errors.video_link && 'error')}
                />
                {errors.video_link && (
                  <p className="field-error">{errors.video_link.message}</p>
                )}
              </div>
            )}

            {/* Fornecedor (apenas CONTRATO) */}
            {show.supplier && (
              <div>
                <label className="field-label">Fornecedor *</label>
                <input
                  {...register('supplier_name')}
                  className={cn('field-input', errors.supplier_name && 'error')}
                  placeholder="Nome do fornecedor ou contratante"
                />
                {errors.supplier_name && (
                  <p className="field-error">{errors.supplier_name.message}</p>
                )}
              </div>
            )}

            {/* Data de vencimento (PRAZO / CONTRATO) */}
            {show.due && (
              <div>
                <label className="field-label">Data de Vencimento *</label>
                <input
                  {...register('due_date')}
                  type="date"
                  className={cn('field-input', errors.due_date && 'error')}
                />
                {errors.due_date && (
                  <p className="field-error">{errors.due_date.message}</p>
                )}
              </div>
            )}

            {/* Responsável + Nº Processo */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="field-label">Responsável *</label>
                <select
                  {...register('assigned_to')}
                  className={cn('field-input', errors.assigned_to && 'error')}
                >
                  <option value="">Selecionar…</option>
                  {users?.results.map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
                {errors.assigned_to && (
                  <p className="field-error">{errors.assigned_to.message}</p>
                )}
              </div>

              <div>
                <label className="field-label">Nº Processo (opcional)</label>
                <input
                  {...register('process_number')}
                  className="field-input"
                  placeholder="0000.00.00.000000-0"
                />
              </div>
            </div>

            {/* Toggle TV */}
            <div
              className="rounded-xl p-4 border"
              style={{ borderColor: '#e2d9c8', background: '#faf8f3' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Tv size={16} style={{ color: tvEnabled ? '#1e3f5c' : '#c8bfb2' }} />
                  <div>
                    <p className="text-sm font-semibold text-navy-800">Ativar Painel TV</p>
                    <p className="text-xs" style={{ color: '#a89e90' }}>
                      Chama o cliente na recepção
                    </p>
                  </div>
                </div>

                <Controller
                  control={control}
                  name="tv_enabled"
                  render={({ field }) => (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={field.value}
                      onClick={() => field.onChange(!field.value)}
                      className="toggle"
                      style={{ background: field.value ? '#0e1e2e' : '#e2d9c8' }}
                    >
                      <span
                        className="toggle-thumb"
                        style={{ transform: field.value ? 'translateX(20px)' : 'translateX(4px)' }}
                      />
                    </button>
                  )}
                />
              </div>

              {/* Prioridade (condicional ao tv_enabled) */}
              {tvEnabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 pt-4 border-t"
                  style={{ borderColor: '#e2d9c8' }}
                >
                  <label className="field-label mb-2">Prioridade da Chamada</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['NORMAL', 'HIGH'] as const).map((p) => (
                      <label
                        key={p}
                        className={cn(
                          'flex items-center gap-2 p-3 rounded-xl border-2',
                          'cursor-pointer transition-all text-sm font-medium',
                        )}
                        style={
                          tvPriority === p
                            ? { borderColor: '#0e1e2e', background: '#f0f4f9', color: '#0e1e2e' }
                            : { borderColor: '#e2d9c8', color: '#a89e90' }
                        }
                      >
                        <input
                          type="radio"
                          {...register('tv_priority')}
                          value={p}
                          className="sr-only"
                        />
                        <span>{p === 'NORMAL' ? '📢' : '🔔'}</span>
                        {p === 'NORMAL' ? 'Normal (1x)' : 'Alta (repete 30s)'}
                      </label>
                    ))}
                  </div>

                  {tvPriority === 'HIGH' && (
                    <div className="flex items-start gap-2 mt-3 p-3 rounded-xl bg-amber-50 text-amber-800 text-xs">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                      A chamada será repetida a cada 30s até confirmação do advogado.
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            {/* Observações */}
            <div>
              <label className="field-label">Observações (opcional)</label>
              <textarea
                {...register('notes')}
                rows={2}
                className="field-input resize-none"
                placeholder="Informações adicionais…"
              />
            </div>

            {/* Botões */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { hide(); reset(); }}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="btn-primary flex-1"
                style={{ background: accentColor }}
              >
                {mutation.isPending
                  ? <><Loader2 size={15} className="animate-spin" /> Salvando…</>
                  : editId ? 'Salvar Alterações' : 'Criar Evento'
                }
              </button>
            </div>

          </form>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}