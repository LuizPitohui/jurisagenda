'use client';
import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, Legend, LabelList, LineChart, Line,
} from 'recharts';
import { api } from '@/lib/api';
import { EVENT_CONFIG } from '@/lib/utils';
import { TrendingUp, Calendar, Clock, Monitor, AlertTriangle, CheckCircle2, Download } from 'lucide-react';

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const TYPE_COLORS = {
  AUDIENCIA: EVENT_CONFIG.AUDIENCIA.color,
  REUNIAO:   EVENT_CONFIG.REUNIAO.color,
  PRAZO:     EVENT_CONFIG.PRAZO.color,
  CONTRATO:  EVENT_CONFIG.CONTRATO.color,
};
const TYPE_LABELS: Record<string, string> = {
  AUDIENCIA: 'Audiência',
  REUNIAO:   'Reunião',
  PRAZO:     'Prazo',
  CONTRATO:  'Contrato',
};
const TYPE_EMOJIS: Record<string, string> = {
  AUDIENCIA: '⚖',
  REUNIAO:   '◎',
  PRAZO:     '◷',
  CONTRATO:  '▤',
};
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  SCHEDULED:   { label: 'Agendado',   color: '#2563eb' },
  DONE:        { label: 'Realizado',  color: '#16a34a' },
  CANCELLED:   { label: 'Cancelado',  color: '#dc2626' },
  RESCHEDULED: { label: 'Remarcado',  color: '#ca8a04' },
};

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-[#162030] rounded-xl border p-3 shadow-lg text-xs" style={{ borderColor: '#e2d9c8' }}>
      <p className="font-semibold text-navy-800 dark:text-[#e2eaf4] mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color || p.fill }} />
          <span style={{ color: '#8a7e70' }}>{p.name}:</span>
          <span className="font-semibold text-navy-800 dark:text-[#e2eaf4]">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

const Skel = ({ h = 200 }: { h?: number }) => (
  <div className="skel rounded-xl w-full" style={{ height: h }} />
);

// Card de tipo com quantitativo exato no mês, estimativa semanal e anual
function TypeBreakdownCard({
  type, annual, monthly, weekly, color, isLoading,
}: {
  type: string; annual: number; monthly: number; weekly: number; color: string; isLoading: boolean;
}) {
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">{TYPE_EMOJIS[type]}</span>
        <span className="text-sm font-bold" style={{ color }}>{TYPE_LABELS[type]}</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <div className="skel h-6 w-16 rounded" />
          <div className="skel h-3 w-24 rounded" />
          <div className="skel h-3 w-20 rounded" />
        </div>
      ) : (
        <>
          {/* Mês atual — número exato em destaque */}
          <div>
            <p className="text-2xl font-bold text-navy-900 dark:text-[#e2eaf4] leading-none">
              {monthly}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: '#a89e90' }}>
              este mês
            </p>
          </div>

          <div className="border-t pt-2 space-y-1.5" style={{ borderColor: '#e2d9c8' }}>
            {/* Estimativa semanal */}
            <div className="flex items-center justify-between">
              <span className="text-[11px]" style={{ color: '#8a7e70' }}>Média/semana</span>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: color + '15', color }}
              >
                ~{weekly}
              </span>
            </div>
            {/* Total no ano */}
            <div className="flex items-center justify-between">
              <span className="text-[11px]" style={{ color: '#8a7e70' }}>Total no ano</span>
              <span className="text-xs font-semibold text-navy-800 dark:text-[#c8dff0]">
                {annual}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const router    = useRouter();

  const exportPDF = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const { default: jsPDF }       = await import('jspdf');
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true });
      const pdf    = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const w      = pdf.internal.pageSize.getWidth();
      const h      = (canvas.height * w) / canvas.width;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h);
      pdf.save(`relatorio-jurisagenda-${year}.pdf`);
    } catch { } finally {
      setExporting(false);
    }
  };

  const exportCSV = () => {
    if (!data) return;
    const rows: string[][] = [];

    // Cabeçalho
    rows.push([`Relatório JurisAgenda — ${year}`]);
    rows.push([]);

    // Totais
    rows.push(['Resumo Geral']);
    rows.push(['Métrica', 'Valor']);
    rows.push(['Total no ano',       String(data.total)]);
    rows.push(['Este mês',           String(data.this_month)]);
    rows.push(['Próximos agendados', String(data.upcoming)]);
    rows.push(['Prazos em 7 dias',   String(data.deadline_soon)]);
    rows.push(['Taxa de realização', `${data.completion_rate}%`]);
    rows.push([]);

    // Por tipo no mês
    rows.push(['Por Tipo — Mês Atual']);
    rows.push(['Tipo', 'Quantidade', 'Média/Semana', 'Total Ano']);
    const annualMap = Object.fromEntries((data.by_type ?? []).map((t: any) => [t.event_type, t.total]));
    for (const t of ['AUDIENCIA', 'REUNIAO', 'PRAZO', 'CONTRATO']) {
      rows.push([
        TYPE_LABELS[t],
        String(data.this_month_by_type?.[t] ?? 0),
        String(data.weekly_estimates?.[t] ?? 0),
        String(annualMap[t] ?? 0),
      ]);
    }
    rows.push([]);

    // Por mês
    rows.push(['Volume Mensal']);
    rows.push(['Mês', 'Audiência', 'Reunião', 'Prazo', 'Contrato', 'Total']);
    for (const m of (data.by_month ?? [])) {
      rows.push([
        MONTHS[m.month - 1],
        String(m.AUDIENCIA), String(m.REUNIAO),
        String(m.PRAZO),     String(m.CONTRATO),
        String(m.total),
      ]);
    }
    rows.push([]);

    // Por responsável
    rows.push(['Carga por Advogado']);
    rows.push(['Nome', 'Eventos']);
    for (const u of (data.by_user ?? [])) {
      rows.push([u.assigned_to__full_name ?? 'N/A', String(u.total)]);
    }

    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `relatorio-jurisagenda-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['reports', year],
    queryFn: () => api.get(`events/reports/?year=${year}`).then(r => r.data),
    retry: 1,
  });

  const cards = [
    { label: 'Total no ano',        value: data?.total ?? 0,                icon: Calendar,      color: '#1e3f5c', delta: null },
    { label: `Este mês`,            value: data?.this_month ?? 0,           icon: TrendingUp,    color: '#2563eb', delta: data?.this_month_delta ?? null },
    { label: 'Próximos agendados',  value: data?.upcoming ?? 0,             icon: Clock,         color: '#16a34a', delta: null },
    { label: 'Prazos em 7 dias',    value: data?.deadline_soon ?? 0,        icon: AlertTriangle, color: '#dc2626', delta: null },
    { label: 'Taxa de realização',  value: `${data?.completion_rate ?? 0}%`, icon: CheckCircle2, color: '#7c3aed', delta: null },
  ];

  // Gráfico 1: Volume mensal
  const monthlyData = (data?.by_month ?? []).map((m: any) => ({
    name: MONTHS[m.month - 1],
    Audiência: m.AUDIENCIA,
    Reunião:   m.REUNIAO,
    Prazo:     m.PRAZO,
    Contrato:  m.CONTRATO,
  }));

  // Gráfico 2: Distribuição por tipo
  const typeData = (data?.by_type ?? []).map((t: any) => ({
    name:  TYPE_LABELS[t.event_type] ?? t.event_type,
    value: t.total,
    color: TYPE_COLORS[t.event_type as keyof typeof TYPE_COLORS] ?? '#888',
  }));

  // Gráfico 3: Status
  const statusData = (data?.by_status ?? []).map((s: any) => ({
    name:  STATUS_LABELS[s.status]?.label ?? s.status,
    value: s.total,
    color: STATUS_LABELS[s.status]?.color ?? '#888',
  }));

  // Gráfico 4: Carga por responsável
  const userLoad = (data?.by_user ?? []).map((u: any) => ({
    name:  u.assigned_to__full_name?.split(' ').slice(0, 2).join(' ') ?? 'N/A',
    total: u.total,
    rate:  u.completion_rate ?? 0,
    id:    u['assigned_to__id'] ?? '',
  }));

  // Gráfico 5: Prazos 4 semanas
  const deadlines = data?.deadlines_4w ?? [];

  // Dados de breakdown por tipo
  const weekly  = data?.weekly_estimates    ?? {};
  const monthly = data?.this_month_by_type  ?? {};
  const annual  = Object.fromEntries(
    (data?.by_type ?? []).map((t: any) => [t.event_type, t.total])
  );

  return (
    <motion.div
      ref={reportRef}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold text-navy-900 dark:text-[#e2eaf4]">Relatórios</h2>
          <p className="text-sm mt-1" style={{ color: '#a89e90' }}>Análise do escritório</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportPDF}
            disabled={exporting || isLoading}
            className="btn-secondary btn-sm flex items-center gap-1.5"
          >
            <Download size={13} />
            {exporting ? 'Exportando…' : 'PDF'}
          </button>
          <button
            onClick={exportCSV}
            disabled={isLoading || !data}
            className="btn-secondary btn-sm flex items-center gap-1.5"
          >
            <Download size={13} />
            CSV
          </button>
          <div className="flex items-center gap-2 card px-4 py-2">
            <button onClick={() => setYear(y => y - 1)} className="btn-ghost btn-sm px-2">←</button>
            <span className="font-bold text-navy-800 dark:text-[#e2eaf4] w-14 text-center">{year}</span>
            <button onClick={() => setYear(y => y + 1)} className="btn-ghost btn-sm px-2">→</button>
          </div>
        </div>
      </div>

      {/* Cards de totais */}
      <div className="grid grid-cols-5 gap-4">
        {cards.map(({ label, value, icon: Icon, color, delta }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.06, ease: 'easeOut' }}
            className="card p-4"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: color + '15' }}>
              <Icon size={17} style={{ color }} />
            </div>
            <p className="text-2xl font-bold text-navy-900 dark:text-[#e2eaf4]">{isLoading ? '—' : value}</p>
            <p className="text-xs mt-0.5" style={{ color: '#a89e90' }}>{label}</p>
            {delta !== null && !isLoading && (
              <p className="text-[10px] mt-1 font-semibold" style={{ color: delta >= 0 ? '#16a34a' : '#dc2626' }}>
                {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)} vs mês anterior
              </p>
            )}
          </motion.div>
        ))}
      </div>

      {/* Breakdown por tipo — quantitativo exato + estimativas */}
      <div>
        <div className="flex items-baseline gap-2 mb-3">
          <h3 className="text-sm font-semibold text-navy-800 dark:text-[#c8dff0]">Breakdown por tipo</h3>
          <span className="text-xs" style={{ color: '#a89e90' }}>
            — quantitativo exato do mês, média semanal e total anual
          </span>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {(['AUDIENCIA', 'REUNIAO', 'PRAZO', 'CONTRATO'] as const).map((t) => (
            <TypeBreakdownCard
              key={t}
              type={t}
              annual={annual[t] ?? 0}
              monthly={monthly[t] ?? 0}
              weekly={weekly[t] ?? 0}
              color={TYPE_COLORS[t]}
              isLoading={isLoading}
            />
          ))}
        </div>
      </div>

      {/* Gráfico de linha — evolução mensal */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-navy-800 dark:text-[#c8dff0] mb-0.5">Evolução mensal</h3>
        <p className="text-xs mb-4" style={{ color: '#a89e90' }}>Tendência de cada tipo ao longo do ano</p>
        {isLoading ? <Skel h={200} /> : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#a89e90' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#a89e90' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<Tip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Line type="monotone" dataKey="Audiência" stroke={TYPE_COLORS.AUDIENCIA} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="Reunião"   stroke={TYPE_COLORS.REUNIAO}   strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="Prazo"     stroke={TYPE_COLORS.PRAZO}     strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="Contrato"  stroke={TYPE_COLORS.CONTRATO}  strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Linha 1: Volume mensal + Distribuição por tipo */}      <div className="grid grid-cols-3 gap-5">
        <div className="card p-5 col-span-2">
          <h3 className="text-sm font-semibold text-navy-800 dark:text-[#c8dff0] mb-0.5">Volume de eventos por mês</h3>
          <p className="text-xs mb-4" style={{ color: '#a89e90' }}>Quantidade de cada tipo ao longo do ano</p>
          {isLoading ? <Skel h={220} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData} barSize={8} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#a89e90' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#a89e90' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<Tip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Bar dataKey="Audiência" fill={TYPE_COLORS.AUDIENCIA} radius={[3,3,0,0]}>
                  <LabelList dataKey="Audiência" position="top" style={{ fontSize: 9, fill: '#a89e90' }} formatter={(v: number) => v > 0 ? v : ''} />
                </Bar>
                <Bar dataKey="Reunião"   fill={TYPE_COLORS.REUNIAO}   radius={[3,3,0,0]}>
                  <LabelList dataKey="Reunião" position="top" style={{ fontSize: 9, fill: '#a89e90' }} formatter={(v: number) => v > 0 ? v : ''} />
                </Bar>
                <Bar dataKey="Prazo"     fill={TYPE_COLORS.PRAZO}     radius={[3,3,0,0]}>
                  <LabelList dataKey="Prazo" position="top" style={{ fontSize: 9, fill: '#a89e90' }} formatter={(v: number) => v > 0 ? v : ''} />
                </Bar>
                <Bar dataKey="Contrato"  fill={TYPE_COLORS.CONTRATO}  radius={[3,3,0,0]}>
                  <LabelList dataKey="Contrato" position="top" style={{ fontSize: 9, fill: '#a89e90' }} formatter={(v: number) => v > 0 ? v : ''} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-navy-800 dark:text-[#c8dff0] mb-0.5">Distribuição por tipo</h3>
          <p className="text-xs mb-4" style={{ color: '#a89e90' }}>Total de cada categoria no ano</p>
          {isLoading ? <Skel h={220} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={typeData} layout="vertical" barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#a89e90' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#8a7e70' }} axisLine={false} tickLine={false} width={72} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="value" name="Total" radius={[0,4,4,0]}>
                  {typeData.map((e: any, i: number) => <Cell key={i} fill={e.color} />)}
                  <LabelList dataKey="value" position="right" style={{ fontSize: 10, fill: '#8a7e70' }} formatter={(v: number) => v > 0 ? v : ''} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Linha 2: Status + Carga por responsável + Prazos */}
      <div className="grid grid-cols-3 gap-5">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-navy-800 dark:text-[#c8dff0] mb-0.5">Status dos eventos</h3>
          <p className="text-xs mb-4" style={{ color: '#a89e90' }}>Realizados, cancelados e remarcados</p>
          {isLoading ? <Skel /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={statusData} layout="vertical" barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#a89e90' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#8a7e70' }} axisLine={false} tickLine={false} width={80} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="value" name="Total" radius={[0,4,4,0]}>
                  {statusData.map((e: any, i: number) => <Cell key={i} fill={e.color} />)}
                  <LabelList dataKey="value" position="right" style={{ fontSize: 10, fill: '#8a7e70' }} formatter={(v: number) => v > 0 ? v : ''} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-navy-800 dark:text-[#c8dff0] mb-0.5">Carga por advogado</h3>
          <p className="text-xs mb-4" style={{ color: '#a89e90' }}>Clique para ver detalhes do advogado</p>
          {isLoading ? <Skel /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={userLoad} layout="vertical" barSize={14}
                onClick={(d) => { if (d?.activePayload?.[0]?.payload?.id) router.push(`/dashboard/lawyer/${d.activePayload[0].payload.id}`); }}
                style={{ cursor: 'pointer' }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#a89e90' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#8a7e70' }} axisLine={false} tickLine={false} width={80} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="total" name="Eventos" fill="#1e3f5c" radius={[0,3,3,0]}>
                  <LabelList dataKey="total" position="right" style={{ fontSize: 10, fill: '#8a7e70' }} formatter={(v: number) => v > 0 ? v : ''} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-navy-800 dark:text-[#c8dff0] mb-0.5">Prazos próximas 4 semanas</h3>
          <p className="text-xs mb-4" style={{ color: '#a89e90' }}>Vencimentos agendados por semana</p>
          {isLoading ? <Skel /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={deadlines} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#a89e90' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#a89e90' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="total" name="Prazos" fill="#dc2626" radius={[4,4,0,0]}>
                  <LabelList dataKey="total" position="top" style={{ fontSize: 10, fill: '#a89e90' }} formatter={(v: number) => v > 0 ? v : ''} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

    </motion.div>
  );
}
