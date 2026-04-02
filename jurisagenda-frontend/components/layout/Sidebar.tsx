'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Scale, Calendar, FileText, Monitor, LogOut, ChevronRight, Settings, BarChart2 } from 'lucide-react';
import { useAuth } from '@/store';
import { authApi, clearTokens, getRefresh } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const NAV = [
  { href: '/dashboard',           icon: Calendar,  label: 'Calendário'    },
  { href: '/dashboard/documents', icon: FileText,  label: 'Documentos'    },
  { href: '/dashboard/reports',   icon: BarChart2, label: 'Relatórios'    },
  { href: '/dashboard/settings',  icon: Settings,  label: 'Configurações' },
];

export function Sidebar() {
  const path   = usePathname();
  const router = useRouter();
  const { user, clear, avatarUrl } = useAuth();

  const initials = user?.full_name
    ?.split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase() ?? '??';

  const logout = async () => {
    const rt = getRefresh();
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
      style={{ width: 232, background: 'white', borderColor: '#e1e8f0' }}
    >
      {/* Logo */}
      <div className="p-5 border-b" style={{ borderColor: '#e1e8f0' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #163352, #0b1929)' }}
          >
            <Scale size={17} className="text-white" />
          </div>
          <div>
            <p className="font-serif font-bold text-navy-900 text-[15px] leading-tight">
              JurisAgenda
            </p>
            <p className="text-[10px] uppercase tracking-widest" style={{ color: '#c9a84c' }}>
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

        {NAV.map(({ href, icon: Icon, label }, i) => {
          const active =
            href === '/dashboard'
              ? path === '/dashboard' || path === '/dashboard/'
              : path.startsWith(href);

          return (
            <motion.div
              key={href}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: i * 0.05 }}
            >
              <Link
                href={href}
                className={cn('nav-link', active && 'active')}
              >
                <Icon size={16} className="shrink-0" />
                <span className="flex-1">{label}</span>
                {active && <ChevronRight size={12} className="opacity-50" />}
              </Link>
            </motion.div>
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
      <div className="p-3 border-t dark:border-navy-800" style={{ borderColor: '#e2d9c8' }}>
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-[#faf8f3] dark:bg-[#1a2840]">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white overflow-hidden"
            style={{ background: '#1e3f5c' }}
          >
            {avatarUrl
              ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              : initials
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-navy-800 dark:text-blue-200 truncate">
              {user?.full_name}
            </p>
            <p className="text-[10px] truncate dark:text-blue-400" style={{ color: '#a89e90' }}>
              {user?.role}
            </p>
          </div>
          <button
            onClick={logout}
            title="Sair"
            className="transition-colors p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
            style={{ color: '#c8bfb2' }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}