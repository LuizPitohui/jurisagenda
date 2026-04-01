import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import type {
    AuthTokens, User, Event, CalendarEvent,
    FollowUp, EventDocument, PresignedUploadResponse,
    Client, TVQueueState, TVCallRecord, Paginated,
} from '@/types';

const isServer = typeof window === 'undefined';

const BASE = isServer 
    ? `${process.env.BACKEND_URL || 'http://backend:8000'}/api/v1/` 
    : (process.env.NEXT_PUBLIC_API_URL || '/api/v1/');

// ── Helpers de token (sessionStorage → some ao fechar a aba) ─────────
export const setTokens = (a: string, r: string) => {
    if (isServer) return;
    sessionStorage.setItem('access', a);
    sessionStorage.setItem('refresh', r);
};
export const clearTokens = () => {
    if (isServer) return;
    sessionStorage.removeItem('access');
    sessionStorage.removeItem('refresh');
};
export const getAccess  = () => isServer ? null : sessionStorage.getItem('access');
export const getRefresh = () => isServer ? null : sessionStorage.getItem('refresh');

// ── Axios instance ────────────────────────────────────────────────────
export const api: AxiosInstance = axios.create({
    baseURL: BASE,
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
});

// ── Attach JWT token em toda requisição ───────────────────────────────
api.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
    const token = getAccess();
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
    return cfg;
});

// ── Auto-refresh do token ao receber 401 ─────────────────────────────
let refreshing = false;
let queue: Array<(t: string) => void> = [];

api.interceptors.response.use(
    (r) => r,
    async (err: AxiosError) => {
        const orig = err.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (err.response?.status === 401 && !orig._retry) {
            orig._retry = true;
            const rt = getRefresh();

            if (!rt) {
                clearTokens();
                if (!isServer) window.location.href = '/login';
                return Promise.reject(err);
            }

            if (refreshing) {
                return new Promise((res) =>
                    queue.push((t) => {
                        if (orig.headers) orig.headers.Authorization = `Bearer ${t}`;
                        res(api(orig));
                    })
                );
            }

            refreshing = true;
            try {
                const { data } = await axios.post(`${BASE}auth/token/refresh/`, { refresh: rt });
                setTokens(data.access, rt);
                queue.forEach((fn) => fn(data.access));
                queue = [];
                if (orig.headers) orig.headers.Authorization = `Bearer ${data.access}`;
                return api(orig);
            } catch {
                clearTokens();
                if (!isServer) window.location.href = '/login';
                return Promise.reject(err);
            } finally {
                refreshing = false;
            }
        }

        return Promise.reject(err);
    }
);

// ── Auth ──────────────────────────────────────────────────────────────
export const authApi = {
    login: async (email: string, password: string): Promise<AuthTokens> => {
        const { data } = await api.post<AuthTokens>('auth/token/', { email, password });
        setTokens(data.access, data.refresh);
        return data;
    },
    logout: async (refresh: string) => {
        await api.post('auth/logout/', { refresh });
        clearTokens();
    },
    me: async (): Promise<User> => (await api.get<User>('auth/me/')).data,
};

// ── Events ────────────────────────────────────────────────────────────
export const eventsApi = {
    list: async (p?: Record<string, unknown>): Promise<Paginated<Event>> =>
        (await api.get('events/', { params: p })).data,

    calendar: async (month: number, year: number): Promise<CalendarEvent[]> =>
        (await api.get('events/calendar/', { params: { month, year } })).data,

    get: async (id: string): Promise<Event> =>
        (await api.get(`events/${id}/`)).data,

    create: async (payload: Partial<Event>): Promise<Event> =>
        (await api.post('events/', payload)).data,

    update: async (id: string, payload: Partial<Event>): Promise<Event> =>
        (await api.patch(`events/${id}/`, payload)).data,

    delete: async (id: string): Promise<void> => {
        await api.delete(`events/${id}/`);
    },

    tvCall: async (id: string) =>
        (await api.post(`events/${id}/tv-call/`)).data,

    confirmCall: async (id: string) =>
        (await api.post(`events/${id}/confirm-call/`)).data,
};

// ── Follow-ups ────────────────────────────────────────────────────────
export const followupsApi = {
    list: async (): Promise<Paginated<FollowUp>> =>
        (await api.get('followups/')).data,

    get: async (id: string): Promise<FollowUp> =>
        (await api.get(`followups/${id}/`)).data,

    create: async (p: {
        event: string;
        outcome: string;
        notes?: string;
        failure_reason?: string;
    }): Promise<FollowUp> => (await api.post('followups/', p)).data,

    update: async (id: string, p: object): Promise<FollowUp> =>
        (await api.patch(`followups/${id}/`, p)).data,

    reschedule: async (id: string, p: {
        new_start_datetime: string;
        new_end_datetime?: string;
        notes?: string;
    }) => (await api.post(`followups/${id}/reschedule/`, p)).data,
};

// ── Documents ─────────────────────────────────────────────────────────
export const documentsApi = {
    list: async (eventId: string): Promise<EventDocument[]> =>
        (await api.get('documents/', { params: { event_id: eventId } })).data.results,

    requestUpload: async (p: {
        event_id: string;
        file_name: string;
        content_type: string;
        file_size: number;
    }): Promise<PresignedUploadResponse> =>
        (await api.post('documents/presigned-upload/', p)).data,

    uploadToMinio: async (url: string, file: File): Promise<void> => {
        await fetch(url, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': file.type },
        });
    },

    register: async (p: {
        event_id: string;
        file_name: string;
        minio_key: string;
        content_type: string;
        file_size: number;
    }) => (await api.post('documents/register/', p)).data,

    download: async (id: string): Promise<string> => {
        const response = await api.get(`documents/${id}/download/`, { maxRedirects: 0, validateStatus: (s) => s < 400 });
        // O backend retorna 302 com a URL do MinIO no header Location
        return response.request?.responseURL || response.headers?.location || '';
    },

    delete: async (id: string): Promise<void> => {
        await api.delete(`documents/${id}/`);
    },
};

// ── Clients ───────────────────────────────────────────────────────────
export const clientsApi = {
    list: async (search?: string): Promise<Paginated<Client>> =>
        (await api.get('clients/', { params: search ? { search } : {} })).data,

    get: async (id: string): Promise<Client> =>
        (await api.get(`clients/${id}/`)).data,

    create: async (p: Partial<Client> & { consent_given: boolean }): Promise<Client> =>
        (await api.post('clients/', p)).data,

    update: async (id: string, p: Partial<Client>): Promise<Client> =>
        (await api.patch(`clients/${id}/`, p)).data,

    anonymize: async (id: string): Promise<void> => {
        await api.delete(`clients/${id}/anonymize/`);
    },
};

// ── TV ────────────────────────────────────────────────────────────────
export const tvApi = {
    queue: async (): Promise<TVQueueState> =>
        (await api.get('tv/queue/')).data,

    history: async (): Promise<any> =>
        (await api.get('tv/history/')).data,

    clearQueue: async (): Promise<void> => {
        await api.post('tv/clear-queue/');
    },
};

// ── Accounts ──────────────────────────────────────────────────────────
export const accountsApi = {
    list: async (): Promise<Paginated<User>> =>
        (await api.get('auth/users/')).data,

    updateMe: async (p: Partial<User>): Promise<User> =>
        (await api.patch('auth/me/', p)).data,

    create: async (p: any): Promise<User> =>
        (await api.post('auth/users/', p)).data,

    update: async (id: string, p: any): Promise<User> =>
        (await api.patch(`auth/users/${id}/`, p)).data,

    deactivate: async (id: string): Promise<void> => {
        await api.delete(`auth/users/${id}/`);
    },

    changePassword: async (p: { old_password: string; new_password: string; new_password_confirm: string }): Promise<void> => {
        await api.post('auth/me/change-password/', p);
    },
};