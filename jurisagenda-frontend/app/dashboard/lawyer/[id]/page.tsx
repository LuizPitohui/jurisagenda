'use client';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, CheckCircle2, XCircle, Clock, TrendingUp } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts';
import { api, accountsApi } from '@/lib/api';
import { EVENT_CONFIG, MONTHS } from '@/lib/utils';

const TYPE_COLORS = {
  AUDIENCIA: EVENT_CONFIG.AUDIENCIA.color,
  REUNIAO:   EVENT_CONFIG.REUNIAO.color,
  PRAZO:     EVENT_CONFIG.PRAZO.color,
  CONTRATO:  EVENT_CONFIG.CONTRATO.color,
};

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-[#162030] rounded-xl border p-3 shadow-lg text-xs" style={{ borderColor: '#e2d9c8' }}>
      <p className="font-semibold text-navy-800 dark:text-[#e2eaf4] mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span style={{ color: '#8a7e70' }}>{p.name}:</span>
          <span className="font-semibold text-navy-800 dark:text-[#e2eaf4]">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function LawyerDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const year     = new Date().getFullYear();

  const { data: reports, isLoading } = useQuery({
    queryKey: ['reports', year],
    queryFn:  () => api.get(`events/reports/?year=${year}`).then(r => r.data),
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn:  accountsApi.list,
  });

  const user     = usersData?.results?.find((u: any) => u.id === id);
  const userStat = reports?.by_user?.find((u: any) => u['assigned_to__id'] === id);

  // Filtra by_month para este advogado — precisaria de endpoint dedicado
  // Por ora usa os dados globais como proxy
  const monthlyData = (reports?.by_month ?? []).map((m: any) => ({
    name:      MONTHS[m.month - 1],
    Audiência: m.AUDIENCIA,
    Reunião:   m.REUNIAO,
    Prazo:     m.PRAZO,
    Contrato:  m.CONTRATO,
    Total:     m.total,
  }));

  const total      = userStat?.total ?? 0;
  const done       = userStat?.done  ?? 0;
  const rate       = userStat?.completion_rate ?? 0;
  const cancelled  = total - done;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="btn-ghost btn-sm p-2">
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white"
            style={{ background: '#1e3f5c' }}
          >
            {user?.full_name?.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase() ?? '?'}
          </div>
          <div>
            <h2 className="font-serif text-2xl font-bold text-navy-900 dark:text-[#e2eaf4]">
              {user?.full_name ?? 'Advogado'}
            </h2>
            <p className="text-sm" style={{ color: '#a89e90' }}>
              {user?.oab_number ? `OAB: ${user.oab_number} · ` : ''}{user?.email}
            </p>
          </div>
        </div>
      </div>

      {/* Cards de stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total no ano',      value: total,          icon: Calendar,      color: '#1e3f5c' },
          { label: 'Realizados',        value: done,           icon: CheckCircle2,  color: '#16a34a' },
          { label: 'Não realizados',    value: cancelled,      icon: XCircle,       color: '#dc2626' },
          { label: 'Taxa de realização',value: `${rate}%`,     icon: TrendingUp,    color: '#7c3aed' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: color + '15' }}>
              <Icon size={17} style={{ color }} />
            </div>
            <p className="text-2xl font-bold text-navy-900 dark:text-[#e2eaf4]">
              {isLoading ? '—' : value}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#a89e90' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Gráfico de linha — evolução mensal */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-navy-800 dark:text-[#c8dff0] mb-0.5">
          Evolução mensal — {year}
        </h3>
        <p className="text-xs mb-4" style={{ color: '#a89e90' }}>
          Volume de eventos por tipo ao longo do ano (dados do escritório)
        </p>
        {isLoading ? (
          <div className="skel rounded-xl w-full h-56" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#a89e90' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#a89e90' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<Tip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
              <Line type="monotone" dataKey="Audiência" stroke={TYPE_COLORS.AUDIENCIA} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Reunião"   stroke={TYPE_COLORS.REUNIAO}   strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Prazo"     stroke={TYPE_COLORS.PRAZO}     strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Contrato"  stroke={TYPE_COLORS.CONTRATO}  strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
}
