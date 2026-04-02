'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  currentPage: number;
  totalPages:  number;
  onPage:      (p: number) => void;
}

export function Pagination({ currentPage, totalPages, onPage }: Props) {
  if (totalPages <= 1) return null;

  // Gera array de páginas com reticências
  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push('...');
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-center gap-1 pt-2">
      <button
        onClick={() => onPage(currentPage - 1)}
        disabled={currentPage === 1}
        className="btn-ghost btn-sm p-2 disabled:opacity-30"
      >
        <ChevronLeft size={15} />
      </button>

      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`dots-${i}`} className="px-2 text-sm" style={{ color: '#a89e90' }}>…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPage(p)}
            className={cn(
              'w-8 h-8 rounded-lg text-sm font-semibold transition-all',
              p === currentPage
                ? 'bg-navy-800 text-white dark:bg-[#1e4a73]'
                : 'btn-ghost'
            )}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onPage(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="btn-ghost btn-sm p-2 disabled:opacity-30"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  );
}
