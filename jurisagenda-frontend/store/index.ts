import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, CalendarEvent, FollowUpNeededPayload, TVCallPayload } from '@/types';

// ── Auth ──────────────────────────────────────────────────────────────
interface AuthStore {
  user:       User | null;
  isAuth:     boolean;
  avatarUrl:  string | null;
  setUser:    (u: User) => void;
  setAvatar:  (url: string | null) => void;
  clear:      () => void;
}

export const useAuth = create<AuthStore>()(
  persist(
    (set) => ({
      user:      null,
      isAuth:    false,
      avatarUrl: null,
      setUser:   (u) => set({ user: u, isAuth: true }),
      setAvatar: (url) => set({ avatarUrl: url }),
      clear:     ()  => set({ user: null, isAuth: false, avatarUrl: null }),
    }),
    {
      name: 'juris-auth',
      partialize: (s) => ({ user: s.user, isAuth: s.isAuth, avatarUrl: s.avatarUrl }),
      // Limpa avatarUrl se apontar para hostname interno do Docker
      merge: (persisted: any, current) => {
        const url = persisted?.avatarUrl ?? null;
        const isInternal = url && (url.includes('minio:9000') || url.includes('minio:'));
        return { ...current, ...persisted, avatarUrl: isInternal ? null : url };
      },
    }
  )
);

// ── Tema ──────────────────────────────────────────────────────────────
interface ThemeStore {
  dark: boolean;
  toggle: () => void;
}

export const useTheme = create<ThemeStore>()(
  persist(
    (set, get) => ({
      dark: false,
      toggle: () => {
        const next = !get().dark;
        set({ dark: next });
        document.documentElement.classList.toggle('dark', next);
      },
    }),
    { name: 'juris-theme' }
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
  month:          number;
  year:           number;
  filters:        Set<string>;
  assignedFilter: string | null;
  setMonth:       (m: number, y: number) => void;
  toggleFilter:   (t: string) => void;
  hasFilter:      (t: string) => boolean;
  setAssigned:    (id: string | null) => void;
}

const now = new Date();

export const useCalendar = create<CalendarStore>((set, get) => ({
  month:          now.getMonth() + 1,
  year:           now.getFullYear(),
  filters:        new Set(['AUDIENCIA', 'REUNIAO', 'PRAZO', 'CONTRATO']),
  assignedFilter: null,
  setMonth: (m, y) => set({ month: m, year: y }),
  toggleFilter: (t) => {
    const f = new Set(get().filters);
    if (f.has(t)) f.delete(t); else f.add(t);
    set({ filters: f });
  },
  hasFilter:   (t) => get().filters.has(t),
  setAssigned: (id) => set({ assignedFilter: id }),
}));

// ── Estado do painel TV ───────────────────────────────────────────────
interface TVStore {
  active:      TVCallPayload | null;
  history:     TVCallPayload[];
  speaking:    boolean;
  setCall:     (c: TVCallPayload) => void;
  confirm:     (code: string) => void;
  setSpeaking: (v: boolean) => void;
  setHistory:  (h: TVCallPayload[]) => void;
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
  setHistory:  (h)    => set({ history: h.slice(0, 3) }),
}));