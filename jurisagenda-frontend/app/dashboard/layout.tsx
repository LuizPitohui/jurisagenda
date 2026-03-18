'use client';
import { useEffect } from 'react';
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuth } = useAuth();
  const router     = useRouter();
  const enqueue    = useFollowUpModal((s) => s.enqueue);

  // Redireciona para login se não autenticado
  useEffect(() => {
    if (!isAuth) router.replace('/login');
  }, [isAuth, router]);

  // WebSocket de notificações pessoais
  useWebSocket('/ws/notifications/', {
    requireAuth: true,
    onMessage: (msg: WSMessage) => {
      if (msg.type === 'followup.needed') {
        toast.warning(`Follow-up: ${msg.payload.event_title}`, {
          description: 'Registre o resultado do evento.',
          action: {
            label:   'Registrar',
            onClick: () => enqueue(msg.payload),
          },
        });
        enqueue(msg.payload);
      }
    },
  });

  if (!isAuth) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-cream-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      {/* Modais globais */}
      <EventModal />
      <EventDetailModal />
      <FollowUpModal />
    </div>
  );
}