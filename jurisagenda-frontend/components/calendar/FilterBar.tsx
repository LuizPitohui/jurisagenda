'use client';
import { Gavel, Users, Clock, FileText, ChevronDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useCalendar } from '@/store';
import { accountsApi } from '@/lib/api';
import { cn } from '@/lib/utils';

const FILTERS = [
  { type: 'AUDIENCIA', label: 'Audiências', icon: Gavel,    color: '#DC2626', bg: '#FEE2E2' },
  { type: 'REUNIAO',   label: 'Reuniões',   icon: Users,    color: '#2563EB', bg: '#DBEAFE' },
  { type: 'PRAZO',     label: 'Prazos',     icon: Clock,    color: '#CA8A04', bg: '#FEF9C3' },
  { type: 'CONTRATO',  label: 'Contratos',  icon: FileText, color: '#16A34A', bg: '#DCFCE7' },
];

export function FilterBar() {
  const { toggleFilter, hasFilter, assignedFilter, setAssigned } = useCalendar();

  const { data: usersData } = useQuery({
    queryKey: ['users-filter'],
    queryFn:  accountsApi.listSelect,
    staleTime: 60_000,
  });

  const users = usersData?.results ?? [];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {FILTERS.map(({ type, label, icon: Icon, color, bg }) => {
        const active = hasFilter(type);
        return (
          <button
            key={type}
            onClick={() => toggleFilter(type)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl',
              'text-xs font-semibold transition-all duration-150 border',
              active ? 'opacity-100' : 'opacity-40 grayscale'
            )}
            style={
              active
                ? { background: bg, color, borderColor: color + '44' }
                : { background: 'white', color: '#a89e90', borderColor: '#e2d9c8' }
            }
          >
            <Icon size={12} />
            {label}
          </button>
        );
      })}

      {/* Filtro por responsável */}
      {users.length > 0 && (
        <div className="relative">
          <select
            value={assignedFilter ?? ''}
            onChange={(e) => setAssigned(e.target.value || null)}
            className={cn(
              'appearance-none pl-3 pr-7 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer',
              assignedFilter
                ? 'bg-navy-800 text-white border-navy-800'
                : 'bg-white text-navy-500 border-cream-300'
            )}
            style={{ borderColor: assignedFilter ? undefined : '#e2d9c8' }}
          >
            <option value="">Todos</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.full_name}</option>
            ))}
          </select>
          <ChevronDown
            size={11}
            className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: assignedFilter ? 'white' : '#a89e90' }}
          />
        </div>
      )}
    </div>
  );
}
