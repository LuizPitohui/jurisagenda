'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCalendar } from '@/store';
import { MONTHS } from '@/lib/utils';

export function MonthNavigator() {
  const { month, year, setMonth } = useCalendar();

  const prev = () => {
    if (month === 1) setMonth(12, year - 1);
    else             setMonth(month - 1, year);
  };

  const next = () => {
    if (month === 12) setMonth(1, year + 1);
    else              setMonth(month + 1, year);
  };

  const goToday = () => {
    const n = new Date();
    setMonth(n.getMonth() + 1, n.getFullYear());
  };

  return (
    <div className="flex items-center gap-3">
      <h2 className="font-serif text-2xl font-bold text-navy-900 min-w-[210px]">
        {MONTHS[month - 1]}{' '}
        <span className="text-navy-400 font-normal">{year}</span>
      </h2>

      <div className="flex items-center gap-1">
        <button
          onClick={prev}
          className="btn-ghost btn-sm p-2 rounded-xl"
        >
          <ChevronLeft size={16} />
        </button>

        <button
          onClick={goToday}
          className="btn-secondary btn-sm"
        >
          Hoje
        </button>

        <button
          onClick={next}
          className="btn-ghost btn-sm p-2 rounded-xl"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}