'use client';
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Tv, AlertTriangle, Search } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useEventModal, useAuth } from '@/store';
import { eventsApi, accountsApi, eventsApi as eApi } from '@/lib/api';
import { cn } from '@/lib/utils';

const schema = z.object({
  title: z.string().min(1, 'Título obrigatório'),
  event_type: z.enum(['AUDIENCIA', 'REUNIAO', 'PRAZO', 'CONTRATO']),
  start_datetime: z.string().min(1, 'Data/hora obrigatória'),
  end_datetime: z.string().optional(),
  video_link: z.string().url('URL inválida').optional().or(z.literal('')),
  supplier_name: z.string().optional(),
  due_date: z.string().optional(),
  client: z.string().optional(),
  process_number: z.string().optional(),
  assigned_to: z.string().min(1, 'Responsável obrigatório'),
  tv_enabled: z.boolean(),
  tv_priority: z.enum(['NORMAL', 'HIGH']),
  tv_advance_value: z.coerce.number().min(0).default(0), // O valor numérico (0, 15, 2, etc)
  tv_advance_unit:  z.enum(['MINUTES', 'HOURS', 'DAYS']).default('MINUTES'), // A unidade de tempo
  notes: z.string().optional(),
}).superRefine((d, ctx) => {
  if (d.event_type === 'AUDIENCIA') {
    if (!d.end_datetime)
      ctx.addIssue({ code: 'custom', path: ['end_datetime'], message: 'Obrigatório para audiências' });
    if (!d.video_link)
      ctx.addIssue({ code: 'custom', path: ['video_link'], message: 'Obrigatório para audiências' });
  }
  if (d.event_type === 'CONTRATO') {
    if (!d.supplier_name)
      ctx.addIssue({ code: 'custom', path: ['supplier_name'], message: 'Obrigatório para contratos' });
    if (!d.due_date)
      ctx.addIssue({ code: 'custom', path: ['due_date'], message: 'Obrigatório para contratos' });
  }
  if (d.event_type === 'PRAZO' && !d.due_date)
    ctx.addIssue({ code: 'custom', path: ['due_date'], message: 'Obrigatório para prazos' });
});

type Form = z.infer<typeof schema>;

const TYPE_COLORS = {
  AUDIENCIA: '#DC2626',
  REUNIAO: '#2563EB',
  PRAZO: '#CA8A04',
  CONTRATO: '#16A34A',
};

const TYPE_LABELS = {
  AUDIENCIA: 'Audiência',
  REUNIAO: 'Reunião',
  PRAZO: 'Prazo',
  CONTRATO: 'Contrato',
};

const TYPE_EMOJIS = {
  AUDIENCIA: '⚖',
  REUNIAO:   '◎',
  PRAZO:     '◷',
  CONTRATO:  '▤',
};

function ProcessNumberInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [query, setQuery]   = useState(value);
  const [open,  setOpen]    = useState(false);
  const ref                 = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ['process-search', query],
    queryFn:  () => eventsApi.list({ search: query, page_size: 6 }),
    enabled:  query.length >= 4,
    staleTime: 10_000,
  });

  // Extrai números de processo únicos dos eventos encontrados
  const suggestions = [...new Set(
    (data?.results ?? [])
      .map((e: any) => e.process_number)
      .filter((p: string) => p && p.toLowerCase().includes(query.toLowerCase()))
  )].slice(0, 5) as string[];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#a89e90' }} />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
          onFocus={() => query.length >= 4 && setOpen(true)}
          className="field-input pl-8"
          placeholder="0000.00.00.000000-0"
        />
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#162030] rounded-xl border border-[#e2d9c8] dark:border-[#243550] shadow-lg overflow-hidden">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { onChange(s); setQuery(s); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-[#f0f4f9] dark:hover:bg-[#1a2840] text-navy-800 dark:text-[#e2eaf4] font-mono"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function EventModal() {  const { open, hide, editId, preDate } = useEventModal();
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => accountsApi.listSelect(),
    enabled: open,
  });

  const { data: editing } = useQuery({
    queryKey: ['event', editId],
    queryFn: () => eventsApi.get(editId!),
    enabled: !!editId && open,
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
    resolver: zodResolver(schema),
    defaultValues: {
      event_type:  'AUDIENCIA',
      tv_enabled:  false,
      tv_priority: 'NORMAL',
      tv_advance_value: 0,
      tv_advance_unit: 'MINUTES',
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
        start_datetime:   editing.start_datetime?.slice(0, 16) ?? '',
        end_datetime:     editing.end_datetime?.slice(0, 16)   ?? '',
        due_date:         editing.due_date    ?? '',
        client:           editing.client      ?? '',
        assigned_to:      editing.assigned_to,
        tv_advance_value: editing.tv_advance_value ?? 0,
        tv_advance_unit:  editing.tv_advance_unit ?? 'MINUTES',
      });
    }
  }, [editing, reset]);

  const mutation = useMutation({
    mutationFn: (payload: any) => editId
      ? eventsApi.update(editId, payload)
      : eventsApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar'] });
      qc.invalidateQueries({ queryKey: ['events'] });
      toast.success(editId ? 'Evento atualizado!' : 'Evento criado com sucesso!');
      hide();
      reset();
    },
    onError: (error) => {
      console.error("Erro na API:", error); // Adicionado para facilitar debug futuro no Docker
      toast.error('Erro ao salvar o evento. Verifique os campos.');
    },
  });

  const onSubmit = (data: Form) => {
    const isAudienciaOrReuniao = data.event_type === 'AUDIENCIA' || data.event_type === 'REUNIAO';
    const isContrato = data.event_type === 'CONTRATO';
    const isPrazo = data.event_type === 'PRAZO';

    const payload = {
      ...data,
      end_datetime: (isAudienciaOrReuniao && data.end_datetime) ? data.end_datetime : null,
      supplier_name: (isContrato && data.supplier_name) ? data.supplier_name : "",
      due_date: ((isContrato || isPrazo) && data.due_date) ? data.due_date : null,
      client: data.client ? data.client : null,
      video_link: data.video_link || "",
    };

    const recurrence = (data as any).recurrence;

    if (!editId && recurrence) {
      // Cria 4 ocorrências
      const promises = Array.from({ length: 4 }, (_, i) => {
        const start = new Date(payload.start_datetime);
        const end   = payload.end_datetime ? new Date(payload.end_datetime) : null;
        const days  = recurrence === 'weekly' ? 7 : recurrence === 'biweekly' ? 14 : 30;
        start.setDate(start.getDate() + days * (i + 1));
        if (end) end.setDate(end.getDate() + days * (i + 1));
        return eventsApi.create({
          ...payload,
          start_datetime: start.toISOString().slice(0, 16),
          end_datetime:   end ? end.toISOString().slice(0, 16) : null,
        });
      });
      mutation.mutate(payload);
      Promise.all(promises).then(() => {
        qc.invalidateQueries({ queryKey: ['calendar'] });
      });
    } else {
      mutation.mutate(payload);
    }
  };

  // 🛠️ VARIÁVEL SHOW RESTAURADA: Ela controla o que aparece na tela
  const show = {
    end: eventType === 'AUDIENCIA' || eventType === 'REUNIAO',
    video: eventType === 'AUDIENCIA' || eventType === 'REUNIAO',
    supplier: eventType === 'CONTRATO',
    due: eventType === 'CONTRATO' || eventType === 'PRAZO',
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
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm"
          onClick={() => { hide(); reset(); }}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="relative bg-white dark:bg-[#162030] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto z-10"
          style={{ boxShadow: 'var(--shadow-modal)' }}
        >
          {/* Barra colorida por tipo */}
          <div
            className="h-1 rounded-t-2xl transition-colors duration-300"
            style={{ background: accentColor }}
          />

          {/* Cabeçalho */}
          <div
            className="flex items-center justify-between px-6 py-5 border-b border-[#e2d9c8] dark:border-navy-700"
          >
            <div>
              <h3 className="font-serif text-xl font-bold text-navy-900 dark:text-[#e2eaf4]">
                {editId ? 'Editar Evento' : 'Novo Evento'}
              </h3>
              <p className="text-xs mt-0.5 text-[#a89e90] dark:text-[#4a6a88]">
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
                      eventType === t
                        ? ''
                        : 'bg-[#f8fafc] dark:bg-[#1a2840] text-[#a89e90] dark:text-[#4a6a88] border-transparent'
                    )}
                    style={
                      eventType === t
                        ? { background: TYPE_COLORS[t] + '15', color: TYPE_COLORS[t], borderColor: TYPE_COLORS[t] + '66' }
                        : undefined
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
                    : eventType === 'REUNIAO' ? 'Ex: Reunião com cliente sobre contrato'
                      : eventType === 'PRAZO' ? 'Ex: Prazo recursal – Proc. 5678'
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
                <ProcessNumberInput
                  value={watch('process_number') ?? ''}
                  onChange={(v) => setValue('process_number', v)}
                />
              </div>
            </div>

            {/* Toggle TV */}
            <div className="rounded-xl p-4 border border-[#e2d9c8] dark:border-[#243550] bg-[#faf8f3] dark:bg-[#1a2840]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tv size={16} className="text-[#4a7fa8]" />
                  <div>
                    <p className="text-sm font-semibold text-navy-900 dark:text-[#e2eaf4]">Ativar Painel TV</p>
                    <p className="text-xs text-[#a89e90] dark:text-[#4a6a88]">
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
                      style={{ background: field.value ? '#1e4a73' : '#243550' }}
                    >
                      <span
                        className="toggle-thumb"
                        style={{ transform: field.value ? 'translateX(20px)' : 'translateX(4px)' }}
                      />
                    </button>
                  )}
                />
              </div>

              {/* Prioridade e Antecedência (condicional ao tv_enabled) */}
              {tvEnabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 pt-4 border-t border-[#e2d9c8] dark:border-[#243550] space-y-4"
                >
                  <div>
                    <label className="field-label mb-2">Prioridade da Chamada</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['NORMAL', 'HIGH'] as const).map((p) => (
                        <label
                          key={p}
                          className={cn(
                            'flex items-center gap-2 p-3 rounded-xl border-2',
                            'cursor-pointer transition-all text-sm font-medium',
                            tvPriority === p
                              ? 'border-[#1e4a73] dark:border-[#4a7fa8] bg-[#f0f4f9] dark:bg-[#1e2e45] text-[#0e1e2e] dark:text-[#e2eaf4]'
                              : 'border-[#e2d9c8] dark:border-[#243550] text-[#a89e90] dark:text-[#4a6a88]'
                          )}
                        >
                          <input
                            type="radio"
                            {...register('tv_priority')}
                            value={p}
                            className="sr-only"
                          />
                          <span>{p === 'NORMAL' ? '○' : '●'}</span>
                          {p === 'NORMAL' ? 'Normal (Toca 1x)' : 'Alta (Insistente)'}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Antecedência Dinâmica */}
                  <div>
                    <label className="field-label">Lembrar com antecedência de:</label>
                    <div className="flex gap-3 items-center">
                      <input
                        type="number"
                        min="0"
                        {...register('tv_advance_value')}
                        className={cn('field-input w-24 text-center', errors.tv_advance_value && 'error')}
                        placeholder="Ex: 15"
                      />
                      <select
                        {...register('tv_advance_unit')}
                        className="field-input flex-1"
                      >
                        <option value="MINUTES">Minutos</option>
                        <option value="HOURS">Horas</option>
                        <option value="DAYS">Dias</option>
                      </select>
                    </div>
                    {watch('tv_advance_value') == 0 && (
                      <p className="text-xs text-amber-500 dark:text-amber-400 mt-1">A chamada será feita no exato horário do evento.</p>
                    )}
                  </div>

                  {tvPriority === 'HIGH' && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-xs">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                      A chamada repetirá a cada 30 segundos até que alguém confirme a ciência no painel.
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            {/* Recorrência */}
            {!editId && (
              <div className="rounded-xl p-4 border border-[#e2d9c8] dark:border-[#243550] bg-[#faf8f3] dark:bg-[#1a2840]">
                <label className="field-label mb-2">Repetir evento</label>
                <select {...register('recurrence' as any)} className="field-input">
                  <option value="">Não repetir</option>
                  <option value="weekly">Semanalmente</option>
                  <option value="biweekly">A cada 2 semanas</option>
                  <option value="monthly">Mensalmente</option>
                </select>
                <p className="text-xs mt-2" style={{ color: '#a89e90' }}>
                  Cria cópias do evento nas próximas 4 ocorrências automaticamente.
                </p>
              </div>
            )}

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