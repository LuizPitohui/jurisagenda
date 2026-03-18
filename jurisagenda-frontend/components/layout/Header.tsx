'use client';
import { Plus } from 'lucide-react';
import { useEventModal } from '@/store';
import { usePathname } from 'next/navigation';

const TITLES: Record<string, string> = {
  '/dashboard':           'Calendário',
  '/dashboard/followups': 'Follow-ups',
  '/dashboard/clients':   'Clientes',
  '/dashboard/documents': 'Documentos',
};

export function Header() {
  const path     = usePathname();
  const { show } = useEventModal();
  const title    = TITLES[path] ?? 'JurisAgenda';

  return (
    <header
      className="h-16 flex items-center justify-between px-6 shrink-0 border-b bg-white"
      style={{ borderColor: '#e2d9c8' }}
    >
      <h1 className="font-serif text-xl font-semibold text-navy-900">
        {title}
      </h1>

      <button
        onClick={() => show()}
        className="btn-primary btn-sm gap-1.5"
      >
        <Plus size={15} />
        Novo Evento
      </button>
    </header>
  );
}