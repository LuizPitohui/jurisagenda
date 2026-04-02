import { useEffect } from 'react';

interface Shortcuts {
  onNewEvent?: () => void;
  onClose?: () => void;
  onSearch?: () => void;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
}

export function useKeyboardShortcuts({ onNewEvent, onClose, onSearch, onPrevMonth, onNextMonth }: Shortcuts) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (e.key === 'Escape') {
        onClose?.();
        return;
      }

      if (isInput) return;

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        onNewEvent?.();
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onSearch?.();
      }

      if (e.key === 'ArrowLeft' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onPrevMonth?.();
      }

      if (e.key === 'ArrowRight' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onNextMonth?.();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onNewEvent, onClose, onSearch, onPrevMonth, onNextMonth]);
}
