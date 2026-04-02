import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { eventsApi } from '@/lib/api';
import { isSameDay, parseISO } from 'date-fns';

export function useDocumentTitle() {
  const today = new Date();

  const { data: events = [] } = useQuery({
    queryKey: ['calendar', today.getMonth() + 1, today.getFullYear()],
    queryFn:  () => eventsApi.calendar(today.getMonth() + 1, today.getFullYear()),
    staleTime: 5 * 60_000,
  });

  const todayEvents = events.filter(
    (e) => isSameDay(parseISO(e.start_datetime), today) && e.status === 'SCHEDULED'
  );

  const deadlines = todayEvents.filter(
    (e) => e.event_type === 'PRAZO' || e.event_type === 'CONTRATO'
  );

  useEffect(() => {
    const count = todayEvents.length;
    const dl    = deadlines.length;

    if (dl > 0) {
      document.title = `⚠ ${dl} prazo${dl > 1 ? 's' : ''} hoje · JurisAgenda`;
    } else if (count > 0) {
      document.title = `${count} evento${count > 1 ? 's' : ''} hoje · JurisAgenda`;
    } else {
      document.title = 'JurisAgenda';
    }

    return () => { document.title = 'JurisAgenda'; };
  }, [todayEvents.length, deadlines.length]);
}
