'use client';
import { useQuery } from '@tanstack/react-query';
import { CalendarGrid }    from '@/components/calendar/CalendarGrid';
import { FilterBar }       from '@/components/calendar/FilterBar';
import { MonthNavigator }  from '@/components/calendar/MonthNavigator';
import { TVQueuePanel }    from '@/components/tv/TVQueuePanel';
import { useCalendar }     from '@/store';
import { eventsApi }       from '@/lib/api';

export default function DashboardPage() {
  const { month, year, filters } = useCalendar();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['calendar', month, year],
    queryFn:  () => eventsApi.calendar(month, year),
  });

  const filtered = events.filter((e) => filters.has(e.event_type));

  return (
    <div className="flex gap-5 h-[calc(100vh-112px)]">

      {/* Área principal do calendário */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <MonthNavigator />
          <FilterBar />
        </div>

        <div className="card flex-1 overflow-hidden flex flex-col">
          <CalendarGrid
            month={month}
            year={year}
            events={filtered}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Painel lateral TV */}
      <div className="w-72 shrink-0">
        <TVQueuePanel />
      </div>

    </div>
  );
}