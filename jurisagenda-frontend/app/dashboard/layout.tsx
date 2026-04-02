'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useFollowUpModal } from '@/store';
import { Sidebar }          from '@/components/layout/Sidebar';
import { Header }           from '@/components/layout/Header';
import { EventModal }       from '@/components/events/EventModal';
import { EventDetailModal } from '@/components/events/EventDetailModal';
import { FollowUpModal }    from '@/components/followups/FollowUpModal';
import { useWebSocket }     from '@/hooks/useWebSocket';
import type { WSMessage }   from '@/types';
import { toast }            from 'sonner';
import { authApi, clearTokens, getRefresh } from '@/lib/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const INACTIVITY_MS = 30 * 60 * 1000; // 30 minutos

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuth, setUser, clear } = useAuth();
  const router  = useRouter();
  const enqueue = useFollowUpModal((s) => s.enqueue);
  const [checking, setChecking] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useDocumentTitle();

  const doLogout = useCallback(() => {
    const rt = getRefresh();
    if (rt) { try { authApi.logout(rt); } catch {} }
    clearTokens();
    clear();
    router.replace('/login');
  }, [clear, router]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      toast.warning('Sessão expirada por inatividade.');
      doLogout();
    }, INACTIVITY_MS);
  }, [doLogout]);

  useEffect(() => {
    const verify = async () => {
      const hasToken = getRefresh();
      if (isAuth || hasToken) {
        try {
          const user = await authApi.me();
          setUser(user);
          setChecking(false);
          return;
        } catch {}
      }
      router.replace('/login');
    };
    verify();
  }, []);

  useEffect(() => {
    if (checking) return;
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [checking, resetTimer]);

  useWebSocket('/ws/notifications/', {
    requireAuth: true,
    onMessage: (msg: WSMessage) => {
      if (msg.type === 'followup.needed') {
        toast.warning(`Follow-up: ${msg.payload.event_title}`, {
          description: 'Registre o resultado do evento.',
          action: { label: 'Registrar', onClick: () => enqueue(msg.payload) },
        });
        enqueue(msg.payload);
      }
    },
  });

  if (checking) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f6f9] dark:bg-[#0f1923]">      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden bg-[#f4f6f9] dark:bg-[#0f1923]">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <EventModal />
      <EventDetailModal />
      <FollowUpModal />
    </div>
  );
}
