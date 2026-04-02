'use client';
import { Plus, Moon, Sun, Wifi, WifiOff } from 'lucide-react';
import { useEventModal, useTheme, useCalendar } from '@/store';
import { usePathname } from 'next/navigation';
import { DeadlineNotifications } from './DeadlineNotifications';
import { GlobalSearch } from './GlobalSearch';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useWebSocket } from '@/hooks/useWebSocket';

const TITLES: Record<string, string> = {
  '/dashboard':           'Calendário',
  '/dashboard/documents': 'Documentos',
  '/dashboard/reports':   'Relatórios',
  '/dashboard/settings':  'Configurações',
};

function useCalendarNav() {
  const { month, year, setMonth } = useCalendar();
  return {
    prev: () => month === 1  ? setMonth(12, year - 1) : setMonth(month - 1, year),
    next: () => month === 12 ? setMonth(1,  year + 1) : setMonth(month + 1, year),
  };
}

export function Header() {
  const path     = usePathname();
  const { show } = useEventModal();
  const { dark, toggle } = useTheme();
  const { prev: prevMonth, next: nextMonth } = useCalendarNav();
  const title    = TITLES[path] ?? 'JurisAgenda';
  const { connected } = useWebSocket('/ws/notifications/', { requireAuth: true });

  useKeyboardShortcuts({ onNewEvent: () => show(), onPrevMonth: prevMonth, onNextMonth: nextMonth });

  return (
    <header
      className="h-16 flex items-center justify-between px-6 shrink-0 border-b bg-white dark:bg-navy-900 dark:border-navy-800"
      style={{ borderColor: '#e1e8f0' }}
    >
      <h1 className="font-serif text-xl font-semibold text-navy-900 dark:text-white">
        {title}
      </h1>

      <div className="flex items-center gap-2">
        <GlobalSearch />
        <DeadlineNotifications />

        {/* Indicador WebSocket */}
        <div
          title={connected ? 'Conectado em tempo real' : 'Reconectando…'}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold"
          style={connected
            ? { background: '#dcfce7', color: '#16a34a' }
            : { background: '#fef9c3', color: '#ca8a04' }
          }
        >
          {connected
            ? <Wifi size={11} />
            : <WifiOff size={11} />
          }
          <span className="hidden lg:block">{connected ? 'Online' : 'Offline'}</span>
        </div>

        <button
          onClick={toggle}
          className="p-2 rounded-xl transition-colors hover:bg-slate-100 dark:hover:bg-navy-800"
          title={dark ? 'Modo claro' : 'Modo escuro'}
          style={{ color: '#6b8099' }}
        >
          {dark ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <button onClick={() => show()} className="btn-primary btn-sm gap-1.5">
          <Plus size={15} />
          Novo Evento
          <kbd className="hidden lg:block text-[10px] opacity-60 font-mono ml-1">N</kbd>
        </button>
      </div>
    </header>
  );
}
