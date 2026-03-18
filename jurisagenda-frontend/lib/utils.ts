import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO, isToday, isTomorrow, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { EventType } from '@/types';

// ── Tailwind class merger ─────────────────────────────────────────────
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

// ── Formatadores de data ──────────────────────────────────────────────
export const fmtDate = (d: string | Date, f = 'dd/MM/yyyy') =>
  format(typeof d === 'string' ? parseISO(d) : d, f, { locale: ptBR });

export const fmtDateTime = (d: string | Date) =>
  format(typeof d === 'string' ? parseISO(d) : d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

export const fmtTime = (d: string | Date) =>
  format(typeof d === 'string' ? parseISO(d) : d, 'HH:mm', { locale: ptBR });

export const fmtRelative = (d: string | Date) => {
  const dt = typeof d === 'string' ? parseISO(d) : d;
  if (isToday(dt))    return `Hoje, ${format(dt, 'HH:mm')}`;
  if (isTomorrow(dt)) return `Amanhã, ${format(dt, 'HH:mm')}`;
  return formatDistanceToNow(dt, { addSuffix: true, locale: ptBR });
};

// ── Configuração visual por tipo de evento ────────────────────────────
export const EVENT_CONFIG: Record<EventType, {
  label:  string;
  color:  string;
  bg:     string;
  border: string;
}> = {
  AUDIENCIA: { label: 'Audiência', color: '#DC2626', bg: '#FEE2E2', border: '#DC2626' },
  REUNIAO:   { label: 'Reunião',   color: '#2563EB', bg: '#DBEAFE', border: '#2563EB' },
  PRAZO:     { label: 'Prazo',     color: '#CA8A04', bg: '#FEF9C3', border: '#CA8A04' },
  CONTRATO:  { label: 'Contrato',  color: '#16A34A', bg: '#DCFCE7', border: '#16A34A' },
};

export const STATUS_CONFIG = {
  SCHEDULED:   { label: 'Agendado',  cls: 'bg-blue-50 text-blue-700 border-blue-200'     },
  DONE:        { label: 'Realizado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CANCELLED:   { label: 'Cancelado', cls: 'bg-red-50 text-red-700 border-red-200'         },
  RESCHEDULED: { label: 'Remarcado', cls: 'bg-amber-50 text-amber-700 border-amber-200'   },
};

// ── Formatador de tamanho de arquivo ─────────────────────────────────
export const fmtFileSize = (bytes: number) => {
  if (bytes < 1024)             return `${bytes} B`;
  if (bytes < 1024 * 1024)      return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ── Nomes dos meses e dias da semana ─────────────────────────────────
export const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

export const WEEKDAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

// ── Gerador da grade do calendário ───────────────────────────────────
export function buildCalendarGrid(year: number, month: number) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay    = new Date(year, month - 1, 1).getDay();
  const daysInPrev  = new Date(year, month - 1, 0).getDate();

  const cells: {
    day:   number;
    which: 'prev' | 'curr' | 'next';
    date:  Date;
  }[] = [];

  // Dias do mês anterior (preenchimento)
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrev - i;
    const m = month === 1 ? 12 : month - 1;
    const y = month === 1 ? year - 1 : year;
    cells.push({ day: d, which: 'prev', date: new Date(y, m - 1, d) });
  }

  // Dias do mês atual
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ day: d, which: 'curr', date: new Date(year, month - 1, d) });

  // Dias do próximo mês (preenchimento)
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const m = month === 12 ? 1 : month + 1;
    const y = month === 12 ? year + 1 : year;
    cells.push({ day: d, which: 'next', date: new Date(y, m - 1, d) });
  }

  return cells;
}