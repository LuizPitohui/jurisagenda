// ── Auth ────────────────────────────────────────────────────────────────
export type UserRole = 'ADMIN' | 'LAWYER' | 'SECRETARY' | 'TV_OPERATOR';

export interface User {
    id: string;
    email: string;
    full_name: string;
    oab_number: string;
    role: UserRole;
    phone: string;
    is_active: boolean;
    created_at: string;
}

export interface AuthTokens {
    access: string;
    refresh: string;
    user: {
        id: string;
        email: string;
        full_name: string;
        role: UserRole;
        oab_number: string;
    };
}

// ── Events ──────────────────────────────────────────────────────────────
export type EventType = 'AUDIENCIA' | 'REUNIAO' | 'PRAZO' | 'CONTRATO';
export type EventStatus = 'SCHEDULED' | 'DONE' | 'CANCELLED' | 'RESCHEDULED';
export type TVPriority = 'NORMAL' | 'HIGH';

export interface Event {
    id: string;
    title: string;
    event_type: EventType;
    start_datetime: string;
    end_datetime: string | null;
    location: string;
    video_link: string;
    supplier_name: string;
    due_date: string | null;
    client: string | null;
    client_code: string | null;
    client_name: string | null;
    process_number: string;
    assigned_to: string;
    assigned_to_name: string;
    tv_enabled: boolean;
    tv_priority: TVPriority;
    tv_code: string;
    status: EventStatus;
    notes: string;
    color_tag: string;
    display_color: string;
    is_overdue: boolean;
    needs_followup: boolean;
    created_at: string;
    updated_at: string;
}

export interface CalendarEvent {
    id: string;
    title: string;
    event_type: EventType;
    start_datetime: string;
    end_datetime: string | null;
    tv_enabled: boolean;
    tv_code: string;
    status: EventStatus;
    display_color: string;
    is_overdue: boolean;
    needs_followup: boolean;
    has_followup: boolean;
    assigned_to: string;
}

// ── Follow-up ───────────────────────────────────────────────────────────
export type FollowUpOutcome = 'SUCCESS' | 'FAILURE' | 'POSTPONED';

export interface TimelineEntry {
    ts: string;
    actor: string;
    entry: string;
}

export interface FollowUp {
    id: string;
    event: string;
    event_title: string;
    event_type: EventType;
    event_start: string;
    outcome: FollowUpOutcome;
    notes: string;
    failure_reason: string;
    next_event: string | null;
    next_event_title: string | null;
    timeline_log: TimelineEntry[];
    created_by: string;
    created_by_name: string;
    created_at: string;
    updated_at: string;
}

// ── Documents ───────────────────────────────────────────────────────────
export interface EventDocument {
    id: string;
    event: string;
    file_name: string;
    content_type: string;
    file_size: number;
    file_size_mb: number;
    uploaded_by: string;
    uploaded_by_name: string;
    created_at: string;
}

export interface PresignedUploadResponse {
    upload_url: string;
    minio_key: string;
    document_id: string;
    expires_in: number;
}

// ── Clients ─────────────────────────────────────────────────────────────
export interface Client {
    id: string;
    code: string;
    full_name: string;
    cpf_cnpj: string;
    email: string;
    phone: string;
    notes: string;
    is_active: boolean;
    consent_given: boolean;
    consent_given_at: string | null;
    consent_policy_version: string;
    created_by_name: string;
    created_at: string;
}

// ── TV ──────────────────────────────────────────────────────────────────
export interface TVCallRecord {
    id: string;
    tv_code: string;
    event_type: EventType;
    event_type_label: string;
    call_status: 'CALLED' | 'CONFIRMED' | 'EXPIRED';
    confirmed_at: string | null;
    created_at: string;
}

export interface TVQueueState {
    active: TVCallRecord | null;
    history: TVCallRecord[];
}

// ── WebSocket ───────────────────────────────────────────────────────────
export interface TVCallPayload {
    code: string;
    event_type: EventType;
    event_type_label: string;
    priority: TVPriority;
    tts_text: string;
    timestamp: string;
    event_id: string;
}

export interface FollowUpNeededPayload {
    event_id: string;
    event_title: string;
    event_type: EventType;
    event_type_label: string;
    started_at: string;
    message: string;
}

export type WSMessage =
    | { type: 'tv.init'; payload: { queue: TVCallRecord[] } }
    | { type: 'tv.call'; payload: TVCallPayload }
    | { type: 'tv.confirm'; payload: { code: string; event_id: string; timestamp: string } }
    | { type: 'followup.needed'; payload: FollowUpNeededPayload }
    | { type: 'pong' };

// ── Pagination ──────────────────────────────────────────────────────────
export interface Paginated<T> {
    pagination: {
        count: number;
        total_pages: number;
        current_page: number;
        next: string | null;
        previous: string | null;
    };
    results: T[];
}