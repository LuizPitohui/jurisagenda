'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, Legend,
} from 'recharts';
import { api } from '@/lib/api';
import { EVENT_CONFIG } from '@/lib/utils';
import { TrendingUp, Calendar, Clock, Monitor, AlertTriangle, CheckCircle2 } from 'lucide-react';

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const TYPE_COLORS = {
  AUDIENCIA: EVENT_CONFIG.AUDIENCIA.color,
  REUNIAO:   EVENT_CONFIG.REUNIAO.color,
  PRAZO:     EVENT_CONFIG.PRAZO.color,
  CONTRATO:  EVENT_CONFIG.CONTRATO.color,
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
    <div className="bg-white rounded-xl border p-3 shadow-lg text-xs" style={{ borderColor: '#e2d9c8' }}>
      <p className="font-semibold text-navy-800 mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color || p.fill }} />
          <span style={{ color: '#8a7e70' }}>{p.name}:</span>
          <span className="font-semibold text-navy-800">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

const Skel = ({ h = 200 }: { h?: number }) => (
  <div className="skel rounded-xl w-full" style={{ height: h }} />
);

export default function ReportsPage() {
  const [year, setYear] = useState(new Date().getFullYear());

  const { data, isLoading } = useQuery({
    queryKey: ['reports', year],
    queryFn: () => api.get(`events/reports/?year=${year}`).then(r => r.data),
    retry: 1,
  });

  const cards = [
    { label: 'Total no ano',        value: data?.total ?? 0,            icon: Calendar,      color: '#1e3f5c' },
    { label: 'Este mês',            value: data?.this_month ?? 0,       icon: TrendingUp,    color: '#2563eb' },
    { label: 'Próximos agendados',  value: data?.upcoming ?? 0,         icon: Clock,         color: '#16a34a' },
    { label: 'Prazos em 7 dias',    value: data?.deadline_soon ?? 0,    icon: AlertTriangle, color: '#dc2626' },
    { label: 'Taxa de realização',  value: `${data?.completion_rate ?? 0}%`, icon: CheckCircle2, color: '#7c3aed' },
  ];

  // Gráfico 1: Volume mensal de eventos
  const monthlyData = (data?.by_month ?? []).map((m: any) => ({
    name: MONTHS[m.month - 1],
    Audiência: m.AUDIENCIA,
    Reunião:   m.REUNIAO,
    Prazo:     m.PRAZO,
    Contrato:  m.CONTRATO,
  }));

  // Gráfico 2: Distribuição por tipo (pizza)
  const typeData = (data?.by_type ?? []).map((t: any) => ({
    name:  EVENT_CONFIG[t.event_type as keyof typeof EVENT_CONFIG]?.label ?? t.event_type,
    value: t.total,
    color: TYPE_COLORS[t.event_type as keyof typeof TYPE_COLORS] ?? '#888',
  }));

  // Gráfico 3: Status dos eventos
  const statusData = (data?.by_status ?? []).map((s: any) => ({
    name:  STATUS_LABELS[s.status]?.label ?? s.status,
    value: s.total,
    color: STATUS_LABELS[s.status]?.color ?? '#888',
  }));

  // Gráfico 4: Carga por responsável
  const userLoad = (data?.by_user ?? []).map((u: any) => ({
    name:  u.assigned_to__full_name?.split(' ').slice(0, 2).join(' ') ?? 'N/A',
    total: u.total,
  }));

  // Gráfico 5: Prazos próximas 4 semanas
  const deadlines = data?.deadlines_4w ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-6"
    >

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold text-navy-900">Relatórios</h2>
          <p className="text-sm mt-1" style={{ color: '#a89e90' }}>Análise do escritório</p>
        </div>
        <div className="flex items-center gap-2 card px-4 py-2">
          <button onClick={() => setYear(y => y - 1)} className="btn-ghost btn-sm px-2">←</button>
          <span className="font-bold text-navy-800 w-14 text-center">{year}</span>
          <button onClick={() => setYear(y => y + 1)} className="btn-ghost btn-sm px-2">→</button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-5 gap-4">
        {cards.map(({ label, value, icon: Icon, color }, i) => (
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
            <p className="text-2xl font-bold text-navy-900">{isLoading ? '—' : value}</p>
            <p className="text-xs mt-0.5" style={{ color: '#a89e90' }}>{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Linha 1: Volume mensal + Distribuição por tipo */}
      <div className="grid grid-cols-3 gap-5">
        <div className="card p-5 col-span-2">
          <h3 className="text-sm font-semibold text-navy-800 mb-0.5">Volume de eventos por mês</h3>
          <p className="text-xs mb-4" style={{ color: '#a89e90' }}>Quantidade de cada tipo ao longo do ano</p>
          {isLoading ? <Skel h={220} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData} barSize={8} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#a89e90' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#a89e90' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<Tip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Bar dataKey="Audiência" fill={TYPE_COLORS.AUDIENCIA} radius={[3,3,0,0]} />
                <Bar dataKey="Reunião"   fill={TYPE_COLORS.REUNIAO}   radius={[3,3,0,0]} />
                <Bar dataKey="Prazo"     fill={TYPE_COLORS.PRAZO}     radius={[3,3,0,0]} />
                <Bar dataKey="Contrato"  fill={TYPE_COLORS.CONTRATO}  radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-navy-800 mb-0.5">Distribuição por tipo</h3>
          <p className="text-xs mb-4" style={{ color: '#a89e90' }}>Quantidade de cada categoria no ano</p>
          {isLoading ? <Skel h={220} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={typeData} layout="vertical" barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#a89e90' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#8a7e70' }} axisLine={false} tickLine={false} width={72} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="value" name="Total" radius={[0,4,4,0]}>
                  {typeData.map((e: any, i: number) => <Cell key={i} fill={e.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Linha 2: Status + Carga por responsável + Prazos */}
      <div className="grid grid-cols-3 gap-5">

        {/* Status dos eventos */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-navy-800 mb-0.5">Status dos eventos</h3>
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
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Carga por responsável */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-navy-800 mb-0.5">Carga por advogado</h3>
          <p className="text-xs mb-4" style={{ color: '#a89e90' }}>Eventos atribuídos por responsável</p>
          {isLoading ? <Skel /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={userLoad} layout="vertical" barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#a89e90' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#8a7e70' }} axisLine={false} tickLine={false} width={80} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="total" name="Eventos" fill="#1e3f5c" radius={[0,3,3,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Prazos próximas 4 semanas */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-navy-800 mb-0.5">Prazos próximas 4 semanas</h3>
          <p className="text-xs mb-4" style={{ color: '#a89e90' }}>Vencimentos agendados por semana</p>
          {isLoading ? <Skel /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={deadlines} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#a89e90' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#a89e90' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="total" name="Prazos" fill="#dc2626" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

    </motion.div>
  );
}
