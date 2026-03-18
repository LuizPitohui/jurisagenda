'use client';
import { Gavel, Users, Clock, FileText } from 'lucide-react';
import { useCalendar } from '@/store';
import { cn } from '@/lib/utils';

const FILTERS = [
  { type: 'AUDIENCIA', label: 'Audiências', icon: Gavel,    color: '#DC2626', bg: '#FEE2E2' },
  { type: 'REUNIAO',   label: 'Reuniões',   icon: Users,    color: '#2563EB', bg: '#DBEAFE' },
  { type: 'PRAZO',     label: 'Prazos',     icon: Clock,    color: '#CA8A04', bg: '#FEF9C3' },
  { type: 'CONTRATO',  label: 'Contratos',  icon: FileText, color: '#16A34A', bg: '#DCFCE7' },
];

export function FilterBar() {
  const { toggleFilter, hasFilter } = useCalendar();

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
                ? { background: bg,      color, borderColor: color + '44' }
                : { background: 'white', color: '#a89e90', borderColor: '#e2d9c8' }
            }
          >
            <Icon size={12} />
            {label}
          </button>
        );
      })}
    </div>
  );
}