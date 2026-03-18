'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Scale, Calendar, Users, FileText, Bell, Monitor, LogOut, ChevronRight } from 'lucide-react';
import { useAuth } from '@/store';
import { authApi, clearTokens } from '@/lib/api';
import Cookies from 'js-cookie';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const NAV = [
  { href: '/dashboard',           icon: Calendar, label: 'Calendário' },
  { href: '/dashboard/followups', icon: Bell,     label: 'Follow-ups' },
  { href: '/dashboard/clients',   icon: Users,    label: 'Clientes'   },
  { href: '/dashboard/documents', icon: FileText, label: 'Documentos' },
];

export function Sidebar() {
  const path   = usePathname();
  const router = useRouter();
  const { user, clear } = useAuth();

  const initials = user?.full_name
    ?.split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase() ?? '??';

  const logout = async () => {
    const rt = Cookies.get('refresh');
    if (rt) {
      try { await authApi.logout(rt); } catch {}
    }
    clearTokens();
    clear();
    toast.success('Sessão encerrada.');
    router.replace('/login');
  };

  return (
    <aside
      className="h-full flex flex-col shrink-0 border-r"
      style={{ width: 228, background: 'white', borderColor: '#e2d9c8' }}
    >
      {/* Logo */}
      <div className="p-5 border-b" style={{ borderColor: '#e2d9c8' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: '#0e1e2e' }}
          >
            <Scale size={17} className="text-white" />
          </div>
          <div>
            <p className="font-serif font-bold text-navy-900 text-[15px] leading-tight">
              JurisAgenda
            </p>
            <p className="text-[10px] uppercase tracking-widest" style={{ color: '#a89e90' }}>
              Sistema Jurídico
            </p>
          </div>
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        <p
          className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest"
          style={{ color: '#c8bfb2' }}
        >
          Principal
        </p>

        {NAV.map(({ href, icon: Icon, label }) => {
          const active =
            href === '/dashboard'
              ? path === '/dashboard'
              : path.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={cn('nav-link', active && 'active')}
            >
              <Icon size={16} className="shrink-0" />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={12} className="opacity-50" />}
            </Link>
          );
        })}

        <div className="my-3 border-t" style={{ borderColor: '#e2d9c8' }} />

        <p
          className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest"
          style={{ color: '#c8bfb2' }}
        >
          Ferramentas
        </p>

        <Link href="/tv" target="_blank" className="nav-link">
          <Monitor size={16} className="shrink-0" />
          <span className="flex-1">Painel TV</span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full"
            style={{ background: '#f3ecdb', color: '#8a7e70' }}
          >
            PÚBLICO
          </span>
        </Link>
      </nav>

      {/* Rodapé com usuário */}
      <div className="p-3 border-t" style={{ borderColor: '#e2d9c8' }}>
        <div
          className="flex items-center gap-3 px-2 py-2 rounded-xl"
          style={{ background: '#faf8f3' }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white"
            style={{ background: '#1e3f5c' }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-navy-800 truncate">
              {user?.full_name}
            </p>
            <p className="text-[10px] truncate" style={{ color: '#a89e90' }}>
              {user?.role}
            </p>
          </div>
          <button
            onClick={logout}
            title="Sair"
            className="transition-colors p-1 rounded-lg hover:bg-red-50"
            style={{ color: '#c8bfb2' }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}