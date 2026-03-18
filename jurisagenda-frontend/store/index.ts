import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, CalendarEvent, FollowUpNeededPayload, TVCallPayload } from '@/types';

// ── Auth ──────────────────────────────────────────────────────────────
interface AuthStore {
  user:    User | null;
  isAuth:  boolean;
  setUser: (u: User) => void;
  clear:   () => void;
}

export const useAuth = create<AuthStore>()(
  persist(
    (set) => ({
      user:    null,
      isAuth:  false,
      setUser: (u) => set({ user: u, isAuth: true }),
      clear:   ()  => set({ user: null, isAuth: false }),
    }),
    {
      name: 'juris-auth',
      partialize: (s) => ({ user: s.user, isAuth: s.isAuth }),
    }
  )
);

// ── Modal de criação/edição de evento ─────────────────────────────────
interface EventModalStore {
  open:    boolean;
  editId:  string | null;
  preDate: Date | null;
  show:    (opts?: { editId?: string; date?: Date }) => void;
  hide:    () => void;
}

export const useEventModal = create<EventModalStore>((set) => ({
  open:    false,
  editId:  null,
  preDate: null,
  show: (o) => set({ open: true, editId: o?.editId ?? null, preDate: o?.date ?? null }),
  hide: ()  => set({ open: false, editId: null, preDate: null }),
}));

// ── Modal de detalhe do evento ────────────────────────────────────────
interface EventDetailStore {
  open:  boolean;
  event: CalendarEvent | null;
  show:  (e: CalendarEvent) => void;
  hide:  () => void;
}

export const useEventDetail = create<EventDetailStore>((set) => ({
  open:  false,
  event: null,
  show:  (e) => set({ open: true, event: e }),
  hide:  ()  => set({ open: false, event: null }),
}));

// ── Modal de follow-up ────────────────────────────────────────────────
interface FollowUpModalStore {
  open:    boolean;
  payload: FollowUpNeededPayload | null;
  queue:   FollowUpNeededPayload[];
  enqueue: (p: FollowUpNeededPayload) => void;
  close:   () => void;
}

export const useFollowUpModal = create<FollowUpModalStore>((set, get) => ({
  open:    false,
  payload: null,
  queue:   [],
  enqueue: (p) => {
    const { open, queue } = get();
    if (!open) set({ open: true, payload: p });
    else       set({ queue: [...queue, p] });
  },
  close: () => {
    const { queue } = get();
    const [next, ...rest] = queue;
    if (next) set({ open: true, payload: next, queue: rest });
    else      set({ open: false, payload: null });
  },
}));

// ── Filtros do calendário ─────────────────────────────────────────────
interface CalendarStore {
  month:        number;
  year:         number;
  filters:      Set<string>;
  setMonth:     (m: number, y: number) => void;
  toggleFilter: (t: string) => void;
  hasFilter:    (t: string) => boolean;
}

const now = new Date();

export const useCalendar = create<CalendarStore>((set, get) => ({
  month:   now.getMonth() + 1,
  year:    now.getFullYear(),
  filters: new Set(['AUDIENCIA', 'REUNIAO', 'PRAZO', 'CONTRATO']),
  setMonth: (m, y) => set({ month: m, year: y }),
  toggleFilter: (t) => {
    const f = new Set(get().filters);
    if (f.has(t)) f.delete(t); else f.add(t);
    set({ filters: f });
  },
  hasFilter: (t) => get().filters.has(t),
}));

// ── Estado do painel TV ───────────────────────────────────────────────
interface TVStore {
  active:      TVCallPayload | null;
  history:     TVCallPayload[];
  speaking:    boolean;
  setCall:     (c: TVCallPayload) => void;
  confirm:     (code: string) => void;
  setSpeaking: (v: boolean) => void;
}

export const useTV = create<TVStore>((set, get) => ({
  active:   null,
  history:  [],
  speaking: false,
  setCall: (c) => set({
    active:  c,
    history: [c, ...get().history].slice(0, 3),
  }),
  confirm:     (code) => { if (get().active?.code === code) set({ active: null }); },
  setSpeaking: (v)    => set({ speaking: v }),
}));